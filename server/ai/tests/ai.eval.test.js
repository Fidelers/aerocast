const path = require('path');
const fs = require('fs');
const aiConfig = require('../config/aiConfig');
const aiService = require('../services/aiService');
const { resolveWorkingUrl, validateTestCase, checkJevStatus } = require('./evalRunner');

const JEV_DATASET_PATH = path.resolve(__dirname, 'jev/dataset.json');
const GEMMA_DATASET_PATH = path.resolve(__dirname, 'gemma/dataset.json');

const jevDataset = fs.existsSync(JEV_DATASET_PATH) ? JSON.parse(fs.readFileSync(JEV_DATASET_PATH, 'utf8')) : [];
const gemmaDataset = fs.existsSync(GEMMA_DATASET_PATH) ? JSON.parse(fs.readFileSync(GEMMA_DATASET_PATH, 'utf8')) : [];

const dataset = [...jevDataset, ...gemmaDataset];

// Увеличиваем таймаут для живых обращений к локальной модели
jest.setTimeout(240000);

describe('Unified AI System Evaluation (System 1 Jev + System 2 Gemma)', () => {
    let workingUrl = null;
    let isServerAvailable = false;
    let isJevAvailable = false;

    beforeAll(async () => {
        workingUrl = await resolveWorkingUrl();
        if (workingUrl) {
            isServerAvailable = true;
            aiConfig.baseURL = workingUrl;
            console.log(`\n[Jest E2E Eval] Подключено к llama-server: ${workingUrl}`);
        } else {
            console.warn('\n⚠️ [Jest E2E Eval] llama-server оффлайн. ' +
                'Живые тесты будут пропущены. Для запуска выполните: docker compose up llama-server');
        }

        if (process.env.JEV_ENABLED !== 'false') {
            const jevStatus = await checkJevStatus();
            if (jevStatus.ok) {
                isJevAvailable = true;
                console.log(`\n[Jest E2E Eval] Подключено к jev-service: ${jevStatus.url}`);
            }
        }
    });

    const categories = [...new Set(dataset.map(tc => tc.category))];

    categories.forEach(category => {
        describe(`Категория: ${category}`, () => {
            const categoryCases = dataset.filter(tc => tc.category === category);

            categoryCases.forEach(tc => {
                it(`[${tc.id}] ${tc.name}`, async () => {
                    if (tc.id.startsWith('jev_') && !isJevAvailable) {
                        return;
                    }
                    if (!tc.id.startsWith('jev_') && !isServerAvailable) {
                        return;
                    }

                    const startTime = Date.now();
                    let result;
                    try {
                        result = await aiService.sendChatMessage(tc.input);
                    } catch (err) {
                        result = {
                            reply: err.message,
                            emotion: 'alert',
                            error: true
                        };
                    }
                    const durationMs = Date.now() - startTime;

                    const validation = validateTestCase(tc, result, durationMs);

                    if (!validation.passed) {
                        const message = [
                            `\nТест-кейс: ${tc.id} (${tc.name})`,
                            `Запрос пользователя: "${tc.input.userMessage}"`,
                            `Модель-обработчик: "${result.model || 'unknown'}"`,
                            `Ответ: "${result.reply}"`,
                            `Эмоция: "${result.emotion}"`,
                            `Action: ${JSON.stringify(result.action)}`,
                            `Ошибки валидации:`,
                            ...validation.issues.map(i => `  - ${i}`)
                        ].join('\n');

                        throw new Error(message);
                    }

                    expect(validation.passed).toBe(true);
                });
            });
        });
    });
});
