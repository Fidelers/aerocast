const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Загружаем переменные окружения из server/.env, если есть
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const aiConfig = require('../config/aiConfig');
const jevConfig = require('../config/jevConfig');
const aiService = require('../services/aiService');

const JEV_DATASET_PATH = path.resolve(__dirname, 'jev/dataset.json');
const GEMMA_DATASET_PATH = path.resolve(__dirname, 'gemma/dataset.json');
const LEGACY_DATASET_PATH = path.resolve(__dirname, 'evalDataset.json');
const REPORT_PATH = path.resolve(__dirname, 'evalReport.md');

// Парсинг CLI-аргументов
const args = process.argv.slice(2);
const cliOptions = {
    target: 'all', // 'all' | 'jev' | 'gemma'
    category: null,
    limit: null,
    url: null,
    verbose: args.includes('--verbose') || args.includes('-v'),
    noReport: args.includes('--no-report')
};

for (const arg of args) {
    if (arg.startsWith('--target=')) cliOptions.target = arg.split('=')[1].trim().toLowerCase();
    if (arg.startsWith('--category=')) cliOptions.category = arg.split('=')[1].trim();
    if (arg.startsWith('--limit=')) cliOptions.limit = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--url=')) cliOptions.url = arg.split('=')[1].trim();
}

async function resolveWorkingUrl() {
    const candidates = [
        cliOptions.url,
        process.env.LLM_EVAL_BASE_URL,
        aiConfig.baseURL,
        'http://localhost:8080/v1',
        'http://127.0.0.1:8080/v1'
    ].filter(Boolean);

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

async function checkJevStatus() {
    try {
        const jevHealth = await axios.get(`${jevConfig.baseURL}/health`, { timeout: 1500 });
        if (jevHealth.data?.status === 'ok') {
            return {
                ok: true,
                url: jevConfig.baseURL,
                model: jevHealth.data.model || 'Jev-Style-0.8B-Decision-v3'
            };
        }
    } catch (e) {
        // jev оффлайн
    }
    return { ok: false, url: jevConfig.baseURL, error: 'Offline' };
}

function loadDataset(target) {
    let cases = [];

    const loadJson = (filePath, subSystem) => {
        if (fs.existsSync(filePath)) {
            const list = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return list.map(item => ({ ...item, subSystem }));
        }
        return [];
    };

    if (target === 'jev') {
        cases = loadJson(JEV_DATASET_PATH, 'System 1 (Jev-Style)');
    } else if (target === 'gemma') {
        cases = loadJson(GEMMA_DATASET_PATH, 'System 2 (Gemma-4)');
    } else {
        const jevCases = loadJson(JEV_DATASET_PATH, 'System 1 (Jev-Style)');
        const gemmaCases = loadJson(GEMMA_DATASET_PATH, 'System 2 (Gemma-4)');
        if (jevCases.length === 0 && gemmaCases.length === 0 && fs.existsSync(LEGACY_DATASET_PATH)) {
            cases = loadJson(LEGACY_DATASET_PATH, 'Combined');
        } else {
            cases = [...jevCases, ...gemmaCases];
        }
    }

    return cases;
}

function validateTestCase(tc, result, durationMs) {
    const issues = [];
    const exp = tc.expectations || {};

    // 1. Проверка сетевого сбоя
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
            issues.push(`Эмоция "${result.emotion}" не входит в список [${exp.allowedEmotions.join(', ')}]`);
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
            issues.push(`Ответ должен содержать хотя бы один фрагмент из: [${exp.replyMustContainOneOf.join(', ')}]`);
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

function generateMarkdownReport({ results, stats, durationTotalSec, gemmaUrl, jevStatus, target }) {
    const timestamp = new Date().toLocaleString('ru-RU', { timeZoneName: 'short' });

    let md = `# AeroCast Two-Tier AI E2E Evaluation Report\n\n`;
    md += `* **Дата тестирования:** ${timestamp}\n`;
    md += `* **Выбранный таргет:** \`${target}\`\n`;
    md += `* **System 1 (Jev Router):** \`${jevStatus.ok ? jevStatus.url + ' (' + jevStatus.model + ')' : 'Offline'}\`\n`;
    md += `* **System 2 (Gemma LLM):** \`${gemmaUrl || 'Offline'}\` (\`${aiConfig.model}\`)\n`;
    md += `* **Общее время прогона:** ${durationTotalSec.toFixed(2)} с\n`;
    md += `* **Всего сценариев:** ${stats.total}\n`;
    md += `* **Успешно:** ${stats.passed} (${stats.passRate.toFixed(1)}%)\n`;
    md += `* **Провалено:** ${stats.failed}\n`;
    md += `* **Средняя задержка:** ${stats.avgLatencyMs.toFixed(0)} мс (Мин: ${stats.minLatencyMs} мс, Макс: ${stats.maxLatencyMs} мс)\n\n`;

    md += `## 1. Сводка по подсистемам (System 1 vs System 2)\n\n`;
    md += `| Подсистема | Всего | Пройдено | Провалено | Pass Rate | Ср. Задержка |\n`;
    md += `|------------|-------|----------|-----------|-----------|--------------|\n`;

    for (const [sub, sStats] of Object.entries(stats.bySubSystem)) {
        const rate = (sStats.passed / sStats.total) * 100;
        const avgLat = sStats.latencies.reduce((a, b) => a + b, 0) / (sStats.latencies.length || 1);
        md += `| **${sub}** | ${sStats.total} | ${sStats.passed} | ${sStats.failed} | ${rate.toFixed(1)}% | ${avgLat.toFixed(0)} мс |\n`;
    }

    md += `\n## 2. Сводка по категориям\n\n`;
    md += `| Категория | Всего | Пройдено | Провалено | Pass Rate | Ср. Задержка |\n`;
    md += `|-----------|-------|----------|-----------|-----------|--------------|\n`;

    for (const [cat, cStats] of Object.entries(stats.byCategory)) {
        const catRate = (cStats.passed / cStats.total) * 100;
        const avgLat = cStats.latencies.reduce((a, b) => a + b, 0) / (cStats.latencies.length || 1);
        md += `| \`${cat}\` | ${cStats.total} | ${cStats.passed} | ${cStats.failed} | ${catRate.toFixed(1)}% | ${avgLat.toFixed(0)} мс |\n`;
    }

    md += `\n## 3. Детальные результаты по тестам\n\n`;
    md += `| Статус | ID | Подсистема | Категория | Название | Задержка | Примечания |\n`;
    md += `|:------:|----|------------|-----------|----------|:--------:|------------|\n`;

    for (const r of results) {
        const icon = r.passed ? '✅' : '❌';
        const notes = r.passed ? 'OK' : r.issues.map(i => i.replace(/\|/g, '\\|')).join('; ');
        md += `| ${icon} | \`${r.tc.id}\` | ${r.tc.subSystem || '—'} | ${r.tc.category} | ${r.tc.name} | ${r.durationMs} мс | ${notes} |\n`;
    }

    const failed = results.filter(r => !r.passed);
    if (failed.length > 0) {
        md += `\n## 4. Детализация проваленных тестов (${failed.length})\n\n`;
        for (const f of failed) {
            md += `### ❌ [${f.tc.id}] ${f.tc.name}\n`;
            md += `* **Подсистема:** \`${f.tc.subSystem}\`\n`;
            md += `* **Запрос:** \`${f.tc.input.userMessage}\`\n`;
            md += `* **Модель ответа:** \`${f.result.model || 'unknown'}\`\n`;
            md += `* **Action:** \`${JSON.stringify(f.result.action)}\`\n`;
            md += `* **Эмоция:** \`${f.result.emotion}\`\n`;
            md += `* **Ответ модели:**\n> ${f.result.reply ? f.result.reply.replace(/\n/g, '\n> ') : 'нет ответа'}\n`;
            md += `* **Замечания:**\n`;
            for (const issue of f.issues) {
                md += `  - ⚠️ ${issue}\n`;
            }
            md += `\n---\n`;
        }
    }

    return md;
}

async function run() {
    console.log('\n' + '='.repeat(75));
    console.log('  AeroCast Two-Tier AI E2E Eval Runner (System 1 Jev + System 2 Gemma)');
    console.log('='.repeat(75) + '\n');

    const target = cliOptions.target;
    let testCases = loadDataset(target);

    if (testCases.length === 0) {
        console.error(`Датасет для таргета "${target}" пуст или не найден.`);
        process.exit(1);
    }

    if (cliOptions.category) {
        testCases = testCases.filter(tc => tc.category === cliOptions.category);
        console.log(`Фильтр по категории: "${cliOptions.category}" (${testCases.length} тестов)`);
    }

    if (cliOptions.limit && cliOptions.limit > 0) {
        testCases = testCases.slice(0, cliOptions.limit);
        console.log(`Ограничение выборки: первые ${testCases.length} тестов`);
    }

    console.log(`Целевой контур: [${target.toUpperCase()}], сценариев к запуску: ${testCases.length}`);

    // Проверяем сервисы
    const jevStatus = await checkJevStatus();
    if (jevStatus.ok) {
        console.log(`✅ System 1 (Jev-Style) активен: ${jevStatus.url} (${jevStatus.model})`);
    } else {
        console.log(`⚠️ System 1 (Jev-Style) не отвечает по ${jevStatus.url} (${jevStatus.error})`);
    }

    let gemmaUrl = await resolveWorkingUrl();
    if (gemmaUrl) {
        aiConfig.baseURL = gemmaUrl;
        console.log(`✅ System 2 (Gemma-4) активен: ${gemmaUrl} (${aiConfig.model})`);
    } else {
        const needsGemma = target === 'all' || target === 'gemma';
        if (needsGemma) {
            console.log(`⚠️ llama-server оффлайн. Ответы System 2 будут эмулироваться fallback'ом.`);
            if (target === 'gemma') {
                console.log('Для запуска тестов Gemma поднимите контейнер: docker compose up llama-server');
                process.exit(1);
            }
        }
    }

    console.log('\nЗапуск тестирования сценариев:\n' + '-'.repeat(75));

    const results = [];
    const startTimeTotal = Date.now();

    for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        const sub = tc.subSystem ? `[${tc.subSystem.includes('Jev') ? 'JEV' : 'GEMMA'}]` : '';
        process.stdout.write(`[${i + 1}/${testCases.length}] ${sub} [${tc.category}] ${tc.id}: ${tc.name}... `);

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
            console.log(`✅ OK (${promptDuration} ms, model: ${result.model || 'default'})`);
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
    const bySubSystem = {};

    for (const r of results) {
        const cat = r.tc.category;
        if (!byCategory[cat]) {
            byCategory[cat] = { total: 0, passed: 0, failed: 0, latencies: [] };
        }
        byCategory[cat].total++;
        if (r.passed) byCategory[cat].passed++;
        else byCategory[cat].failed++;
        byCategory[cat].latencies.push(r.durationMs);

        const sub = r.tc.subSystem || 'Other';
        if (!bySubSystem[sub]) {
            bySubSystem[sub] = { total: 0, passed: 0, failed: 0, latencies: [] };
        }
        bySubSystem[sub].total++;
        if (r.passed) bySubSystem[sub].passed++;
        else bySubSystem[sub].failed++;
        bySubSystem[sub].latencies.push(r.durationMs);
    }

    const stats = {
        total: results.length,
        passed: passedCount,
        failed: failedCount,
        passRate,
        minLatencyMs: latencies.length ? Math.min(...latencies) : 0,
        maxLatencyMs: latencies.length ? Math.max(...latencies) : 0,
        avgLatencyMs: latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
        byCategory,
        bySubSystem
    };

    console.log('\n' + '='.repeat(75));
    console.log(`ИТОГИ ТЕСТИРОВАНИЯ (Pass Rate: ${stats.passRate.toFixed(1)}%)`);
    console.log('='.repeat(75));
    console.log(`Всего тестов:     ${stats.total}`);
    console.log(`Успешно:          ✅ ${stats.passed}`);
    console.log(`Провалено:        ❌ ${stats.failed}`);
    console.log(`Средняя задержка: ⚡ ${stats.avgLatencyMs.toFixed(0)} мс (Мин: ${stats.minLatencyMs} мс, Макс: ${stats.maxLatencyMs} мс)`);
    console.log(`Время прогона:    ⏱️ ${durationTotalSec.toFixed(2)} с\n`);

    console.log('Разбивка по подсистемам:');
    for (const [sub, sStats] of Object.entries(bySubSystem)) {
        const rate = (sStats.passed / sStats.total) * 100;
        const avgLat = sStats.latencies.reduce((a, b) => a + b, 0) / (sStats.latencies.length || 1);
        console.log(`  • ${sub.padEnd(25)}: ${rate.toFixed(1).padStart(5)}% (${sStats.passed}/${sStats.total}) | Ср: ${avgLat.toFixed(0)} мс`);
    }

    console.log('\nРазбивка по категориям:');
    for (const [cat, cStats] of Object.entries(byCategory)) {
        const rate = (cStats.passed / cStats.total) * 100;
        console.log(`  • ${cat.padEnd(22)}: ${rate.toFixed(1).padStart(5)}% (${cStats.passed}/${cStats.total})`);
    }

    if (!cliOptions.noReport) {
        const mdReport = generateMarkdownReport({
            results,
            stats,
            durationTotalSec,
            gemmaUrl,
            jevStatus,
            target
        });
        fs.writeFileSync(REPORT_PATH, mdReport, 'utf8');
        console.log(`\n📄 Детальный отчет сохранен в: ${REPORT_PATH}`);
    }

    console.log('='.repeat(75) + '\n');
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
    generateMarkdownReport,
    loadDataset,
    checkJevStatus
};
