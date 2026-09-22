// tests/services/historyService.test.js — тесты истории замеров

const historyService = require('../../services/historyService');
const dbConfig = require('../../config/db');

jest.mock('../../config/db', () => ({
    getDB: jest.fn()
}));

describe('Service: historyService', () => {
    let mockDb;

    beforeEach(() => {
        mockDb = {
            all: jest.fn(),
            get: jest.fn(),
            run: jest.fn()
        };
        dbConfig.getDB.mockReturnValue(mockDb);
        jest.useFakeTimers().setSystemTime(new Date('2026-09-19T12:00:00Z')); // Фиксируем время
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    describe('saveFromResponse()', () => {
        it('должен сохранять только прошлые часы и удалять записи старше 7 суток', async () => {
            const mockData = {
                latitude: 55.75,
                longitude: 37.61,
                used_source: 'open-meteo',
                hourly: {
                    // Почасовые метки ответа живут в часовом поясе Europe/Moscow.
                    // «Сейчас» в тесте: 2026-09-19T12:00:00Z = 15:00 по Москве.
                    // 11:00 по Москве (08:00 UTC)   — уже прошлый час (сохраняем);
                    // 16:00 по Москве (13:00 UTC)   — ещё будущий час (не сохраняем).
                    time: ['2026-09-19T11:00', '2026-09-19T16:00'],
                    pm10: [15, 20],
                    pm2_5: [10, 12]
                }
            };

            await historyService.saveFromResponse(mockData);

            // В архив должен попасть только прошлый час (11:00 МСК).
            // Отфильтровываем INSERT-вызовы, чтобы не смешивать их с DELETE-очисткой.
            const insertCalls = mockDb.run.mock.calls.filter(([sql]) => String(sql).includes('INSERT OR IGNORE'));
            expect(insertCalls).toHaveLength(1);
            // Параметры вставки: (latitude, longitude, timestamp, pollutant_data, source)
            expect(insertCalls[0][1]).toEqual(expect.arrayContaining([55.75, 37.61]));

            // Проверяем очистку старых данных (старше 7 суток)
            const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            expect(mockDb.run).toHaveBeenCalledWith(
                'DELETE FROM air_quality_history WHERE timestamp < ?',
                [sevenDaysAgo]
            );
        });

        it('должен округлять координаты до 2 знаков при сохранении в архив', async () => {
            const mockData = {
                latitude: 55.756,
                longitude: 37.614,
                used_source: 'open-meteo',
                hourly: {
                    time: ['2026-09-19T11:00'],
                    pm10: [15]
                }
            };

            await historyService.saveFromResponse(mockData);

            const insertCalls = mockDb.run.mock.calls.filter(([sql]) => String(sql).includes('INSERT OR IGNORE'));
            expect(insertCalls).toHaveLength(1);
            expect(insertCalls[0][1][0]).toBe(55.76);
            expect(insertCalls[0][1][1]).toBe(37.61);
        });

        it('не должен выбрасывать исключение при сбое базы данных во время сохранения', async () => {
            mockDb.run.mockRejectedValue(new Error('disk I/O error'));
            const mockData = {
                latitude: 55.75,
                longitude: 37.61,
                hourly: {
                    time: ['2026-09-19T11:00'],
                    pm10: [10]
                }
            };

            await expect(historyService.saveFromResponse(mockData)).resolves.not.toThrow();
        });

        it('должен выходить без ошибок, если база данных недоступна (getDB вернул null или ошибку)', async () => {
            dbConfig.getDB.mockRejectedValueOnce(new Error('db down'));
            await expect(historyService.saveFromResponse({ hourly: { time: ['2026-09-19T11:00'] } })).resolves.toBeUndefined();
            expect(mockDb.run).not.toHaveBeenCalled();

            dbConfig.getDB.mockReturnValueOnce(null);
            await expect(historyService.saveFromResponse({ hourly: { time: ['2026-09-19T11:00'] } })).resolves.toBeUndefined();
        });

        it('должен корректно обрабатывать отсутствие входных данных data или hourly.time', async () => {
            await historyService.saveFromResponse(null);
            await historyService.saveFromResponse({});
            await historyService.saveFromResponse({ hourly: null });
            await historyService.saveFromResponse({ hourly: { time: 'not-an-array' } });
            expect(mockDb.run).not.toHaveBeenCalled();
        });

        it('должен использовать источник unknown, если used_source не задан', async () => {
            const mockData = {
                latitude: 55.75,
                longitude: 37.61,
                hourly: {
                    time: ['2026-09-19T11:00'],
                    pm10: [10]
                }
            };
            await historyService.saveFromResponse(mockData);
            const insertCalls = mockDb.run.mock.calls.filter(([sql]) => String(sql).includes('INSERT OR IGNORE'));
            expect(insertCalls[0][1][4]).toBe('unknown');
        });

        it('должен корректно парсить метки с Z, числовым смещением и секундами, и пропускать невалидные', async () => {
            const mockData = {
                latitude: 55.75,
                longitude: 37.61,
                hourly: {
                    time: [
                        '2026-09-19T08:00:00Z',
                        '2026-09-19T11:00:00+03:00',
                        '2026-09-19T11:00:00',
                        'invalid-time'
                    ],
                    pm10: [10, 11, 12, 13]
                }
            };
            await historyService.saveFromResponse(mockData);
            const insertCalls = mockDb.run.mock.calls.filter(([sql]) => String(sql).includes('INSERT OR IGNORE'));
            expect(insertCalls).toHaveLength(3);
        });

        it('должен пропускать показатели, не являющиеся массивами, и точки с пустыми данными', async () => {
            const mockData = {
                latitude: 55.75,
                longitude: 37.61,
                hourly: {
                    time: ['2026-09-19T11:00'],
                    pm10: 'not-array'
                }
            };
            await historyService.saveFromResponse(mockData);

            const emptyData = {
                latitude: 55.75,
                longitude: 37.61,
                hourly: {
                    time: ['2026-09-19T11:00']
                }
            };
            await historyService.saveFromResponse(emptyData);
        });
    });

    describe('getLatest()', () => {
        it('должен возвращать последнюю запись из базы для заданных координат с округлением до 2 знаков', async () => {
            const lat = 55.756;
            const lon = 37.614;
            const mockRecord = { id: 1, pollutant_data: '{"pm10": 10}' };

            mockDb.get.mockResolvedValue(mockRecord);

            const result = await historyService.getLatest(lat, lon);

            expect(mockDb.get).toHaveBeenCalledWith(
                'SELECT * FROM air_quality_history WHERE latitude = ? AND longitude = ? ORDER BY timestamp DESC LIMIT 1',
                [55.76, 37.61]
            );
            expect(result).toEqual(mockRecord);
        });

        it('должен возвращать null, если база недоступна', async () => {
            dbConfig.getDB.mockReturnValueOnce(null);
            const result = await historyService.getLatest(55.75, 37.61);
            expect(result).toBeNull();
        });

        it('должен возвращать null при сбое запроса к базе', async () => {
            mockDb.get.mockRejectedValueOnce(new Error('query failed'));
            const result = await historyService.getLatest(55.75, 37.61);
            expect(result).toBeNull();
        });
    });

    describe('mergeWithFresh()', () => {
        it('должен возвращать freshData без изменений, если нет hourly.time', async () => {
            const freshData = { hourly: {} };
            const result = await historyService.mergeWithFresh(freshData, 55.75, 37.61);
            expect(result).toBe(freshData);
        });

        it('должен возвращать freshData без изменений при null, пустом time или если time не массив', async () => {
            expect(await historyService.mergeWithFresh(null, 55.75, 37.61)).toBeNull();
            expect(await historyService.mergeWithFresh({}, 55.75, 37.61)).toEqual({});
            expect(await historyService.mergeWithFresh({ hourly: { time: [] } }, 55.75, 37.61)).toEqual({ hourly: { time: [] } });
            expect(await historyService.mergeWithFresh({ hourly: { time: 'invalid' } }, 55.75, 37.61)).toEqual({ hourly: { time: 'invalid' } });
        });

        it('должен возвращать свежие данные без добавления архива, если база недоступна', async () => {
            dbConfig.getDB.mockReturnValueOnce(null);
            const freshData = {
                latitude: 55.75,
                longitude: 37.61,
                hourly: {
                    time: ['2026-09-19T12:00'],
                    pm10: [10]
                }
            };
            const result = await historyService.mergeWithFresh(freshData, 55.75, 37.61);
            expect(result.history_merged).toBeUndefined();
            expect(result.hourly.time).toEqual(['2026-09-19T12:00']);
        });

        it('должен корректно объединять свежие данные с архивом (приоритет у свежих)', async () => {
            const lat = 55.756; // Должно округлиться до 55.76
            const lon = 37.614; // Должно округлиться до 37.61

            const freshData = {
                latitude: lat,
                longitude: lon,
                hourly: {
                    time: ['2026-09-19T12:00'],
                    pm10: [50] // Свежие данные: pm10 = 50
                }
            };

            // Мокаем ответ из архива: старая запись за 11:00 и конфликтная за 12:00
            mockDb.all.mockResolvedValue([
                {
                    timestamp: new Date('2026-09-19T08:00:00Z').getTime(), // 11:00 по Москве
                    pollutant_data: JSON.stringify({ pm10: 30 })
                },
                {
                    timestamp: new Date('2026-09-19T09:00:00Z').getTime(), // 12:00 по Москве (будет перекрыто)
                    pollutant_data: JSON.stringify({ pm10: 999 })
                }
            ]);

            const result = await historyService.mergeWithFresh(freshData, lat, lon);

            // Проверяем, что запрос ушел с округленными координатами
            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('WHERE latitude = ? AND longitude = ?'),
                [55.76, 37.61, expect.any(Number)]
            );

            // Проверяем результат слияния
            expect(result.hourly.time).toEqual(['2026-09-19T11:00', '2026-09-19T12:00']);
            // Значение за 11:00 берется из БД (30). Значение за 12:00 из свежих данных (50), а не 999.
            expect(result.hourly.pm10).toEqual([30, 50]);
            expect(result.history_merged).toBe(true);
        });

        it('должен корректно обрабатывать показатели в freshData, не являющиеся массивами', async () => {
            const freshData = {
                hourly: {
                    time: ['2026-09-19T12:00'],
                    pm10: 'not-array'
                }
            };
            mockDb.all.mockResolvedValue([]);
            const result = await historyService.mergeWithFresh(freshData, 55.75, 37.61);
            expect(result.hourly.pm10).toEqual([null]);
        });

        it('должен безопасно обрабатывать битый JSON или null в pollutant_data архивных записей', async () => {
            const freshData = {
                hourly: {
                    time: ['2026-09-19T12:00'],
                    pm10: [50]
                }
            };
            mockDb.all.mockResolvedValue([
                {
                    timestamp: new Date('2026-09-19T08:00:00Z').getTime(),
                    pollutant_data: 'corrupted-json'
                },
                {
                    timestamp: new Date('2026-09-19T07:00:00Z').getTime(),
                    pollutant_data: 'null'
                }
            ]);
            const result = await historyService.mergeWithFresh(freshData, 55.75, 37.61);
            expect(result.history_merged).toBe(true);
            expect(result.hourly.pm10).toEqual([null, null, 50]);
        });

        it('должен проставлять null для загрязнителей, отсутствующих в архивной точке', async () => {
            const freshData = {
                hourly: {
                    time: ['2026-09-19T12:00'],
                    pm10: [50],
                    o3: [20]
                }
            };
            mockDb.all.mockResolvedValue([
                {
                    timestamp: new Date('2026-09-19T08:00:00Z').getTime(),
                    pollutant_data: JSON.stringify({ pm10: 25 }) // o3 отсутствует
                }
            ]);
            const result = await historyService.mergeWithFresh(freshData, 55.75, 37.61);
            expect(result.hourly.pm10).toEqual([25, 50]);
            expect(result.hourly.o3).toEqual([null, 20]);
        });

        it('не должен устанавливать флаг history_merged, если все архивные точки уже присутствуют в свежих данных', async () => {
            const freshData = {
                hourly: {
                    time: ['2026-09-19T11:00'],
                    pm10: [50]
                }
            };
            mockDb.all.mockResolvedValue([
                {
                    timestamp: new Date('2026-09-19T08:00:00Z').getTime(), // 11:00 МСК
                    pollutant_data: JSON.stringify({ pm10: 30 })
                }
            ]);
            const result = await historyService.mergeWithFresh(freshData, 55.75, 37.61);
            expect(result.history_merged).toBeUndefined();
            expect(result.hourly.pm10).toEqual([50]);
        });
    });
});