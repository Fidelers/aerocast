const spatialCacheService = require('../../services/spatialCacheService');
const dbConfig = require('../../config/db');
const timeUtils = require('../../services/timeUtils');

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

        it('офлайн-резерв (ignoreTTL=true): если записи нет в SQLite, читает из in-memory кэша процесса', async () => {
            // Прод-сценарий: запись в БД не удалась/строки нет, TTL истёк, а Open-Meteo лежит —
            // макросетка всё равно должна отдаваться из памяти процесса, а не превращаться в 500
            const offlineKey = 'grid_offline_mem_fallback';
            const offlineData = { type: 'macro', points: [{ lat: 55.75, lon: 37.61, european_aqi: [20] }] };

            dbConfig.getDB.mockReturnValue(Promise.resolve(mockDb)); // как в проде
            mockDb.run.mockResolvedValue({ changes: 1 });
            await spatialCacheService.setSpatialCache(offlineKey, offlineData, 10);

            mockDb.get.mockResolvedValue(undefined); // строки в БД нет
            jest.advanceTimersByTime(11 * 1000); // TTL истёк

            // Обычное чтение — промах по БД (БД источник истины)
            expect(await spatialCacheService.getSpatialCache(offlineKey, false)).toBeNull();
            // Офлайн-резерв — отдаёт данные из памяти несмотря на истёкший TTL
            expect(await spatialCacheService.getSpatialCache(offlineKey, true)).toEqual(offlineData);
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

        it('пишет в SQLite, когда getDB() возвращает Promise (как в проде) — кэш переживает перезапуск сервера', async () => {
            // В проде getDB() — async-функция: без await обращение к db.run/db.get падало,
            // ошибка молча глоталась, и запись терялась (после рестарта в cache.db пусто)
            dbConfig.getDB.mockReturnValue(Promise.resolve(mockDb));
            mockDb.run.mockResolvedValue({ changes: 1 });

            await spatialCacheService.setSpatialCache(key, sampleGridData, 86400);

            expect(mockDb.run).toHaveBeenNthCalledWith(1,
                'INSERT OR REPLACE INTO api_cache (key, data, expires_at, updated_at) VALUES (?, ?, ?, ?)',
                [key, JSON.stringify(sampleGridData), expect.any(Number), expect.any(Number)]
            );

            // Чтение также работает через Promise-соединение
            mockDb.get.mockResolvedValue({
                data: JSON.stringify(sampleGridData),
                expires_at: Date.now() + 86400 * 1000,
                updated_at: Date.now()
            });

            const result = await spatialCacheService.getSpatialCache(key);
            expect(result).toEqual(sampleGridData);

            const entry = await spatialCacheService.getSpatialCacheEntry(key);
            expect(entry).not.toBeNull();
            expect(entry.data).toEqual(sampleGridData);
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

    describe('6. Кеширование макросетки на текущий день (getTodayMacroGrid & isMacroGridSavedToday)', () => {
        const key = 'grid_macro_russia';
        const sampleMacro = {
            type: 'macro',
            points_count: 550,
            points: [{ lat: 55.75, lon: 37.61, european_aqi: [20] }]
        };

        it('возвращает сетку, если она была сохранена сегодня (в этот день)', async () => {
            // Текущее зафиксированное время в тестах: '2026-10-09T12:00:00Z' (15:00 по Москве)
            mockDb.get.mockResolvedValue({
                data: JSON.stringify({ ...sampleMacro, cached_date: '2026-10-09' }),
                expires_at: Date.now() + 86400 * 1000,
                updated_at: Date.now()
            });

            const result = await spatialCacheService.getTodayMacroGrid(key);
            expect(result).not.toBeNull();
            expect(result.type).toBe('macro');

            const isSaved = await spatialCacheService.isMacroGridSavedToday(key);
            expect(isSaved).toBe(true);
        });

        it('TTL ещё валиден, но сетка загружена вчера (покрывает только сегодня+2) — возвращает null: нужны свежие точки на будущее', async () => {
            // Текущее время: 2026-10-09 15:00 Мск; кэш сохранён вчера (2026-10-08),
            // прогноз заканчивается 2026-10-11 = сегодня+2, а нужно сегодня+3 (2026-10-12)
            const yesterdayMs = Date.now() - 24 * 3600 * 1000;
            mockDb.get.mockResolvedValue({
                data: JSON.stringify({
                    ...sampleMacro,
                    cached_date: '2026-10-08',
                    time: ['2026-10-02T00:00', '2026-10-11T23:00'] // покрытие до 2026-10-11 включительно
                }),
                expires_at: Date.now() + 3600 * 1000, // TTL ещё валиден, но он больше не основание
                updated_at: yesterdayMs
            });

            const result = await spatialCacheService.getTodayMacroGrid(key);
            expect(result).toBeNull();

            const isSaved = await spatialCacheService.isMacroGridSavedToday(key);
            expect(isSaved).toBe(false);
        });

        it('сетка, покрывающая прогноз до сегодня+3 (2026-10-12T23:00), отдаётся из кэша даже с истёкшим TTL', async () => {
            // Сценарий: сетка загружена сегодня, сервер перезагрузили — чтение идёт только из
            // SQLite (in-memory пуст); покрытие "сегодня+3" делает запись действительной
            mockDb.get.mockResolvedValue({
                data: JSON.stringify({
                    ...sampleMacro,
                    cached_date: '2026-10-09',
                    time: ['2026-10-02T00:00', '2026-10-12T23:00'] // сегодня (09-е) + 3 дня = 12-е
                }),
                expires_at: Date.now() - 1000, // TTL истёк — покрытие важнее TTL
                updated_at: Date.now()
            });

            const result = await spatialCacheService.getTodayMacroGrid(key);
            expect(result).not.toBeNull();
            expect(result.type).toBe('macro');
            expect(await spatialCacheService.isMacroGridSavedToday(key)).toBe(true);
        });

        it('coversForecastHorizon: true для покрытия сегодня+3, false для сегодня+2 и без массива time', () => {
            const timeUtils = require('../../services/timeUtils');
            const todayPlus3 = timeUtils.getTodayDateString(Date.now() + 3 * 24 * 3600 * 1000);
            const todayPlus2 = timeUtils.getTodayDateString(Date.now() + 2 * 24 * 3600 * 1000);

            expect(spatialCacheService.coversForecastHorizon({ time: [`${todayPlus3}T23:00`] })).toBe(true);
            expect(spatialCacheService.coversForecastHorizon({ time: ['2000-01-01T00:00', `${todayPlus2}T23:00`] })).toBe(false);
            expect(spatialCacheService.coversForecastHorizon({ points: [] })).toBe(false);
            expect(spatialCacheService.coversForecastHorizon({ time: [] })).toBe(false);
            expect(spatialCacheService.coversForecastHorizon(null)).toBe(false);
        });

        it('возвращает null, если TTL истек и макросетка сохранена во вчерашний день (требуется актуализация)', async () => {
            const yesterdayMs = Date.now() - 24 * 3600 * 1000;
            mockDb.get.mockResolvedValue({
                data: JSON.stringify({ ...sampleMacro, cached_date: '2026-10-08' }),
                expires_at: Date.now() - 1000, // TTL уже истек
                updated_at: yesterdayMs
            });

            const result = await spatialCacheService.getTodayMacroGrid(key);
            expect(result).toBeNull();

            const isSaved = await spatialCacheService.isMacroGridSavedToday(key);
            expect(isSaved).toBe(false);
        });

        it('возвращает null, если кэш макросетки пуст', async () => {
            mockDb.get.mockResolvedValue(undefined);

            const result = await spatialCacheService.getTodayMacroGrid(key);
            expect(result).toBeNull();
            expect(await spatialCacheService.isMacroGridSavedToday(key)).toBe(false);
        });

        it('возвращает сетку, если TTL истёк, но запись сохранена сегодня (fallback на cached_date)', async () => {
            const sampleMacro = {
                type: 'macro',
                points_count: 550,
                points: [{ lat: 55.75, lon: 37.61, european_aqi: [20] }]
            };
            // TTL истек, но cached_date = сегодня, isRecordSavedToday вернёт true
            mockDb.get.mockResolvedValue({
                data: JSON.stringify({ ...sampleMacro, cached_date: '2026-10-09' }),
                expires_at: Date.now() - 1000, // TTL истек
                updated_at: Date.now()
            });

            const result = await spatialCacheService.getTodayMacroGrid(key);
            expect(result).not.toBeNull();
            expect(result.type).toBe('macro');
        });
    });

    describe('7. Обработка ошибок и граничные случаи', () => {
        const key = 'grid_error_key';

        it('getSpatialCache деградирует во in-memory, если db.get выбрасывает ошибку', async () => {
            // Сначала сохраняем в память (db = null)
            dbConfig.getDB.mockReturnValue(null);
            await spatialCacheService.setSpatialCache(key, { type: 'macro', count: 5 }, 3600);

            dbConfig.getDB.mockImplementation(() => {
                throw new Error('DB read error');
            });

            const result = await spatialCacheService.getSpatialCache(key);
            expect(result).toEqual({ type: 'macro', count: 5 });
        });

        it('getSpatialCacheEntry внутренний catch: битый JSON в row.data возвращает null', async () => {
            mockDb.get.mockResolvedValue({
                data: '{not valid json}',
                expires_at: Date.now() + 10000,
                updated_at: Date.now()
            });

            const result = await spatialCacheService.getSpatialCacheEntry(key);
            expect(result).toBeNull();
        });

        it('getSpatialCacheEntry внешний catch: db.get выбрасывает ошибку, деградация во in-memory', async () => {
            // Сначала сохраняем в память
            dbConfig.getDB.mockReturnValue(null);
            await spatialCacheService.setSpatialCache(key, { type: 'micro', count: 10 }, 3600);

            // Затем db.get выбрасывает ошибку
            dbConfig.getDB.mockImplementation(() => {
                throw new Error('DB connection lost');
            });

            const result = await spatialCacheService.getSpatialCacheEntry(key);
            expect(result).not.toBeNull();
            expect(result.data).toEqual({ type: 'micro', count: 10 });
        });

        it('getSpatialCacheEntry !db путь: возвращает запись из _memCache когда БД недоступна', async () => {
            dbConfig.getDB.mockReturnValue(null);
            await spatialCacheService.setSpatialCache(key, { type: 'macro', count: 42 }, 3600);

            const result = await spatialCacheService.getSpatialCacheEntry(key);
            expect(result).not.toBeNull();
            expect(result.data).toEqual({ type: 'macro', count: 42 });
        });

        it('getSpatialCache catch блок: истекшая запись в памяти удаляется и возвращает null', async () => {
            // Режим in-memory (db = null)
            dbConfig.getDB.mockReturnValue(null);
            // Сохраняем данные с TTL 1 секунда
            await spatialCacheService.setSpatialCache(key, { type: 'macro', count: 5 }, 1);
            // Продвигаем время на 2 секунды — запись истекает
            jest.advanceTimersByTime(2000);
            // Теперь getDB выбрасывает ошибку — попадаем в catch блок
            dbConfig.getDB.mockImplementation(() => {
                throw new Error('DB error');
            });

            const result = await spatialCacheService.getSpatialCache(key);
            expect(result).toBeNull();
        });

        it('getSpatialCache catch блок: неистекшая запись в памяти возвращается при ошибке БД', async () => {
            // Режим in-memory (db = null)
            dbConfig.getDB.mockReturnValue(null);
            await spatialCacheService.setSpatialCache(key, { type: 'macro', count: 5 }, 3600);
            // getDB выбрасывает ошибку — попадаем в catch блок, запись не истекла
            dbConfig.getDB.mockImplementation(() => {
                throw new Error('DB error');
            });

            const result = await spatialCacheService.getSpatialCache(key);
            expect(result).toEqual({ type: 'macro', count: 5 });
        });
    });

    describe('8. isRecordSavedToday граничные случаи', () => {
        it('возвращает true когда getTodayMacroGrid возвращает не-null запись', async () => {
            const record = { type: 'macro', cached_at: Date.now() };
            const spy = jest.spyOn(spatialCacheService, 'getTodayMacroGrid').mockResolvedValue(record);

            const result = await spatialCacheService.isRecordSavedToday('grid_macro_russia');
            expect(result).toBe(true);
            spy.mockRestore();
        });

        it('getTodayMacroGrid с записью без cached_date и вчерашним timestamp возвращает null (ветка isToday)', async () => {
            const yesterday = Date.now() - 24 * 60 * 60 * 1000;
            const recordYesterday = {
                type: 'macro',
                points_count: 550,
                points: [{ lat: 55.75, lon: 37.61, european_aqi: [20] }],
                cached_at: yesterday,
                updated_at: yesterday
            };
            mockDb.get.mockResolvedValue({
                data: JSON.stringify(recordYesterday),
                expires_at: Date.now() - 1000, // TTL истек
                updated_at: yesterday
            });

            const result = await spatialCacheService.getTodayMacroGrid('grid_macro_russia');
            expect(result).toBeNull();
        });
    });
});

