// server/ai/services/aiService.js

const axios = require('axios');
const aiConfig = require('../config/aiConfig');
const promptManager = require('./promptManager');

async function retry(fn, retries = 3, delay = 1000) {
    try {
        return await fn();
    } catch (err) {
        if (retries <= 0 || !err.response) throw err;
        await new Promise(resolve => setTimeout(resolve, delay));
        return retry(fn, retries - 1, delay * 2);
    }
}

async function sendChatMessage({ history = [], userMessage }) {
    // Скользящее окно истории
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
        const response = await retry(() => axios.post(
            `${aiConfig.baseURL}/chat/completions`,
            {
                model: aiConfig.model,
                messages,
                max_tokens: aiConfig.maxTokens,
                temperature: aiConfig.temperature
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: aiConfig.timeoutMs
            }
        ));

        const choice = response.data?.choices?.[0];
        let reply = choice?.message?.content || '';

        // Очищаем скрытые блоки размышлений <think>...</think>
        reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        // Извлекаем и удаляем тег настроения
        let emotion = 'idle';
        const moodRegex = /[\[(](?:mood|мood|настроение|emotion):\s*([a-zA-Zа-яА-ЯёЁ_-]+)[\])]/i;
        const moodMatch = reply.match(moodRegex);
        if (moodMatch) {
            emotion = moodMatch[1].toLowerCase();
            reply = reply.replace(/[\[(](?:mood|мood|настроение|emotion):\s*[a-zA-Zа-яА-ЯёЁ_-]+[\])]/gi, '').trim();
        }
        
        reply = reply.replace(/^\[[a-zA-Zа-яА-ЯёЁ\s_-]+:[a-zA-Zа-яА-ЯёЁ\s_-]+\]\s*/i, '').trim();

        // Лимит в 350 символов
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

        if (!reply) {
            if (choice?.finish_reason === 'length') {
                reply = 'Ответ получился слишком длинным и оборвался на лимите токенов.';
                emotion = 'think';
            } else {
                reply = 'Хм, локальная модель вернула пустой ответ.';
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
        console.error('[LLM Error]', err.response?.data || err.message);

        const status = err.response?.status;
        const errMsg = err.response?.data?.error?.message || err.response?.data?.error || err.message;

        return {
            reply: `Не удалось связаться с локальной моделью (${status || 'timeout'}): ${errMsg || 'Сеть недоступна'}.`,
            model: aiConfig.model,
            emotion: 'alert',
            error: true
        };
    }
}

async function transcribeAudio({ audioBase64, mimeType = 'audio/webm' }) {
    // В локальном llama-server нет встроенной транскрипции Whisper, 
    // если она не настроена отдельно. Оставим заглушку или ошибку.
    throw new Error('Транскрипция аудио пока не поддерживается локальной моделью.');
}

module.exports = {
    sendChatMessage,
    transcribeAudio
};