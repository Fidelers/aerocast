// tests/routes/api.test.js — интеграционные тесты маршрутов API

// Контроллеры тестируются отдельно (tests/controllers/*), поэтому здесь их
// поведение заменяется моками — по контракту из SECRETS (валидация и статусы).
// Часть тестов написана в стиле TDD и станет зелёной после подключения
// маршрутов /api/air-quality и /api/search в routes/api.js (см. README).

const express = require('express');
const request = require('supertest');

const apiRoutes = require('../../routes/api');
const airController = require('../../controllers/airController');
const searchController = require('../../controllers/searchController');

jest.mock('../../controllers/airController', () => ({
    getAirQuality: jest.fn()
}));
jest.mock('../../controllers/searchController', () => ({
    search: jest.fn()
}));

// Пример нормализованного ответа внешнего источника (формат Open-Meteo).
const airQualityData = {
    latitude: 55.75,
    longitude: 37.61,
    timezone: 'Europe/Moscow',
    utc_offset_seconds: 10800,
    elevation: 180,
    used_source: 'open-meteo',
    hourly_units: {
        time: 'iso8601',
        pm10: 'μg/m³',
        pm2_5: 'μg/m³',
        european_aqi: 'EAQI'
    },
    hourly: {
        time: ['2026-09-22T10:00', '2026-09-22T11:00'],
        pm10: [12, 14],
        pm2_5: [5, 6],
        european_aqi: [20, 25]
    }
};

// Пример ответа геокодера.
const searchResults = [
    { lat: '55.75583', lon: '37.61778', display_name: 'Москва, Москва, Россия' },
    { lat: '59.93863', lon: '30.31413', display_name: 'Санкт-Петербург, Санкт-Петербург, Россия' }
];

// при отсутствии/некорректности lat или lon — 400, иначе — нормализованные данные.
function airQualityHandler(req, res) {
    const { lat, lon } = req.query;
    const invalid = lat === undefined || lon === undefined ||
        lat === '' || lon === '' ||
        Number.isNaN(Number(lat)) || Number.isNaN(Number(lon));

    if (invalid) {
        return res.status(400).json({ error: 'Missing lat or lon parameters' });
    }
    return res.json(airQualityData);
}

// при отсутствии/пустом q — 400, иначе — список результатов.
function searchHandler(req, res) {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q === '') {
        return res.status(400).json({ error: 'Missing query parameter q' });
    }
    return res.json(searchResults);
}

// Повторяет сборку app из server.js, чтобы тестировать маршруты без прослушивания порта.
function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);
    app.get('/ping', (req, res) => {
        res.json({ message: 'Бэкенд на связи!' });
    });
    return app;
}

describe('Routes: API', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();

        airController.getAirQuality.mockImplementation(airQualityHandler);
        searchController.search.mockImplementation(searchHandler);

        app = createApp();
    });
describe('GET /ping', () => {
        it('должен возвращать 200 и сообщение «Бэкенд на связи!»', async () => {
            const res = await request(app).get('/ping');

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ message: 'Бэкенд на связи!' });
        });
    });

    describe('GET /api/air-quality', () => {
        it('должен возвращать 200 с нормализованными данными о качестве воздуха', async () => {
            const res = await request(app)
                .get('/api/air-quality')
                .query({ lat: '55.75', lon: '37.61', source: 'auto' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual(airQualityData);
            expect(airController.getAirQuality).toHaveBeenCalledTimes(1);
        });

        it('должен передавать контроллеру query-параметры lat, lon и source', async () => {
            let receivedQuery = null;
            airController.getAirQuality.mockImplementation((req, res) => {
                receivedQuery = { ...req.query };
                return res.json(airQualityData);
            });

            await request(app)
                .get('/api/air-quality')
                .query({ lat: '55.75', lon: '37.61', source: 'open-weather-map' });

            expect(receivedQuery).toEqual({
                lat: '55.75',
                lon: '37.61',
                source: 'open-weather-map'
            });
        });

        it('должен возвращать 400, если lat и lon отсутствуют', async () => {
            const res = await request(app).get('/api/air-quality');

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ error: 'Missing lat or lon parameters' });
        });

        it('должен возвращать 400, если координата — не число', async () => {
            const res = await request(app)
                .get('/api/air-quality')
                .query({ lat: 'abc', lon: '37.61' });

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ error: 'Missing lat or lon parameters' });
        });

        it('должен возвращать 400, если координата — пустая строка', async () => {
            const res = await request(app)
                .get('/api/air-quality')
                .query({ lat: '55.75', lon: '' });

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ error: 'Missing lat or lon parameters' });
        });

        it('должен возвращать 500, если исчерпаны все источники и офлайн-резерв пуст', async () => {
            airController.getAirQuality.mockImplementation((req, res) => {
                res.status(500).json({
                    error: 'Failed to fetch air quality data and no offline cache available'
                });
            });

            const res = await request(app)
                .get('/api/air-quality')
                .query({ lat: '55.75', lon: '37.61' });

            expect(res.status).toBe(500);
            expect(res.body).toEqual({
                error: 'Failed to fetch air quality data and no offline cache available'
            });
        });

        it('должен возвращать 500, если контроллер выбрасывает исключение', async () => {
            airController.getAirQuality.mockRejectedValue(
                new Error('primary and backup are down')
            );

            const res = await request(app)
                .get('/api/air-quality')
                .query({ lat: '55.75', lon: '37.61' });

            expect(res.status).toBe(500);
        });
    });

    describe('GET /api/search', () => {
        it('должен возвращать 200 со списком найденных населённых пунктов', async () => {
            const res = await request(app)
                .get('/api/search')
                .query({ q: 'Москва' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual(searchResults);
            expect(searchController.search).toHaveBeenCalledTimes(1);
        });

        it('должен передавать контроллеру параметр q', async () => {
            let receivedQ = null;
            searchController.search.mockImplementation((req, res) => {
                receivedQ = req.query.q;
                return res.json(searchResults);
            });

            await request(app).get('/api/search').query({ q: 'Санкт-Петербург' });

            expect(receivedQ).toBe('Санкт-Петербург');
        });

        it('должен возвращать 400, если q отсутствует', async () => {
            const res = await request(app).get('/api/search');

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ error: 'Missing query parameter q' });
        });

        it('должен возвращать 400, если q — пустая строка', async () => {
            const res = await request(app).get('/api/search').query({ q: '' });

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ error: 'Missing query parameter q' });
        });

        it('должен возвращать 400, если q состоит только из пробелов', async () => {
            const res = await request(app).get('/api/search').query({ q: '   ' });

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ error: 'Missing query parameter q' });
        });

        it('должен возвращать 500, если контроллер выбрасывает исключение', async () => {
            searchController.search.mockRejectedValue(new Error('timeout of 1000ms exceeded'));

            const res = await request(app).get('/api/search').query({ q: 'Москва' });

            expect(res.status).toBe(500);
        });
    });

    describe('GET /api/air (псевдоним /api/air-quality)', () => {
        it('должен обрабатываться тем же контроллером getAirQuality', async () => {
            const res = await request(app)
                .get('/api/air')
                .query({ lat: '55.75', lon: '37.61' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual(airQualityData);
            expect(airController.getAirQuality).toHaveBeenCalledTimes(1);
        });

        it('должен передавать параметры lat, lon и source в контроллер', async () => {
            let receivedQuery = null;
            airController.getAirQuality.mockImplementation((req, res) => {
                receivedQuery = { ...req.query };
                return res.json(airQualityData);
            });

            await request(app)
                .get('/api/air')
                .query({ lat: '55.75', lon: '37.61', source: 'auto' });

            expect(receivedQuery).toEqual({ lat: '55.75', lon: '37.61', source: 'auto' });
        });

        it('должен возвращать 400 при отсутствии координат', async () => {
            const res = await request(app).get('/api/air');
            expect(res.status).toBe(400);
            expect(res.body).toEqual({ error: 'Missing lat or lon parameters' });
        });
    });

    describe('Неизвестные маршруты API', () => {
        it('должен возвращать 404 для несуществующих маршрутов API', async () => {
            const res = await request(app).get('/api/non-existent-endpoint');
            expect(res.status).toBe(404);
        });
    });
});
