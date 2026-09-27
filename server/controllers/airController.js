// controllers/airController.js

const cacheService = require('../services/cacheService');
const historyService = require('../services/historyService');
const primaryAirService = require('../services/primaryAirService');
const backupAirService = require('../services/backupAirService');
const timeUtils = require('../services/timeUtils');

/**
 * ГЛАВНЫЙ эндпоинт получения данных о качестве воздуха
 * GET /api/air-quality?lat=...&lon=...&source=...
 */
async function getAirQuality(req, res) {
    try {
        const { lat: latQuery, lon: lonQuery, source: sourceQuery } = req.query;

        // 1. Валидация обязательных параметров
        if (latQuery === undefined || lonQuery === undefined || latQuery === '' || lonQuery === '') {
            return res.status(400).json({ error: 'Missing lat or lon parameters' });
        }

        const lat = Number(latQuery);
        const lon = Number(lonQuery);

        if (Number.isNaN(lat) || Number.isNaN(lon)) {
            return res.status(400).json({ error: 'Missing lat or lon parameters' });
        }

        // Проверка допустимых диапазонов для широты и долготы
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            return res.status(400).json({ error: 'Missing lat or lon parameters' });
        }

        // 2. Определение и валидация источника
        let source = sourceQuery || 'auto';

        // Поддержка синонимов (из требований и тестов)
        if (source === 'primary') source = 'open-meteo';
        if (source === 'backup') source = 'open-weather-map';

        if (!['auto', 'open-meteo', 'open-weather-map'].includes(source)) {
            return res.status(400).json({ error: 'Invalid source parameter' });
        }

        // 3. Формирование ключа кэша (округление координат до 2 знаков, ~1.1 км)
        const latStr = lat.toFixed(2);
        const lonStr = lon.toFixed(2);
        const cacheKey = `air_${source}_${latStr}_${lonStr}`;

        // 4. Проверка быстрого кэша
        const cachedData = await cacheService.getCache(cacheKey, false);
        if (cachedData) {
            const merged = await historyService.mergeWithFresh(cachedData, lat, lon);
            return res.json(merged); // возвращаем сразу, без внешних запросов
        }

        // 5. Выбор стратегии загрузки при промахе кэша
        let freshData = null;
        try {
            if (source === 'open-meteo') {
                freshData = await primaryAirService.fetchAirQuality(lat, lon);
            } else if (source === 'open-weather-map') {
                freshData = await backupAirService.fetchAirQuality(lat, lon);
            } else {
                // auto: сначала основной источник, затем резервный
                try {
                    freshData = await primaryAirService.fetchAirQuality(lat, lon);
                } catch (primaryErr) {
                    console.error('Основной источник недоступен, переключение на резервный:', primaryErr.message);
                    freshData = await backupAirService.fetchAirQuality(lat, lon);
                }
            }
        } catch (fetchError) {
            console.error('Все доступные внешние источники вернули ошибку:', fetchError.message);

            // 6. Полный сбой источников -> Офлайн-резерв

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

            // 6.1 Проверка устаревшего кэша (игнорирование TTL)
            const staleData = await cacheService.getCache(cacheKey, true);
            if (staleData) {
                const merged = await historyService.mergeWithFresh(staleData, lat, lon);
                merged.used_source = 'offline_database';
                return res.json(merged);
            }

            // 6.2 Последняя запись из архива БД
            const latestRecord = await historyService.getLatest(lat, lon);
            if (latestRecord) {
                let pollutantData = {};
                try {
                    pollutantData = JSON.parse(latestRecord.pollutant_data);
                } catch (e) {
                    // Игнорируем ошибку парсинга, если данные повреждены
                }

                const timeStr = timeUtils.formatIsoHourMillis(latestRecord.timestamp);
                const hourly = { time: [timeStr] };

                for (const [key, value] of Object.entries(pollutantData)) {
                    hourly[key] = [value];
                }

                // Гарантируем наличие базовых полей в hourly
                const standardFields = ['pm10', 'pm2_5', 'carbon_monoxide', 'nitrogen_dioxide', 'sulphur_dioxide', 'ozone', 'european_aqi'];
                for (const field of standardFields) {
                    if (!hourly[field]) {
                        hourly[field] = [null];
                    }
                }

                // Сборка ответа в нормализованном формате
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

            // 6.3 Данных нет вообще нигде
            return res.status(500).json({
                error: 'Failed to fetch air quality data and no offline cache available'
            });
        }

        // 7. Успешный ответ от внешних источников: сохранение и возврат

        // Пишем свежие данные в кэш на 1 час (3600 секунд)
        await cacheService.setCache(cacheKey, freshData, 3600);

        // Асинхронное накопление архива (INSERT OR IGNORE) без блокировки потока
        historyService.saveFromResponse(freshData).catch(err => {
            console.error('Ошибка сохранения данных в архив (historyService):', err.message);
        });

        // Слияние свежего ответа с историей
        const mergedData = await historyService.mergeWithFresh(freshData, lat, lon);

        return res.json(mergedData);

    } catch (error) {
        console.error('Непредвиденная ошибка в getAirQuality:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}

module.exports = {
    getAirQuality
};