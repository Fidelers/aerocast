// services/backupAirService.js — резервный источник данных о качестве воздуха
const axios = require('axios');
const aqiCalculator = require('./aqiCalculator');
const timeUtils = require('./timeUtils');

const TIMEOUT_MS = 1000;
const TIMEZONE = 'Europe/Moscow';
const UTC_OFFSET_SECONDS = 10800;

// Извлекает показатели из item.components, отсутствующие заменяет на 0
function extractComponents(components) {
    const source = components || {};
    return {
        pm10: source.pm10 ?? 0,
        pm2_5: source.pm2_5 ?? 0,
        co: source.co ?? 0,
        no2: source.no2 ?? 0,
        so2: source.so2 ?? 0,
        o3: source.o3 ?? 0
    };
}

async function fetchAirQuality(lat, lon) {
    const apiKey = process.env.BACKUP_API_KEY;
    if (!apiKey) {
        throw new Error('Резервный источник недоступен: отсутствует API key (BACKUP_API_KEY)');
    }

    const url = `http://api.openweathermap.org/data/2.5/air_pollution/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}`;

    try {
        const response = await axios.get(url, { timeout: TIMEOUT_MS });
        const list = Array.isArray(response.data.list) ? response.data.list : [];

        // Массивы показателей одинаковой длины
        const hourly = {
            time: [],
            pm10: [],
            pm2_5: [],
            carbon_monoxide: [],
            nitrogen_dioxide: [],
            sulphur_dioxide: [],
            ozone: [],
            european_aqi: []
        };

        for (const item of list) {
            const { pm10, pm2_5, co, no2, so2, o3 } = extractComponents(item.components);

            hourly.time.push(timeUtils.formatIsoHour(item.dt));
            hourly.pm10.push(pm10);
            hourly.pm2_5.push(pm2_5);
            hourly.carbon_monoxide.push(co);
            hourly.nitrogen_dioxide.push(no2);
            hourly.sulphur_dioxide.push(so2);
            hourly.ozone.push(o3);
            hourly.european_aqi.push(aqiCalculator.calculateEAQI({ pm10, pm2_5, co, no2, so2, o3 }));
        }

        const pointCount = hourly.time.length;

        // Собираем ответ в формате основного источника (Open-Meteo)
        return {
            latitude: response.data.coord?.lat ?? lat,
            longitude: response.data.coord?.lon ?? lon,
            timezone: TIMEZONE,
            utc_offset_seconds: UTC_OFFSET_SECONDS,
            elevation: 0,
            used_source: 'open-weather-map',
            hourly_units: {
                time: 'iso8601',
                pm10: 'μg/m³',
                pm2_5: 'μg/m³',
                carbon_monoxide: 'μg/m³',
                nitrogen_dioxide: 'μg/m³',
                sulphur_dioxide: 'μg/m³',
                ozone: 'μg/m³',
                european_aqi: 'EAQI'
            },
            hourly: {
                ...hourly,
                // Показатели, недоступные в источнике, заполняем нулями той же длины
                aerosol_optical_depth: new Array(pointCount).fill(0),
                dust: new Array(pointCount).fill(0),
                uv_index: new Array(pointCount).fill(0)
            }
        };
    } catch (error) {
        throw error;
    }
}

module.exports = {
    fetchAirQuality
};
