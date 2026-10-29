

const path = require('path');
const fs = require('fs');
const aiConfig = require('../config/aiConfig');
const aiService = require('../services/aiService');
const { resolveWorkingUrl, validateTestCase } = require('./evalRunner');

const DATASET_PATH = path.resolve(__dirname, 'evalDataset.json');
const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));

// Увеличиваем таймаут для живых обращений к локальной модели
jest.setTimeout(120000);

describe('Local LLM (gemma-4-E2B-it-Q4_K_M) Live E2E Evaluation', () => {
    let workingUrl = null;
    let isServerAvailable = false;

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
    });

    // Группируем по категориям
    const categories = [...new Set(dataset.map(tc => tc.category))];

    categories.forEach(category => {
        describe(`Категория: ${category}`, () => {
            const categoryCases = dataset.filter(tc => tc.category === category);

            categoryCases.forEach(tc => {
                it(`[${tc.id}] ${tc.name}`, async () => {
                    if (!isServerAvailable) {
                        // Если локальная модель не запущена, аккуратно пропускаем
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
                            `Ответ модели: "${result.reply}"`,
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
