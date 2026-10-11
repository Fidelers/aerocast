const batchAirService = require('../services/batchAirService');
const spatialCacheService = require('../services/spatialCacheService');

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
        //проверка кэша
        const cachedData = await spatialCacheService.getSpatialCache(cacheKey, false);
        if (cachedData) {
        return res.status(200).json(cachedData);
        }

        //промах по кэшу и пакетный запрос к Open-Meteo
        try {
            let coordinates;
            let microData = null;

            if (type === 'macro') {
            coordinates = batchAirService.generateMacroGridCoordinates();
            } else {
                microData = batchAirService.generateMicroGridCoordinates(latNum, lonNum);
                coordinates = Array.isArray(microData) ? microData : (microData?.points || microData?.coordinates || []);
            }


            const rawResponse = await batchAirService.fetchBatchAirQuality(coordinates);
            const normalized = batchAirService.normalizeBatchResponse(rawResponse, coordinates);

            //итоговый объект для кэша и ответа
            const payload = {
            type,
            ...(microData?.bbox ? { bbox: microData.bbox } : {}),
            used_source: 'open-meteo',
            points_count: normalized?.points?.length || coordinates?.length || 0,
            time: normalized?.time,
            points: normalized?.points || []
        };

        //сохранение на часик в кэщ
        try {
            await spatialCacheService.setSpatialCache(cacheKey, payload, 3600);
        } catch (cacheErr) {
            console.warn('Не удалось записать в кэш:', cacheErr);
        }

        return res.status(200).json(payload);

        } catch (fetchError) {
            //при сбое проверяем наличие устаревшего кэшща
        try {
            const staleGrid = await spatialCacheService.getSpatialCache(cacheKey, true);
            if (staleGrid) {
            const stalePayload = {
                ...staleGrid,
                used_source: 'offline_database'
            };
            return res.status(200).json(stalePayload);
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
    req.query = { ...req.query, type: 'macro'};
    return getGridAirQuality(req, res);
}

//микро
async function getMicroGrid(req, res) {
    req.query = { ...req.query, type: 'micro'};
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
