// tests/services/primaryAirService.test.js — тесты основного источника данных

const axios = require('axios');
const primaryAirService = require('../../services/primaryAirService');

jest.mock('axios');

describe('Service: primaryAirService.fetchAirQuality', () => {
    const lat = 53.7575;
    const lon = 87.1360;
    const expectedUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,aerosol_optical_depth,dust,uv_index,european_aqi&timezone=Europe/Moscow&past_days=7&forecast_days=4`;

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Успешные запросы', () => {
        it('должен возвращать данные API с флагом used_source="open-meteo" при таймауте 1000 мс', async () => {
            const mockResponseData = {
                latitude: lat,
                longitude: lon,
                timezone: 'Europe/Moscow',
                hourly: { pm10: [10, 15], pm2_5: [5, 8] }
            };

            axios.get.mockResolvedValue({ data: mockResponseData });

            const result = await primaryAirService.fetchAirQuality(lat, lon);

            expect(axios.get).toHaveBeenCalledTimes(1);
            expect(axios.get).toHaveBeenCalledWith(expectedUrl, { timeout: 1000 });
            expect(result).toEqual({
                ...mockResponseData,
                used_source: 'open-meteo'
            });
        });

        it('должен корректно формировать URL для отрицательных и нулевых координат', async () => {
            const negativeLat = -15.5;
            const zeroLon = 0;
            const expectedEdgeUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${negativeLat}&longitude=${zeroLon}&hourly=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,aerosol_optical_depth,dust,uv_index,european_aqi&timezone=Europe/Moscow&past_days=7&forecast_days=4`;

            axios.get.mockResolvedValue({ data: {} });

            await primaryAirService.fetchAirQuality(negativeLat, zeroLon);

            expect(axios.get).toHaveBeenCalledWith(expectedEdgeUrl, { timeout: 1000 });
        });
    });

    describe('Обработка ошибок', () => {
        it('должен пробрасывать ошибку при таймауте (Network Error)', async () => {
            const networkError = new Error('timeout of 1000ms exceeded');
            axios.get.mockRejectedValue(networkError);

            await expect(primaryAirService.fetchAirQuality(lat, lon)).rejects.toThrow('timeout of 1000ms exceeded');
        });

        it('должен пробрасывать HTTP-ошибки от внешнего API (например, 500)', async () => {
            const httpError = new Error('Request failed with status code 500');
            httpError.response = { status: 500, data: { error: true } };

            axios.get.mockRejectedValue(httpError);

            await expect(primaryAirService.fetchAirQuality(lat, lon)).rejects.toThrow('Request failed with status code 500');
        });
    });
});