// controllers/airController.js — логика обработки запросов

const gridService = require('../services/gridService');
const dbService = require('../services/dbService');
const owmService = require('../services/owmService');

// Сейчас отвечает 501, чтобы было видно, что роут жив и работает.
async function getAirData(req, res) {
    res.status(501).json({
        message: 'GET /api/air — заглушка, логика появится позже',
        query: req.query,
    });
}

module.exports = {
    getAirData,
    // getHistoryData,
};