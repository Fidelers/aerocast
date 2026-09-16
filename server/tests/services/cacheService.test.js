// tests/services/cacheService.test.js — тесты кэширования
const cacheService = require('../../services/cacheService');
const dbConfig = require('../../config/db');

// Мокаем модуль базы данных
jest.mock('../../config/db', () => ({
    getDB: jest.fn()
}));

describe('Service: cacheService', () => {
    let mockDb;

    beforeEach(() => {
        // Подготавливаем мок БД с методами get и run
        mockDb = {
            get: jest.fn(),
            run: jest.fn()
        };
        dbConfig.getDB.mockReturnValue(mockDb);
        jest.useFakeTimers().setSystemTime(new Date('2026-09-16T12:00:00Z')); // Фиксируем время
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    describe('getCache()', () => {
        const key = 'air_open-meteo_55.75_37.61';
        const fakeData = { temp: 20 };
        const fakeDataString = JSON.stringify(fakeData);

        it('должен возвращать распарсенные данные, если запись валидна (Cache Hit)', async () => {
            // Имитируем, что запись в БД есть и срок expires_at в будущем
            mockDb.get.mockResolvedValue({
                data: fakeDataString,
                expires_at: Date.now() + 10000
            });

            const result = await cacheService.getCache(key);

            expect(mockDb.get).toHaveBeenCalledWith(
                'SELECT data, expires_at FROM api_cache WHERE key = ?',
                [key]
            );
            expect(result).toEqual(fakeData);
        });

        it('должен возвращать null, если записи нет (Cache Miss)', async () => {
            mockDb.get.mockResolvedValue(undefined);

            const result = await cacheService.getCache(key);
            expect(result).toBeNull();
        });

        it('должен возвращать null, если запись просрочена и ignoreTTL = false', async () => {
            // Срок истек
            mockDb.get.mockResolvedValue({
                data: fakeDataString,
                expires_at: Date.now() - 10000
            });

            const result = await cacheService.getCache(key, false);
            expect(result).toBeNull();
        });

        it('должен возвращать данные, если запись просрочена, но ignoreTTL = true (Офлайн-резерв)', async () => {
            mockDb.get.mockResolvedValue({
                data: fakeDataString,
                expires_at: Date.now() - 10000
            });

            const result = await cacheService.getCache(key, true);
            expect(result).toEqual(fakeData);
        });
    });

    describe('setCache()', () => {
        it('должен записывать данные в БД и удалять старые записи (старше 7 суток)', async () => {
            const key = 'search_москва';
            const data = { lat: 55, lon: 37 };
            const ttlSeconds = 86400; // 24 часа

            await cacheService.setCache(key, data, ttlSeconds);

            const expectedExpiresAt = Date.now() + ttlSeconds * 1000;
            const expectedUpdatedAt = Date.now();
            const expectedOldDateLimit = Date.now() - 7 * 24 * 60 * 60 * 1000;

            // Проверка INSERT OR REPLACE
            expect(mockDb.run).toHaveBeenNthCalledWith(1,
                'INSERT OR REPLACE INTO api_cache (key, data, expires_at, updated_at) VALUES (?, ?, ?, ?)',
                [key, JSON.stringify(data), expectedExpiresAt, expectedUpdatedAt]
            );

            // Проверка очистки старья
            expect(mockDb.run).toHaveBeenNthCalledWith(2,
                'DELETE FROM api_cache WHERE updated_at < ?',
                [expectedOldDateLimit]
            );
        });
    });

    describe('getCacheStats()', () => {
        it('должен возвращать статистику кэша', async () => {
            mockDb.get.mockResolvedValueOnce({ count: 12 }); // Для entries
            mockDb.get.mockResolvedValueOnce({ count: 3 });  // Для expired

            const stats = await cacheService.getCacheStats();

            expect(stats).toEqual({ entries: 12, expired: 3 });
            expect(mockDb.get).toHaveBeenCalledTimes(2);
        });
    });

    describe('clear()', () => {
        it('должен удалять конкретный ключ, если он передан', async () => {
            await cacheService.clear('some_key');
            expect(mockDb.run).toHaveBeenCalledWith(
                'DELETE FROM api_cache WHERE key = ?',
                ['some_key']
            );
        });

        it('должен очищать всю таблицу, если ключ не передан', async () => {
            await cacheService.clear();
            expect(mockDb.run).toHaveBeenCalledWith('DELETE FROM api_cache');
        });
    });
});