const express = require('express');
const request = require('supertest');

const apiRoutes = require('../../routes/api');
const gridAirController = require('../../controllers/gridAirController');
const airController = require('../../controllers/airController');
const searchController = require('../../controllers/searchController');

jest.mock('../../controllers/gridAirController', () => ({
    getGridAirQuality: jest.fn(),
    getMacroGrid: jest.fn(),
    getMicroGrid: jest.fn(),
    clearGridCache: jest.fn()
}));

jest.mock('../../controllers/airController', () => ({
    getAirQuality: jest.fn()
}));

jest.mock('../../controllers/searchController', () => ({
    search: jest.fn()
}));

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);
    return app;
}

describe('Routes: Grid API (/api/air-quality/grid/*, /api/cache/grid)', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => { });
        jest.spyOn(console, 'warn').mockImplementation(() => { });

        app = createApp();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('1. GET /api/air-quality/grid', () => {
        it('маршрутизирует запрос к gridAirController.getGridAirQuality', async () => {
            const mockGridData = {
                type: 'macro',
                points_count: 85,
                used_source: 'open-meteo'
            };

            gridAirController.getGridAirQuality.mockImplementation((req, res) => {
                res.status(200).json(mockGridData);
            });

            const res = await request(app)
                .get('/api/air-quality/grid')
                .query({ type: 'macro' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual(mockGridData);
            expect(gridAirController.getGridAirQuality).toHaveBeenCalledTimes(1);
        });

        it('корректно пробрасывает все query параметры (lat, lon, zoom, bbox, type)', async () => {
            let capturedQuery = null;
            gridAirController.getGridAirQuality.mockImplementation((req, res) => {
                capturedQuery = { ...req.query };
                res.json({ ok: true });
            });

            await request(app)
                .get('/api/air-quality/grid')
                .query({
                    lat: '53.75',
                    lon: '87.15',
                    zoom: '10',
                    bbox: '86.85,53.45,87.45,54.05',
                    type: 'micro'
                });

            expect(capturedQuery).toEqual({
                lat: '53.75',
                lon: '87.15',
                zoom: '10',
                bbox: '86.85,53.45,87.45,54.05',
                type: 'micro'
            });
        });
    });

    describe('2. GET /api/air-quality/grid/macro', () => {
        it('маршрутизирует запрос к gridAirController.getMacroGrid', async () => {
            const mockMacroData = {
                type: 'macro',
                points_count: 90,
                used_source: 'open-meteo'
            };

            gridAirController.getMacroGrid.mockImplementation((req, res) => {
                res.status(200).json(mockMacroData);
            });

            const res = await request(app).get('/api/air-quality/grid/macro');

            expect(res.status).toBe(200);
            expect(res.body).toEqual(mockMacroData);
            expect(gridAirController.getMacroGrid).toHaveBeenCalledTimes(1);
        });
    });

    describe('3. GET /api/air-quality/grid/micro', () => {
        it('маршрутизирует запрос к gridAirController.getMicroGrid с координатами', async () => {
            const mockMicroData = {
                type: 'micro',
                bbox: [86.85, 53.45, 87.45, 54.05],
                points_count: 25,
                used_source: 'open-meteo'
            };

            gridAirController.getMicroGrid.mockImplementation((req, res) => {
                res.status(200).json(mockMicroData);
            });

            const res = await request(app)
                .get('/api/air-quality/grid/micro')
                .query({ lat: '53.75', lon: '87.15' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual(mockMicroData);
            expect(gridAirController.getMicroGrid).toHaveBeenCalledTimes(1);
        });
    });

    describe('4. DELETE /api/cache/grid', () => {
        it('маршрутизирует запрос к gridAirController.clearGridCache', async () => {
            gridAirController.clearGridCache.mockImplementation((req, res) => {
                res.status(200).json({ message: 'Grid cache cleared', deleted_entries: 12 });
            });

            const res = await request(app)
                .delete('/api/cache/grid')
                .query({ pattern: 'grid_%' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                message: 'Grid cache cleared',
                deleted_entries: 12
            });
            expect(gridAirController.clearGridCache).toHaveBeenCalledTimes(1);
        });
    });

    describe('5. Безопасность и обработка исключений (asyncHandler)', () => {
        it('возвращает 500 и не роняет сервер, если контроллер выбросил исключение', async () => {
            gridAirController.getGridAirQuality.mockImplementation(async () => {
                throw new Error('Unexpected database failure');
            });

            const res = await request(app).get('/api/air-quality/grid');

            expect(res.status).toBe(500);
            expect(res.body).toEqual({ error: 'Internal server error' });
        });
    });

    describe('6. Сохранение обратной совместимости существующих маршрутов', () => {
        it('/api/air-quality продолжает вызывать airController.getAirQuality', async () => {
            airController.getAirQuality.mockImplementation((req, res) => {
                res.status(200).json({ status: 'ok', legacy: false });
            });

            const res = await request(app)
                .get('/api/air-quality')
                .query({ lat: '55.75', lon: '37.61' });

            expect(res.status).toBe(200);
            expect(airController.getAirQuality).toHaveBeenCalledTimes(1);
        });

        it('/api/search продолжает вызывать searchController.search', async () => {
            searchController.search.mockImplementation((req, res) => {
                res.status(200).json([{ display_name: 'Москва' }]);
            });

            const res = await request(app)
                .get('/api/search')
                .query({ q: 'Москва' });

            expect(res.status).toBe(200);
            expect(searchController.search).toHaveBeenCalledTimes(1);
        });
    });
});
