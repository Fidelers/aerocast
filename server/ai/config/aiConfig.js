// server/ai/config/aiConfig.js

module.exports = {
    baseURL: process.env.ANYMODEL_BASE_URL || 'https://anymodel.org/v1',
    get apiKey() {
        return process.env.ANYMODEL_API_KEY || '';
    },
    // Рекомендуем 'am/llama-3.2-11b-vision-instruct' для мгновенных ответов без таймаутов, либо 'am/free'
    model: process.env.ANYMODEL_MODEL || 'am/llama-3.2-11b-vision-instruct',
    maxTokens: parseInt(process.env.ANYMODEL_MAX_TOKENS, 10) || 2000,
    temperature: parseFloat(process.env.ANYMODEL_TEMPERATURE) || 0.6,
    timeoutMs: parseInt(process.env.ANYMODEL_TIMEOUT_MS, 10) || 75000,
    maxHistoryMessages: parseInt(process.env.ANYMODEL_MAX_HISTORY, 10) || 4 // скользящее окно истории (4 сообщения: 2 пары вопрос-ответ)
};
