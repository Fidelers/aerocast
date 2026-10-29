const cacheService = require('../services/cacheService');
const historyService = require('../services/historyService');
const primaryAirService = require('../services/primaryAirService');
const backupAirService = require('../services/backupAirService');
const timeUtils = require('../services/timeUtils');


async function getAirQuality(req, res) {
    try {
        const { lat: latQuery, lon: lonQuery, source: sourceQuery } = req.query;

        if (latQuery === undefined || lonQuery === undefined || latQuery === '' || lonQuery === '') {
            return res.status(400).json({ error: 'Missing lat or lon parameters' });
        }

        const lat = Number(latQuery);
        const lon = Number(lonQuery);

        if (Number.isNaN(lat) || Number.isNaN(lon)) {
            return res.status(400).json({ error: 'Missing lat or lon parameters' });
        }

        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            return res.status(400).json({ error: 'Missing lat or lon parameters' });
        }

        let source = sourceQuery || 'auto';

        // Поддержка синонимов (из требований и тестов)
        if (source === 'primary') source = 'open-meteo';
        if (source === 'backup') source = 'open-weather-map';

        if (!['auto', 'open-meteo', 'open-weather-map'].includes(source)) {
            return res.status(400).json({ error: 'Invalid source parameter' });
        }

        // Округление координат до 2 знаков (~1.1 км) для сетки кэша
        const latStr = lat.toFixed(2);
        const lonStr = lon.toFixed(2);
        const cacheKey = `air_${source}_${latStr}_${lonStr}`;

        const cachedData = await cacheService.getCache(cacheKey, false);
        if (cachedData) {
            const merged = await historyService.mergeWithFresh(cachedData, lat, lon);
            return res.json(merged);
        }

        let freshData = null;
        try {
            if (source === 'open-meteo') {
                freshData = await primaryAirService.fetchAirQuality(lat, lon);
            } else if (source === 'open-weather-map') {
                freshData = await backupAirService.fetchAirQuality(lat, lon);
            } else {
                try {
                    freshData = await primaryAirService.fetchAirQuality(lat, lon);
                } catch (primaryErr) {
                    console.error('Основной источник недоступен, переключение на резервный:', primaryErr.message);
                    freshData = await backupAirService.fetchAirQuality(lat, lon);
                }
            }
        } catch (fetchError) {
            console.error('Все доступные внешние источники вернули ошибку:', fetchError.message);

            const DEFAULT_HOURLY_UNITS = {
                time: 'iso8601',
                pm10: 'μg/m³',
                pm2_5: 'μg/m³',
                carbon_monoxide: 'μg/m³',
                nitrogen_dioxide: 'μg/m³',
                sulphur_dioxide: 'μg/m³',
                ozone: 'μg/m³',
                aerosol_optical_depth: '',
                dust: 'μg/m³',
                uv_index: '',
                european_aqi: 'EAQI'
            };

            const staleData = await cacheService.getCache(cacheKey, true);
            if (staleData) {
                const merged = await historyService.mergeWithFresh(staleData, lat, lon);
                merged.used_source = 'offline_database';
                return res.json(merged);
            }

            const latestRecord = await historyService.getLatest(lat, lon);
            if (latestRecord) {
                let pollutantData = {};
                try {
                    pollutantData = JSON.parse(latestRecord.pollutant_data);
                } catch (e) {
                }

                const timeStr = timeUtils.formatIsoHourMillis(latestRecord.timestamp);
                const hourly = { time: [timeStr] };

                for (const [key, value] of Object.entries(pollutantData)) {
                    hourly[key] = [value];
                }

                const standardFields = ['pm10', 'pm2_5', 'carbon_monoxide', 'nitrogen_dioxide', 'sulphur_dioxide', 'ozone', 'european_aqi'];
                for (const field of standardFields) {
                    if (!hourly[field]) {
                        hourly[field] = [null];
                    }
                }

                return res.json({
                    latitude: lat,
                    longitude: lon,
                    timezone: 'Europe/Moscow',
                    utc_offset_seconds: 10800,
                    elevation: 0,
                    used_source: 'offline_database',
                    hourly_units: DEFAULT_HOURLY_UNITS,
                    hourly: hourly
                });
            }

            return res.status(500).json({
                error: 'Failed to fetch air quality data and no offline cache available'
            });
        }

        await cacheService.setCache(cacheKey, freshData, 3600);

        // Асинхронное накопление архива (INSERT OR IGNORE) без блокировки потока
        historyService.saveFromResponse(freshData).catch(err => {
            console.error('Ошибка сохранения данных в архив (historyService):', err.message);
        });

        const mergedData = await historyService.mergeWithFresh(freshData, lat, lon);
        return res.json(mergedData);

    } catch (error) {
        console.error('Непредвиденная ошибка в getAirQuality:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}

function normalizeIp(value) {
    if (!value) return '';
    return String(value).split(',')[0].trim().replace(/^::ffff:/i, '');
}

function isPrivateIp(ip) {
    if (!ip) return true;
    if (ip === '::1' || ip === '127.0.0.1' || ip === '0.0.0.0') return true;
    if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('169.254.')) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
    if (/^(fc|fd|fe80:)/i.test(ip)) return true;
    return false;
}

// Публичный IP клиента (важно, если бекенд развёрнут отдельно от пользователя).
// Для локальной сети/прокси вернём пустую строку — тогда геолокация пойдёт по IP сервера.
function getClientIp(req) {
    const forwarded = req?.headers?.['x-forwarded-for'];
    const candidate = normalizeIp(forwarded)
        || normalizeIp(req?.ip)
        || normalizeIp(req?.socket?.remoteAddress);

    return isPrivateIp(candidate) ? '' : candidate;
}

async function locateByIp(req, res) {
    try {
        const axios = require('axios');
        const clientIp = getClientIp(req);

        try {
            const url = clientIp ? `https://ipwho.is/${encodeURIComponent(clientIp)}` : 'https://ipwho.is/';
            const resp = await axios.get(url, { timeout: 3500 });
            if (resp.data && resp.data.success && typeof resp.data.latitude === 'number' && typeof resp.data.longitude === 'number') {
                return res.json({
                    latitude: resp.data.latitude,
                    longitude: resp.data.longitude,
                    city: resp.data.city || ''
                });
            }
        } catch {
        }

        try {
            const url = clientIp ? `https://ipapi.co/${encodeURIComponent(clientIp)}/json/` : 'https://ipapi.co/json/';
            const resp = await axios.get(url, { timeout: 3500 });
            if (resp.data && typeof resp.data.latitude === 'number' && typeof resp.data.longitude === 'number') {
                return res.json({
                    latitude: resp.data.latitude,
                    longitude: resp.data.longitude,
                    city: resp.data.city || ''
                });
            }
        } catch {
        }

        // Fallback по умолчанию (Новокузнецк).
        // Помечаем ответ заголовком X-Geo-Fallback, чтобы фронтенд мог попробовать браузерный IP-сервис
        // и не принимать этот «статический» город за реальный результат геолокации.
        if (typeof res.set === 'function') {
            res.set('X-Geo-Fallback', '1');
        }
        return res.json({
            latitude: 53.7596,
            longitude: 87.1467,
            city: 'Новокузнецк'
        });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to determine location' });
    }
}

module.exports = {
    getAirQuality,
    locateByIp
};