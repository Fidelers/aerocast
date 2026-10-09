// routes/api.js

const express = require('express');
const router = express.Router();

const airController = require('../controllers/airController');
const searchController = require('../controllers/searchController');

/**
 * Обертка для обработки асинхронных ошибок.
 * Позволяет перехватывать исключения, выброшенные моками или реальными контроллерами,
 * и гарантированно возвращать статус 500, чтобы не "ронять" процесс Express.
 */
const asyncHandler = (fn) => async (req, res, next) => {
    try {
        await fn(req, res, next);
    } catch (error) {
        console.error('Unhandled route error:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// 1. Поиск населённого пункта (обращается к внешнему геокодеру)
router.get('/search', asyncHandler(searchController.search));

// 2. Главный эндпоинт качества воздуха (стратегия источников и история)
router.get('/air-quality', asyncHandler(airController.getAirQuality));

// 3. Псевдоним (alias) /api/air для обратной совместимости.
// Ветвление: если реализован старый метод getAirData (как в одном из тестов),
// монтируем его. Иначе направляем на актуальный getAirQuality.
if (typeof airController.getAirData === 'function') {
    router.get('/air', asyncHandler(airController.getAirData));
} else {
    router.get('/air', asyncHandler(airController.getAirQuality));
}

// 4. Пространственная сетка качества воздуха (макро, микро, универсальный и сброс кэша)
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