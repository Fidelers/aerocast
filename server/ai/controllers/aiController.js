// server/ai/controllers/aiController.js

const aiService = require('../services/aiService');
const aiConfig = require('../config/aiConfig');

/**
 * Обработка сообщения чата
 */
async function handleChat(req, res) {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'Поле message обязательно и не должно быть пустым.' });
    }

    try {
        const result = await aiService.sendChatMessage({
            userMessage: message.trim(),
            history: Array.isArray(history) ? history : []
        });

        res.json({
            reply: result.reply,
            model: result.model,
            emotion: result.emotion || 'idle',
            timestamp: Date.now()
        });
    } catch (err) {
        console.error('aiController error:', err);
        res.status(500).json({ error: 'Внутренняя ошибка AI модуля' });
    }
}

/**
 * Статус подключения к AnyModel
 */
function getStatus(req, res) {
    res.json({
        status: 'ok',
        model: aiConfig.model,
        hasApiKey: Boolean(aiConfig.apiKey && aiConfig.apiKey.trim().length > 5),
        endpoint: aiConfig.baseURL
    });
}

module.exports = {
    handleChat,
    getStatus
};
