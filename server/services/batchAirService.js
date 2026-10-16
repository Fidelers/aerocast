const axios = require('axios');


const MACRO_GRID_POINTS = require('./macroGridPoints500.json');



function generateMacroGridCoordinates() {
    return MACRO_GRID_POINTS.map(p => ({ lat: p.lat, lon: p.lon }));
}


function generateMicroGridCoordinates(centerLat, centerLon) {
    if (
        centerLat === null ||
        centerLon === null ||
        typeof centerLat !== 'number' ||
        typeof centerLon !== 'number' ||
        Number.isNaN(centerLat) ||
        Number.isNaN(centerLon)
    ) {
        throw new Error('Invalid center coordinates: lat and lon must be numbers');
    }

    if (centerLat < -90 || centerLat > 90 || centerLon < -180 || centerLon > 180) {
        throw new Error('Coordinates out of range: lat must be in [-90, 90], lon in [-180, 180]');
    }

    const points = [];
    const step = 0.10;
    const offsets = [-2, -1, 0, 1, 2];

    for (const dy of offsets) {
        for (const dx of offsets) {
            const lat = Number((centerLat + dy * step).toFixed(4));
            const lon = Number((centerLon + dx * step).toFixed(4));
            points.push({ lat, lon });
        }
    }

    const lats = points.map(p => p.lat);
    const lons = points.map(p => p.lon);
    const bbox = [
        Math.min(...lons),
        Math.min(...lats),
        Math.max(...lons),
        Math.max(...lats)
    ];

    return { points, bbox };
}


async function fetchBatchAirQuality(coordinates) {
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
        return [];
    }

    const CHUNK_SIZE = 250;
    if (coordinates.length <= CHUNK_SIZE) {
        const lats = coordinates.map(c => Number(c.lat).toFixed(4)).join(',');
        const lons = coordinates.map(c => Number(c.lon).toFixed(4)).join(',');

        const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}&hourly=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,european_aqi&timezone=Europe/Moscow&past_days=7&forecast_days=4`;

        const response = await axios.get(url, { timeout: 2000 });
        return response.data;
    }

    const chunks = [];
    for (let i = 0; i < coordinates.length; i += CHUNK_SIZE) {
        chunks.push(coordinates.slice(i, i + CHUNK_SIZE));
    }

    const promises = chunks.map(async (chunk) => {
        const lats = chunk.map(c => Number(c.lat).toFixed(4)).join(',');
        const lons = chunk.map(c => Number(c.lon).toFixed(4)).join(',');

        const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}&hourly=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,european_aqi&timezone=Europe/Moscow&past_days=7&forecast_days=4`;

        const response = await axios.get(url, { timeout: 4000 });
        return response.data;
    });

    const results = await Promise.all(promises);
    return results.flat();
}



function normalizeBatchResponse(rawArray, coordinates) {
    const items = Array.isArray(rawArray) ? rawArray : [rawArray];

    if (!coordinates || items.length !== coordinates.length) {
        throw new Error(
            `Response count mismatch: Open-Meteo returned ${items.length} items, but expected ${coordinates ? coordinates.length : 0}`
        );
    }

    const time = items[0]?.hourly?.time || [];

    const points = items.map((item, idx) => {
        const coord = coordinates[idx];
        const rawAqi = item?.hourly?.european_aqi || [];
        const european_aqi = rawAqi.map(val => {
            if (val === null || val === undefined || Number.isNaN(Number(val))) {
                return 20; // базовый фоновый уровень
            }
            return Number(val);
        });

        return {
            lat: coord.lat,
            lon: coord.lon,
            european_aqi
        };
    });

    return {
        time,
        points
    };
}

module.exports = {
    generateMacroGridCoordinates,
    generateMicroGridCoordinates,
    fetchBatchAirQuality,
    normalizeBatchResponse
};
