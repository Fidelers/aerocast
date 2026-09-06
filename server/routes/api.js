// routes/api.js — описание маршрутов (endpoints)

const express = require('express');
const airController = require('../controllers/airController');
const router = express.Router();

// Пока заглушка: показывает, как запрос React уходит в контроллер
router.get('/air', airController.getAirData);

module.exports = router;