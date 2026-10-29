const axios = require('axios');
const aqiCalculator = require('../../services/aqiCalculator');
const backupAirService = require('../../services/backupAirService');

jest.mock('axios');
jest.mock('../../services/aqiCalculator', () => ({
    calculateEAQI: jest.fn()
}));

describe('Service: backupAirService.fetchAirQuality', () => {
    const lat = 53.7575;
    const lon = 87.1360;
    const mockApiKey = 'test-openweathermap-key-123';
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv, BACKUP_API_KEY: mockApiKey };
    });

    afterEach(() => {
        process.env = originalEnv;
        jest.clearAllMocks();
    });

    describe('Конфигурация и валидация окружения', () => {
        it('должен бросать ошибку, если API ключ отсутствует', async () => {
            delete process.env.BACKUP_API_KEY;

            await expect(backupAirService.fetchAirQuality(lat, lon))
                .rejects
                .toThrow(/источник недоступен|api key/i);

            expect(axios.get).not.toHaveBeenCalled();
        });
    });

    describe('Успешные запросы и нормализация структуры', () => {
        const expectedUrl = `https://api.openweathermap.org/data/2.5/air_pollution/forecast?lat=${lat}&lon=${lon}&appid=${mockApiKey}`;

        it('должен корректно нормализовать ответ OpenWeatherMap под формат Open-Meteo', async () => {
            // OpenWeatherMap отдает Unix timestamp (секунды) в UTC:
            // 1704067200 -> 2024-01-01 00:00:00 UTC -> 2024-01-01 03:00:00 Europe/Moscow (+3)
            // 1704070800 -> 2024-01-01 01:00:00 UTC -> 2024-01-01 04:00:00 Europe/Moscow (+3)
            const mockOwmResponse = {
                coord: { lat, lon },
                list: [
                    {
                        dt: 1704067200,
                        components: {
                            co: 250.5,
                            no2: 18.2,
                            o3: 45.0,
                            so2: 5.1,
                            pm2_5: 12.3,
                            pm10: 22.0
                        }
                    },
                    {
                        dt: 1704070800,
                        components: {
                            pm10: 30.0,
                            pm2_5: 15.0
                        }
                    }
                ]
            };

            axios.get.mockResolvedValue({ data: mockOwmResponse });

            aqiCalculator.calculateEAQI
                .mockReturnValueOnce(2)
                .mockReturnValueOnce(3);

            const result = await backupAirService.fetchAirQuality(lat, lon);

            expect(axios.get).toHaveBeenCalledTimes(1);
            expect(axios.get).toHaveBeenCalledWith(expectedUrl, { timeout: 1000 });

            expect(aqiCalculator.calculateEAQI).toHaveBeenCalledTimes(2);
            expect(aqiCalculator.calculateEAQI).toHaveBeenNthCalledWith(1, {
                pm10: 22.0,
                pm2_5: 12.3,
                co: 250.5,
                no2: 18.2,
                so2: 5.1,
                o3: 45.0
            });
            expect(aqiCalculator.calculateEAQI).toHaveBeenNthCalledWith(2, {
                pm10: 30.0,
                pm2_5: 15.0,
                co: 0,
                no2: 0,
                so2: 0,
                o3: 0
            });

            expect(result).toEqual({
                latitude: lat,
                longitude: lon,
                timezone: 'Europe/Moscow',
                utc_offset_seconds: 10800,
                elevation: 0,
                used_source: 'open-weather-map',
                hourly_units: expect.objectContaining({
                    time: 'iso8601',
                    pm10: 'μg/m³',
                    pm2_5: 'μg/m³',
                    carbon_monoxide: 'μg/m³',
                    nitrogen_dioxide: 'μg/m³',
                    sulphur_dioxide: 'μg/m³',
                    ozone: 'μg/m³',
                    european_aqi: 'EAQI'
                }),
                hourly: {
                    time: ['2024-01-01T03:00', '2024-01-01T04:00'],
                    pm10: [22.0, 30.0],
                    pm2_5: [12.3, 15.0],
                    carbon_monoxide: [250.5, 0],
                    nitrogen_dioxide: [18.2, 0],
                    sulphur_dioxide: [5.1, 0],
                    ozone: [45.0, 0],
                    aerosol_optical_depth: [0, 0],
                    dust: [0, 0],
                    uv_index: [0, 0],
                    european_aqi: [2, 3]
                }
            });
        });

        it('должен возвращать пустые массивы той же структуры, если список точек пуст', async () => {
            axios.get.mockResolvedValue({
                data: { coord: { lat, lon }, list: [] }
            });

            const result = await backupAirService.fetchAirQuality(lat, lon);

            expect(result.hourly.time).toEqual([]);
            expect(result.hourly.pm10).toEqual([]);
            expect(result.hourly.aerosol_optical_depth).toEqual([]);
            expect(result.hourly.european_aqi).toEqual([]);
            expect(aqiCalculator.calculateEAQI).not.toHaveBeenCalled();
        });

        it('должен корректно обрабатывать случай, когда list не является массивом, а coord отсутствует', async () => {
            axios.get.mockResolvedValue({
                data: { list: null }
            });

            const result = await backupAirService.fetchAirQuality(lat, lon);

            expect(result.latitude).toBe(lat);
            expect(result.longitude).toBe(lon);
            expect(result.hourly.time).toEqual([]);
            expect(result.hourly.pm10).toEqual([]);
        });

        it('должен использовать фоллбэки координат, если coord пуст или содержит частичные данные', async () => {
            axios.get.mockResolvedValue({
                data: { coord: {}, list: [] }
            });

            const result = await backupAirService.fetchAirQuality(lat, lon);

            expect(result.latitude).toBe(lat);
            expect(result.longitude).toBe(lon);
        });

        it('должен подставлять нули, если item.components отсутствует (undefined/null)', async () => {
            axios.get.mockResolvedValue({
                data: {
                    coord: { lat, lon },
                    list: [
                        { dt: 1704067200 }
                    ]
                }
            });

            aqiCalculator.calculateEAQI.mockReturnValue(1);

            const result = await backupAirService.fetchAirQuality(lat, lon);

            expect(aqiCalculator.calculateEAQI).toHaveBeenCalledWith({
                pm10: 0,
                pm2_5: 0,
                co: 0,
                no2: 0,
                so2: 0,
                o3: 0
            });
            expect(result.hourly.pm10).toEqual([0]);
            expect(result.hourly.pm2_5).toEqual([0]);
            expect(result.hourly.carbon_monoxide).toEqual([0]);
        });
    });

    describe('Обработка ошибок сети и API', () => {
        it('должен пробрасывать таймаут (1000 мс)', async () => {
            axios.get.mockRejectedValue(new Error('timeout of 1000ms exceeded'));

            await expect(backupAirService.fetchAirQuality(lat, lon))
                .rejects
                .toThrow('timeout of 1000ms exceeded');
        });

        it('должен пробрасывать HTTP-ошибки (например, 401 Unauthorized)', async () => {
            const unauthorizedError = new Error('Request failed with status code 401');
            unauthorizedError.response = { status: 401, data: { message: 'Invalid API key' } };

            axios.get.mockRejectedValue(unauthorizedError);

            await expect(backupAirService.fetchAirQuality(lat, lon))
                .rejects
                .toThrow('Request failed with status code 401');
        });
    });
});