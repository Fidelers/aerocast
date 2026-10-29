module.exports = {
    baseURL: process.env.LLM_BASE_URL || 'http://llama-server:8080/v1',
    get apiKey() {
        return process.env.LLM_API_KEY || 'not-needed';
    },
    // Имя модели для llama-server обычно игнорируется, но задано для совместимости с OpenAI API
    model: process.env.LLM_MODEL || 'gemma-4-E2B-it-Q4_K_M',
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS, 10) || 800,
    temperature: parseFloat(process.env.LLM_TEMPERATURE) || 0.8,
    topP: parseFloat(process.env.LLM_TOP_P) || 0.9,
    repeatPenalty: parseFloat(process.env.LLM_REPEAT_PENALTY) || 1.08,
    frequencyPenalty: parseFloat(process.env.LLM_FREQUENCY_PENALTY) || 0.15,
    presencePenalty: parseFloat(process.env.LLM_PRESENCE_PENALTY) || 0.15,
    timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS, 10) || 75000,
    maxHistoryMessages: parseInt(process.env.LLM_MAX_HISTORY, 10) || 4,
    maxCharLimit: parseInt(process.env.LLM_MAX_CHAR_LIMIT, 10) || 750
};
