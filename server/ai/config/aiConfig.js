// server/ai/config/aiConfig.js

module.exports = {
    // Теперь указываем на внутренний сервис Docker
    baseURL: process.env.LLM_BASE_URL || 'http://llama-server:8080/v1',
    get apiKey() {
        return process.env.LLM_API_KEY || 'not-needed';
    },
    // Имя модели для llama-server обычно игнорируется, но зададим для совместимости
    model: process.env.LLM_MODEL || 'llama-3.2-3b',
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS, 10) || 2000,
    temperature: parseFloat(process.env.LLM_TEMPERATURE) || 0.2,
    timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS, 10) || 75000,
    maxHistoryMessages: parseInt(process.env.LLM_MAX_HISTORY, 10) || 4
};
