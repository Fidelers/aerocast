const axios = require('axios');
const batchAirService = require('../../services/batchAirService');

jest.mock('axios');

describe('Service: batchAirService (Пакетные запросы к Open-Meteo)', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('1. generateMacroGridCoordinates()', () => {
        it('возвращает расширенный массив калиброванных опорных узлов (603) для территории РФ', () => {
            const points = batchAirService.generateMacroGridCoordinates();
            expect(Array.isArray(points)).toBe(true);
            expect(points.length).toBe(603);
        });

        it('обеспечивает сбалансированное покрытие промышленных центров с защитными буферами фона без паразитной скученности', () => {
            const points = batchAirService.generateMacroGridCoordinates();
            // Череповец и защитные буферы (lat ~ 58.7..59.6, lon ~ 37.0..38.8)
            const cherepovetsPoints = points.filter(p => p.lat >= 58.7 && p.lat <= 59.6 && p.lon >= 37.0 && p.lon <= 38.8);
            expect(cherepovetsPoints.length).toBeGreaterThanOrEqual(3);

            // Мирный и защитные буферы (lat ~ 62.0..63.1, lon ~ 113.0..115.0)
            const mirnyPoints = points.filter(p => p.lat >= 62.0 && p.lat <= 63.1 && p.lon >= 113.0 && p.lon <= 115.0);
            expect(mirnyPoints.length).toBeGreaterThanOrEqual(3);

            // Москва и прилегающий пояс (lat ~ 54.8..56.3, lon ~ 36.8..38.5)
            const moscowPoints = points.filter(p => p.lat >= 54.8 && p.lat <= 56.3 && p.lon >= 36.8 && p.lon <= 38.5);
            expect(moscowPoints.length).toBeGreaterThanOrEqual(3);
        });

        it('все точки имеют валидные числовые координаты в границах РФ и смежных зон', () => {
            const points = batchAirService.generateMacroGridCoordinates();
            points.forEach((p) => {
                expect(typeof p.lat).toBe('number');
                expect(typeof p.lon).toBe('number');
                expect(p.lat).toBeGreaterThanOrEqual(41);
                expect(p.lat).toBeLessThanOrEqual(82);
                expect(p.lon).toBeGreaterThanOrEqual(19);
                expect(p.lon).toBeLessThanOrEqual(180);
                expect(Number.isNaN(p.lat)).toBe(false);
                expect(Number.isNaN(p.lon)).toBe(false);
            });
        });

        it('обеспечивает охват от запада (Калининград/Европейская часть) до Дальнего Востока', () => {
            const points = batchAirService.generateMacroGridCoordinates();
            const hasWest = points.some(p => p.lon <= 30);
            const hasCenter = points.some(p => p.lon >= 60 && p.lon <= 100);
            const hasEast = points.some(p => p.lon >= 130);

            expect(hasWest).toBe(true);
            expect(hasCenter).toBe(true);
            expect(hasEast).toBe(true);
        });
    });

    describe('2. generateMicroGridCoordinates(centerLat, centerLon)', () => {
        const centerLat = 53.7596;
        const centerLon = 87.1467;

        it('формирует регулярную матрицу 5x5 (25 точек) или 6x6 (36 точек)', () => {
            const result = batchAirService.generateMicroGridCoordinates(centerLat, centerLon);
            expect(result).toHaveProperty('points');
            expect(result).toHaveProperty('bbox');
            expect(Array.isArray(result.points)).toBe(true);
            expect([25, 36]).toContain(result.points.length);
        });

        it('шаг сетки строго равен 0.10° по широте и долготе (~10–11 км CAMS)', () => {
            const { points } = batchAirService.generateMicroGridCoordinates(centerLat, centerLon);

            // Находим уникальные широты и долготы
            const uniqueLats = [...new Set(points.map(p => Number(p.lat.toFixed(4))))].sort((a, b) => a - b);
            const uniqueLons = [...new Set(points.map(p => Number(p.lon.toFixed(4))))].sort((a, b) => a - b);

            expect(uniqueLats.length).toBeGreaterThanOrEqual(5);
            expect(uniqueLons.length).toBeGreaterThanOrEqual(5);

            for (let i = 1; i < uniqueLats.length; i++) {
                const diff = uniqueLats[i] - uniqueLats[i - 1];
                expect(diff).toBeCloseTo(0.10, 2);
            }
            for (let i = 1; i < uniqueLons.length; i++) {
                const diff = uniqueLons[i] - uniqueLons[i - 1];
                expect(diff).toBeCloseTo(0.10, 2);
            }
        });

        it('рассчитывает корректный BBox [minLon, minLat, maxLon, maxLat], содержащий центр', () => {
            const { bbox } = batchAirService.generateMicroGridCoordinates(centerLat, centerLon);
            expect(Array.isArray(bbox)).toBe(true);
            expect(bbox.length).toBe(4);

            const [minLon, minLat, maxLon, maxLat] = bbox;
            expect(minLon).toBeLessThan(maxLon);
            expect(minLat).toBeLessThan(maxLat);

            expect(centerLon).toBeGreaterThanOrEqual(minLon);
            expect(centerLon).toBeLessThanOrEqual(maxLon);
            expect(centerLat).toBeGreaterThanOrEqual(minLat);
            expect(centerLat).toBeLessThanOrEqual(maxLat);
        });

        it('выбрасывает ошибку при недопустимых координатах центра', () => {
            expect(() => batchAirService.generateMicroGridCoordinates(null, centerLon)).toThrow();
            expect(() => batchAirService.generateMicroGridCoordinates(95, centerLon)).toThrow();
            expect(() => batchAirService.generateMicroGridCoordinates(centerLat, 200)).toThrow();
        });
    });

    describe('3. fetchBatchAirQuality(coordinates)', () => {
        const sampleCoords = [
            { lat: 53.75, lon: 87.15 },
            { lat: 53.85, lon: 87.25 }
        ];

        it('отправляет единый пакетный запрос к Open-Meteo через запятую с таймаутом 2000 мс', async () => {
            const mockApiResponse = [
                {
                    latitude: 53.75,
                    longitude: 87.15,
                    hourly: {
                        time: ['2026-10-01T00:00'],
                        european_aqi: [25]
                    }
                },
                {
                    latitude: 53.85,
                    longitude: 87.25,
                    hourly: {
                        time: ['2026-10-01T00:00'],
                        european_aqi: [30]
                    }
                }
            ];

            axios.get.mockResolvedValue({ data: mockApiResponse });

            const result = await batchAirService.fetchBatchAirQuality(sampleCoords);

            expect(axios.get).toHaveBeenCalledTimes(1);
            const [url, config] = axios.get.mock.calls[0];

            expect(url).toContain('https://air-quality-api.open-meteo.com/v1/air-quality');
            expect(url).toContain('latitude=53.7500,53.8500');
            expect(url).toContain('longitude=87.1500,87.2500');
            expect(url).toContain('timezone=Europe/Moscow');
            expect(url).toContain('past_days=7');
            expect(url).toContain('forecast_days=4');
            expect(url).toContain('european_aqi');

            expect(config).toEqual(expect.objectContaining({ timeout: 2000 }));
            expect(result).toEqual(mockApiResponse);
        });

        it('возвращает пустой массив без запроса к axios при пустом списке координат', async () => {
            const result = await batchAirService.fetchBatchAirQuality([]);
            expect(result).toEqual([]);
            expect(axios.get).not.toHaveBeenCalled();
        });

        it('пробрасывает исключение при ошибке axios или таймауте', async () => {
            axios.get.mockRejectedValue(new Error('timeout of 2000ms exceeded'));

            await expect(batchAirService.fetchBatchAirQuality(sampleCoords))
                .rejects.toThrow('timeout of 2000ms exceeded');
        });

        it('выполняет чанкированные запросы при большом количестве координат (>250)', async () => {
            // Создаём 300 координат — больше CHUNK_SIZE (250), чтобы вызвать чанкирование
            const manyCoords = Array.from({ length: 300 }, (_, i) => ({
                lat: 55 + i * 0.001,
                lon: 37 + i * 0.001
            }));

            const chunk1Data = [{ latitude: 55, longitude: 37, hourly: { time: ['t1'], european_aqi: [10] } }];
            const chunk2Data = [{ latitude: 55, longitude: 37, hourly: { time: ['t2'], european_aqi: [20] } }];

            // Первый вызов для первого чанка (250 координат), второй для второго (50 координат)
            axios.get.mockResolvedValueOnce({ data: chunk1Data });
            axios.get.mockResolvedValueOnce({ data: chunk2Data });

            const result = await batchAirService.fetchBatchAirQuality(manyCoords);

            expect(axios.get).toHaveBeenCalledTimes(2);
            expect(result).toEqual([...chunk1Data, ...chunk2Data]);
        });

        it('повторяет запрос после 429 Too Many Requests с задержкой (чанкированный путь)', async () => {
            const rateLimitError = new Error('Rate limited');
            rateLimitError.response = { status: 429 };

            // Создаём 300 координат — больше CHUNK_SIZE (250) — чтобы попасть в чанкированный путь
            const manyCoords = Array.from({ length: 300 }, (_, i) => ({
                lat: 55 + i * 0.001,
                lon: 37 + i * 0.001
            }));

            const chunk1Data = [{ latitude: 55, longitude: 37, hourly: { time: ['t1'], european_aqi: [10] } }];
            const chunk2Data = [{ latitude: 55, longitude: 37, hourly: { time: ['t2'], european_aqi: [20] } }];

            // Первый чанк: 429 ошибка, второй чанк: успех
            axios.get.mockRejectedValueOnce(rateLimitError);
            axios.get.mockResolvedValueOnce({ data: chunk1Data });
            axios.get.mockResolvedValueOnce({ data: chunk2Data });

            const start = Date.now();
            const result = await batchAirService.fetchBatchAirQuality(manyCoords);
            const elapsed = Date.now() - start;

            expect(axios.get).toHaveBeenCalledTimes(3); // 1st chunk fail + 1st chunk retry + 2nd chunk
            expect(elapsed).toBeGreaterThanOrEqual(1500);
            expect(result).toEqual([...chunk1Data, ...chunk2Data]);
        });

        it('пробрасывает ошибку, если 429 повторяется и второй запрос тоже падает', async () => {
            const rateLimitError = new Error('Rate limited');
            rateLimitError.response = { status: 429 };

            axios.get.mockRejectedValue(rateLimitError);

            await expect(batchAirService.fetchBatchAirQuality(sampleCoords))
                .rejects.toThrow('Rate limited');
        });

        it('пробрасывает не-429 ошибки без повторов', async () => {
            const networkError = new Error('Network error');

            axios.get.mockRejectedValue(networkError);

            await expect(batchAirService.fetchBatchAirQuality(sampleCoords))
                .rejects.toThrow('Network error');
            expect(axios.get).toHaveBeenCalledTimes(1);
        });

        it('обрабатывает не-массив ответ данных (else if ветка) в чанкированном режиме', async () => {
            const manyCoords = Array.from({ length: 300 }, (_, i) => ({
                lat: 55 + i * 0.001,
                lon: 37 + i * 0.001
            }));

            // Первый чанк возвращает объект (не массив), второй — массив
            axios.get.mockResolvedValueOnce({ data: { latitude: 55, longitude: 37, hourly: { time: ['t1'], european_aqi: [10] } } });
            axios.get.mockResolvedValueOnce({ data: [{ latitude: 56, longitude: 38, hourly: { time: ['t2'], european_aqi: [20] } }] });

            const result = await batchAirService.fetchBatchAirQuality(manyCoords);

            expect(axios.get).toHaveBeenCalledTimes(2);
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ latitude: 55, longitude: 37, hourly: { time: ['t1'], european_aqi: [10] } });
            expect(result[1]).toEqual({ latitude: 56, longitude: 38, hourly: { time: ['t2'], european_aqi: [20] } });
        });
    });

    describe('4. normalizeBatchResponse(rawArray, coordinates)', () => {
        const coordinates = [
            { lat: 53.75, lon: 87.15 },
            { lat: 53.85, lon: 87.25 }
        ];

        // 264 часа (7 суток назад + 1 сутки сегодня + 4 суток прогноза = 11 * 24 = 264)
        const mockTimeSteps = Array.from({ length: 264 }, (_, i) => `2026-10-${String(Math.floor(i / 24) + 1).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00`);

        const rawOpenMeteoArray = [
            {
                latitude: 53.75,
                longitude: 87.15,
                hourly: {
                    time: mockTimeSteps,
                    european_aqi: Array.from({ length: 264 }, (_, i) => 20 + (i % 10)),
                    pm2_5: Array.from({ length: 264 }, () => 15),
                    pm10: Array.from({ length: 264 }, () => 25)
                }
            },
            {
                latitude: 53.85,
                longitude: 87.25,
                hourly: {
                    time: mockTimeSteps,
                    european_aqi: Array.from({ length: 264 }, (_, i) => 30 + (i % 10)),
                    pm2_5: Array.from({ length: 264 }, () => 18),
                    pm10: Array.from({ length: 264 }, () => 28)
                }
            }
        ];

        it('корректно формирует структуру с 264 временными метками и массивом точек', () => {
            const normalized = batchAirService.normalizeBatchResponse(rawOpenMeteoArray, coordinates);

            expect(normalized).toHaveProperty('time');
            expect(normalized.time).toHaveLength(264);
            expect(normalized.time[0]).toBe('2026-10-01T00:00');

            expect(normalized).toHaveProperty('points');
            expect(normalized.points).toHaveLength(2);

            expect(normalized.points[0]).toEqual({
                lat: 53.75,
                lon: 87.15,
                european_aqi: expect.any(Array)
            });
            expect(normalized.points[0].european_aqi).toHaveLength(264);
        });

        it('заполняет null или отсутствующие значения AQI базовым фоновым уровнем (20)', () => {
            const rawWithNulls = [
                {
                    latitude: 53.75,
                    longitude: 87.15,
                    hourly: {
                        time: mockTimeSteps,
                        european_aqi: [null, undefined, NaN, ...Array(261).fill(25)]
                    }
                }
            ];

            const normalized = batchAirService.normalizeBatchResponse(rawWithNulls, [{ lat: 53.75, lon: 87.15 }]);
            const aqiArray = normalized.points[0].european_aqi;

            expect(aqiArray[0]).toBe(20);
            expect(aqiArray[1]).toBe(20);
            expect(aqiArray[2]).toBe(20);
            expect(aqiArray[3]).toBe(25);
        });

        it('выбрасывает ошибку при несоответствии количества ответов количеству координат', () => {
            expect(() => batchAirService.normalizeBatchResponse([rawOpenMeteoArray[0]], coordinates)).toThrow();
        });

        it('обрабатывает одиночный объект rawArray (не массив)', () => {
            const singleRaw = {
                hourly: {
                    time: ['2026-10-01T00:00'],
                    european_aqi: [25]
                }
            };
            const res = batchAirService.normalizeBatchResponse(singleRaw, [{ lat: 55.75, lon: 37.61 }]);
            expect(res.points).toHaveLength(1);
            expect(res.points[0].european_aqi).toEqual([25]);
        });

        it('выбрасывает ошибку при отсутствии coordinates (!coordinates)', () => {
            expect(() => batchAirService.normalizeBatchResponse([], null)).toThrow(/expected 0/);
        });

        it('использует пустой массив для time, если hourly.time отсутствует в items[0]', () => {
            const rawNoTime = [{
                hourly: {
                    european_aqi: [30]
                }
            }];
            const res = batchAirService.normalizeBatchResponse(rawNoTime, [{ lat: 55.75, lon: 37.61 }]);
            expect(res.time).toEqual([]);
            expect(res.points[0].european_aqi).toEqual([30]);
        });

        it('использует пустой массив для rawAqi, если item.hourly.european_aqi отсутствует', () => {
            const rawNoAqi = [{
                hourly: {
                    time: ['2026-10-01T00:00']
                }
            }];
            const res = batchAirService.normalizeBatchResponse(rawNoAqi, [{ lat: 55.75, lon: 37.61 }]);
            expect(res.points[0].european_aqi).toEqual([]);
        });
    });

    describe('5. Дополнительные граничные случаи fetchBatchAirQuality', () => {
        it('возвращает [] если coordinates не массив или null', async () => {
            expect(await batchAirService.fetchBatchAirQuality(null)).toEqual([]);
            expect(await batchAirService.fetchBatchAirQuality('invalid')).toEqual([]);
        });

        it('в чанкированном режиме пробрасывает не-429 ошибку сразу (500 Internal Server Error)', async () => {
            const manyCoords = Array.from({ length: 300 }, (_, i) => ({ lat: 55 + i * 0.001, lon: 37 + i * 0.001 }));
            const serverErr = new Error('500 Server Error');
            serverErr.response = { status: 500 };
            axios.get.mockRejectedValue(serverErr);

            await expect(batchAirService.fetchBatchAirQuality(manyCoords)).rejects.toThrow('500 Server Error');
        });

        it('в чанкированном режиме корректно игнорирует null/пустые данные ответа', async () => {
            const manyCoords = Array.from({ length: 300 }, (_, i) => ({ lat: 55 + i * 0.001, lon: 37 + i * 0.001 }));
            axios.get.mockResolvedValueOnce({ data: null });
            axios.get.mockResolvedValueOnce({ data: [{ latitude: 56, longitude: 38 }] });

            const result = await batchAirService.fetchBatchAirQuality(manyCoords);
            expect(result).toHaveLength(1);
        });
    });
});
