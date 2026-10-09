const axios = require('axios');
const batchAirService = require('../../services/batchAirService');

jest.mock('axios');

describe('Service: batchAirService (Пакетные запросы к Open-Meteo)', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('1. generateMacroGridCoordinates()', () => {
        it('возвращает массив из 80–100 опорных узлов для территории РФ', () => {
            const points = batchAirService.generateMacroGridCoordinates();
            expect(Array.isArray(points)).toBe(true);
            expect(points.length).toBeGreaterThanOrEqual(80);
            expect(points.length).toBeLessThanOrEqual(100);
        });

        it('все точки имеют валидные числовые координаты в границах РФ и смежных зон', () => {
            const points = batchAirService.generateMacroGridCoordinates();
            points.forEach((p, idx) => {
                expect(typeof p.lat, `Точка ${idx} должна иметь числовую широту`).toBe('number');
                expect(typeof p.lon, `Точка ${idx} должна иметь числовую долготу`).toBe('number');
                expect(p.lat).toBeGreaterThanOrEqual(41);
                expect(p.lat).toBeLessThanOrEqual(75);
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

            expect(hasWest, 'Сетка должна содержать западные узлы').toBe(true);
            expect(hasCenter, 'Сетка должна содержать центральные/сибирские узлы').toBe(true);
            expect(hasEast, 'Сетка должна содержать дальневосточные узлы').toBe(true);
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
    });
});
