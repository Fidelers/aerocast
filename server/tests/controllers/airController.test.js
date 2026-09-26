// tests/controllers/airController.test.js — тесты контроллера airController

const airController = require('../../controllers/airController');
const cacheService = require('../../services/cacheService');
const historyService = require('../../services/historyService');
const primaryAirService = require('../../services/primaryAirService');
const backupAirService = require('../../services/backupAirService');

jest.mock('../../services/cacheService', () => ({
    getCache: jest.fn(),
    setCache: jest.fn()
}));
jest.mock('../../services/historyService', () => ({
    mergeWithFresh: jest.fn(),
    saveFromResponse: jest.fn(),
    getLatest: jest.fn()
}));
jest.mock('../../services/primaryAirService', () => ({
    fetchAirQuality: jest.fn()
}));
jest.mock('../../services/backupAirService', () => ({
    fetchAirQuality: jest.fn()
}));

describe('Controller: airController.getAirQuality', () => {
    const lat = 55.75;
    const lon = 37.61;

    let req;
    let res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            query: { lat: String(lat), lon: String(lon), source: 'auto' }
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        // кэш пуст, слияние возвращает данные как есть, архив сохраняется.
        cacheService.getCache.mockResolvedValue(null);
        cacheService.setCache.mockResolvedValue(undefined);
        historyService.mergeWithFresh.mockImplementation(async (data) => data);
        historyService.saveFromResponse.mockResolvedValue(undefined);
        historyService.getLatest.mockResolvedValue(null);

        // Глушим журналирование ошибок, чтобы не засорять вывод.
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Валидация параметров', () => {
        it('должен возвращать 400, если lat отсутствует', async () => {
            req.query = { lon: '37.61', source: 'auto' };

            await airController.getAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Missing lat or lon parameters' });
        });

        it('должен возвращать 400, если lon отсутствует', async () => {
            req.query = { lat: '55.75', source: 'auto' };

            await airController.getAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Missing lat or lon parameters' });
        });

        it('должен возвращать 400, если координата некорректна (не число)', async () => {
            req.query = { lat: 'abc', lon: '37.61', source: 'auto' };

            await airController.getAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Missing lat or lon parameters' });
        });

        it('должен возвращать 400, если координата — пустая строка', async () => {
            req.query = { lat: '55.75', lon: '', source: 'auto' };

            await airController.getAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Missing lat or lon parameters' });
        });

        it('должен возвращать 400, если lat выходит за пределы [-90, 90]', async () => {
            req.query = { lat: '95', lon: '37.61', source: 'auto' };

            await airController.getAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Missing lat or lon parameters' });
        });

        it('должен возвращать 400, если lon выходит за пределы [-180, 180]', async () => {
            req.query = { lat: '55.75', lon: '190', source: 'auto' };

            await airController.getAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Missing lat or lon parameters' });
        });

        it('должен возвращать 400, если lat < -90 или lon < -180', async () => {
            req.query = { lat: '-95', lon: '37.61', source: 'auto' };
            await airController.getAirQuality(req, res);
            expect(res.status).toHaveBeenCalledWith(400);

            req.query = { lat: '55.75', lon: '-195', source: 'auto' };
            await airController.getAirQuality(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('должен корректно принимать допустимые граничные координаты (-90, 90, -180, 180, 0, 0)', async () => {
            const boundaries = [
                { lat: '-90', lon: '0' },
                { lat: '90', lon: '0' },
                { lat: '0', lon: '-180' },
                { lat: '0', lon: '180' },
                { lat: '0', lon: '0' }
            ];

            for (const coords of boundaries) {
                req.query = { ...coords, source: 'auto' };
                primaryAirService.fetchAirQuality.mockResolvedValue({ used_source: 'open-meteo' });
                await airController.getAirQuality(req, res);
                expect(res.status).not.toHaveBeenCalledWith(400);
            }
        });

        it('должен возвращать 400 при передаче невалидного source', async () => {
            req.query = { lat: '55.75', lon: '37.61', source: 'unknown_source' };

            await airController.getAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Invalid source parameter' });
        });

        it('должен поддерживать синонимы source: primary и backup (из README)', async () => {
            // source: 'primary' -> как 'open-meteo'
            req.query = { lat: '55.75', lon: '37.61', source: 'primary' };
            primaryAirService.fetchAirQuality.mockResolvedValue({ used_source: 'open-meteo' });

            await airController.getAirQuality(req, res);
            expect(primaryAirService.fetchAirQuality).toHaveBeenCalledWith(55.75, 37.61);

            jest.clearAllMocks();

            // source: 'backup' -> как 'open-weather-map'
            req.query = { lat: '55.75', lon: '37.61', source: 'backup' };
            backupAirService.fetchAirQuality.mockResolvedValue({ used_source: 'open-weather-map' });

            await airController.getAirQuality(req, res);
            expect(backupAirService.fetchAirQuality).toHaveBeenCalledWith(55.75, 37.61);
        });

        it('должен использовать source = auto по умолчанию, если параметр source опущен', async () => {
            req.query = { lat: '55.75', lon: '37.61' };
            const primaryData = { latitude: lat, longitude: lon, used_source: 'open-meteo' };
            primaryAirService.fetchAirQuality.mockResolvedValue(primaryData);

            await airController.getAirQuality(req, res);

            expect(cacheService.getCache).toHaveBeenCalledWith('air_auto_55.75_37.61', false);
            expect(primaryAirService.fetchAirQuality).toHaveBeenCalledWith(lat, lon);
        });

        it('не должен обращаться к кэшу и источникам при ошибке валидации', async () => {
            req.query = { lon: '37.61', source: 'auto' };

            await airController.getAirQuality(req, res);

            expect(cacheService.getCache).not.toHaveBeenCalled();
            expect(primaryAirService.fetchAirQuality).not.toHaveBeenCalled();
            expect(backupAirService.fetchAirQuality).not.toHaveBeenCalled();
        });
    });

    describe('Попадание в кэш', () => {
        it('должен вернуть слияние кэша с историей и не ходить к источникам', async () => {
            const cachedData = {
                latitude: lat,
                longitude: lon,
                used_source: 'open-meteo',
                hourly: { time: ['2026-09-19T12:00'], pm10: [10] }
            };
            const merged = { ...cachedData, history_merged: true };

            cacheService.getCache.mockResolvedValue(cachedData);
            historyService.mergeWithFresh.mockResolvedValue(merged);

            await airController.getAirQuality(req, res);

            expect(cacheService.getCache).toHaveBeenCalledWith('air_auto_55.75_37.61', false);
            expect(historyService.mergeWithFresh).toHaveBeenCalledWith(cachedData, lat, lon);
            expect(res.json).toHaveBeenCalledWith(merged);

            expect(primaryAirService.fetchAirQuality).not.toHaveBeenCalled();
            expect(backupAirService.fetchAirQuality).not.toHaveBeenCalled();
            expect(cacheService.setCache).not.toHaveBeenCalled();
            expect(historyService.saveFromResponse).not.toHaveBeenCalled();
        });

        it('должен строить ключ кэша с округлением координат до 2 знаков', async () => {
            req.query = { lat: '55.756', lon: '37.614', source: 'open-meteo' };
            cacheService.getCache.mockResolvedValue({ used_source: 'open-meteo' });

            await airController.getAirQuality(req, res);

            expect(cacheService.getCache).toHaveBeenCalledWith('air_open-meteo_55.76_37.61', false);
        });
    });

    describe('Стратегия источника: open-meteo', () => {
        it('должен использовать только основной источник и сохранить ответ в кэш на 1 час', async () => {
            const primaryData = {
                latitude: lat,
                longitude: lon,
                used_source: 'open-meteo',
                hourly: { time: ['2026-09-19T12:00'], pm10: [15] }
            };

            req.query = { lat: String(lat), lon: String(lon), source: 'open-meteo' };
            primaryAirService.fetchAirQuality.mockResolvedValue(primaryData);

            await airController.getAirQuality(req, res);

            expect(primaryAirService.fetchAirQuality).toHaveBeenCalledWith(lat, lon);
            expect(backupAirService.fetchAirQuality).not.toHaveBeenCalled();

            expect(cacheService.setCache).toHaveBeenCalledWith('air_open-meteo_55.75_37.61', primaryData, 3600);
            expect(historyService.saveFromResponse).toHaveBeenCalledWith(primaryData);
            expect(historyService.mergeWithFresh).toHaveBeenCalledWith(primaryData, lat, lon);
            expect(res.json).toHaveBeenCalledWith(primaryData);
        });
    });

    describe('Стратегия источника: open-weather-map', () => {
        it('должен использовать только резервный источник', async () => {
            const backupData = {
                latitude: lat,
                longitude: lon,
                used_source: 'open-weather-map',
                hourly: { time: ['2026-09-19T12:00'], pm10: [20] }
            };

            req.query = { lat: String(lat), lon: String(lon), source: 'open-weather-map' };
            backupAirService.fetchAirQuality.mockResolvedValue(backupData);

            await airController.getAirQuality(req, res);

            expect(backupAirService.fetchAirQuality).toHaveBeenCalledWith(lat, lon);
            expect(primaryAirService.fetchAirQuality).not.toHaveBeenCalled();
            expect(cacheService.setCache).toHaveBeenCalledWith('air_open-weather-map_55.75_37.61', backupData, 3600);
            expect(historyService.saveFromResponse).toHaveBeenCalledWith(backupData);
            expect(historyService.mergeWithFresh).toHaveBeenCalledWith(backupData, lat, lon);
            expect(res.json).toHaveBeenCalledWith(backupData);
        });
    });

    describe('Стратегия источника: auto', () => {
        it('должен использовать основной источник, если он доступен', async () => {
            const primaryData = { latitude: lat, longitude: lon, used_source: 'open-meteo' };

            req.query = { lat: String(lat), lon: String(lon), source: 'auto' };
            primaryAirService.fetchAirQuality.mockResolvedValue(primaryData);

            await airController.getAirQuality(req, res);

            expect(primaryAirService.fetchAirQuality).toHaveBeenCalledWith(lat, lon);
            expect(backupAirService.fetchAirQuality).not.toHaveBeenCalled();
            expect(cacheService.setCache).toHaveBeenCalledWith('air_auto_55.75_37.61', primaryData, 3600);
            expect(historyService.saveFromResponse).toHaveBeenCalledWith(primaryData);
            expect(historyService.mergeWithFresh).toHaveBeenCalledWith(primaryData, lat, lon);
            expect(res.json).toHaveBeenCalledWith(primaryData);
        });

        it('должен автоматически переключиться на резервный источник при сбое основного', async () => {
            const backupData = { latitude: lat, longitude: lon, used_source: 'open-weather-map' };

            req.query = { lat: String(lat), lon: String(lon), source: 'auto' };
            primaryAirService.fetchAirQuality.mockRejectedValue(new Error('primary is down'));
            backupAirService.fetchAirQuality.mockResolvedValue(backupData);

            await airController.getAirQuality(req, res);

            expect(primaryAirService.fetchAirQuality).toHaveBeenCalledWith(lat, lon);
            expect(backupAirService.fetchAirQuality).toHaveBeenCalledWith(lat, lon);
            expect(cacheService.setCache).toHaveBeenCalledWith('air_auto_55.75_37.61', backupData, 3600);
            expect(historyService.saveFromResponse).toHaveBeenCalledWith(backupData);
            expect(historyService.mergeWithFresh).toHaveBeenCalledWith(backupData, lat, lon);
            expect(res.json).toHaveBeenCalledWith(backupData);
        });

        it('должен успешно отвечать клиенту (200), даже если фоновое сохранение архива упало', async () => {
            const primaryData = { latitude: lat, longitude: lon, used_source: 'open-meteo' };
            primaryAirService.fetchAirQuality.mockResolvedValue(primaryData);
            historyService.saveFromResponse.mockRejectedValue(new Error('db locked'));

            await airController.getAirQuality(req, res);

            expect(res.json).toHaveBeenCalledWith(primaryData);
        });
    });

    describe('Офлайн-резерв: сбой всех источников', () => {
        it('должен отдать устаревший кэш с меткой offline_database, если все источники недоступны', async () => {
            const staleData = {
                latitude: lat,
                longitude: lon,
                used_source: 'open-meteo',
                hourly: { time: ['2026-09-19T11:00'], pm10: [5] }
            };

            primaryAirService.fetchAirQuality.mockRejectedValue(new Error('primary is down'));
            backupAirService.fetchAirQuality.mockRejectedValue(new Error('backup is down'));

            // Первый запрос (без игнорирования TTL) — промах, второй (ignoreTTL=true) — устаревший кэш.
            cacheService.getCache.mockImplementation((key, ignoreTTL) =>
                Promise.resolve(ignoreTTL ? staleData : null)
            );
            historyService.mergeWithFresh.mockResolvedValue({ ...staleData, used_source: 'open-meteo' });

            await airController.getAirQuality(req, res);

            expect(cacheService.getCache).toHaveBeenNthCalledWith(1, 'air_auto_55.75_37.61', false);
            expect(cacheService.getCache).toHaveBeenNthCalledWith(2, 'air_auto_55.75_37.61', true);
            expect(historyService.mergeWithFresh).toHaveBeenCalledWith(staleData, lat, lon);
            // Источник из кэша должен быть перезаписан на offline_database
            expect(res.json).toHaveBeenCalledWith({ ...staleData, used_source: 'offline_database' });
        });

        it('должен отдать последнюю запись архива в нормализованном формате с меткой offline_database, если нет и устаревшего кэша', async () => {
            const latestRecord = {
                id: 1,
                latitude: lat,
                longitude: lon,
                timestamp: 1789862400000,
                pollutant_data: '{"european_aqi":42,"pm10":30}',
                source: 'open-meteo'
            };

            primaryAirService.fetchAirQuality.mockRejectedValue(new Error('primary is down'));
            backupAirService.fetchAirQuality.mockRejectedValue(new Error('backup is down'));
            historyService.getLatest.mockResolvedValue(latestRecord);

            await airController.getAirQuality(req, res);

            expect(historyService.getLatest).toHaveBeenCalledWith(lat, lon);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                latitude: lat,
                longitude: lon,
                used_source: 'offline_database',
                timezone: 'Europe/Moscow',
                hourly: expect.objectContaining({
                    time: expect.arrayContaining([expect.any(String)]),
                    european_aqi: [42],
                    pm10: [30]
                })
            }));
        });

        it('должен возвращать 500, если нет ни источников, ни кэша, ни архива', async () => {
            primaryAirService.fetchAirQuality.mockRejectedValue(new Error('primary is down'));
            backupAirService.fetchAirQuality.mockRejectedValue(new Error('backup is down'));

            await airController.getAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Failed to fetch air quality data and no offline cache available'
            });
        });
    });

    describe('Общий перехватчик ошибок', () => {
        it('должен возвращать 500 при непредвиденной ошибке (например, сбой чтения кэша)', async () => {
            cacheService.getCache.mockRejectedValue(new Error('db is broken'));

            await airController.getAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
        });

        it('должен возвращать дефолтное сообщение об ошибке, если message отсутствует', async () => {
            cacheService.getCache.mockRejectedValue({});

            await airController.getAirQuality(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
        });
    });
});
