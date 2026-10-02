// tests/config/db.test.js — тесты конфигурации и миграции базы данных SQLite

describe('Config: db', () => {
    let dbConfig;
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv, DB_PATH: ':memory:' };
        dbConfig = require('../../config/db');
    });

    afterEach(async () => {
        await dbConfig.closeDB();
        process.env = originalEnv;
    });

    it('initDB открывает рабочую БД и создаёт таблицы api_cache и air_quality_history', async () => {
        const db = await dbConfig.initDB();
        expect(db).toBeTruthy();

        const tables = await db.all(
            "SELECT name FROM sqlite_master WHERE type='table'"
        );
        const names = tables.map(t => t.name);

        expect(names).toEqual(
            expect.arrayContaining(['api_cache', 'air_quality_history'])
        );
    });

    it('getDB() возвращает один и тот же экземпляр при повторных вызовах', async () => {
        const db1 = await dbConfig.getDB();
        const db2 = await dbConfig.getDB();
        expect(db1).toBe(db2);
    });


    it('closeDB закрывает соединение и сбрасывает dbPromise', async () => {
        const db1 = await dbConfig.getDB();
        const closeSpy = jest.spyOn(db1, 'close');

        try {
            await dbConfig.closeDB();
            expect(closeSpy).toHaveBeenCalledTimes(1);

            const db2 = await dbConfig.getDB();
            expect(db2).not.toBe(db1);
        } finally {
            closeSpy.mockRestore();
        }
    });

    it('closeDB корректно завершается, если соединение не открывалось', async () => {
        await expect(dbConfig.closeDB()).resolves.toBeUndefined();
    });

    it('при сбое соединения dbPromise сбрасывается и следующий вызов пробует снова', async () => {
        jest.resetModules();
        const sqlite = require('sqlite');
        const openSpy = jest
            .spyOn(sqlite, 'open')
            .mockRejectedValue(new Error('Connection failure'));
        const freshDbConfig = require('../../config/db');

        try {
            await expect(freshDbConfig.getDB()).rejects.toThrow('Connection failure');
            await expect(freshDbConfig.getDB()).rejects.toThrow('Connection failure');
            expect(openSpy).toHaveBeenCalledTimes(2);
        } finally {
            openSpy.mockRestore();
        }
    });

    it('air_quality_history не допускает дубликатов по (latitude, longitude, timestamp)', async () => {
        const db = await dbConfig.getDB();

        await db.run(
            'INSERT INTO air_quality_history (latitude, longitude, timestamp, pollutant_data, source) VALUES (?, ?, ?, ?, ?)',
            [55.75, 37.61, 1789862400000, '{"pm10": 10}', 'open-meteo']
        );

        await db.run(
            'INSERT OR IGNORE INTO air_quality_history (latitude, longitude, timestamp, pollutant_data, source) VALUES (?, ?, ?, ?, ?)',
            [55.75, 37.61, 1789862400000, '{"pm10": 99}', 'open-weather-map']
        );

        const rows = await db.all(
            'SELECT * FROM air_quality_history WHERE latitude = ? AND longitude = ? AND timestamp = ?',
            [55.75, 37.61, 1789862400000]
        );

        expect(rows).toHaveLength(1);
        expect(JSON.parse(rows[0].pollutant_data)).toEqual({ pm10: 10 });
    });

    it('использует дефолтный путь cache.db, когда DB_PATH не задан', async () => {
        delete process.env.DB_PATH;
        jest.resetModules();

        const sqlite = require('sqlite');
        const mockInstance = {
            exec: jest.fn().mockResolvedValue(),
            close: jest.fn().mockResolvedValue()
        };
        const openSpy = jest
            .spyOn(sqlite, 'open')
            .mockResolvedValueOnce(mockInstance);
        const freshDbConfig = require('../../config/db');

        try {
            await freshDbConfig.getDB();
            expect(openSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    filename: expect.stringMatching(/[\\/]cache\.db$/)
                })
            );
        } finally {
            await freshDbConfig.closeDB();
            openSpy.mockRestore();
        }
    });

    it('создаёт директорию для базы данных, если её нет', async () => {
        jest.resetModules();

        const fs = require('fs');
        const sqlite = require('sqlite');
        const mockInstance = {
            exec: jest.fn().mockResolvedValue(),
            close: jest.fn().mockResolvedValue()
        };

        const openSpy = jest
            .spyOn(sqlite, 'open')
            .mockResolvedValueOnce(mockInstance);
        const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
        const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);

        process.env.DB_PATH = 'non_existent_dir/custom.db';
        const freshDbConfig = require('../../config/db');

        try {
            await freshDbConfig.getDB();

            expect(existsSpy).toHaveBeenCalled();
            expect(mkdirSpy).toHaveBeenCalledWith(
                expect.stringContaining('non_existent_dir'),
                { recursive: true }
            );
        } finally {
            await freshDbConfig.closeDB();
            openSpy.mockRestore();
            existsSpy.mockRestore();
            mkdirSpy.mockRestore();
        }
    });
});