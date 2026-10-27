// server/ai/routes/aiRoutes.js

const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// Обработчик ошибок
const asyncHandler = (fn) => async (req, res, next) => {
    try {
        await fn(req, res, next);
    } catch (error) {
        console.error('Unhandled AI route error:', error.message);
        res.status(500).json({ error: 'Internal AI server error' });
    }
};

router.post('/chat', asyncHandler(aiController.handleChat));
router.post('/transcribe', asyncHandler(aiController.handleTranscribe));
router.get('/status', asyncHandler(aiController.getStatus));

module.exports = router;
