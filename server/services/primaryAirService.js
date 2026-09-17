const axios = require('axios');

const TIMEOUT_MS = 1000;

// Тут функция берет данные о воздухе из Open-Meteo
// Принимает: lat (широта), lon (долгота)
async function fetchAirQuality(lat, lon) {
    // Создаем url со всеми параметрами через шаблонную строку
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,aerosol_optical_depth,dust,uv_index,european_aqi&timezone=Europe/Moscow&past_days=7&forecast_days=4`;

    try {
        // получает запрос с таймаутом 1000 мс
        const response = await axios.get(url, { timeout: TIMEOUT_MS });

        // возвращает данные ответа с добавлением флага used_source
        return {
            ...response.data,
            used_source: 'open-meteo'
        };
    } catch (error) {
        // При ошибке пробрасываем исключение наверх
        throw error;
    }
}

module.exports = {
    fetchAirQuality
};