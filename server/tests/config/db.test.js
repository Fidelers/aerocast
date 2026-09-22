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

    it('должен открывать соединение и создавать таблицы api_cache и air_quality_history', async () => {
        const db = await dbConfig.getDB();
        expect(db).toBeDefined();

        // Проверяем существование таблиц через sqlite_master
        const tables = await db.all(
            "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('api_cache', 'air_quality_history')"
        );
        const tableNames = tables.map(t => t.name);
        expect(tableNames).toContain('api_cache');
        expect(tableNames).toContain('air_quality_history');
    });

    it('должен возвращать один и тот же промис/экземпляр базы при повторных вызовах getDB()', async () => {
        const db1 = await dbConfig.getDB();
        const db2 = await dbConfig.getDB();
        expect(db1).toBe(db2);
    });

    it('должен поддерживать initDB() как инициализатор базы', async () => {
        const db = await dbConfig.initDB();
        expect(db).toBeDefined();
    });

    it('должен закрывать соединение через closeDB() и сбрасывать dbPromise', async () => {
        const db1 = await dbConfig.getDB();
        expect(db1).toBeDefined();

        await dbConfig.closeDB();
        // Новый вызов getDB после closeDB должен открывать новое соединение
        const db2 = await dbConfig.getDB();
        expect(db2).toBeDefined();
    });

    it('должен не допускать дубликатов в air_quality_history благодаря UNIQUE(latitude, longitude, timestamp)', async () => {
        const db = await dbConfig.getDB();

        await db.run(
            'INSERT INTO air_quality_history (latitude, longitude, timestamp, pollutant_data, source) VALUES (?, ?, ?, ?, ?)',
            [55.75, 37.61, 1789862400000, '{"pm10": 10}', 'open-meteo']
        );

        // Повторная вставка с теми же координатами и меткой через INSERT OR IGNORE должна игнорироваться
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

    it('должен использовать дефолтный путь к cache.db при отсутствии переменной DB_PATH', async () => {
        delete process.env.DB_PATH;
        jest.resetModules();
        const sqlite = require('sqlite');
        const mockInstance = {
            exec: jest.fn().mockResolvedValue(),
            close: jest.fn().mockResolvedValue()
        };
        const openSpy = jest.spyOn(sqlite, 'open').mockResolvedValueOnce(mockInstance);
        const freshDbConfig = require('../../config/db');

        await freshDbConfig.getDB();
        expect(openSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                filename: expect.stringMatching(/[\\/]cache\.db$/)
            })
        );
        await freshDbConfig.closeDB();
        openSpy.mockRestore();
    });

    it('должен корректно завершаться при closeDB, если соединение не открывалось', async () => {
        await expect(dbConfig.closeDB()).resolves.toBeUndefined();
    });

    it('должен сбрасывать dbPromise в null и пробрасывать ошибку при сбое соединения или миграции', async () => {
        jest.resetModules();
        const sqlite = require('sqlite');
        const openSpy = jest.spyOn(sqlite, 'open').mockRejectedValueOnce(new Error('Connection failure'));
        const freshDbConfig = require('../../config/db');
        await expect(freshDbConfig.getDB()).rejects.toThrow('Connection failure');
        openSpy.mockRestore();
    });
});
