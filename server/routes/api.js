const express = require('express');
const router = express.Router();

const airController = require('../controllers/airController');
const searchController = require('../controllers/searchController');

// Обертка для обработки асинхронных ошибок без падения процесса Express
const asyncHandler = (fn) => async (req, res, next) => {
    try {
        await fn(req, res, next);
    } catch (error) {
        console.error('Unhandled route error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};

router.get('/search', asyncHandler(searchController.search));

// Определение местоположения по IP (для мобильных устройств в локальной сети)
if (typeof airController.locateByIp === 'function') {
    router.get('/locate-me', asyncHandler(airController.locateByIp));
}

router.get('/air-quality', asyncHandler(airController.getAirQuality));

// Псевдоним /api/air для обратной совместимости: если есть старый getAirData, монтируем его
if (typeof airController.getAirData === 'function') {
    router.get('/air', asyncHandler(airController.getAirData));
} else {
    router.get('/air', asyncHandler(airController.getAirQuality));
}

try {
    const gridAirController = require('../controllers/gridAirController');
    if (gridAirController) {
        if (typeof gridAirController.getMacroGrid === 'function') {
            router.get('/air-quality/grid/macro', asyncHandler(gridAirController.getMacroGrid));
        }
        if (typeof gridAirController.getMicroGrid === 'function') {
            router.get('/air-quality/grid/micro', asyncHandler(gridAirController.getMicroGrid));
        }
        if (typeof gridAirController.getGridAirQuality === 'function') {
            router.get('/air-quality/grid', asyncHandler(gridAirController.getGridAirQuality));
        }
        if (typeof gridAirController.clearGridCache === 'function') {
            router.delete('/cache/grid', asyncHandler(gridAirController.clearGridCache));
        }
    }
} catch (err) {
    console.warn('gridAirController is not yet available:', err.message);
}


module.exports = router;