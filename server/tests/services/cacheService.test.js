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
        it('должен удалять конкретный ключ, если он передан, и возвращать число удалённых записей', async () => {
            mockDb.run.mockResolvedValue({ changes: 1 });
            const count = await cacheService.clear('some_key');
            expect(mockDb.run).toHaveBeenCalledWith(
                'DELETE FROM api_cache WHERE key = ?',
                ['some_key']
            );
            expect(count).toBe(1);
        });

        it('должен очищать всю таблицу, если ключ не передан, и возвращать число удалённых записей', async () => {
            mockDb.run.mockResolvedValue({ changes: 5 });
            const count = await cacheService.clear();
            expect(mockDb.run).toHaveBeenCalledWith('DELETE FROM api_cache');
            expect(count).toBe(5);
        });

        it('должен возвращать 0 при очистке, если результат db.run пуст', async () => {
            mockDb.run.mockResolvedValue(null);
            expect(await cacheService.clear()).toBe(0);
            expect(await cacheService.clear('some_key')).toBe(0);
        });
    });

    describe('In-memory fallback (деградация во in-memory Map при отказе БД)', () => {
        beforeEach(() => {
            // Имитируем недоступность базы данных
            dbConfig.getDB.mockReturnValue(null);
        });

        it('должен сохранять и извлекать данные из памяти при недоступности БД', async () => {
            const key = 'in_mem_key';
            const data = { temp: 15 };

            await cacheService.setCache(key, data, 3600);
            const cached = await cacheService.getCache(key);

            expect(cached).toEqual(data);
        });

        it('должен возвращать null для просроченной записи из памяти при ignoreTTL = false', async () => {
            const key = 'in_mem_expired';
            const data = { temp: 18 };

            await cacheService.setCache(key, data, 10); // 10 секунд
            jest.advanceTimersByTime(11000); // Проматываем 11 секунд

            const cached = await cacheService.getCache(key, false);
            expect(cached).toBeNull();
        });

        it('должен возвращать просроченную запись из памяти при ignoreTTL = true (офлайн-резерв)', async () => {
            const key = 'in_mem_stale';
            const data = { temp: 22 };

            await cacheService.setCache(key, data, 10);
            jest.advanceTimersByTime(11000);

            const cached = await cacheService.getCache(key, true);
            expect(cached).toEqual(data);
        });

        it('должен корректно считать getCacheStats в режиме памяти', async () => {
            await cacheService.setCache('valid_1', { a: 1 }, 3600);
            await cacheService.setCache('valid_2', { b: 2 }, 3600);
            await cacheService.setCache('exp_1', { c: 3 }, 5);
            jest.advanceTimersByTime(10000);

            const stats = await cacheService.getCacheStats();
            expect(stats.expired).toBeGreaterThanOrEqual(1);
            expect(stats.entries).toBeGreaterThanOrEqual(3);
        });

        it('должен удалять конкретный ключ и очищать память через clear()', async () => {
            await cacheService.setCache('to_delete', { x: 1 }, 3600);
            const deletedCount = await cacheService.clear('to_delete');
            expect(deletedCount).toBe(1);

            const check = await cacheService.getCache('to_delete');
            expect(check).toBeNull();

            await cacheService.setCache('rem_1', { x: 2 }, 3600);
            await cacheService.setCache('rem_2', { x: 3 }, 3600);
            const totalCleared = await cacheService.clear();
            expect(totalCleared).toBeGreaterThanOrEqual(2);
        });

        it('должен возвращать 0 при удалении несуществующего ключа из памяти', async () => {
            const count = await cacheService.clear('non_existent_key_12345');
            expect(count).toBe(0);
        });

        it('должен переходить в in-memory режим при исключении в getDB()', async () => {
            dbConfig.getDB.mockRejectedValue(new Error('connection failed'));
            await cacheService.setCache('err_key', { status: 'ok' }, 3600);
            const res = await cacheService.getCache('err_key');
            expect(res).toEqual({ status: 'ok' });
        });
    });
});