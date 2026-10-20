const batchAirService = require('../services/batchAirService');
const spatialCacheService = require('../services/spatialCacheService');
const timeUtils = require('../services/timeUtils');

//глав обработчик
async function getGridAirQuality(req, res) {
   try {
        let { type, lat, lon, zoom} = req.query || {};
       //авто определение типа сетки по зуму
        if  (!type){
            if (zoom !== undefined && zoom != null && !isNaN(Number(zoom))){
                type = Number(zoom) < 9 ? 'macro' : 'micro';
            }   else {
                type = 'macro';
            }
        }
        //валидация координат для микро сетки
        let latNum, lonNum;
        if (type === 'micro'){
            latNum = Number(lat);
            lonNum = Number(lon);

            const isInvalid = 
                lat === undefined ||
                lat === null ||
                lon === undefined ||
                lon === null ||
                isNaN(latNum) ||
                isNaN(lonNum) ||
                latNum < -90 ||
                latNum > 90 ||
                lonNum < -180 ||
                lonNum > 180;
            
            if (isInvalid){
                return res.status(400).json({error: 'Missing valid lat and lon for micro grid'});
            }
        }
        //ключ пространственного кэша
        let cacheKey;
        if (type === 'macro') {
        cacheKey = 'grid_macro_russia';
        } else {
        const quantized = spatialCacheService.quantizeCoordinates(latNum, lonNum);
        cacheKey = quantized?.cacheKey || `grid_micro_${(Math.round(latNum / 0.2) * 0.2).toFixed(2)}_${(Math.round(lonNum / 0.2) * 0.2).toFixed(2)}`;
        }
        //проверка кэша: для макросетки проверяем наличие сохранённой сетки за сегодня (в этот день)
        let cachedData = null;

        if (type === 'macro') {
            if (typeof spatialCacheService.getTodayMacroGrid === 'function') {
                cachedData = await spatialCacheService.getTodayMacroGrid(cacheKey);
            }
            if (!cachedData) {
                const candidate = await spatialCacheService.getSpatialCache(cacheKey, false);
                if (candidate) {
                    const isToday = typeof spatialCacheService.isRecordSavedToday === 'function'
                        ? spatialCacheService.isRecordSavedToday(candidate)
                        : (candidate.cached_date ? candidate.cached_date === timeUtils.getTodayDateString() : true);
                    if (isToday) {
                        cachedData = candidate;
                    }
                }
            }
        } else {
            cachedData = await spatialCacheService.getSpatialCache(cacheKey, false);
        }

        if (cachedData) {
            return res.status(200).json(cachedData);
        }

        //промах по кэшу и пакетный запрос к Open-Meteo
        try {
            let coordinates;
            let microData = null;
            let bbox = null;

            if (type === 'macro') {
                coordinates = batchAirService.generateMacroGridCoordinates();
                bbox = [19.5, 41.0, 190.5, 82.0];
            } else {
                microData = batchAirService.generateMicroGridCoordinates(latNum, lonNum);
                coordinates = Array.isArray(microData) ? microData : (microData?.points || microData?.coordinates || []);
                bbox = microData?.bbox || null;
            }


            const rawResponse = await batchAirService.fetchBatchAirQuality(coordinates);
            const normalized = batchAirService.normalizeBatchResponse(rawResponse, coordinates);

            // Макросетка без точек/времени непригодна для отрисовки и не должна попадать в кэш:
            // считаем ответ сбоем, чтобы сработать ветку офлайн-резерва (устаревший кэш)
            if (type === 'macro') {
                const hasPoints = Array.isArray(normalized?.points) && normalized.points.length > 0;
                const hasTime = Array.isArray(normalized?.time) && normalized.time.length > 0;
                if (!hasPoints || !hasTime) {
                    throw new Error('Open-Meteo returned an empty macro grid');
                }
            }

            const todayStr = timeUtils.getTodayDateString();
            const now = Date.now();

            //итоговый объект для кэша и ответа
            const payload = {
                type,
                ...(bbox ? { bbox } : {}),
                used_source: 'open-meteo',
                points_count: normalized?.points?.length || coordinates?.length || 0,
                time: normalized?.time,
                points: normalized?.points || [],
                cached_at: now,
                cached_date: todayStr
            };

            //сохранение в кэш: для макросетки 86400 сек (24 часа / 1 день), для микро 3600 сек
            try {
                const ttl = type === 'macro' ? 86400 : 3600;
                await spatialCacheService.setSpatialCache(cacheKey, payload, ttl);
            } catch (cacheErr) {
                console.warn('Не удалось записать в кэш:', cacheErr);
            }

            return res.status(200).json(payload);


        } catch (fetchError) {
            // Основной сервис (Open-Meteo) недоступен или вернул непригодные данные.
            // Явно уходим в офлайн-резерв: берём прошлые/устаревшие точки из кэша
            // (SQLite ignoreTTL=true, при недоступности БД — in-memory кэш процесса),
            // чтобы макросетка всё равно отрисовалась на карте.
            console.warn(
                'Сбой запроса к Open-Meteo, пробуем устаревший кэш:',
                fetchError?.message || fetchError
            );
        try {
            const staleGrid = await spatialCacheService.getSpatialCache(cacheKey, true);
            const hasStalePoints = Array.isArray(staleGrid?.points) && staleGrid.points.length > 0;

            if (hasStalePoints) {
                const stalePayload = {
                    ...staleGrid,
                    used_source: 'offline_database'
                };
                return res.status(200).json(stalePayload);
            }

            if (staleGrid) {
                console.warn('Устаревший кэш найден, но не содержит точек — считаем его промахом офлайн-резерва');
            }
        } catch (staleErr) {
            console.error('Ошибка чтения устаревшего кэша:', staleErr);
        }

        //если данных нет возвращаем 500
        return res.status(500).json({
                    error: 'Failed to fetch grid data and no offline cache available',
                    type,
                    source: 'offline_database_miss'
                });
        }

    } catch (error) {
        console.error('Ошибка в контроллере сетки:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

//макро
async function getMacroGrid(req, res) {
    Object.defineProperty(req, 'query', {
        value: { ...(req.query || {}), type: 'macro' },
        writable: true,
        enumerable: true,
        configurable: true
    });
    return getGridAirQuality(req, res);
}

//микро
async function getMicroGrid(req, res) {
    Object.defineProperty(req, 'query', {
        value: { ...(req.query || {}), type: 'micro' },
        writable: true,
        enumerable: true,
        configurable: true
    });
    return getGridAirQuality(req, res);
}

//очистка пространственного кэша
async function clearGridCache(req, res) {
    try{
        const pattern = req.query?.pattern || 'grid_%';
        const deletedCount = await spatialCacheService.clearSpatialCache(pattern);
        return res.status(200).json({
            message: 'Grid cache cleared successfully',
            deleted_entries: deletedCount ?? 0
        });
        } catch (error) {
            console.error('Ошибка очистки кэша:', error);
            return res.status(500).json({ error: 'Failed to clear grid cache'});
    }
}

module.exports = {
    getGridAirQuality,
    getMacroGrid,
    getMicroGrid,
    clearGridCache
};
