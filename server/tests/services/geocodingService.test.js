// tests/services/geocodingService.test.js — тесты геокодирования

const axios = require('axios');
const geocodingService = require('../../services/geocodingService');

jest.mock('axios');

describe('Service: geocodingService.search', () => {
    const query = 'москва';
    const expectedUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=ru&format=json`;

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Валидация входных данных', () => {
        it('должен возвращать пустой массив без вызова API для пустых или невалидных запросов', async () => {
            const invalidQueries = ['', '   ', null, undefined, 123, {}, []];

            for (const invalidQuery of invalidQueries) {
                const result = await geocodingService.search(invalidQuery);
                expect(result).toEqual([]);
                expect(axios.get).not.toHaveBeenCalled();
            }
        });
    });

    describe('Нормализация данных', () => {
        it('должен формировать display_name из названия, региона и страны, а координаты приводить к строкам', async () => {
            const mockResponse = {
                data: {
                    results: [
                        {
                            name: 'Москва',
                            admin1: 'Москва', // admin1 обычно выступает регионом
                            country: 'Россия',
                            latitude: 55.75583,
                            longitude: 37.61778
                        }
                    ]
                }
            };

            axios.get.mockResolvedValue(mockResponse);

            const result = await geocodingService.search(query);

            expect(axios.get).toHaveBeenCalledWith(expectedUrl, { timeout: 1000 });
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                lat: '55.75583',
                lon: '37.61778',
                display_name: 'Москва, Москва, Россия'
            });
        });

        it('должен корректно собирать display_name, если отсутствует регион', async () => {
            const mockResponse = {
                data: {
                    results: [
                        {
                            name: 'Берлин',
                            country: 'Германия',
                            latitude: 52.52437,
                            longitude: 13.41053
                        }
                    ]
                }
            };

            axios.get.mockResolvedValue(mockResponse);

            const result = await geocodingService.search('берлин');

            expect(result[0].display_name).toBe('Берлин, Германия');
        });

        it('должен возвращать пустой массив, если API не нашло результатов (нет ключа results)', async () => {
            const mockResponse = {
                data: {

                }
            };

            axios.get.mockResolvedValue(mockResponse);

            const result = await geocodingService.search('неизвестный_город');

            expect(result).toEqual([]);
        });
    });

    describe('Обработка ошибок', () => {
        it('должен пробрасывать исключение при сбое запроса или таймауте', async () => {
            const networkError = new Error('timeout of 1000ms exceeded');
            axios.get.mockRejectedValue(networkError);

            await expect(geocodingService.search(query)).rejects.toThrow('timeout of 1000ms exceeded');
        });
    });
});