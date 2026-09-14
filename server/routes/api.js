// routes/api.js — описание маршрутов (endpoints)

const express = require('express');
const airController = require('../controllers/airController');
const router = express.Router();

// Пока заглушка: показывает, как запрос React уходит в контроллер.
// Если обработчик ещё не реализован в контроллере — отвечаем 501, чтобы сервер поднимался.
if (typeof airController.getAirData === 'function') {
    router.get('/air', airController.getAirData);
} else {
    router.get('/air', (req, res) => {
        res.status(501).json({
            message: 'GET /api/air — заглушка, логика появится позже',
            query: req.query,
        });
    });
}

module.exports = router;