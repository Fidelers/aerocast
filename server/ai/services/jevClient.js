const axios = require('axios');
const jevConfig = require('../config/jevConfig');
const { DECISION_SPECS } = require('../schemas/decisionSchemas');

async function scoreDecisions(userMessage, appContext = {}) {
    try {
        const state = {
            app: 'AeroCast',
            user_message: String(userMessage || '').trim()
        };

        const response = await axios.post(`${jevConfig.baseURL}/decide_many`, {
            state,
            questions: DECISION_SPECS
        }, {
            timeout: jevConfig.timeoutMs,
            headers: { 'Content-Type': 'application/json' }
        });

        return response.data;
    } catch (err) {
        console.warn('[JevClient] Service unavailable or timeout:', err.message);
        return null;
    }
}

module.exports = { scoreDecisions };
