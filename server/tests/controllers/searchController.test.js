// tests/controllers/searchController.test.js — тесты контроллера searchController

const searchController = require('../../controllers/searchController');
const cacheService = require('../../services/cacheService');
const geocodingService = require('../../services/geocodingService');

jest.mock('../../services/cacheService', () => ({
    getCache: jest.fn(),
    setCache: jest.fn()
}));
jest.mock('../../services/geocodingService', () => ({
    search: jest.fn()
}));

describe('Controller: searchController.search', () => {
    let req;
    let res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = { query: { q: 'Москва' } };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        cacheService.getCache.mockResolvedValue(null);
        cacheService.setCache.mockResolvedValue(undefined);
        geocodingService.search.mockResolvedValue([]);
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Валидация параметра q', () => {
        it('должен возвращать 400, если q отсутствует', async () => {
            req.query = {};

            await searchController.search(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Missing query parameter q' });
        });

        it('должен возвращать 400, если q — пустая строка', async () => {
            req.query = { q: '' };

            await searchController.search(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Missing query parameter q' });
        });

        it('должен возвращать 400, если q состоит только из пробелов', async () => {
            req.query = { q: '   ' };

            await searchController.search(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Missing query parameter q' });
        });

        it('должен возвращать 400, если q не является строкой', async () => {
            req.query = { q: 123 };
            await searchController.search(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Missing query parameter q' });

            req.query = { q: ['москва'] };
            await searchController.search(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Missing query parameter q' });
        });

        it('не должен обращаться к кэшу и геокодеру при невалидном q', async () => {
            req.query = { q: '  ' };

            await searchController.search(req, res);

            expect(cacheService.getCache).not.toHaveBeenCalled();
            expect(geocodingService.search).not.toHaveBeenCalled();
        });
    });

    describe('Поиск через геокодер', () => {
        it('должен нормализовать запрос (trim + lower case), вызвать геокодер и сохранить результат в кэш на 24 часа', async () => {
            const results = [
                { lat: '55.75583', lon: '37.61778', display_name: 'Москва, Москва, Россия' }
            ];

            req.query = { q: '  МоСкВа  ' };
            geocodingService.search.mockResolvedValue(results);

            await searchController.search(req, res);

            expect(cacheService.getCache).toHaveBeenCalledWith('search_москва', false);
            expect(geocodingService.search).toHaveBeenCalledWith('москва');
            expect(cacheService.setCache).toHaveBeenCalledWith('search_москва', results, 86400);
            expect(res.json).toHaveBeenCalledWith(results);
        });

        it('должен корректно обрабатывать составные названия с дефисом и несколькими словами', async () => {
            const results = [
                { lat: '59.93863', lon: '30.31413', display_name: 'Санкт-Петербург, Россия' }
            ];

            req.query = { q: '  Санкт-Петербург  ' };
            geocodingService.search.mockResolvedValue(results);

            await searchController.search(req, res);

            expect(cacheService.getCache).toHaveBeenCalledWith('search_санкт-петербург', false);
            expect(geocodingService.search).toHaveBeenCalledWith('санкт-петербург');
            expect(res.json).toHaveBeenCalledWith(results);
        });

        it('должен вернуть пустой список, если геокодер не нашёл совпадений', async () => {
            geocodingService.search.mockResolvedValue([]);

            await searchController.search(req, res);

            expect(res.json).toHaveBeenCalledWith([]);
            expect(cacheService.setCache).toHaveBeenCalledWith('search_москва', [], 86400);
        });
    });

    describe('Попадание в кэш', () => {
        it('должен вернуть результаты из кэша без обращения к геокодеру', async () => {
            const cachedResults = [
                { lat: '55.75583', lon: '37.61778', display_name: 'Москва, Москва, Россия' }
            ];

            cacheService.getCache.mockResolvedValue(cachedResults);

            await searchController.search(req, res);

            expect(cacheService.getCache).toHaveBeenCalledWith('search_москва', false);
            expect(geocodingService.search).not.toHaveBeenCalled();
            expect(cacheService.setCache).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(cachedResults);
        });
    });

    describe('Обработка ошибок', () => {
        it('должен возвращать 500 при ошибке геокодера', async () => {
            geocodingService.search.mockRejectedValue(new Error('timeout of 1000ms exceeded'));

            await searchController.search(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Failed to search location' });
        });

        it('должен возвращать 500 при ошибке чтения кэша', async () => {
            cacheService.getCache.mockRejectedValue(new Error('db is broken'));

            await searchController.search(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Failed to search location' });
        });

        it('должен возвращать найденные результаты клиенту, даже если запись в кэш упала', async () => {
            const results = [
                { lat: '55.75583', lon: '37.61778', display_name: 'Москва, Россия' }
            ];
            req.query = { q: 'Москва' };
            geocodingService.search.mockResolvedValue(results);
            cacheService.setCache.mockRejectedValue(new Error('cache write failed'));

            await searchController.search(req, res);

            expect(res.json).toHaveBeenCalledWith(results);
        });
    });
});
