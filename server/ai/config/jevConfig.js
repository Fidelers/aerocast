module.exports = {
    baseURL: process.env.JEV_BASE_URL || 'http://localhost:8001',
    timeoutMs: parseInt(process.env.JEV_TIMEOUT_MS, 10) || 3000,
    minConfidence: 0.70 // Минимальная уверенность для авто-применения действия
};
