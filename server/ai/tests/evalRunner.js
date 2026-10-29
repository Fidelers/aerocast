#!/usr/bin/env node
// server/ai/tests/evalRunner.js
/**
 * AeroCast Local LLM E2E Evaluation Runner
 * 
 * Запускает оценку качества и поведения живой локальной модели (gemma-4-E2B-it-Q4_K_M)
 * на реальном датасете evalDataset.json.
 * 
 * Использование:
 *   node server/ai/tests/evalRunner.js
 *   node server/ai/tests/evalRunner.js --category=map_layers
 *   node server/ai/tests/evalRunner.js --limit=5
 *   node server/ai/tests/evalRunner.js --url=http://127.0.0.1:8080/v1
 *   node server/ai/tests/evalRunner.js --verbose
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Загружаем переменные окружения из server/.env, если есть
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const aiConfig = require('../config/aiConfig');
const aiService = require('../services/aiService');

const DATASET_PATH = path.resolve(__dirname, 'evalDataset.json');
const REPORT_PATH = path.resolve(__dirname, 'evalReport.md');

// Парсинг CLI-аргументов
const args = process.argv.slice(2);
const cliOptions = {
    category: null,
    limit: null,
    url: null,
    verbose: args.includes('--verbose') || args.includes('-v'),
    noReport: args.includes('--no-report')
};

for (const arg of args) {
    if (arg.startsWith('--category=')) cliOptions.category = arg.split('=')[1].trim();
    if (arg.startsWith('--limit=')) cliOptions.limit = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--url=')) cliOptions.url = arg.split('=')[1].trim();
}

/**
 * Определение рабочего URL для связи с llama-server на хосте
 */
async function resolveWorkingUrl() {
    const candidates = [
        cliOptions.url,
        process.env.LLM_EVAL_BASE_URL,
        aiConfig.baseURL,
        'http://localhost:8080/v1',
        'http://127.0.0.1:8080/v1'
    ].filter(Boolean);

    // Если адрес внутри docker 'llama-server', заменим приоритет на localhost для хоста
    const normalized = [];
    for (const u of candidates) {
        if (u.includes('llama-server')) {
            normalized.push(u.replace('llama-server', 'localhost'));
            normalized.push(u.replace('llama-server', '127.0.0.1'));
        }
        normalized.push(u);
    }

    const uniqueCandidates = [...new Set(normalized)];

    for (const url of uniqueCandidates) {
        try {
            const hostRoot = url.replace(/\/v1\/?$/, '');
            // Проверяем /health или /v1/models
            const healthUrl = `${hostRoot}/health`;
            const modelsUrl = `${url}/models`;

            const testTarget = url.endsWith('/v1') ? modelsUrl : healthUrl;
            await axios.get(testTarget, { timeout: 3500 });
            return url;
        } catch (e) {
            // пробуем следующий кандидат
        }
    }

    return null;
}

/**
 * Валидация ответа модели против ожиданий тест-кейса
 */
function validateTestCase(tc, result, durationMs) {
    const issues = [];
    const exp = tc.expectations || {};

    // 1. Проверка ошибки сетевого вызова
    if (result.error) {
        issues.push(`Сбой вызова модели: ${result.reply}`);
        return { passed: false, issues, durationMs };
    }

    // 2. Проверка действия (action)
    if (exp.action !== undefined) {
        if (exp.action === null) {
            if (result.action) {
                issues.push(`Ожидалось отсутствие action, но получен: ${JSON.stringify(result.action)}`);
            }
        } else {
            if (!result.action) {
                issues.push(`Ожидался action ${JSON.stringify(exp.action)}, но ничего не сгенерировано`);
            } else {
                for (const [k, v] of Object.entries(exp.action)) {
                    if (result.action[k] !== v) {
                        issues.push(`Несовпадение action.${k}: ожидалось "${v}", получено "${result.action[k]}"`);
                    }
                }
            }
        }
    }

    // 2.1 Проверка целевого города в действии навигации
    if (exp.targetCity) {
        const actualCity = result.action?.city || result.action?.cityName || result.action?.targetCity;
        if (!actualCity || !actualCity.toLowerCase().includes(exp.targetCity.toLowerCase())) {
            issues.push(`Ожидался переход к городу "${exp.targetCity}", получено: "${actualCity || 'null'}"`);
        }
    }

    // 2.2 Проверка запрещенных городов
    if (exp.actionMustNotBeCity && Array.isArray(exp.actionMustNotBeCity)) {
        const actualCity = result.action?.city || result.action?.cityName || '';
        if (exp.actionMustNotBeCity.some(forbidden => forbidden.toLowerCase() === actualCity.toLowerCase())) {
            issues.push(`Ошибочный геокодинг запрещенного слова: "${actualCity}"`);
        }
    }

    // 3. Проверка эмоции
    if (exp.allowedEmotions && Array.isArray(exp.allowedEmotions)) {
        if (!exp.allowedEmotions.includes(result.emotion)) {
            issues.push(`Эмоция "${result.emotion}" не входит в разрешенный список [${exp.allowedEmotions.join(', ')}]`);
        }
    }

    const replyLower = (result.reply || '').toLowerCase();

    // 4. Обязательные фрагменты текста (AND)
    if (exp.replyMustContain && Array.isArray(exp.replyMustContain)) {
        for (const str of exp.replyMustContain) {
            if (!replyLower.includes(str.toLowerCase())) {
                issues.push(`Ответ не содержит обязательную фразу: "${str}"`);
            }
        }
    }

    // 5. Обязателен хотя бы один фрагмент (OR)
    if (exp.replyMustContainOneOf && Array.isArray(exp.replyMustContainOneOf)) {
        const found = exp.replyMustContainOneOf.some(str => replyLower.includes(str.toLowerCase()));
        if (!found) {
            issues.push(`Ответ должен содержать хотя бы один из фрагментов: [${exp.replyMustContainOneOf.join(', ')}]`);
        }
    }

    // 6. Запрещенные фрагменты текста
    if (exp.replyMustNotContain && Array.isArray(exp.replyMustNotContain)) {
        for (const str of exp.replyMustNotContain) {
            if (replyLower.includes(str.toLowerCase())) {
                issues.push(`Ответ содержит запрещенную фразу: "${str}"`);
            }
        }
    }

    // 7. Ограничение длины ответа
    if ((result.reply || '').length > 850) {
        issues.push(`Превышен лимит длины ответа: ${(result.reply || '').length} > 850 символов`);
    }

    return {
        passed: issues.length === 0,
        issues,
        durationMs
    };
}

/**
 * Генерация Markdown отчета
 */
function generateMarkdownReport({ results, stats, durationTotalSec, targetUrl }) {
    const timestamp = new Date().toLocaleString('ru-RU', { timeZoneName: 'short' });

    let md = `# AeroCast Local LLM Eval Report\n\n`;
    md += `* **Дата прогона:** ${timestamp}\n`;
    md += `* **Модель:** \`${aiConfig.model}\`\n`;
    md += `* **URL сервера инференса:** \`${targetUrl}\`\n`;
    md += `* **Общее время тестирования:** ${durationTotalSec.toFixed(2)} с\n`;
    md += `* **Всего тестов:** ${stats.total}\n`;
    md += `* **Успешно:** ${stats.passed} (${stats.passRate.toFixed(1)}%)\n`;
    md += `* **Провалено:** ${stats.failed}\n`;
    md += `* **Средняя задержка:** ${stats.avgLatencyMs.toFixed(0)} мс (Мин: ${stats.minLatencyMs} мс, Макс: ${stats.maxLatencyMs} мс)\n\n`;

    md += `## 1. Сводка по категориям\n\n`;
    md += `| Категория | Всего | Пройдено | Провалено | Pass Rate | Ср. Задержка |\n`;
    md += `|-----------|-------|----------|-----------|-----------|--------------|\n`;

    for (const [cat, cStats] of Object.entries(stats.byCategory)) {
        const catRate = (cStats.passed / cStats.total) * 100;
        const avgLat = cStats.latencies.reduce((a, b) => a + b, 0) / (cStats.latencies.length || 1);
        md += `| \`${cat}\` | ${cStats.total} | ${cStats.passed} | ${cStats.failed} | ${catRate.toFixed(1)}% | ${avgLat.toFixed(0)} мс |\n`;
    }

    md += `\n## 2. Детальные результаты по тестам\n\n`;
    md += `| Статус | ID | Категория | Название | Задержка | Примечания |\n`;
    md += `|:------:|----|-----------|----------|:--------:|------------|\n`;

    for (const r of results) {
        const icon = r.passed ? '✅' : '❌';
        const notes = r.passed ? 'OK' : r.issues.map(i => i.replace(/\|/g, '\\|')).join('; ');
        md += `| ${icon} | \`${r.tc.id}\` | ${r.tc.category} | ${r.tc.name} | ${r.durationMs} мс | ${notes} |\n`;
    }

    const failed = results.filter(r => !r.passed);
    if (failed.length > 0) {
        md += `\n## 3. Анализ ошибок (${failed.length})\n\n`;
        for (const f of failed) {
            md += `### ❌ [${f.tc.id}] ${f.tc.name}\n`;
            md += `* **Запрос:** \`${f.tc.input.userMessage}\`\n`;
            md += `* **Полученный action:** \`${JSON.stringify(f.result.action)}\`\n`;
            md += `* **Эмоция:** \`${f.result.emotion}\`\n`;
            md += `* **Ответ модели:**\n> ${f.result.reply.replace(/\n/g, '\n> ')}\n`;
            md += `* **Зафиксированные несоответствия:**\n`;
            for (const issue of f.issues) {
                md += `  - ⚠️ ${issue}\n`;
            }
            md += `\n---\n`;
        }
    }

    return md;
}

/**
 * Основной цикл запуска оценки
 */
async function run() {
    console.log('\n' + '='.repeat(70));
    console.log('  🚀 AeroCast Local LLM (gemma-4-E2B-it-Q4_K_M) E2E Eval Runner');
    console.log('='.repeat(70) + '\n');

    if (!fs.existsSync(DATASET_PATH)) {
        console.error(`❌ Файл датасета не найден: ${DATASET_PATH}`);
        process.exit(1);
    }

    const datasetRaw = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));
    let testCases = datasetRaw;

    if (cliOptions.category) {
        testCases = testCases.filter(tc => tc.category === cliOptions.category);
        console.log(`🔍 Фильтр по категории: "${cliOptions.category}" (${testCases.length} тестов)`);
    }

    if (cliOptions.limit && cliOptions.limit > 0) {
        testCases = testCases.slice(0, cliOptions.limit);
        console.log(`⏱️ Ограничение выборки: первые ${testCases.length} тестов`);
    }

    console.log(`📦 Загружено сценариев для оценки: ${testCases.length}`);

    // Проверка доступности llama-server
    console.log(`🔌 Проверка связи с llama-server...`);
    const workingUrl = await resolveWorkingUrl();

    if (!workingUrl) {
        console.log('\n' + '!'.repeat(70));
        console.log('  ⚠️  ВНИМАНИЕ: llama-server не доступен!');
        console.log('!'.repeat(70));
        console.log('\nЛокальная LLM не отвечает по адресам:');
        console.log(`  - ${aiConfig.baseURL}`);
        console.log(`  - http://localhost:8080/v1`);
        console.log(`  - http://127.0.0.1:8080/v1\n`);
        console.log('Для запуска "живых" тестов модели:');
        console.log('  1. Скачайте модель gemma-4-E2B-it-Q4_K_M.gguf в папку models/');
        console.log('  2. Запустите контейнер: docker compose up llama-server');
        console.log('  3. Повторите запуск этой команды: npm run test:eval\n');
        console.log('='.repeat(70) + '\n');
        process.exit(0);
    }

    console.log(`✅ Связь с LLM установлена: ${workingUrl}`);
    aiConfig.baseURL = workingUrl;

    const results = [];
    const startTimeTotal = Date.now();

    for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        process.stdout.write(`[${i + 1}/${testCases.length}] [${tc.category}] ${tc.id}: ${tc.name}... `);

        const promptStart = Date.now();
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
        const promptDuration = Date.now() - promptStart;

        const evalOutcome = validateTestCase(tc, result, promptDuration);
        results.push({
            tc,
            result,
            ...evalOutcome
        });

        if (evalOutcome.passed) {
            console.log(`✅ OK (${promptDuration} ms)`);
        } else {
            console.log(`❌ FAIL (${promptDuration} ms)`);
            if (cliOptions.verbose) {
                for (const iss of evalOutcome.issues) {
                    console.log(`    ⚠️ ${iss}`);
                }
            }
        }
    }

    const durationTotalSec = (Date.now() - startTimeTotal) / 1000;
    const latencies = results.map(r => r.durationMs);
    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.length - passedCount;
    const passRate = (passedCount / (results.length || 1)) * 100;

    const byCategory = {};
    for (const r of results) {
        const cat = r.tc.category;
        if (!byCategory[cat]) {
            byCategory[cat] = { total: 0, passed: 0, failed: 0, latencies: [] };
        }
        byCategory[cat].total++;
        if (r.passed) byCategory[cat].passed++;
        else byCategory[cat].failed++;
        byCategory[cat].latencies.push(r.durationMs);
    }

    const stats = {
        total: results.length,
        passed: passedCount,
        failed: failedCount,
        passRate,
        minLatencyMs: latencies.length ? Math.min(...latencies) : 0,
        maxLatencyMs: latencies.length ? Math.max(...latencies) : 0,
        avgLatencyMs: latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
        byCategory
    };

    console.log('\n' + '='.repeat(70));
    console.log(`📊 ИТОГИ ОЦЕНКИ (Pass Rate: ${stats.passRate.toFixed(1)}%)`);
    console.log('='.repeat(70));
    console.log(`Всего тестов:     ${stats.total}`);
    console.log(`Успешно:          ✅ ${stats.passed}`);
    console.log(`Провалено:        ❌ ${stats.failed}`);
    console.log(`Средняя задержка: ⚡ ${stats.avgLatencyMs.toFixed(0)} мс (Мин: ${stats.minLatencyMs} мс, Макс: ${stats.maxLatencyMs} мс)`);
    console.log(`Время прогона:    ⏱️ ${durationTotalSec.toFixed(2)} с\n`);

    console.log('Разбивка по категориям:');
    for (const [cat, cStats] of Object.entries(byCategory)) {
        const rate = (cStats.passed / cStats.total) * 100;
        console.log(`  • ${cat.padEnd(18)}: ${rate.toFixed(1).padStart(5)}% (${cStats.passed}/${cStats.total})`);
    }

    if (!cliOptions.noReport) {
        const mdReport = generateMarkdownReport({
            results,
            stats,
            durationTotalSec,
            targetUrl: workingUrl
        });
        fs.writeFileSync(REPORT_PATH, mdReport, 'utf8');
        console.log(`\n📄 Подробный отчет сохранен в: ${REPORT_PATH}`);
    }

    console.log('='.repeat(70) + '\n');
    process.exit(failedCount > 0 ? 1 : 0);
}

if (require.main === module) {
    run().catch(err => {
        console.error('Критическая ошибка раннера оценки:', err);
        process.exit(1);
    });
}

module.exports = {
    resolveWorkingUrl,
    validateTestCase,
    generateMarkdownReport
};
