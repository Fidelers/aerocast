const aiRoutes = require('./routes/aiRoutes');
const aiService = require('./services/aiService');
const aiConfig = require('./config/aiConfig');

module.exports = {
    routes: aiRoutes,
    service: aiService,
    config: aiConfig
};
