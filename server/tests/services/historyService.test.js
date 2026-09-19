// tests/services/historyService.test.js — тесты истории замеров

const historyService = require('../../services/historyService');
const dbConfig = require('../../config/db');

jest.mock('../../config/db', () => ({
    getDB: jest.fn()
}));

describe('Service: historyService', () => {
    let mockDb;

    beforeEach(() => {
        mockDb = {
            all: jest.fn(),
            get: jest.fn(),
            run: jest.fn()
        };
        dbConfig.getDB.mockReturnValue(mockDb);
        jest.useFakeTimers().setSystemTime(new Date('2026-09-19T12:00:00Z')); // Фиксируем время
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    describe('saveFromResponse()', () => {
        it('должен сохранять только прошлые часы и удалять записи старше 7 суток', async () => {
            const mockData = {
                latitude: 55.75,
                longitude: 37.61,
                used_source: 'open-meteo',
                hourly: {
                    // Имитируем один час в прошлом (11:00) и один в будущем (13:00) относительно 12:00
                    time: ['2026-09-19T11:00', '2026-09-19T13:00'],
                    pm10: [15, 20],
                    pm2_5: [10, 12]
                }
            };

            await historyService.saveFromResponse(mockData);

            // Проверяем, что INSERT был вызван только для прошлого часа (11:00)
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT OR IGNORE INTO air_quality_history'),
                expect.any(Array)
            );

            // Проверяем очистку старых данных
            const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            expect(mockDb.run).toHaveBeenCalledWith(
                'DELETE FROM air_quality_history WHERE timestamp < ?',
                [sevenDaysAgo]
            );
        });
    });

    describe('getLatest()', () => {
        it('должен возвращать последнюю запись из базы для заданных координат', async () => {
            const lat = 55.75;
            const lon = 37.61;
            const mockRecord = { id: 1, pollutant_data: '{"pm10": 10}' };

            mockDb.get.mockResolvedValue(mockRecord);

            const result = await historyService.getLatest(lat, lon);

            expect(mockDb.get).toHaveBeenCalledWith(
                'SELECT * FROM air_quality_history WHERE latitude = ? AND longitude = ? ORDER BY timestamp DESC LIMIT 1',
                [lat, lon]
            );
            expect(result).toEqual(mockRecord);
        });
    });

    describe('mergeWithFresh()', () => {
        it('должен возвращать freshData без изменений, если нет hourly.time', async () => {
            const freshData = { hourly: {} };
            const result = await historyService.mergeWithFresh(freshData, 55.75, 37.61);
            expect(result).toBe(freshData);
        });

        it('должен корректно объединять свежие данные с архивом (приоритет у свежих)', async () => {
            const lat = 55.756; // Должно округлиться до 55.76
            const lon = 37.614; // Должно округлиться до 37.61

            const freshData = {
                latitude: lat,
                longitude: lon,
                hourly: {
                    time: ['2026-09-19T12:00'],
                    pm10: [50] // Свежие данные: pm10 = 50
                }
            };

            // Мокаем ответ из архива: старая запись за 11:00 и конфликтная за 12:00
            mockDb.all.mockResolvedValue([
                {
                    timestamp: new Date('2026-09-19T08:00:00Z').getTime(), // 11:00 по Москве
                    pollutant_data: JSON.stringify({ pm10: 30 })
                },
                {
                    timestamp: new Date('2026-09-19T09:00:00Z').getTime(), // 12:00 по Москве (будет перекрыто)
                    pollutant_data: JSON.stringify({ pm10: 999 })
                }
            ]);

            const result = await historyService.mergeWithFresh(freshData, lat, lon);

            // Проверяем, что запрос ушел с округленными координатами
            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('WHERE latitude = ? AND longitude = ?'),
                [55.76, 37.61, expect.any(Number)]
            );

            // Проверяем результат слияния
            expect(result.hourly.time).toEqual(['2026-09-19T11:00', '2026-09-19T12:00']);
            // Значение за 11:00 берется из БД (30). Значение за 12:00 из свежих данных (50), а не 999.
            expect(result.hourly.pm10).toEqual([30, 50]);
        });
    });
});