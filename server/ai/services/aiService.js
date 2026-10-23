// server/ai/services/aiService.js

const axios = require('axios');
const aiConfig = require('../config/aiConfig');
const promptManager = require('./promptManager');


async function sendChatMessage({ history = [], userMessage }) {
    const apiKey = aiConfig.apiKey;

    if (!apiKey || apiKey.trim() === '' || apiKey === 'YOUR_ANYMODEL_KEY') {
        return {
            reply: '⚠️ API-ключ AnyModel еще не настроен. Пожалуйста, укажите ANYMODEL_API_KEY в файле server/.env и перезапустите сервер, чтобы я могла подключиться!',
            model: aiConfig.model,
            emotion: 'alert'
        };
    }

    // Скользящее окно истории (не раздуваем контекст, чтобы модель не думала слишком долго)
    const slicedHistory = Array.isArray(history) 
        ? history.slice(-aiConfig.maxHistoryMessages) 
        : [];

    const messages = [
        { role: 'system', content: promptManager.getSystemPrompt() },
        ...slicedHistory.map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: String(m.content || '')
        })),
        { role: 'user', content: String(userMessage || '').trim() }
    ];

    try {
        const response = await axios.post(
            `${aiConfig.baseURL}/chat/completions`,
            {
                model: aiConfig.model,
                messages,
                max_tokens: aiConfig.maxTokens,
                temperature: aiConfig.temperature
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey.trim()}`,
                    'Content-Type': 'application/json'
                },
                timeout: aiConfig.timeoutMs
            }
        );

        const choice = response.data?.choices?.[0];
        let reply = choice?.message?.content || '';

        // Очищаем скрытые блоки размышлений <think>...</think>, если модель выдала их в тексте
        reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        // Извлекаем и гарантированно удаляем тег настроения [mood:...], [мood:...] (с учетом русской буквы "м")
        let emotion = 'idle';
        const moodRegex = /[\[(](?:mood|мood|настроение|emotion):\s*([a-zA-Zа-яА-ЯёЁ_-]+)[\])]/i;
        const moodMatch = reply.match(moodRegex);
        if (moodMatch) {
            emotion = moodMatch[1].toLowerCase();
            reply = reply.replace(/[\[(](?:mood|мood|настроение|emotion):\s*[a-zA-Zа-яА-ЯёЁ_-]+[\])]/gi, '').trim();
        }
        // Дополнительная страховка: удаляем любые стартовые системные теги вида [тег:значение]
        reply = reply.replace(/^\[[a-zA-Zа-яА-ЯёЁ\s_-]+:[a-zA-Zа-яА-ЯёЁ\s_-]+\]\s*/i, '').trim();

        // Гарантированное соблюдение лимита в 350 символов
        if (reply.length > 350) {
            const cutoff = Math.max(
                reply.lastIndexOf('.', 350),
                reply.lastIndexOf('!', 350),
                reply.lastIndexOf('?', 350)
            );
            if (cutoff > 120) {
                reply = reply.substring(0, cutoff + 1).trim();
            } else {
                const spaceCutoff = reply.lastIndexOf(' ', 350);
                reply = (spaceCutoff > 100 ? reply.substring(0, spaceCutoff) : reply.substring(0, 350)).trim() + '...';
            }
        }

        // Если ответ пустой (например, reasoning съел лимит токенов)
        if (!reply) {
            if (choice?.finish_reason === 'length') {
                reply = 'Ответ получился слишком длинным и оборвался на лимите токенов. Пожалуйста, задай вопрос чуть конкретнее!';
                emotion = 'think';
            } else {
                reply = 'Хм, AnyModel вернул пустой ответ. Попробуй переформулировать вопрос!';
                emotion = 'alert';
            }
        }

        return {
            reply: reply.trim(),
            model: response.data?.model || aiConfig.model,
            emotion,
            usage: response.data?.usage
        };
    } catch (err) {
        console.error('[AnyModel Error]', err.response?.data || err.message);

        const status = err.response?.status;
        const errMsg = err.response?.data?.error?.message || err.response?.data?.error || err.message;

        if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
            return {
                reply: `⏳ Модель слишком долго размышляла и не успела ответить за ${Math.round(aiConfig.timeoutMs / 1000)} секунд. Для мгновенных ответов без задержек рекомендуем сменить модель на am/llama-3.2-11b-vision-instruct в server/.env!`,
                model: aiConfig.model,
                emotion: 'alert',
                error: true
            };
        }

        if (status === 401) {
            return {
                reply: 'Ошибка авторизации (401). Проверьте правильность ANYMODEL_API_KEY в файле server/.env.',
                model: aiConfig.model,
                emotion: 'alert',
                error: true
            };
        }

        if (status === 429) {
            return {
                reply: 'Ой, запросов сейчас слишком много (лимит 429). Подожди пару секунд и попробуй снова!',
                model: aiConfig.model,
                emotion: 'think',
                error: true
            };
        }

        return {
            reply: `Не удалось связаться с AnyModel (${status || 'timeout'}): ${errMsg || 'Сеть недоступна'}. Попробуй еще раз чуть позже!`,
            model: aiConfig.model,
            emotion: 'alert',
            error: true
        };
    }
}

module.exports = {
    sendChatMessage
};
