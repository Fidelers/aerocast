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
            expect(res.json).toHaveBeenCalledWith(backupData);
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

        it('должен отдать последнюю запись архива с меткой offline_database, если нет и устаревшего кэша', async () => {
            const latestRecord = {
                id: 1,
                latitude: lat,
                longitude: lon,
                timestamp: 1780000000000,
                pollutant_data: '{"european_aqi":42,"pm10":30}',
                source: 'open-meteo'
            };

            primaryAirService.fetchAirQuality.mockRejectedValue(new Error('primary is down'));
            backupAirService.fetchAirQuality.mockRejectedValue(new Error('backup is down'));
            historyService.getLatest.mockResolvedValue(latestRecord);

            await airController.getAirQuality(req, res);

            expect(historyService.getLatest).toHaveBeenCalledWith(lat, lon);
            expect(res.json).toHaveBeenCalledWith({ ...latestRecord, used_source: 'offline_database' });
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
    });
});
