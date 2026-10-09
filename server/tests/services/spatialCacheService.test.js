const spatialCacheService = require('../../services/spatialCacheService');
const dbConfig = require('../../config/db');

// Мокаем модуль базы данных SQLite
jest.mock('../../config/db', () => ({
    getDB: jest.fn()
}));

describe('Service: spatialCacheService (Пространственное кэширование в SQLite)', () => {
    let mockDb;

    beforeEach(() => {
        mockDb = {
            get: jest.fn(),
            run: jest.fn()
        };
        dbConfig.getDB.mockReturnValue(mockDb);
        // Фиксируем системное время для стабильности проверки TTL
        jest.useFakeTimers().setSystemTime(new Date('2026-10-09T12:00:00Z'));
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    describe('1. quantizeCoordinates(lat, lon, step)', () => {
        it('квантует координаты к ближайшему шагу 0.2° по умолчанию и формирует cacheKey', () => {
            // 53.7596 -> 53.80, 87.1467 -> 87.20 (Math.round(x / 0.2) * 0.2)
            const result = spatialCacheService.quantizeCoordinates(53.7596, 87.1467);

            expect(result).toHaveProperty('qLat');
            expect(result).toHaveProperty('qLon');
            expect(result).toHaveProperty('cacheKey');

            expect(result.qLat).toBe('53.80');
            expect(result.qLon).toBe('87.20');
            expect(result.cacheKey).toBe('grid_micro_53.80_87.20');
        });

        it('корректно работает с кастомным шагом квантования (например, 0.1° и 0.5°)', () => {
            const step01 = spatialCacheService.quantizeCoordinates(55.7512, 37.6184, 0.1);
            expect(step01.qLat).toBe('55.80');
            expect(step01.qLon).toBe('37.60');
            expect(step01.cacheKey).toBe('grid_micro_55.80_37.60');

            const step05 = spatialCacheService.quantizeCoordinates(55.7512, 37.6184, 0.5);
            expect(step05.qLat).toBe('56.00');
            expect(step05.qLon).toBe('37.50');
            expect(step05.cacheKey).toBe('grid_micro_56.00_37.50');
        });

        it('корректно квантует отрицательные географические координаты', () => {
            // Сидней: -33.8688, 151.2093
            const result = spatialCacheService.quantizeCoordinates(-33.8688, 151.2093, 0.2);
            expect(result.qLat).toBe('-33.80');
            expect(result.qLon).toBe('151.20');
            expect(result.cacheKey).toBe('grid_micro_-33.80_151.20');
        });

        it('выбрасывает ошибку при отсутствии координат или некорректных типах', () => {
            expect(() => spatialCacheService.quantizeCoordinates(null, 37.61)).toThrow();
            expect(() => spatialCacheService.quantizeCoordinates(55.75, undefined)).toThrow();
            expect(() => spatialCacheService.quantizeCoordinates('invalid', 37.61)).toThrow();
            expect(() => spatialCacheService.quantizeCoordinates(NaN, 37.61)).toThrow();
        });

        it('выбрасывает ошибку при выходе координат за пределы допустимого диапазона (-90..90, -180..180)', () => {
            expect(() => spatialCacheService.quantizeCoordinates(95.0, 37.61)).toThrow();
            expect(() => spatialCacheService.quantizeCoordinates(-91.0, 37.61)).toThrow();
            expect(() => spatialCacheService.quantizeCoordinates(55.75, 185.0)).toThrow();
            expect(() => spatialCacheService.quantizeCoordinates(55.75, -181.0)).toThrow();
        });
    });

    describe('2. getSpatialCache(cacheKey, ignoreTTL)', () => {
        const key = 'grid_micro_53.80_87.20';
        const sampleGridData = {
            type: 'micro',
            bbox: [86.85, 53.45, 87.45, 54.05],
            points_count: 25,
            points: [{ lat: 53.55, lon: 86.95, european_aqi: [25, 26] }]
        };
        const sampleGridJson = JSON.stringify(sampleGridData);

        it('возвращает распарсенный объект сетки при попадании в кэш (Cache Hit)', async () => {
            mockDb.get.mockResolvedValue({
                data: sampleGridJson,
                expires_at: Date.now() + 3600 * 1000
            });

            const result = await spatialCacheService.getSpatialCache(key);

            expect(mockDb.get).toHaveBeenCalledWith(
                'SELECT data, expires_at FROM api_cache WHERE key = ?',
                [key]
            );
            expect(result).toEqual(sampleGridData);
        });

        it('возвращает null при промахе кэша (Cache Miss)', async () => {
            mockDb.get.mockResolvedValue(undefined);

            const result = await spatialCacheService.getSpatialCache(key);

            expect(result).toBeNull();
        });

        it('возвращает null, если запись в кэше просрочена и ignoreTTL = false', async () => {
            mockDb.get.mockResolvedValue({
                data: sampleGridJson,
                expires_at: Date.now() - 1000 // Срок истек 1 секунду назад
            });

            const result = await spatialCacheService.getSpatialCache(key, false);

            expect(result).toBeNull();
        });

        it('возвращает данные даже при просроченном TTL, если ignoreTTL = true (Офлайн-резерв)', async () => {
            mockDb.get.mockResolvedValue({
                data: sampleGridJson,
                expires_at: Date.now() - 50000 // Давно просрочен
            });

            const result = await spatialCacheService.getSpatialCache(key, true);

            expect(result).toEqual(sampleGridData);
        });

        it('возвращает null и не падает, если JSON в базе поврежден', async () => {
            mockDb.get.mockResolvedValue({
                data: 'corrupted-non-json-data{{{',
                expires_at: Date.now() + 3600 * 1000
            });

            const result = await spatialCacheService.getSpatialCache(key);
            expect(result).toBeNull();
        });
    });

    describe('3. setSpatialCache(cacheKey, gridData, ttlSeconds)', () => {
        const key = 'grid_macro_russia';
        const sampleGridData = {
            type: 'macro',
            points_count: 85,
            points: [{ lat: 55.75, lon: 37.61, european_aqi: [18, 19] }]
        };

        it('записывает сериализованную сетку в api_cache с TTL по умолчанию 3600 секунд (1 час)', async () => {
            await spatialCacheService.setSpatialCache(key, sampleGridData);

            const expectedExpiresAt = Date.now() + 3600 * 1000;
            const expectedUpdatedAt = Date.now();
            const expected7DaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

            expect(mockDb.run).toHaveBeenNthCalledWith(1,
                'INSERT OR REPLACE INTO api_cache (key, data, expires_at, updated_at) VALUES (?, ?, ?, ?)',
                [key, JSON.stringify(sampleGridData), expectedExpiresAt, expectedUpdatedAt]
            );

            // Очистка записей старше 7 суток
            expect(mockDb.run).toHaveBeenNthCalledWith(2,
                expect.stringContaining('DELETE FROM api_cache WHERE updated_at < ?'),
                expect.arrayContaining([expected7DaysAgo])
            );
        });

        it('учитывает переданный кастомный ttlSeconds', async () => {
            const customTTL = 7200; // 2 часа
            await spatialCacheService.setSpatialCache(key, sampleGridData, customTTL);

            const expectedExpiresAt = Date.now() + 7200 * 1000;

            expect(mockDb.run).toHaveBeenNthCalledWith(1,
                'INSERT OR REPLACE INTO api_cache (key, data, expires_at, updated_at) VALUES (?, ?, ?, ?)',
                [key, JSON.stringify(sampleGridData), expectedExpiresAt, Date.now()]
            );
        });
    });

    describe('4. clearSpatialCache(pattern)', () => {
        it('удаляет записи пространственных сеток по заданному паттерну (по умолчанию grid_%)', async () => {
            mockDb.run.mockResolvedValue({ changes: 14 });

            const count = await spatialCacheService.clearSpatialCache();

            expect(mockDb.run).toHaveBeenCalledWith(
                'DELETE FROM api_cache WHERE key LIKE ?',
                ['grid_%']
            );
            expect(count).toBe(14);
        });

        it('поддерживает кастомный паттерн (например, grid_micro_%)', async () => {
            mockDb.run.mockResolvedValue({ changes: 8 });

            const count = await spatialCacheService.clearSpatialCache('grid_micro_%');

            expect(mockDb.run).toHaveBeenCalledWith(
                'DELETE FROM api_cache WHERE key LIKE ?',
                ['grid_micro_%']
            );
            expect(count).toBe(8);
        });

        it('возвращает 0, если результат run пуст или changes = 0', async () => {
            mockDb.run.mockResolvedValue(null);
            expect(await spatialCacheService.clearSpatialCache()).toBe(0);
        });
    });

    describe('5. In-memory fallback (Отказоустойчивость при недоступности SQLite)', () => {
        beforeEach(() => {
            // Имитируем падение / недоступность базы данных
            dbConfig.getDB.mockReturnValue(null);
        });

        it('сохраняет и извлекает сетку из оперативной памяти, если база данных недоступна', async () => {
            const key = 'grid_in_memory_1';
            const data = { type: 'micro', points_count: 25 };

            await spatialCacheService.setSpatialCache(key, data, 3600);
            const cached = await spatialCacheService.getSpatialCache(key);

            expect(cached).toEqual(data);
        });

        it('возвращает null для просроченной записи из памяти при ignoreTTL = false', async () => {
            const key = 'grid_in_mem_exp';
            const data = { type: 'micro', points_count: 25 };

            await spatialCacheService.setSpatialCache(key, data, 10);
            jest.advanceTimersByTime(11000); // 11 секунд вперед

            const cached = await spatialCacheService.getSpatialCache(key, false);
            expect(cached).toBeNull();
        });

        it('возвращает просроченную запись из памяти при ignoreTTL = true (офлайн-резерв)', async () => {
            const key = 'grid_in_mem_stale';
            const data = { type: 'micro', points_count: 25 };

            await spatialCacheService.setSpatialCache(key, data, 10);
            jest.advanceTimersByTime(11000);

            const cached = await spatialCacheService.getSpatialCache(key, true);
            expect(cached).toEqual(data);
        });

        it('очищает записи в памяти через clearSpatialCache', async () => {
            await spatialCacheService.setSpatialCache('grid_to_del_1', { a: 1 }, 3600);
            await spatialCacheService.setSpatialCache('grid_to_del_2', { b: 2 }, 3600);

            const count = await spatialCacheService.clearSpatialCache('grid_%');
            expect(count).toBeGreaterThanOrEqual(2);

            const check = await spatialCacheService.getSpatialCache('grid_to_del_1');
            expect(check).toBeNull();
        });

        it('плавно деградирует во in-memory режим, если getDB() выбрасывает исключение', async () => {
            dbConfig.getDB.mockImplementation(() => {
                throw new Error('SQLite disk I/O error');
            });

            const key = 'grid_io_error_key';
            const data = { type: 'macro', points_count: 85 };

            await spatialCacheService.setSpatialCache(key, data, 3600);
            const res = await spatialCacheService.getSpatialCache(key);
            expect(res).toEqual(data);
        });
    });
});
