const gridAirController = require('../../controllers/gridAirController');
const batchAirService = require('../../services/batchAirService');
const spatialCacheService = require('../../services/spatialCacheService');

// Мокаем сервисы
jest.mock('../../services/batchAirService', () => ({
    generateMacroGridCoordinates: jest.fn(),
    generateMicroGridCoordinates: jest.fn(),
    fetchBatchAirQuality: jest.fn(),
    normalizeBatchResponse: jest.fn()
}));

jest.mock('../../services/spatialCacheService', () => ({
    quantizeCoordinates: jest.fn(),
    getSpatialCache: jest.fn(),
    setSpatialCache: jest.fn(),
    clearSpatialCache: jest.fn(),
    getTodayMacroGrid: jest.fn(),
    isMacroGridSavedToday: jest.fn(),
    isRecordSavedToday: jest.fn()
}));

describe('Controller: gridAirController', () => {
    let req;
    let res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            query: {}
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        // Заглушаем console.error и console.warn в тестах
        jest.spyOn(console, 'error').mockImplementation(() => { });
        jest.spyOn(console, 'warn').mockImplementation(() => { });

        // Базовые моки сервиса пространственного кэша
        spatialCacheService.quantizeCoordinates.mockImplementation((lat, lon) => {
            const qLat = (Math.round(lat / 0.2) * 0.2).toFixed(2);
            const qLon = (Math.round(lon / 0.2) * 0.2).toFixed(2);
            return { qLat, qLon, cacheKey: `grid_micro_${qLat}_${qLon}` };
        });
        spatialCacheService.getSpatialCache.mockResolvedValue(null);
        spatialCacheService.setSpatialCache.mockResolvedValue(undefined);
        spatialCacheService.clearSpatialCache.mockResolvedValue(0);
        spatialCacheService.getTodayMacroGrid.mockResolvedValue(null);
        spatialCacheService.isMacroGridSavedToday.mockResolvedValue(false);
        spatialCacheService.isRecordSavedToday.mockImplementation((rec) => {
            if (!rec) return false;
            const timeUtils = require('../../services/timeUtils');
            if (rec.cached_date) return rec.cached_date === timeUtils.getTodayDateString();
            return true;
        });


        // Базовые моки batchAirService
        batchAirService.generateMacroGridCoordinates.mockReturnValue([
            { lat: 55.75, lon: 37.61 },
            { lat: 59.93, lon: 30.31 }
        ]);
        batchAirService.generateMicroGridCoordinates.mockReturnValue({
            points: [{ lat: 53.75, lon: 87.15 }, { lat: 53.85, lon: 87.25 }],
            bbox: [87.05, 53.65, 87.35, 53.95]
        });
        batchAirService.fetchBatchAirQuality.mockResolvedValue([
            { hourly: { time: ['2026-10-01T00:00'], european_aqi: [25] } }
        ]);
        batchAirService.normalizeBatchResponse.mockImplementation((raw, coords) => ({
            time: ['2026-10-01T00:00'],
            points: coords.map(c => ({ lat: c.lat, lon: c.lon, european_aqi: [25] }))
        }));
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('1. Валидация параметров (getGridAirQuality)', () => {
        it('возвращает 400, если запрошен micro и lat отсутствует', async () => {
            req.query = { type: 'micro', lon: '87.15' };

            await gridAirController.getGridAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringMatching(/lat.*lon/i) })
            );
        });

        it('возвращает 400, если запрошен micro и lon отсутствует', async () => {
            req.query = { type: 'micro', lat: '53.75' };

            await gridAirController.getGridAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringMatching(/lat.*lon/i) })
            );
        });

        it('возвращает 400, если lat или lon не являются числами', async () => {
            req.query = { type: 'micro', lat: 'abc', lon: '87.15' };

            await gridAirController.getGridAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringMatching(/lat.*lon/i) })
            );
        });

        it('возвращает 400, если координаты выходят за допустимые границы (-90..90, -180..180)', async () => {
            req.query = { type: 'micro', lat: '95', lon: '87.15' };

            await gridAirController.getGridAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(400);

            req.query = { type: 'micro', lat: '53.75', lon: '200' };
            await gridAirController.getGridAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('автоматически выбирает macro при zoom < 9, даже без координат lat/lon', async () => {
            req.query = { zoom: '6' };

            await gridAirController.getGridAirQuality(req, res);

            expect(res.status).not.toHaveBeenCalledWith(400);
            expect(batchAirService.generateMacroGridCoordinates).toHaveBeenCalled();
        });

        it('автоматически выбирает micro при zoom >= 9 и требует координаты', async () => {
            req.query = { zoom: '10' }; // Нет координат

            await gridAirController.getGridAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('2. Попадание в кэш (Cache Hit)', () => {
        it('возвращает 200 и кэшированную макро-сетку за 1-3 мс без сетевых запросов', async () => {
            const cachedMacro = {
                type: 'macro',
                points_count: 85,
                used_source: 'open-meteo',
                points: [{ lat: 55.75, lon: 37.61, european_aqi: [20] }]
            };
            spatialCacheService.getSpatialCache.mockResolvedValue(cachedMacro);

            req.query = { type: 'macro' };
            await gridAirController.getGridAirQuality(req, res);

            expect(batchAirService.fetchBatchAirQuality).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(cachedMacro);
        });

        it('возвращает сетку через getTodayMacroGrid, если она сохранена сегодня', async () => {
            const cachedMacroToday = {
                type: 'macro',
                points_count: 550,
                used_source: 'open-meteo',
                cached_date: '2026-10-16',
                points: [{ lat: 55.75, lon: 37.61, european_aqi: [15] }]
            };
            spatialCacheService.getTodayMacroGrid.mockResolvedValue(cachedMacroToday);

            req.query = { type: 'macro' };
            await gridAirController.getGridAirQuality(req, res);

            expect(spatialCacheService.getTodayMacroGrid).toHaveBeenCalledWith('grid_macro_russia');
            expect(batchAirService.fetchBatchAirQuality).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(cachedMacroToday);
        });

        it('возвращает 200 и кэшированную микро-сетку по квантованному ключу без вызова внешнего API', async () => {
            const cachedMicro = {
                type: 'micro',
                bbox: [87.05, 53.65, 87.35, 53.95],
                points_count: 25,
                used_source: 'open-meteo',
                points: [{ lat: 53.75, lon: 87.15, european_aqi: [30] }]
            };
            spatialCacheService.getSpatialCache.mockResolvedValue(cachedMicro);

            req.query = { type: 'micro', lat: '53.75', lon: '87.15' };
            await gridAirController.getGridAirQuality(req, res);

            expect(spatialCacheService.quantizeCoordinates).toHaveBeenCalledWith(53.75, 87.15);
            expect(spatialCacheService.getSpatialCache).toHaveBeenCalledWith('grid_micro_53.80_87.20', false);
            expect(batchAirService.fetchBatchAirQuality).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(cachedMicro);
        });
    });

    describe('3. Промах кэша и получение данных (Cache Miss & Batch Fetch)', () => {
        it('для macro генерирует узлы РФ, делает пакетный запрос и сохраняет в SQLite с TTL 86400 (24 часа) и cached_date', async () => {
            spatialCacheService.getSpatialCache.mockResolvedValue(null);

            req.query = { type: 'macro' };
            await gridAirController.getGridAirQuality(req, res);

            expect(batchAirService.generateMacroGridCoordinates).toHaveBeenCalled();
            expect(batchAirService.fetchBatchAirQuality).toHaveBeenCalledWith(expect.any(Array));
            expect(batchAirService.normalizeBatchResponse).toHaveBeenCalled();

            // Проверяем сохранение в кэш с TTL 86400 сек (24 часа / 1 день) и метками даты
            expect(spatialCacheService.setSpatialCache).toHaveBeenCalledWith(
                'grid_macro_russia',
                expect.objectContaining({
                    type: 'macro',
                    used_source: 'open-meteo',
                    cached_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
                    cached_at: expect.any(Number)
                }),
                86400
            );

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                type: 'macro',
                used_source: 'open-meteo',
                points: expect.any(Array)
            }));
        });

        it('если макросетка в кэше свежая по TTL (в т.ч. сохранённая перед полночью), не запрашивает Open-Meteo повторно', async () => {
            // Свежая макросетка: cached_date вчерашний, но TTL ещё валиден -> отдаётся из кэша без вызова API
            const freshMacro = {
                type: 'macro',
                points_count: 550,
                used_source: 'open-meteo',
                cached_date: '2026-10-08', // вчера по календарю, но TTL ещё не истек
                cached_at: Date.now(),
                points: [{ lat: 55.75, lon: 37.61, european_aqi: [10] }]
            };
            spatialCacheService.getTodayMacroGrid.mockResolvedValue(freshMacro);

            req.query = { type: 'macro' };
            await gridAirController.getGridAirQuality(req, res);

            // Кэш отдан напрямую, в Open-Meteо ходить не нужно
            expect(batchAirService.fetchBatchAirQuality).not.toHaveBeenCalled();
            expect(spatialCacheService.setSpatialCache).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                type: 'macro',
                used_source: 'open-meteo',
                points: expect.any(Array)
            }));
        });


        it('для micro генерирует матрицу вокруг центра, запрашивает API и сохраняет в кэш', async () => {
            spatialCacheService.getSpatialCache.mockResolvedValue(null);

            req.query = { type: 'micro', lat: '53.75', lon: '87.15' };
            await gridAirController.getGridAirQuality(req, res);

            expect(batchAirService.generateMicroGridCoordinates).toHaveBeenCalledWith(53.75, 87.15);
            expect(batchAirService.fetchBatchAirQuality).toHaveBeenCalled();
            expect(spatialCacheService.setSpatialCache).toHaveBeenCalledWith(
                'grid_micro_53.80_87.20',
                expect.objectContaining({
                    type: 'micro',
                    bbox: [87.05, 53.65, 87.35, 53.95],
                    used_source: 'open-meteo'
                }),
                3600
            );

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                type: 'micro',
                bbox: [87.05, 53.65, 87.35, 53.95],
                used_source: 'open-meteo'
            }));
        });
    });

    describe('4. Критическое правило отказоустойчивости (Zero-Cost Failover & Offline)', () => {
        it('при сбое Open-Meteo НЕ вызывает OpenWeatherMap, а возвращает устаревший SQLite-кэш', async () => {
            // Первый поиск в кэше — промах
            spatialCacheService.getSpatialCache.mockResolvedValueOnce(null);

            // Ошибка сетевого запроса к Open-Meteo (таймаут 2000 мс)
            batchAirService.fetchBatchAirQuality.mockRejectedValue(new Error('timeout of 2000ms exceeded'));

            // Устаревший кэш в SQLite (ignoreTTL = true)
            const staleGrid = {
                type: 'micro',
                bbox: [87.05, 53.65, 87.35, 53.95],
                points_count: 25,
                used_source: 'open-meteo',
                points: [{ lat: 53.75, lon: 87.15, european_aqi: [22] }]
            };
            spatialCacheService.getSpatialCache.mockResolvedValueOnce(staleGrid);

            req.query = { type: 'micro', lat: '53.75', lon: '87.15' };
            await gridAirController.getGridAirQuality(req, res);

            // Должен запросить устаревший кэш с ignoreTTL = true
            expect(spatialCacheService.getSpatialCache).toHaveBeenNthCalledWith(2, 'grid_micro_53.80_87.20', true);

            // Должен вернуть 200 с меткой offline_database
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                type: 'micro',
                used_source: 'offline_database',
                points: staleGrid.points
            }));
        });

        it('при сбое Open-Meteo и отсутствии устаревшего кэша возвращает 500 offline_database_miss', async () => {
            spatialCacheService.getSpatialCache.mockResolvedValueOnce(null); // Свежий кэш пуст
            batchAirService.fetchBatchAirQuality.mockRejectedValue(new Error('Open-Meteo 503 Service Unavailable'));
            spatialCacheService.getSpatialCache.mockResolvedValueOnce(null); // Устаревший кэш тоже пуст

            req.query = { type: 'micro', lat: '53.75', lon: '87.15' };
            await gridAirController.getGridAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                error: expect.stringMatching(/failed to fetch grid data/i),
                source: 'offline_database_miss'
            }));
        });
    });

    describe('5. Отдельные методы контроллера', () => {
        it('getMacroGrid вызывает сценарий макро-сетки', async () => {
            const cachedMacro = { type: 'macro', points: [] };
            spatialCacheService.getSpatialCache.mockResolvedValue(cachedMacro);

            await gridAirController.getMacroGrid(req, res);

            expect(spatialCacheService.getSpatialCache).toHaveBeenCalledWith('grid_macro_russia', false);
            expect(res.json).toHaveBeenCalledWith(cachedMacro);
        });

        it('getMicroGrid валидирует координаты и вызывает сценарий микро-сетки', async () => {
            req.query = {};
            await gridAirController.getMicroGrid(req, res);
            expect(res.status).toHaveBeenCalledWith(400);

            req.query = { lat: '53.75', lon: '87.15' };
            const cachedMicro = { type: 'micro', points: [] };
            spatialCacheService.getSpatialCache.mockResolvedValue(cachedMicro);

            await gridAirController.getMicroGrid(req, res);
            expect(res.json).toHaveBeenCalledWith(cachedMicro);
        });

        it('clearGridCache вызывает spatialCacheService.clearSpatialCache и возвращает 200', async () => {
            spatialCacheService.clearSpatialCache.mockResolvedValue(5);
            req.query = { pattern: 'grid_%' };

            await gridAirController.clearGridCache(req, res);

            expect(spatialCacheService.clearSpatialCache).toHaveBeenCalledWith('grid_%');
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.any(String),
                deleted_entries: 5
            }));
        });

        it('clearGridCache возвращает 500 при ошибке очистки кэша', async () => {
            spatialCacheService.clearSpatialCache.mockRejectedValue(new Error('cache clear failed'));
            req.query = { pattern: 'grid_%' };

            await gridAirController.clearGridCache(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Failed to clear grid cache' });
        });
    });

    describe('6. Обработка ошибок кэша и сетевых сбоев', () => {
        it('логирует предупреждение и продолжает работу, если не удалось записать в кэш', async () => {
            spatialCacheService.getSpatialCache.mockResolvedValue(null);
            batchAirService.fetchBatchAirQuality.mockResolvedValue([
                { hourly: { time: ['2026-10-01T00:00'], european_aqi: [25] } }
            ]);
            batchAirService.normalizeBatchResponse.mockImplementation((raw, coords) => ({
                time: ['2026-10-01T00:00'],
                points: coords.map(c => ({ lat: c.lat, lon: c.lon, european_aqi: [25] }))
            }));
            spatialCacheService.setSpatialCache.mockRejectedValue(new Error('cache write failed'));

            req.query = { type: 'macro' };
            await gridAirController.getGridAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(console.warn).toHaveBeenCalledWith('Не удалось записать в кэш:', expect.any(Error));
        });

        it('логирует ошибку чтения устаревшего кэша и возвращает 500, если нет свежих данных', async () => {
            spatialCacheService.getSpatialCache.mockResolvedValueOnce(null); // свежий кэш пуст
            batchAirService.fetchBatchAirQuality.mockRejectedValue(new Error('Open-Meteo down'));
            spatialCacheService.getSpatialCache.mockRejectedValueOnce(new Error('stale cache read error')); // устаревший кэш тоже ошибка

            req.query = { type: 'micro', lat: '53.75', lon: '87.15' };
            await gridAirController.getGridAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(console.error).toHaveBeenCalledWith('Ошибка чтения устаревшего кэша:', expect.any(Error));
        });

        it('возвращает 500 при непредвиденной ошибке в контроллере сетки', async () => {
            spatialCacheService.getSpatialCache.mockImplementation(() => {
                throw new Error('Unexpected controller error');
            });

            req.query = { type: 'macro' };
            await gridAirController.getGridAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
            expect(console.error).toHaveBeenCalledWith('Ошибка в контроллере сетки:', expect.any(Error));
        });

        it('автоопределение типа: zoom не является числом -> macro по умолчанию', async () => {
            req.query = { zoom: 'not-a-number' };
            const cachedMacro = { type: 'macro', points: [] };
            spatialCacheService.getSpatialCache.mockResolvedValue(cachedMacro);

            await gridAirController.getGridAirQuality(req, res);

            expect(res.json).toHaveBeenCalledWith(cachedMacro);
        });

        it('автоопределение типа: zoom >= 9 без координат -> 400 для micro', async () => {
            req.query = { zoom: '9' };
            await gridAirController.getGridAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('req.query отсутствует — дефолтный объект через || {}', async () => {
            req = {};
            const cachedMacro = { type: 'macro', points: [] };
            spatialCacheService.getSpatialCache.mockResolvedValue(cachedMacro);

            await gridAirController.getGridAirQuality(req, res);

            expect(res.json).toHaveBeenCalledWith(cachedMacro);
        });

        it('при сбое fetchBatchAirQuality и отсутствии устаревшего кэша возвращает 500', async () => {
            spatialCacheService.getSpatialCache.mockResolvedValueOnce(null);
            batchAirService.fetchBatchAirQuality.mockRejectedValue(new Error('API down'));
            spatialCacheService.getSpatialCache.mockResolvedValueOnce(null);

            req.query = { type: 'macro' };
            await gridAirController.getGridAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                error: expect.stringMatching(/failed to fetch grid data/i)
            }));
        });

        it('getMacroGrid с отсутствующим req.query использует дефолтный объект', async () => {
            const cachedMacro = { type: 'macro', points: [] };
            spatialCacheService.getSpatialCache.mockResolvedValue(cachedMacro);
            delete req.query;

            await gridAirController.getMacroGrid(req, res);

            expect(res.json).toHaveBeenCalledWith(cachedMacro);
        });

        it('clearGridCache без pattern использует дефолтный grid_%', async () => {
            spatialCacheService.clearSpatialCache.mockResolvedValue(3);
            delete req.query;

            await gridAirController.clearGridCache(req, res);

            expect(spatialCacheService.clearSpatialCache).toHaveBeenCalledWith('grid_%');
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                deleted_entries: 3
            }));
        });

        it('clearGridCache возвращает deleted_entries = 0 когда clearSpatialCache вернет undefined', async () => {
            spatialCacheService.clearSpatialCache.mockResolvedValue(undefined);
            req.query = { pattern: 'grid_%' };

            await gridAirController.clearGridCache(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                deleted_entries: 0
            }));
        });

        it('getMicroGrid с отсутствующим req.query использует дефолтный объект', async () => {
            delete req.query;

            await gridAirController.getMicroGrid(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('микро-сетка с промахом кэша и успешным фетчем проходит через полный путь payload', async () => {
            spatialCacheService.getSpatialCache.mockResolvedValue(null);
            batchAirService.generateMicroGridCoordinates.mockReturnValue({
                points: [{ lat: 53.75, lon: 87.15 }],
                bbox: [87.05, 53.65, 87.35, 53.95]
            });
            batchAirService.fetchBatchAirQuality.mockResolvedValue([
                { hourly: { time: ['2026-10-01T00:00'], european_aqi: [25] } }
            ]);
            batchAirService.normalizeBatchResponse.mockImplementation((raw, coords) => ({
                time: ['2026-10-01T00:00'],
                points: coords.map(c => ({ lat: c.lat, lon: c.lon, european_aqi: [25] }))
            }));

            req.query = { type: 'micro', lat: '53.75', lon: '87.15' };
            await gridAirController.getGridAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                type: 'micro',
                bbox: [87.05, 53.65, 87.35, 53.95],
                points_count: 1
            }));
        });

        it('использует fallback вычисление cacheKey, если quantizeCoordinates не вернул cacheKey', async () => {
            spatialCacheService.quantizeCoordinates.mockReturnValue(null);
            req.query = { type: 'micro', lat: '53.75', lon: '87.15' };
            const cachedMicro = { type: 'micro', points: [] };
            spatialCacheService.getSpatialCache.mockResolvedValue(cachedMicro);

            await gridAirController.getGridAirQuality(req, res);

            expect(spatialCacheService.getSpatialCache).toHaveBeenCalledWith('grid_micro_53.80_87.20', false);
            expect(res.json).toHaveBeenCalledWith(cachedMicro);
        });

        it('ищет candidate в spatialCacheService.getSpatialCache, если getTodayMacroGrid не является функцией', async () => {
            const originalGetToday = spatialCacheService.getTodayMacroGrid;
            delete spatialCacheService.getTodayMacroGrid;
            const candidate = { type: 'macro', cached_date: '2026-10-18', points: [] };
            spatialCacheService.getSpatialCache.mockResolvedValue(candidate);
            spatialCacheService.isRecordSavedToday.mockReturnValue(true);

            req.query = { type: 'macro' };
            await gridAirController.getGridAirQuality(req, res);

            expect(res.json).toHaveBeenCalledWith(candidate);
            spatialCacheService.getTodayMacroGrid = originalGetToday;
        });

        it('проверяет candidate.cached_date вручную, если isRecordSavedToday не функция (дата совпадает)', async () => {
            const originalGetToday = spatialCacheService.getTodayMacroGrid;
            const originalIsSaved = spatialCacheService.isRecordSavedToday;
            delete spatialCacheService.getTodayMacroGrid;
            delete spatialCacheService.isRecordSavedToday;
            const timeUtils = require('../../services/timeUtils');
            const todayStr = timeUtils.getTodayDateString();
            const candidate = { type: 'macro', cached_date: todayStr, points: [] };
            spatialCacheService.getSpatialCache.mockResolvedValue(candidate);

            req.query = { type: 'macro' };
            await gridAirController.getGridAirQuality(req, res);

            expect(res.json).toHaveBeenCalledWith(candidate);
            spatialCacheService.getTodayMacroGrid = originalGetToday;
            spatialCacheService.isRecordSavedToday = originalIsSaved;
        });

        it('не использует candidate, если isRecordSavedToday не функция и candidate.cached_date устарела', async () => {
            const originalGetToday = spatialCacheService.getTodayMacroGrid;
            const originalIsSaved = spatialCacheService.isRecordSavedToday;
            delete spatialCacheService.getTodayMacroGrid;
            delete spatialCacheService.isRecordSavedToday;
            const candidate = { type: 'macro', cached_date: '2020-01-01', points: [] };
            spatialCacheService.getSpatialCache.mockResolvedValue(candidate);

            req.query = { type: 'macro' };
            await gridAirController.getGridAirQuality(req, res);

            expect(batchAirService.fetchBatchAirQuality).toHaveBeenCalled();
            spatialCacheService.getTodayMacroGrid = originalGetToday;
            spatialCacheService.isRecordSavedToday = originalIsSaved;
        });

        it('считает candidate актуальным, если isRecordSavedToday не функция и cached_date отсутствует', async () => {
            const originalGetToday = spatialCacheService.getTodayMacroGrid;
            const originalIsSaved = spatialCacheService.isRecordSavedToday;
            delete spatialCacheService.getTodayMacroGrid;
            delete spatialCacheService.isRecordSavedToday;
            const candidate = { type: 'macro', points: [] };
            spatialCacheService.getSpatialCache.mockResolvedValue(candidate);

            req.query = { type: 'macro' };
            await gridAirController.getGridAirQuality(req, res);

            expect(res.json).toHaveBeenCalledWith(candidate);
            spatialCacheService.getTodayMacroGrid = originalGetToday;
            spatialCacheService.isRecordSavedToday = originalIsSaved;
        });

        it('не использует candidate, если isRecordSavedToday вернул false', async () => {
            spatialCacheService.getTodayMacroGrid.mockResolvedValue(null);
            const candidate = { type: 'macro', cached_date: '2020-01-01', points: [] };
            spatialCacheService.getSpatialCache.mockResolvedValue(candidate);
            spatialCacheService.isRecordSavedToday.mockReturnValue(false);

            req.query = { type: 'macro' };
            await gridAirController.getGridAirQuality(req, res);

            expect(batchAirService.fetchBatchAirQuality).toHaveBeenCalled();
        });

        it('обрабатывает случай, когда generateMicroGridCoordinates возвращает массив точек', async () => {
            spatialCacheService.getSpatialCache.mockResolvedValue(null);
            batchAirService.generateMicroGridCoordinates.mockReturnValue([
                { lat: 53.75, lon: 87.15 }
            ]);
            batchAirService.normalizeBatchResponse.mockReturnValue({
                time: ['2026-10-01T00:00'],
                points: [{ lat: 53.75, lon: 87.15, european_aqi: [25] }]
            });

            req.query = { type: 'micro', lat: '53.75', lon: '87.15' };
            await gridAirController.getGridAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.not.objectContaining({ bbox: expect.anything() }));
        });

        it('обрабатывает случай, когда generateMicroGridCoordinates возвращает объект с полем coordinates и без bbox', async () => {
            spatialCacheService.getSpatialCache.mockResolvedValue(null);
            batchAirService.generateMicroGridCoordinates.mockReturnValue({
                coordinates: [{ lat: 53.75, lon: 87.15 }]
            });
            batchAirService.normalizeBatchResponse.mockReturnValue({
                time: ['2026-10-01T00:00'],
                points: [{ lat: 53.75, lon: 87.15, european_aqi: [25] }]
            });

            req.query = { type: 'micro', lat: '53.75', lon: '87.15' };
            await gridAirController.getGridAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.not.objectContaining({ bbox: expect.anything() }));
        });

        it('обрабатывает случай, когда generateMicroGridCoordinates возвращает пустой объект и normalized = null', async () => {
            spatialCacheService.getSpatialCache.mockResolvedValue(null);
            batchAirService.generateMicroGridCoordinates.mockReturnValue({});
            batchAirService.normalizeBatchResponse.mockReturnValue(null);

            req.query = { type: 'micro', lat: '53.75', lon: '87.15' };
            await gridAirController.getGridAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                points_count: 0,
                points: []
            }));
        });

        it('рассчитывает points_count по coordinates.length, если normalized.points отсутствует', async () => {
            spatialCacheService.getSpatialCache.mockResolvedValue(null);
            batchAirService.generateMicroGridCoordinates.mockReturnValue([
                { lat: 53.75, lon: 87.15 }
            ]);
            batchAirService.normalizeBatchResponse.mockReturnValue({
                time: ['2026-10-01T00:00']
            });

            req.query = { type: 'micro', lat: '53.75', lon: '87.15' };
            await gridAirController.getGridAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                points_count: 1,
                points: []
            }));
        });

    });
});
