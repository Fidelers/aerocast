const aiService = require('../services/aiService');
const aiConfig = require('../config/aiConfig');


async function handleChat(req, res) {
    const ctx = req.body.appContext || {};
    const message = req.body.message;
    const history = req.body.history || ctx.history;
    const currentLayer = req.body.currentLayer || ctx.currentLayer;
    const isColorBlind = req.body.isColorBlind !== undefined ? req.body.isColorBlind : ctx.isColorBlind;
    const colorBlindType = req.body.colorBlindType || ctx.colorBlindType;
    const theme = req.body.theme || ctx.theme;
    const pointAnalytics = req.body.pointAnalytics || ctx.pointAnalytics;
    const isFollowUpAnalytics = req.body.isFollowUpAnalytics !== undefined ? req.body.isFollowUpAnalytics : ctx.isFollowUpAnalytics;

    if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'Поле message обязательно и не должно быть пустым.' });
    }

    try {
        const result = await aiService.sendChatMessage({
            userMessage: message.trim(),
            history: Array.isArray(history) ? history : [],
            currentLayer,
            isColorBlind,
            colorBlindType,
            theme,
            pointAnalytics,
            isFollowUpAnalytics: Boolean(isFollowUpAnalytics)
        });

        res.json({
            reply: result.reply,
            model: result.model,
            emotion: result.emotion || 'idle',
            action: result.action || null,
            timestamp: Date.now()
        });
    } catch (err) {
        console.error('aiController error:', err);
        res.status(500).json({ error: 'Внутренняя ошибка AI модуля' });
    }
}

async function handleTranscribe(req, res) {
    const { audio, mimeType } = req.body;

    if (!audio || typeof audio !== 'string' || !audio.trim()) {
        return res.status(400).json({ error: 'Поле audio обязательно и должно содержать base64-строку.' });
    }

    try {
        const text = await aiService.transcribeAudio({
            audioBase64: audio.trim(),
            mimeType: mimeType || 'audio/webm'
        });

        res.json({
            text,
            timestamp: Date.now()
        });
    } catch (err) {
        console.error('aiController transcribe error:', err.message);
        res.status(500).json({ error: err.message || 'Ошибка транскрипции аудио' });
    }
}

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
    handleTranscribe,
    getStatus
};
