const path = require('path');
const fs = require('fs');
const aiService = require('../../services/aiService');
const { validateTestCase, checkJevStatus } = require('../evalRunner');

const DATASET_PATH = path.resolve(__dirname, 'dataset.json');
const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));

jest.setTimeout(30000);

describe('System 1 (Jev-Style-0.8B) Decision & Guardrails Evaluation', () => {
    let isJevAvailable = false;

    beforeAll(async () => {
        if (process.env.JEV_ENABLED === 'false') {
            console.log('\n[Jev Jest Eval] Jev отключен флагом JEV_ENABLED=false');
            return;
        }
        const status = await checkJevStatus();
        if (status.ok) {
            isJevAvailable = true;
            console.log(`\n[Jev Jest Eval] Подключено к jev-service: ${status.url} (${status.model})`);
        } else {
            console.warn('\n⚠️ [Jev Jest Eval] jev-service оффлайн. ' +
                'Тесты Jev будут пропущены. Для запуска выполните: docker compose up jev-service');
        }
    });

    const categories = [...new Set(dataset.map(tc => tc.category))];

    categories.forEach(category => {
        describe(`Категория: ${category}`, () => {
            const categoryCases = dataset.filter(tc => tc.category === category);

            categoryCases.forEach(tc => {
                it(`[${tc.id}] ${tc.name}`, async () => {
                    if (!isJevAvailable) {
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
