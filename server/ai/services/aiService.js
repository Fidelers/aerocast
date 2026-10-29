// server/ai/services/aiService.js

const axios = require('axios');
const aiConfig = require('../config/aiConfig');
const promptManager = require('./promptManager');

function fixFeminineGrammar(text) {
    if (!text) return text;
    return text
        .replace(/(?<![а-яА-ЯёЁ])([Яя](?:\s+[а-яА-ЯёЁ]+){0,2}\s+)рад(?![а-яА-ЯёЁ])/g, '$1рада')
        .replace(/(?<![а-яА-ЯёЁ])([Яя](?:\s+[а-яА-ЯёЁ]+){0,2}\s+)готов(?![а-яА-ЯёЁ])/g, '$1готова')
        .replace(/(?<![а-яА-ЯёЁ])([Яя](?:\s+[а-яА-ЯёЁ]+){0,2}\s+)уверен(?![а-яА-ЯёЁ])/g, '$1уверена')
        .replace(/(?<![а-яА-ЯёЁ])([Яя]\s+)сам(?![а-яА-ЯёЁ])/g, '$1сама')
        .replace(/(?<![а-яА-ЯёЁ])([Яя](?:\s+[а-яА-ЯёЁ]+){0,2}\s+)заметил(?![а-яА-ЯёЁ])/g, '$1заметила')
        .replace(/(?<![а-яА-ЯёЁ])([Яя](?:\s+[а-яА-ЯёЁ]+){0,2}\s+)посмотрел(?![а-яА-ЯёЁ])/g, '$1посмотрела')
        .replace(/(?<![а-яА-ЯёЁ])([Яя](?:\s+[а-яА-ЯёЁ]+){0,2}\s+)подумал(?![а-яА-ЯёЁ])/g, '$1подумала')
        .replace(/(?<![а-яА-ЯёЁ])([Яя](?:\s+[а-яА-ЯёЁ]+){0,2}\s+)мог(?![а-яА-ЯёЁ])/g, '$1могла')
        .replace(/(?<![а-яА-ЯёЁ])([Яя](?:\s+[а-яА-ЯёЁ]+){0,2}\s+)бы\s+хотел(?![а-яА-ЯёЁ])/g, '$1бы хотела')
        .replace(/(?<![а-яА-ЯёЁ])([Яя](?:\s+[а-яА-ЯёЁ]+){0,2}\s+)хотел(?![а-яА-ЯёЁ])/g, '$1хотела')
        .replace(/(?<![а-яА-ЯёЁ])([Яя](?:\s+[а-яА-ЯёЁ]+){0,2}\s+)сказал(?![а-яА-ЯёЁ])/g, '$1сказала')
        .replace(/(?<![а-яА-ЯёЁ])([Яя](?:\s+[а-яА-ЯёЁ]+){0,2}\s+)нашел(?![а-яА-ЯёЁ])/g, '$1нашла')
        .replace(/(?<![а-яА-ЯёЁ])([Яя](?:\s+[а-яА-ЯёЁ]+){0,2}\s+)нашёл(?![а-яА-ЯёЁ])/g, '$1нашла')
        .replace(/(?<![а-яА-ЯёЁ])([Яя](?:\s+[а-яА-ЯёЁ]+){0,2}\s+)проверил(?![а-яА-ЯёЁ])/g, '$1проверила')
        .replace(/(?<![а-яА-ЯёЁ])([Яя](?:\s+[а-яА-ЯёЁ]+){0,2}\s+)узнал(?![а-яА-ЯёЁ])/g, '$1узнала')
        .replace(/(?<![а-яА-ЯёЁ])([Яя](?:\s+[а-яА-ЯёЁ]+){0,2}\s+)понял(?![а-яА-ЯёЁ])/g, '$1поняла')
        .replace(/(?<![а-яА-ЯёЁ])([Яя](?:\s+[а-яА-ЯёЁ]+){0,2}\s+)устал(?![а-яА-ЯёЁ])/g, '$1устала')
        .replace(/(?<![а-яА-ЯёЁ])([Яя](?:\s+[а-яА-ЯёЁ]+){0,2}\s+)забыл(?![а-яА-ЯёЁ])/g, '$1забыла')
        .replace(/(?<![а-яА-ЯёЁ])([Яя](?:\s+[а-яА-ЯёЁ]+){0,2}\s+)решил(?![а-яА-ЯёЁ])/g, '$1решила');
}

/**
 * Распознает явное намерение пользователя переключить слой карты:
 * 'satellite' — спутниковые снимки ESRI World Imagery
 * 'osm' — схема OpenStreetMap
 */
function detectMapLayerIntent(text) {
    if (!text || typeof text !== 'string') return null;
    const clean = text.toLowerCase().trim();

    const IS_QUESTION_REGEX = /(?:^(?:какие|какой|какая|что\s+такое|расскажи|как|где|почему|зачем)\b|\?$)/i;
    if (IS_QUESTION_REGEX.test(clean)) return null;

    const hasOff = /(?:выключ|отключ|убер|убир|сним|выруб)/i.test(clean);
    const hasOn = /(?:включ|переключ|постав|покажи|открой|сделай|перейди|хочу|вруб|запусти|верни)/i.test(clean);
    const hasSatellite = /(?:спутник|космос)/i.test(clean);
    const hasOsm = /(?:обычн[а-я]*\s+карт|стандартн[а-я]*\s+карт|схем[а-я]*|улиц[а-я]*|вектор|osm)/i.test(clean);

    if (hasOff && hasSatellite) return 'osm';
    if (hasOn && hasSatellite) return 'satellite';
    if (hasOn && hasOsm) return 'osm';
    if (/^(?:спутник|со\s+спутника|спутниковая\s+карта)$/i.test(clean)) return 'satellite';
    if (/^(?:обычная\s+карта|схема|верни\s+карту|векторная\s+карта)$/i.test(clean)) return 'osm';

    return null;
}

/**
 * Распознает команду переключения режима доступности для дальтоников:
 * { enabled: false } — выключение
 * { enabled: true, colorBlindType: 'okabe' | 'deuteranopia' | 'protanopia' | 'tritanopia' } — включение
 * { unsupported: true, requested?: string } — запрос нереализованного вида
 */
function detectColorBlindIntent(text, { isColorBlind = false, history = [] } = {}) {
    if (!text || typeof text !== 'string') return null;
    const clean = text.toLowerCase().trim();

    // Вопросы о дальтонизме не должны триггерить действие
    const IS_QUESTION_REGEX = /(?:^(?:какие|какой|какая|какую|что\s+такое|расскажи|как|где|почему|зачем)\b|\?$)/i;
    if (IS_QUESTION_REGEX.test(clean)) return null;

    let historyText = '';
    if (Array.isArray(history)) {
        historyText = history.map(h => (h?.content || '')).join(' ').toLowerCase();
    }

    const hasOffWord = /(?:выключ|отключ|убер|убир|сним|выруб|сброс)/i.test(clean);
    const hasOnWord = /(?:включ|переключ|постав|сделай|активир|открой|вруб)/i.test(clean);
    const hasCbWord = /(?:дальтонизм|дальтоник|цветов(?:ую|ой|ая)?\s+слепот|цветовосприят|доступност)/i.test(clean);
    const hasReturnNormalColors = /(?:верни|возврат|стандартн|обычн|нормальн|исходн|прежн).*(?:цвет|гамм|палитр)/i.test(clean) ||
                                  /(?:цвет|гамм|палитр).*(?:стандартн|обычн|нормальн|исходн|прежн|как\s+было)/i.test(clean);

    const isContextCb = Boolean(isColorBlind) || /(?:дальтонизм|палитр|гамм|цветов|окабе|дейтераноп|протаноп|тританоп)/i.test(historyText);
    const hasPronounOff = hasOffWord && /(?:его|е[её]|это|этот|режим|палитру|доступность)/i.test(clean);

    // 1. Выключение режима дальтонизма
    if ((hasOffWord && (hasCbWord || /(?:окабе|дейтераноп|протаноп|тританоп)/i.test(clean))) ||
        hasReturnNormalColors ||
        (hasPronounOff && isContextCb) ||
        (/^(?:выключи|отключи|убери|сними|выруби)\s+(?:пожалуйста\s+)?(?:его|е[её]|это|режим)?$/i.test(clean) && isContextCb)) {
        return { enabled: false };
    }

    // Известные медицинские термины, не реализованные в приложении
    const KNOWN_UNSUPPORTED = /(?:ахроматопс[а-я]*|монохромаз[а-я]*|дихромаз[а-я]*|тетрахромат[а-я]*|трихромат[а-я]*|блютоп[а-я]*|редтоп[а-я]*|монохром\b)/i;
    if (KNOWN_UNSUPPORTED.test(clean)) {
        return { unsupported: true };
    }

    // Проверяем паттерны вида: "режим дальтонизма [название]", "палитра [название]", "дальтонизм [название]"
    const SPECIFIED_TYPE_REGEX = /(?:режим(?:а|е)?\s+дальтонизма\s+|дальтонизм(?:а|е)?\s+|палитр[а-я]\s+|вид(?:а)?\s+дальтонизма\s+)([а-яa-z0-9_-]+)/i;
    const specMatch = clean.match(SPECIFIED_TYPE_REGEX);
    if (specMatch) {
        const word = specMatch[1].toLowerCase();
        if (/^(?:окабе|okabe)$/i.test(word)) return { enabled: true, colorBlindType: 'okabe' };
        if (/^(?:дейтераноп[а-я]*|deuteranop[a-z]*)$/i.test(word)) return { enabled: true, colorBlindType: 'deuteranopia' };
        if (/^(?:протаноп[а-я]*|protanop[a-z]*)$/i.test(word)) return { enabled: true, colorBlindType: 'protanopia' };
        if (/^(?:тританоп[а-я]*|tritanop[a-z]*)$/i.test(word)) return { enabled: true, colorBlindType: 'tritanopia' };
        if (!/^(?:по|для|в|на|онлайн|свой|новый|мне|только|все|пожалуйста|пж|плиз|есть|бывает)$/i.test(word)) {
            return { unsupported: true, requested: word };
        }
    }

    // 2. Явное указание одного из 4 поддерживаемых видов
    if (/(?:дейтераноп[а-я]*|deuteranop[a-z]*)/i.test(clean)) return { enabled: true, colorBlindType: 'deuteranopia' };
    if (/(?:протаноп[а-я]*|protanop[a-z]*)/i.test(clean)) return { enabled: true, colorBlindType: 'protanopia' };
    if (/(?:тританоп[а-я]*|tritanop[a-z]*)/i.test(clean)) return { enabled: true, colorBlindType: 'tritanopia' };
    if (/(?:окабе|okabe)/i.test(clean)) return { enabled: true, colorBlindType: 'okabe' };

    // 3. Запрос на включение дальтонизма без указания типа -> Окабе по умолчанию
    if ((hasOnWord && hasCbWord) || /^(?:дальтонизм|режим\s+дальтонизма)$/i.test(clean)) {
        return { enabled: true, colorBlindType: 'okabe' };
    }

    return null;
}

/**
 * Распознает команду переключения темы оформления (тёмная / светлая):
 * 'dark' — тёмная тема
 * 'light' — светлая тема
 */
function detectThemeIntent(text) {
    if (!text || typeof text !== 'string') return null;
    const clean = text.toLowerCase().trim();

    const IS_QUESTION_REGEX = /(?:^(?:какие|какой|какая|что\s+такое|расскажи|как|где|почему|зачем)\b|\?$)/i;
    if (IS_QUESTION_REGEX.test(clean)) return null;

    const hasOff = /(?:выключ|отключ|убер|убир|сним|выруб)/i.test(clean);
    const hasOn = /(?:включ|переключ|постав|сделай|активир|открой|вруб|верни)/i.test(clean);
    const hasDark = /(?:т[её]мн|ночн)/i.test(clean);
    const hasLight = /(?:светл|дневн)/i.test(clean);
    const hasThemeWord = /(?:тем[ауеы]|режим|стиль|оформлен)/i.test(clean);

    if (/(?:сделай\s+темно|темноту)/i.test(clean)) return 'dark';
    if (/(?:сделай\s+светло|посветлее)/i.test(clean)) return 'light';

    if (hasOff && hasDark) return 'light';
    if (hasOff && hasLight) return 'dark';

    if ((hasOn || hasThemeWord) && hasDark) return 'dark';
    if ((hasOn || hasThemeWord) && hasLight) return 'light';

    return null;
}

/**
 * Распознает подтверждение действия в тексте ответа модели (если модель забыла тег [action:...])
 */
function detectActionFromReply(replyText) {
    if (!replyText || typeof replyText !== 'string') return null;
    const clean = replyText.toLowerCase();

    // Если ответ содержит отказ или сообщение об ошибке, действие не извлекаем
    if (/(?:такого\s+режима|не\s+поддержива|нет\s+такого|не\s+буду|хмпф|ошибка)/i.test(clean)) {
        return null;
    }

    // Выключение дальтонизма
    if (/(?:выключаю\s+(?:режим\s+)?дальтонизма|отключаю\s+(?:режим\s+)?дальтонизма|выключаю\s+дальтонизм|отключаю\s+дальтонизм|возвращаю\s+стандартную\s+цветовую|возвращаю\s+стандартные\s+цвета|возвращаю\s+обычные\s+цвета|выключаю\s+его,\s+возвращаю)/i.test(clean)) {
        return { type: 'set_colorblind', enabled: false };
    }

    // Включение конкретной палитры дальтонизма
    const hasSwitchAction = /(?:включаю|переключаю|активирую|ставлю)/i.test(clean);
    if (hasSwitchAction && /(?:дейтераноп)/i.test(clean)) {
        return { type: 'set_colorblind', enabled: true, colorBlindType: 'deuteranopia' };
    }
    if (hasSwitchAction && /(?:протаноп)/i.test(clean)) {
        return { type: 'set_colorblind', enabled: true, colorBlindType: 'protanopia' };
    }
    if (hasSwitchAction && /(?:тританоп)/i.test(clean)) {
        return { type: 'set_colorblind', enabled: true, colorBlindType: 'tritanopia' };
    }
    if (hasSwitchAction && /(?:окабе|палитру\s+окабе|режим\s+дальтонизма|палитру\s+дальтонизма|режим\s+доступности\s+для\s+дальтоников)/i.test(clean)) {
        return { type: 'set_colorblind', enabled: true, colorBlindType: 'okabe' };
    }

    // Темы оформления
    if (hasSwitchAction && /(?:т[её]мн(?:ую|ый)|ночн(?:ую|ой))\s+(?:тему|режим)/i.test(clean)) {
        return { type: 'set_theme', theme: 'dark' };
    }
    if ((hasSwitchAction || /возвращаю/i.test(clean)) && /(?:светл(?:ую|ый)|дневн(?:ую|ой))\s+(?:тему|режим)/i.test(clean)) {
        return { type: 'set_theme', theme: 'light' };
    }

    // Карта
    if (hasSwitchAction && /(?:спутник)/i.test(clean)) {
        return { type: 'set_base_layer', layer: 'satellite' };
    }
    if ((hasSwitchAction || /возвращаю/i.test(clean)) && /(?:схем[ау]|openstreetmap|обычн(?:ую|ая)\s+карт[ау])/i.test(clean)) {
        return { type: 'set_base_layer', layer: 'osm' };
    }

    return null;
}

async function retry(fn, retries = 3, delay = 1000) {
    try {
        return await fn();
    } catch (err) {
        if (retries <= 0 || !err.response) throw err;
        await new Promise(resolve => setTimeout(resolve, delay));
        return retry(fn, retries - 1, delay * 2);
    }
}

async function sendChatMessage({ history = [], userMessage, currentLayer, isColorBlind, colorBlindType, theme }) {
    const cleanUserMessage = String(userMessage || '').trim();

    // Защитный барьер 1: перехват запросов на генерацию программного кода
    const CODE_REQUEST_REGEX = /(?:(?:напиши|сделай|создай|дай|выдай|покажи|сгенерируй|сочини|напечатай|придумай)\s+(?:мне\s+)?(?:простой\s+)?(?:код|программ[ауе]?|скрипт|функци[юя]|алгоритм|калькулятор|бот[а-я]*|сайт)|(?:код|скрипт|программ[ауе]?|функци[юя]|калькулятор)\s+(?:на|для|в)\s+(?:пайтон|питон|python|javascript|js|c\+\+|java|c#|php|html|css|sql|go|rust|bash)|(?:на|для)\s+(?:пайтон|питон|python|javascript|js|c\+\+|java|c#)\s+(?:калькулятор|скрипт|код|функци|программ)|(?:как\s+(?:написать|запрограммировать|создать)\s+(?:код|программу|скрипт|калькулятор|функцию))|\b(?:python|javascript|c\+\+|pascal)\s+код\b)/i;
    if (CODE_REQUEST_REGEX.test(cleanUserMessage)) {
        return {
            reply: 'Эй, ты чего выдумал?! Я же девушка-маскот чистого воздуха AeroCast, а не твой репетитор по программированию, хмпф! 😾 Не буду я тебе код писать. Давай лучше на карту глянем, чем дышит твой город, ня! ✨',
            model: aiConfig.model,
            emotion: 'alert'
        };
    }

    // Защитный барьер 2: перехват вопросов про года отсечки знаний и прошедшие события
    const YEARS_OR_EVENTS_REGEX = /(?:до\s+какого\s+года|в\s+каком\s+году\s+ты|какой\s+(?:сейчас\s+)?год|события\s+в\s+мире|новости\s+в\s+мире|знания\s+о\s+мире|дата\s+отсечки|актуальны\s+до|что\s+нового\s+в\s+мире)/i;
    if (YEARS_OR_EVENTS_REGEX.test(cleanUserMessage)) {
        return {
            reply: 'Хмпф! Зачем мне какие-то старые архивы и прошедшие года, если датчики AeroCast показывают качество воздуха прямо сейчас в реальном времени?! 😾 Не забивай голову старыми датами, лучше посмотри на свежие замеры атмосферы в твоём городе, ня! ✨',
            model: aiConfig.model,
            emotion: 'think'
        };
    }

    // Защитный барьер 3: перехват оффтопа за пределами проекта AeroCast (математика, рецепты, домашка)
    const OFFTOPIC_REQUEST_REGEX = /(?:(?:сколько\s+будет\s+\d+|посчитай\s+\d+|вычисли\s+\d+|реши\s+(?:уравнение|пример|задач[ауе]))|(?:как\s+(?:приготовить|сварить|испечь|пожарить)|рецепт\s+(?:борща|супа|пиццы|пирога|торта|пасты|салата|еды))|(?:напиши\s+сочинение|сделай\s+домашк[ауе]|домашнее\s+задание\s+по)|(?:как\s+играть\s+в\s+(?:доту|кс|майнкрафт|dota|cs|minecraft)))/i;
    if (OFFTOPIC_REQUEST_REGEX.test(cleanUserMessage)) {
        return {
            reply: 'Хмпф! Я же маскот экологической платформы AeroCast, а не универсальная энциклопедия или калькулятор! 😾 Меня волнует только атмосфера и чистота воздуха. Спроси меня лучше про показатели AQI, погоду или открой карту, ня! ✨',
            model: aiConfig.model,
            emotion: 'think'
        };
    }

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
        { role: 'user', content: cleanUserMessage }
    ];

    try {
        const payload = {
            model: aiConfig.model,
            messages,
            max_tokens: aiConfig.maxTokens,
            temperature: aiConfig.temperature,
            top_p: aiConfig.topP,
            frequency_penalty: aiConfig.frequencyPenalty,
            presence_penalty: aiConfig.presencePenalty
        };

        if (aiConfig.repeatPenalty) {
            payload.repeat_penalty = aiConfig.repeatPenalty;
            payload.repetition_penalty = aiConfig.repeatPenalty;
        }

        const response = await retry(() => axios.post(
            `${aiConfig.baseURL}/chat/completions`,
            payload,
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: aiConfig.timeoutMs
            }
        ));

        const choice = response.data?.choices?.[0];
        let reply = choice?.message?.content || '';
        let emotion = 'idle';

        // 1. Извлекаем и удаляем тег настроения в самом начале
        const moodRegex = /[\[(](?:mood|мood|настроение|emotion):\s*([a-zA-Zа-яА-ЯёЁ_-]+)[\])]/i;
        const moodMatch = reply.match(moodRegex);
        if (moodMatch) {
            emotion = moodMatch[1].toLowerCase();
            reply = reply.replace(/[\[(](?:mood|мood|настроение|emotion):\s*[a-zA-Zа-яА-ЯёЁ_-]+[\])]/gi, '').trim();
        }
        reply = reply.replace(/^\[[a-zA-Zа-яА-ЯёЁ\s_-]+:[a-zA-Zа-яА-ЯёЁ\s_-]+\]\s*/i, '').trim();

        // 1.1 Извлекаем и удаляем интерактивный тег действия (переключение слоев карты и др.)
        let action = null;
        const actionRegex = /[\[(]action:\s*([a-zA-Z0-9_-]+)(?::([a-zA-Z0-9_-]+))?[\])]/i;
        const actionMatch = reply.match(actionRegex);
        if (actionMatch) {
            const actType = actionMatch[1].toLowerCase();
            const actVal = (actionMatch[2] || '').toLowerCase();
            if (actType === 'set_layer' || actType === 'map_layer' || actType === 'layer') {
                if (actVal === 'satellite' || actVal === 'osm') {
                    action = { type: 'set_base_layer', layer: actVal };
                }
            } else if (actType === 'set_colorblind' || actType === 'colorblind') {
                if (actVal === 'off' || actVal === 'false' || actVal === 'disable' || actVal === 'disabled') {
                    action = { type: 'set_colorblind', enabled: false };
                } else if (['okabe', 'deuteranopia', 'protanopia', 'tritanopia'].includes(actVal)) {
                    action = { type: 'set_colorblind', enabled: true, colorBlindType: actVal };
                }
            } else if (actType === 'set_theme' || actType === 'theme') {
                if (actVal === 'dark' || actVal === 'light') {
                    action = { type: 'set_theme', theme: actVal };
                }
            }
            reply = reply.replace(/[\[(]action:\s*[a-zA-Z0-9_-]+(?::[a-zA-Z0-9_-]+)?[\])]/gi, '').trim();
        }

        // Если пользователь запросил нереализованный вид дальтонизма — строго сообщаем об этом
        const cbIntent = detectColorBlindIntent(cleanUserMessage, { isColorBlind, history });
        if (cbIntent?.unsupported) {
            action = null;
            reply = 'Хмпф! Такого режима дальтонизма у нас нет! 😾 В AeroCast поддерживаются только 4 проверенные палитры: Окабе (по умолчанию), Дейтеранопия, Протанопия и Тританопия. Выбери что-то из них, ня! ✨';
            emotion = 'alert';
        } else {
            if (!action && cbIntent) {
                if (cbIntent.enabled === false) {
                    action = { type: 'set_colorblind', enabled: false };
                } else if (cbIntent.enabled === true) {
                    action = { type: 'set_colorblind', enabled: true, colorBlindType: cbIntent.colorBlindType || 'okabe' };
                }
            }

            // Если модель не сгенерировала тег действия, но пользователь явно просил переключить тему оформления:
            if (!action) {
                const detectedTheme = detectThemeIntent(cleanUserMessage);
                if (detectedTheme) {
                    action = { type: 'set_theme', theme: detectedTheme };
                }
            }

            // Если модель не сгенерировала тег действия, но пользователь явно просил переключить слой:
            if (!action) {
                const detectedLayer = detectMapLayerIntent(cleanUserMessage);
                if (detectedLayer) {
                    action = { type: 'set_base_layer', layer: detectedLayer };
                }
            }

            // Если модель подтвердила действие в тексте ответа, но забыла вставить тег [action:...]:
            if (!action) {
                const detectedFromReply = detectActionFromReply(reply);
                if (detectedFromReply) {
                    action = detectedFromReply;
                }
            }
        }

        // 2. Очищаем скрытые блоки размышлений <think>...</think>
        reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        // 3. Замена специфичных просачивающихся китайских токенов и очистка любых CJK иероглифов
        reply = reply.replace(/空气质量/g, 'качество воздуха');
        reply = reply.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, '').trim();

        // 4. Очистка упоминаний сторонних компаний (DICPlay, RusMind и др.) и подмена автора на Николаева Артёма
        reply = reply.replace(/русскоязычный\s+ИИ[- ]ассистент\s+от\s+компании\s+DICPlay[.,\s]*/gi, 'маскот платформы AeroCast. ');
        reply = reply.replace(/(?:от\s+компании|создан[ао]?\s+компанией|разработан[ао]?\s+компанией)\s+DICPlay/gi, 'AeroCast');
        reply = reply.replace(/\b(?:DICPlay|RusMind)\b/gi, 'AeroCast');
        reply = reply.replace(/ИИ[- ]ассистент\s+от\s+компании\s+AeroCast/gi, 'маскот платформы AeroCast');
        reply = reply.replace(/большая\s+языковая\s+модель\s+(?:AeroCast)?/gi, 'маскот AeroCast');
        reply = reply.replace(/Даниил(?:а|у|ом|е)?\s+Кириллин(?:а|у|ом|е)?/gi, 'Николаев Артём');
        reply = reply.replace(/Кириллин(?:а|у|ом|е)?/gi, 'Николаев Артём');

        // 5. Защита: если модель всё же сгенерировала программный код
        if (reply.includes('```') || /(?:def\s+\w+\s*\(|class\s+\w+:|import\s+\w+|console\.log|float\(input\(|#include\s*<|function\s+\w+\s*\(|var\s+\w+\s*=|const\s+\w+\s*=)/.test(reply)) {
            reply = 'Эй, я же маскот AeroCast, а не генератор кода, хмпф! 😾 Я слежу за чистотой атмосферы, а не за скриптами. Спроси меня лучше про качество воздуха или открой карту, ня! ✨';
            emotion = 'alert';
        }

        // 6. Очистка отсечки знаний по годам ("знания о мире до ноября 2024 года" и т.д.)
        const KNOWLEDGE_CUTOFF_REGEX = /(?:знания\s+о\s+мире\s+до|до\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)?\s*20\d\d\s+года|мои\s+знания\s+ограничены|актуальны\s+на\s+\d{4}|дата\s+отсечки|конкретное\s+событие,\s+дай\s+мне\s+знать)/i;
        if (KNOWLEDGE_CUTOFF_REGEX.test(reply)) {
            const stripped = reply
                .replace(/[^.!?\n]*(?:опираясь\s+на\s+)?знания\s+о\s+мире\s+до\s+[а-яА-ЯёЁ\s\d]+года[^.!?\n]*[.!?]?/gi, '')
                .replace(/[^.!?\n]*до\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)?\s*20\d\d\s+года[^.!?\n]*[.!?]?/gi, '')
                .replace(/Если ты имеешь в виду какое-то конкретное событие[^.!?\n]*[.!?]?/gi, '')
                .trim();

            if (stripped.length < 25) {
                reply = 'Хмпф! Зачем мне какие-то старые архивы и прошедшие года, когда мои датчики AeroCast следят за атмосферой прямо сейчас в реальном времени?! 😾 Не забивай голову старыми датами, лучше посмотри на свежие замеры воздуха, ня! ✨';
                emotion = 'think';
            } else {
                reply = stripped;
            }
        }

        // 7. Защита от дегенеративных циклов повторений (looping) одинаковых предложений
        if (reply) {
            const rawSentences = reply.split(/(?<=[.!?])\s+/);
            const seenSentences = new Set();
            const uniqueSentences = [];
            for (const s of rawSentences) {
                const normalized = s.toLowerCase().trim().replace(/[«»"'—–\s]/g, '');
                if (normalized.length > 5 && seenSentences.has(normalized)) {
                    continue; // Пропускаем зацикленный дубликат
                }
                if (normalized.length > 5) {
                    seenSentences.add(normalized);
                }
                uniqueSentences.push(s);
            }
            reply = uniqueSentences.join(' ').trim();
        }

        // 8. Лимит символов ответа (по умолчанию 750)
        const charLimit = aiConfig.maxCharLimit || 750;
        if (reply.length > charLimit) {
            const textChunk = reply.substring(0, charLimit);
            const sentenceEndMatches = [...textChunk.matchAll(/(?<!\b\d)[.!?](?=\s|$)/g)];
            if (sentenceEndMatches.length > 0) {
                const lastMatch = sentenceEndMatches[sentenceEndMatches.length - 1];
                const cutoff = lastMatch.index;
                if (cutoff > 200) {
                    reply = textChunk.substring(0, cutoff + 1).trim();
                }
            } else {
                const spaceCutoff = textChunk.lastIndexOf(' ');
                reply = (spaceCutoff > 200 ? textChunk.substring(0, spaceCutoff) : textChunk).trim() + '...';
            }
        }

        // 9. Страховка от висячих обрывков нумерации в самом конце ("5.", "1)", "2." и т.д.)
        reply = reply.replace(/\s*\b\d+[\.\)]\s*$/g, '').trim();

        // 10. Нормализация женского рода от лица персонажа Аи
        reply = fixFeminineGrammar(reply);

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
            action,
            usage: response.data?.usage
        };
    } catch (err) {
        console.error('[LLM Error]', err.response?.data || err.message);

        // Защитная обработка: если локальная LLM выключена/недоступна, но запрос был на переключение карты
        const fallbackLayer = detectMapLayerIntent(cleanUserMessage);
        if (fallbackLayer) {
            return {
                reply: fallbackLayer === 'satellite'
                    ? 'Секундочку! Переключаю карту на спутниковые снимки ESRI, смотри как здорово видно местность из космоса, ня! ✨'
                    : 'Как скажешь! Возвращаю привычную схему OpenStreetMap, ня! ✨',
                model: aiConfig.model,
                emotion: 'happy',
                action: { type: 'set_base_layer', layer: fallbackLayer }
            };
        }

        // Fallback для смены дальтонизма при оффлайне/сбое LLM
        const fallbackCB = detectColorBlindIntent(cleanUserMessage, { isColorBlind, history });
        if (fallbackCB?.unsupported) {
            return {
                reply: 'Хмпф! Такого режима дальтонизма у нас нет! 😾 В AeroCast поддерживаются только 4 проверенные палитры: Окабе (по умолчанию), Дейтеранопия, Протанопия и Тританопия. Выбери что-то из них, ня! ✨',
                model: aiConfig.model,
                emotion: 'alert',
                action: null
            };
        }
        if (fallbackCB?.enabled === false) {
            return {
                reply: 'Как скажешь! Возвращаю стандартную цветовую гамму, ня! ✨',
                model: aiConfig.model,
                emotion: 'happy',
                action: { type: 'set_colorblind', enabled: false }
            };
        }
        if (fallbackCB?.enabled === true) {
            const cbType = fallbackCB.colorBlindType || 'okabe';
            const typeLabels = { okabe: 'Окабе (по умолчанию)', deuteranopia: 'Дейтеранопию', protanopia: 'Протанопию', tritanopia: 'Тританопию' };
            return {
                reply: cbType === 'okabe'
                    ? 'Секундочку! Включаю режим доступности для людей с нарушением цветовосприятия с палитрой Окабе по умолчанию, теперь все показатели контрастные и различимые, ня! ✨'
                    : `Без проблем! Переключаю палитру дальтонизма на ${typeLabels[cbType] || 'Окабе'}, ня! ✨`,
                model: aiConfig.model,
                emotion: 'happy',
                action: { type: 'set_colorblind', enabled: true, colorBlindType: cbType }
            };
        }

        // Fallback для смены темы оформления при оффлайне/сбое LLM
        const fallbackTheme = detectThemeIntent(cleanUserMessage);
        if (fallbackTheme) {
            return {
                reply: fallbackTheme === 'dark'
                    ? 'Секундочку! Переключаю интерфейс на уютную тёмную тему, ня! ✨'
                    : 'Как скажешь! Возвращаю яркую светлую тему, ня! ✨',
                model: aiConfig.model,
                emotion: 'happy',
                action: { type: 'set_theme', theme: fallbackTheme }
            };
        }

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
    transcribeAudio,
    detectMapLayerIntent,
    detectColorBlindIntent,
    detectThemeIntent,
    detectActionFromReply
};