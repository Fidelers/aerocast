const axios = require('axios');

const TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS) || 1000;

async function fetchAirQuality(lat, lon) {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,aerosol_optical_depth,dust,uv_index,european_aqi&timezone=Europe/Moscow&past_days=7&forecast_days=4`;

    try {
        const response = await axios.get(url, { timeout: TIMEOUT_MS });

        return {
            ...response.data,
            used_source: 'open-meteo'
        };
    } catch (error) {
        throw error;
    }
}

module.exports = {
    fetchAirQuality
};