// server/ai/services/aiService.js

const axios = require('axios');
const aiConfig = require('../config/aiConfig');
const promptManager = require('./promptManager');
const geocodingService = require('../../services/geocodingService');

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

function toAccusativeCity(name) {
    if (!name || typeof name !== 'string') return 'выбранный город';
    const base = name.split(',')[0].trim();
    return base.replace(/а$/i, 'у').replace(/я$/i, 'ю');
}

function isNotCityName(str) {
    if (!str) return true;
    const s = str.trim().toLowerCase();
    if (/^(?:точк[а-яё]*|тачк[а-яё]*|мест[а-яё]*|локаци[а-яё]*|координат[а-яё]*|карт[а-яё]*|тут|здесь|сейчас|сегодня)$/i.test(s)) return true;
    if (/(?:текущ[а-яё]*|выбранн[а-яё]*|эт[а-яё]*|данн[а-яё]*)\s+(?:точке?|тачке?|мест[а-яё]*|локаци[а-яё]*|координат[а-яё]*)/i.test(s)) return true;
    if (/(?:3\s+дня|три\s+дня|\d+\s+дн[еяй]|прогноз|завтра|послезавтра|недел|суток|сутки|ближайш|выходн)/i.test(s)) return true;
    if (/^(?:значени[а-яё]*|качеств[а-яё]*|уровн[а-яё]*|воздух[а-яё]*|данн[а-яё]*|замер[а-яё]*|аналитик[а-яё]*|шкал[а-яё]*|индекс[а-яё]*|дн[еяй]*|недел[а-яё]*|месяц[а-яё]*|год[а-яё]*|времен[а-яё]*|период[а-яё]*|архив[а-яё]*|истори[а-яё]*|числ[а-яё]*|маки|аки|aqi|eaqi|пм|pm|средн[а-яё]*|максим[а-яё]*|миним[а-яё]*|пик[а-яё]*|норм[а-яё]*|мире|росси[а-яё]*|планет[а-яё]*|стран[а-яё]*)$/i.test(s)) return true;
    return false;
}

/**
 * Распознает запрос пользователя на перемещение к городу или проверку воздуха в городе
 */
function extractCityIntent(text) {
    if (!text || typeof text !== 'string') return null;
    const clean = text.trim();

    if (/^(?:какие\s+города|как\s+найти|где\s+найти|кто\s+ты|кто\s+тебя)\b/i.test(clean)) {
        return null;
    }
    if (/(?:т[её]мн|светл|ночн|дневн)\s+(?:тем[ау]|режим)/i.test(clean)) return null;
    if (/(?:спутник|схем|дальтонизм|окабе|дейтераноп|протаноп|тританоп)/i.test(clean)) return null;
    if (/(?:по|в|на)\s+(?:текущ[а-яё]*|выбранн[а-яё]*|эт[а-яё]*|данн[а-яё]*|сво[её]|мо[её])?\s*(?:точке?|тачке?|мест[а-яё]*|локаци[а-яё]*|координат[а-яё]*)/i.test(clean)) {
        const withoutPoint = clean.replace(/(?:по|в|на)\s+(?:текущ[а-яё]*|выбранн[а-яё]*|эт[а-яё]*|данн[а-яё]*|сво[её]|мо[её])?\s*(?:точке?|тачке?|мест[а-яё]*|локаци[а-яё]*|координат[а-яё]*)/gi, '').trim();
        if (!/(?:перейди|перемести|покажи|слетай|поехали|город|в|во|на|к|до)\s+[А-ЯЁ][а-яё]{2,}/i.test(withoutPoint)) {
            return null;
        }
    }

    // Снимаем вежливые вводные слова в начале («можешь пожалуйста сказать», «подскажи пожалуйста», «скажи», «хочу узнать»)
    let stripped = clean.replace(/^(?:(?:можешь|можете)(?:\s+ли)?(?:\s+пожалуйста|\s+пж|\s+плиз)?\s+(?:сказать|подсказать|рассказать|узнать|проверить|глянуть|посмотреть|показать)|подскажи(?:те)?(?:\s+пожалуйста|\s+пж|\s+плиз)?|скажи(?:те)?(?:\s+пожалуйста|\s+пж|\s+плиз)?|расскажи(?:те)?(?:\s+пожалуйста|\s+пж|\s+плиз)?|пожалуйста\s+|пж\s+|плиз\s+|хочу\s+узнать|интересно|дай\s+знать|проверь(?:те)?)\s+/i, '').trim();

    // 1. Паттерны навигации: любые формы глаголов перемещения
    const NAV_REGEX = /(?:(?:перейди(?:те)?|перейти|переходим|переход|перемести(?:ть|сь|те)?|перемещаемся|перемещение|перенеси(?:ть|сь|те)?|открой(?:те)?|открыть|открываем|покажи(?:те)?|показать|показывай|полети(?:м)?|полетели|лететь|слетай(?:те)?|слетаем|поехали|погнали|сгоняй(?:те)?|сгоняем|переключи(?:ть|сь|те)?|переключай|найди(?:те)?|найти|поищи|ищи|глянь(?:те)?|глянем|погляди|посмотри(?:те)?|посмотрим|посмотреть|хочу|давай)\s+(?:пожалуйста\s+|пж\s+|плиз\s+)?(?:мне\s+)?(?:(?:в|во|на|к|до)\s+)?(?:город\s+)?|^(?:город)\s+)(.+)$/i;
    let navMatch = stripped.match(NAV_REGEX) || clean.match(NAV_REGEX);
    if (navMatch) {
        let city = navMatch[1].trim().replace(/[.,!?;:()]+$/, '').trim();
        city = city.replace(/\s+(?:пожалуйста|пж|плиз)$/i, '').trim();
        city = city.replace(/^(?:в|во|на|к|до)\s+/i, '').replace(/^(?:город[а-яё]*|локаци[а-яё]*|точк[а-яё]*)\s+/i, '').trim();
        if (city.length >= 2 && city.length <= 40 && !isNotCityName(city)) {
            return city;
        }
    }

    // 2. Паттерны замеров воздуха / аналитики / погоды / вопросов о городе
    const AIR_CITY_REGEX = /(?:(?:что(?:\s+там|\s+сейчас|\s+тут)*(?:\s+(?:с\s+воздухом|по\s+воздуху|с\s+аналитикой|по\s+аналитике|с\s+замерами|по\s+замерам))?|как(?:\s+там|\s+сейчас)?\s+(?:воздух|дышится|погода)|качество\s+воздуха|какая\s+аналитика|какой(?:\s+там|\s+сейчас)?\s+воздух|чем\s+дышат|воздух|погода|замеры|аналитика)\s+(?:пожалуйста\s+)?(?:в|во|на|по)\s+)(?:город\s+)?(.+)$/i;
    let airMatch = stripped.match(AIR_CITY_REGEX) || clean.match(AIR_CITY_REGEX);
    if (airMatch) {
        let city = airMatch[1].trim().replace(/[.,!?;:()]+$/, '').trim();
        city = city.replace(/\s+(?:пожалуйста|пж|плиз)$/i, '').trim();
        city = city.replace(/^(?:в|во|на|к|до)\s+/i, '').replace(/^(?:город[а-яё]*|локаци[а-яё]*|точк[а-яё]*)\s+/i, '').trim();
        if (city.length >= 2 && city.length <= 40 && !isNotCityName(city)) {
            return city;
        }
    }

    // 3. Формат: "про воздух в Москве", "про аналитику в Казани"
    const PRO_CITY_REGEX = /(?:про\s+(?:воздух|аналитику|погоду|замеры)\s+(?:в|во|на|по)\s+)(?:город\s+)?(.+)$/i;
    let proMatch = stripped.match(PRO_CITY_REGEX) || clean.match(PRO_CITY_REGEX);
    if (proMatch) {
        let city = proMatch[1].trim().replace(/[.,!?;:()]+$/, '').trim();
        city = city.replace(/\s+(?:пожалуйста|пж|плиз)$/i, '').trim();
        city = city.replace(/^(?:в|во|на|к|до)\s+/i, '').replace(/^(?:город[а-яё]*|локаци[а-яё]*|точк[а-яё]*)\s+/i, '').trim();
        if (city.length >= 2 && city.length <= 40 && !isNotCityName(city)) {
            return city;
        }
    }

    // 4. Поиск упоминания города внутри сложного предложения: "в Новокузнецке", "по воздуху в Самаре мне бы хотелось..."
    const CAP_CITY_REGEX = /(?:^|\s)(?:в|во|на|к|до)\s+(?:городе\s+|город\s+)?([А-ЯЁ][а-яё\-]+(?:\s+[А-ЯЁ][а-яё\-]+)?)/g;
    let inMatch;
    while ((inMatch = CAP_CITY_REGEX.exec(clean)) !== null) {
        let city = inMatch[1].trim().replace(/[.,!?;:()]+$/, '').trim();
        city = city.replace(/\s+(?:пожалуйста|пж|плиз)$/i, '').trim();
        city = city.replace(/^(?:в|во|на|к|до)\s+/i, '').replace(/^(?:город[а-яё]*|локаци[а-яё]*|точк[а-яё]*)\s+/i, '').trim();
        if (city.length >= 2 && city.length <= 40 && !isNotCityName(city)) {
            return city;
        }
    }

    return null;
}

/**
 * Извлекает город из реплики модели (если модель подтвердила перемещение в тексте, но опустила тег)
 */
function extractCityFromReply(replyText) {
    if (!replyText || typeof replyText !== 'string') return null;
    const clean = replyText.trim();
    const replyMatch = clean.match(/(?:перемещаюсь|перемещаемся|открываю|летим|перелетаем|перехожу|переходим|показываю)\s+(?:в|во|на)?\s*(?:город\s+)?([а-яёА-ЯЁa-zA-Z0-9\s-]+?)(?:,|\.|\!|\?|\s+смотрю|\s+проверяю|\s+глянем|\s+на\s+карте)/i);
    if (replyMatch) {
        let city = replyMatch[1].trim().replace(/[.,!?;:()]+$/, '').trim();
        if (city.length >= 2 && city.length <= 40 && !isNotCityName(city)) {
            return city;
        }
    }
    return null;
}

/**
 * Генерирует варианты нормализации падежей (аккузатив, препозитив) для поиска в геокодере
 */
function getCityCandidates(raw) {
    if (!raw || typeof raw !== 'string') return [];
    let clean = raw.trim().replace(/^(?:в|во|на|к|до)\s+/i, '').replace(/[.,!?;:()]+$/, '').trim();

    const lower = clean.toLowerCase();
    if (lower === 'питер' || lower === 'питере' || lower === 'спб') return ['Санкт-Петербург', 'Питер'];
    if (lower === 'мск' || lower === 'москве' || lower === 'москву') return ['Москва'];
    if (lower === 'екб') return ['Екатеринбург'];
    if (lower === 'нск') return ['Новосибирск'];

    const candidates = [clean];

    // Проверяем распространенные падежные трансформации для русских городов
    if (/[а-яА-ЯёЁ]{3,}у$/i.test(clean)) {
        candidates.push(clean.replace(/у$/i, 'а')); // Москву -> Москва, Самару -> Самара
        candidates.push(clean.replace(/у$/i, ''));
    }
    if (/[а-яА-ЯёЁ]{3,}ю$/i.test(clean)) {
        candidates.push(clean.replace(/ю$/i, 'я'));
    }
    if (/[а-яА-ЯёЁ]{3,}е$/i.test(clean)) {
        candidates.push(clean.replace(/е$/i, ''));  // Новосибирске -> Новосибирск, Ростове -> Ростов
        candidates.push(clean.replace(/е$/i, 'а')); // Самаре -> Самара, Москве -> Москва, Туле -> Тула
        candidates.push(clean.replace(/е$/i, 'ь')); // Твери -> Тверь
    }
    if (/[а-яА-ЯёЁ]{3,}и$/i.test(clean)) {
        candidates.push(clean.replace(/и$/i, 'ь')); // Казани -> Казань, Твери -> Тверь, Перми -> Пермь
        candidates.push(clean.replace(/и$/i, 'я'));
        candidates.push(clean.replace(/и$/i, 'а'));
    }

    return Array.from(new Set(candidates));
}

const KNOWN_CITIES = {
    'москва': { lat: 55.75204, lon: 37.61781, cityName: 'Москва, Россия' },
    'санкт-петербург': { lat: 59.93863, lon: 30.31413, cityName: 'Санкт-Петербург, Россия' },
    'питер': { lat: 59.93863, lon: 30.31413, cityName: 'Санкт-Петербург, Россия' },
    'новосибирск': { lat: 55.02259, lon: 82.93175, cityName: 'Новосибирск, Новосибирская область, Россия' },
    'екатеринбург': { lat: 56.85733, lon: 60.61529, cityName: 'Екатеринбург, Свердловская область, Россия' },
    'казань': { lat: 55.78874, lon: 49.12214, cityName: 'Казань, Татарстан, Россия' },
    'нижний новгород': { lat: 56.32867, lon: 44.00205, cityName: 'Нижний Новгород, Россия' },
    'челябинск': { lat: 55.15402, lon: 61.42915, cityName: 'Челябинск, Россия' },
    'самара': { lat: 53.20767, lon: 50.13553, cityName: 'Самара, Самарская область, Россия' },
    'омск': { lat: 54.99244, lon: 73.36859, cityName: 'Омск, Россия' },
    'ростов-на-дону': { lat: 47.23135, lon: 39.72328, cityName: 'Ростов-на-Дону, Россия' },
    'ростов': { lat: 47.23135, lon: 39.72328, cityName: 'Ростов-на-Дону, Россия' },
    'уфа': { lat: 54.74306, lon: 55.96779, cityName: 'Уфа, Башкортостан, Россия' },
    'красноярск': { lat: 56.01839, lon: 92.86717, cityName: 'Красноярск, Россия' },
    'воронеж': { lat: 51.67204, lon: 39.1843, cityName: 'Воронеж, Россия' },
    'пермь': { lat: 58.01046, lon: 56.22944, cityName: 'Пермь, Россия' },
    'волгоград': { lat: 48.71939, lon: 44.50183, cityName: 'Волгоград, Россия' },
    'краснодар': { lat: 45.04534, lon: 38.98178, cityName: 'Краснодар, Россия' },
    'сочи': { lat: 43.59699, lon: 39.72477, cityName: 'Сочи, Краснодарский край, Россия' },
    'владивосток': { lat: 43.10562, lon: 131.87354, cityName: 'Владивосток, Россия' },
    'томск': { lat: 56.50104, lon: 84.99245, cityName: 'Томск, Россия' },
    'кемерово': { lat: 55.33333, lon: 86.08333, cityName: 'Кемерово, Россия' },
    'новокузнецк': { lat: 53.7596, lon: 87.1467, cityName: 'Новокузнецк, Кемеровская область, Россия' },
    'барнаул': { lat: 53.36056, lon: 83.76361, cityName: 'Барнаул, Россия' },
    'иркутск': { lat: 52.29778, lon: 104.29639, cityName: 'Иркутск, Россия' },
    'тюмень': { lat: 57.15222, lon: 65.52722, cityName: 'Тюмень, Россия' },
    'хабаровск': { lat: 48.48278, lon: 135.08389, cityName: 'Хабаровск, Россия' },
    'ярославль': { lat: 57.62987, lon: 39.87368, cityName: 'Ярославль, Россия' }
};

/**
 * Выполняет геокодирование города через geocodingService с падежной нормализацией
 */
async function resolveCity(raw) {
    if (!raw || typeof raw !== 'string') return null;
    if (isNotCityName(raw)) return null;
    const candidates = getCityCandidates(raw);
    for (const cand of candidates) {
        const lower = cand.toLowerCase();
        if (KNOWN_CITIES[lower]) {
            return {
                query: raw,
                resolvedCandidate: cand,
                lat: KNOWN_CITIES[lower].lat,
                lon: KNOWN_CITIES[lower].lon,
                cityName: KNOWN_CITIES[lower].cityName
            };
        }
    }
    for (const cand of candidates) {
        try {
            const results = await geocodingService.search(cand);
            if (results && results.length > 0) {
                const exactMatch = results.find(r => {
                    const mainPart = (r.display_name.split(',')[0] || '').trim().toLowerCase();
                    return mainPart === cand.toLowerCase();
                });
                const ruResult = results.find(r => r.display_name.includes('Россия'));
                const chosen = exactMatch || ruResult || results[0];
                return {
                    query: raw,
                    resolvedCandidate: cand,
                    lat: Number(chosen.lat),
                    lon: Number(chosen.lon),
                    cityName: chosen.display_name
                };
            }
        } catch (e) {
            // try next candidate
        }
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

function isAnalyticsQuery(text) {
    if (!text || typeof text !== 'string') return false;
    const clean = text.toLowerCase().trim();

    if (/(?:кто\s+(?:тебя\s+)?создал|разработчик|смени|включи\s+спутник|верни\s+карту|темн|светл|дальтонизм)/i.test(clean)) {
        return false;
    }

    return /(?:аналитик|качество\s+воздуха|воздух|показател|замер|чем\s+дышим|дышать|чист(?:ый|о|ота)|смог|aqi|аки|маки|эаки|eaqi|пм|pm2|pm10|безопасно\s+ли|гулять|как\s+(?:там\s+)?дышится|в\s+(?:этой|выбранной|текущей)\s+точке|по\s+точке|здесь|прогноз|3\s+дня|три\s+дня|на\s+днях|завтра|послезавтра|средн|максим|миним|пик|прошл|предыдущ|вчера|позавчера|раньше|архив|истори|все\s+дни|всех\s+дней|весь\s+период|вс[её]\s+время|вместе\s+взят|было\s+(?:ли|самое)?)/i.test(clean);
}

function generateHistoryReply(historyData, locationName, cleanUserMessage = '') {
    if (!historyData || typeof historyData !== 'object') {
        return null;
    }
    const loc = locationName || 'выбранной локации';
    const { pastMaxAqi, pastMinAqi, pastAvgAqi, pastDays } = historyData;

    const wantsMaxOrPeak = /(?:максим|само[ее]\s+высок|пик|худш|больш)/i.test(cleanUserMessage);
    const wantsMin = /(?:миним|само[ее]\s+(?:низк|чист)|лучш)/i.test(cleanUserMessage);
    const wantsYesterday = /(?:вчера|позавчера)/i.test(cleanUserMessage);
    const wantsAvg = /(?:средн)/i.test(cleanUserMessage);

    let text = '';
    if (wantsAvg && pastAvgAqi !== null) {
        text = `В среднем за предыдущие прошедшие дни индекс качества воздуха EAQI в ${loc} составлял ${pastAvgAqi}! Самый высокий пик достигал ${pastMaxAqi ? `${pastMaxAqi.aqi} (${pastMaxAqi.label})` : '—'}, а в самый чистый день опускался до ${pastMinAqi ? pastMinAqi.aqi : '—'}, ня! ✨`;
    } else if (wantsMaxOrPeak && pastMaxAqi) {
        text = `Хмпф, думаешь, я не слежу за архивами метеостанций?! 😼 Самый высокий пик индекса EAQI за прошедшие дни в ${loc} достигал ${pastMaxAqi.aqi} — это зафиксировано ${pastMaxAqi.label}! А в среднем за прошедший период индекс держался около ${pastAvgAqi !== null ? pastAvgAqi : 'нормы'}, ня! ✨`;
    } else if (wantsMin && pastMinAqi) {
        text = `Самый чистый и свежий воздух за прошедшие дни в ${loc} был зафиксирован ${pastMinAqi.label} — индекс EAQI опускался до ${pastMinAqi.aqi} (Отлично)! Дышалось просто идеально, ня! ✨`;
    } else if (wantsYesterday && Array.isArray(pastDays) && pastDays.length > 0) {
        const yDay = pastDays[pastDays.length - 1];
        text = `Вчера в ${loc} средний индекс качества воздуха EAQI составлял ${yDay.avgAqi !== null ? yDay.avgAqi : '—'} [${yDay.status}], а пик достигал ${yDay.maxAqi !== null ? yDay.maxAqi : '—'}${yDay.maxAqiTime ? ` в ${yDay.maxAqiTime}` : ''}. Вся история сохранена в AeroCast, ня! ✨`;
    } else {
        const peakText = pastMaxAqi ? `Самый высокий пик достигал ${pastMaxAqi.aqi} (${pastMaxAqi.label}), ` : '';
        const minText = pastMinAqi ? `а минимум опускался до ${pastMinAqi.aqi}. ` : '';
        text = `Вот что говорят архивные замеры по ${loc} за прошедшие дни, ня: ${peakText}${minText}В среднем за весь прошедший период индекс EAQI держался на отметке ${pastAvgAqi !== null ? pastAvgAqi : '—'}. Всё под моим чутким контролем, бака! 😼✨`;
    }

    return {
        reply: text,
        model: aiConfig.model,
        emotion: 'happy'
    };
}

function generateAllDaysReply(allDaysSummary, locationName, cleanUserMessage = '') {
    if (!allDaysSummary || typeof allDaysSummary !== 'object') {
        return null;
    }
    const loc = locationName || 'выбранной локации';
    const { totalDaysCount, overallAvgAqi, overallMaxAqi, overallMinAqi } = allDaysSummary;

    const maxStr = overallMaxAqi ? `${overallMaxAqi.aqi} (${overallMaxAqi.label})` : '—';
    const minStr = overallMinAqi ? `${overallMinAqi.aqi} (${overallMinAqi.label})` : '—';

    let text = `Смотри, вот сводка по ${loc} за все ${totalDaysCount || 11} дней (неделя архива + сегодня + прогноз), ня! ✨ `;
    if (overallAvgAqi !== null) {
        text += `В среднем за весь период индекс EAQI составляет ${overallAvgAqi}. `;
    }
    text += `Абсолютный пик загрязнения за все дни — ${maxStr}, а самый чистый воздух — ${minStr}. Я помню историю и слежу за прогнозом наперёд, ня! 😊`;

    return {
        reply: text,
        model: aiConfig.model,
        emotion: 'happy'
    };
}

function generateForecastReply(forecast3Days, locationName) {
    if (!forecast3Days || !Array.isArray(forecast3Days.days) || forecast3Days.days.length === 0) {
        return null;
    }
    const loc = locationName || 'выбранной локации';
    const { periodAvgAqi, periodMinAqi, periodMaxAqi, periodAvgPm25, days } = forecast3Days;

    let text = `Смотри, вот прогноз качества воздуха для ${loc} на ближайшие 3 дня, ня! ✨ `;
    if (periodAvgAqi != null) {
        text += `В среднем за 3 дня индекс EAQI составит ${periodAvgAqi} (минимум ${periodMinAqi}, максимум ${periodMaxAqi}). `;
    }
    const daySummaries = days.map(d => `${d.dayLabel}: средний EAQI ${d.avgAqi !== null ? d.avgAqi : '—'} (${d.status}), разброс ${d.minAqi !== null ? d.minAqi : '—'}–${d.maxAqi !== null ? d.maxAqi : '—'}`).join('; ');
    text += `${daySummaries}. `;
    if (periodAvgAqi != null && periodAvgAqi <= 40) {
        text += 'Воздух в целом благоприятный, можно спокойно планировать дела на улице, ня! 😊';
    } else {
        text += 'Местами воздух загрязняется, так что следи за обновлениями и береги здоровье, бака! 😾';
    }
    return {
        reply: text,
        model: aiConfig.model,
        emotion: 'happy'
    };
}

function generatePointAnalyticsReply(pointAnalytics, cleanUserMessage) {
    const {
        locationName,
        aqi,
        pm2_5,
        pm10,
        no2,
        so2,
        o3,
        co
    } = pointAnalytics || {};

    const locText = locationName || 'выбранной точке';

    if (aqi === null || aqi === undefined || isNaN(Number(aqi))) {
        return {
            reply: `Хмпф! Для локации "${locText}" данные ещё подгружаются с метеостанции. Подожди пару секундочек и спроси снова, ня! ✨`,
            model: aiConfig.model,
            emotion: 'think'
        };
    }

    const numAqi = Number(aqi);
    const pm25Str = (pm2_5 != null && !isNaN(Number(pm2_5))) ? `${Number(pm2_5).toFixed(1)} мкг/м³` : null;
    const pm10Str = (pm10 != null && !isNaN(Number(pm10))) ? `${Number(pm10).toFixed(1)} мкг/м³` : null;
    const no2Str = (no2 != null && !isNaN(Number(no2))) ? `${Number(no2).toFixed(1)} мкг/м³` : null;

    if (numAqi <= 20) {
        return {
            reply: `Смотри, в ${locText} сейчас прекрасный воздух! Индекс EAQI равен ${numAqi} (Отлично). PM2.5: ${pm25Str || 'в норме'}, PM10: ${pm10Str || 'в норме'}. Можешь смело идти гулять и дышать полной грудью, ня! ✨`,
            model: aiConfig.model,
            emotion: 'happy'
        };
    }

    if (numAqi <= 40) {
        return {
            reply: `В ${locText} сейчас хорошее качество воздуха: индекс EAQI равен ${numAqi} (Хорошо). PM2.5 держится около ${pm25Str || 'нормы'}, заметных загрязнений нет. Отличная погода для прогулок, ня! ✨`,
            model: aiConfig.model,
            emotion: 'happy'
        };
    }

    if (numAqi <= 60) {
        return {
            reply: `В ${locText} умеренное качество воздуха: индекс EAQI составляет ${numAqi} (Удовлетворительно). PM2.5: ${pm25Str || 'повышен'}, NO₂: ${no2Str || 'в норме'}. Чувствительным людям и аллергикам стоит быть повнимательнее, ня! 👀`,
            model: aiConfig.model,
            emotion: 'think'
        };
    }

    if (numAqi <= 80) {
        return {
            reply: `Внимание! В ${locText} воздух неблагоприятный: индекс EAQI поднялся до ${numAqi} (Плохо). Концентрация PM2.5: ${pm25Str || 'высокая'}. Лучше отложить длительные пробежки и прогулки на улице, ня! 😾`,
            model: aiConfig.model,
            emotion: 'alert'
        };
    }

    return {
        reply: `Осторожнее! В ${locText} опасный уровень загрязнения: индекс EAQI подскочил до ${numAqi} (Опасно)! PM2.5: ${pm25Str || 'зашкаливает'}, PM10: ${pm10Str || 'зашкаливает'}. Закрой окна и надень респиратор, я же за тебя переживаю, бака! 😾`,
        model: aiConfig.model,
        emotion: 'alert'
    };
}

async function sendChatMessage({ history = [], userMessage, currentLayer, isColorBlind, colorBlindType, theme, pointAnalytics, isFollowUpAnalytics = false }) {
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

    // Защитный барьер 2 & 3: экологический контекст защищает от ложных срабатываний
    const isEnvironmental = /(?:aqi|аки|эаки|eaqi|воздух|погод|замер|прогноз|день|дня|дней|суточн|средн|максим|миним|пик|прошл|предыдущ|вчера|позавчера|раньше|архив|истори|концентрац|температур|загрязн|пм|pm|газ|эколог|смог|чист|атмосфер)/i.test(cleanUserMessage);

    const YEARS_OR_EVENTS_REGEX = /(?:до\s+какого\s+года|в\s+каком\s+году\s+ты|какой\s+(?:сейчас\s+)?год|события\s+в\s+мире|новости\s+в\s+мире|знания\s+о\s+мире|дата\s+отсечки|актуальны\s+до|что\s+нового\s+в\s+мире)/i;
    if (!isEnvironmental && YEARS_OR_EVENTS_REGEX.test(cleanUserMessage)) {
        return {
            reply: 'Хмпф! Зачем мне какие-то старые архивы и прошедшие года, если датчики AeroCast показывают качество воздуха прямо сейчас в реальном времени?! 😾 Не забивай голову старыми датами, лучше посмотри на свежие замеры атмосферы в твоём городе, ня! ✨',
            model: aiConfig.model,
            emotion: 'think'
        };
    }
    const OFFTOPIC_REQUEST_REGEX = /(?:(?:сколько\s+будет\s+\d+|посчитай\s+\d+|вычисли\s+\d+|реши\s+(?:уравнение|пример|задач[ауе]))|(?:как\s+(?:приготовить|сварить|испечь|пожарить)|рецепт\s+(?:борща|супа|пиццы|пирога|торта|пасты|салата|еды))|(?:напиши\s+сочинение|сделай\s+домашк[ауе]|домашнее\s+задание\s+по)|(?:как\s+играть\s+в\s+(?:доту|кс|майнкрафт|dota|cs|minecraft)))/i;
    if (!isEnvironmental && OFFTOPIC_REQUEST_REGEX.test(cleanUserMessage)) {
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

    // Если это второй шаг (получение аналитики по городу), не ищем переход к городу и не отсекаем аналитику
    const cityQuery = isFollowUpAnalytics ? null : extractCityIntent(cleanUserMessage);
    let effectivePointAnalytics = pointAnalytics;
    if (!isFollowUpAnalytics && cityQuery && pointAnalytics?.locationName) {
        const locLower = pointAnalytics.locationName.toLowerCase();
        const cityLower = cityQuery.toLowerCase();
        if (!locLower.includes(cityLower) && !cityLower.includes(locLower)) {
            effectivePointAnalytics = null;
        }
    }

    const messages = [
        { role: 'system', content: promptManager.getSystemPrompt(effectivePointAnalytics) },
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

        // 1.1 Извлекаем и удаляем интерактивный тег действия (переключение слоев карты, дальтонизм, города и др.)
        let action = null;
        const actionRegex = /[\[(]action:\s*([a-zA-Z0-9_-]+)(?::([^\]\)\n]+))?[\])]/i;
        const actionMatch = reply.match(actionRegex);
        if (actionMatch) {
            const actType = actionMatch[1].toLowerCase();
            const actVal = (actionMatch[2] || '').trim();
            const actValLower = actVal.toLowerCase();
            if (actType === 'set_layer' || actType === 'map_layer' || actType === 'layer') {
                if (actValLower === 'satellite' || actValLower === 'osm') {
                    action = { type: 'set_base_layer', layer: actValLower };
                }
            } else if (actType === 'set_colorblind' || actType === 'colorblind') {
                if (actValLower === 'off' || actValLower === 'false' || actValLower === 'disable' || actValLower === 'disabled') {
                    action = { type: 'set_colorblind', enabled: false };
                } else if (['okabe', 'deuteranopia', 'protanopia', 'tritanopia'].includes(actValLower)) {
                    action = { type: 'set_colorblind', enabled: true, colorBlindType: actValLower };
                }
            } else if (actType === 'set_theme' || actType === 'theme') {
                if (actValLower === 'dark' || actValLower === 'light') {
                    action = { type: 'set_theme', theme: actValLower };
                }
            } else if (actType === 'set_location' || actType === 'navigate_city' || actType === 'city' || actType === 'location') {
                if (isFollowUpAnalytics || isNotCityName(actVal)) {
                    action = null;
                } else if (actVal) {
                    const resolved = await resolveCity(actVal);
                    if (resolved) {
                        action = {
                            type: 'set_location',
                            lat: resolved.lat,
                            lon: resolved.lon,
                            cityName: resolved.cityName
                        };
                    } else {
                        reply = `Хмпф! Я обыскала карту, но города "${actVal}" не нашла! 😾 Проверь название или выбери другой город, ня! ✨`;
                        emotion = 'alert';
                    }
                }
            }
            reply = reply.replace(/[\[(]action:\s*[a-zA-Z0-9_-]+(?::[^\]\)\n]+)?[\])]/gi, '').trim();
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

            // Если модель не сгенерировала тег действия, но пользователь просил перейти к городу:
            if (!action && !isFollowUpAnalytics) {
                const cityQuery = extractCityIntent(cleanUserMessage);
                if (cityQuery) {
                    const resolved = await resolveCity(cityQuery);
                    if (resolved) {
                        action = {
                            type: 'set_location',
                            lat: resolved.lat,
                            lon: resolved.lon,
                            cityName: resolved.cityName
                        };
                    }
                }
            }

            // Если модель подтвердила перемещение в город в тексте ответа (но опустила тег):
            if (!action && !isFollowUpAnalytics) {
                const cityFromReply = extractCityFromReply(reply);
                if (cityFromReply) {
                    const resolved = await resolveCity(cityFromReply);
                    if (resolved) {
                        action = {
                            type: 'set_location',
                            lat: resolved.lat,
                            lon: resolved.lon,
                            cityName: resolved.cityName
                        };
                    }
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

        if (!isFollowUpAnalytics && action && action.type === 'set_location') {
            const wantsAnalytics = /(?:воздух|аналитик|дыш|aqi|аки|маки|eaqi|пм|pm|замер|смог|чист|показател|качество|погод|прогноз|прошл|предыдущ|вчера|все\s+дни|весь\s+период|вс[её]\s+время|пик|средн)/i.test(cleanUserMessage);
            if (wantsAnalytics) {
                action.followUpAnalytics = true;
                // В шаге 1 Ая ТОЛЬКО перемещается и подтверждает это, никаких левых выдуманных цифр!
                const shortCity = toAccusativeCity(action.cityName);
                reply = `Секундочку! Перемещаемся в ${shortCity}, смотрю свежие замеры воздуха, ня! ✨`;
                emotion = 'happy';
            }
        }

        // Защита: если модель ошибочно попыталась переместиться в "точку" или "тачку" вместо аналитики текущей точки
        if (!action && /(?:перемеща(?:емся|юсь)|перехожу|летим)\s+(?:в|во|на)\s+(?:точк[а-яё]*|тачк[а-яё]*)/i.test(reply)) {
            if (effectivePointAnalytics) {
                const isForecast = /(?:прогноз|3\s+дня|три\s+дня|завтра|послезавтра|средн|максим|миним)/i.test(cleanUserMessage);
                if (isForecast && effectivePointAnalytics.forecast3Days) {
                    const forecastReply = generateForecastReply(effectivePointAnalytics.forecast3Days, effectivePointAnalytics.locationName);
                    if (forecastReply) {
                        reply = forecastReply.reply;
                        emotion = forecastReply.emotion;
                    }
                } else {
                    const pointReply = generatePointAnalyticsReply(effectivePointAnalytics, cleanUserMessage);
                    reply = pointReply.reply;
                    emotion = pointReply.emotion;
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

        // Fallback для аналитики, архива, прогноза и всех дней по выбранной точке при оффлайне/сбое LLM
        if (effectivePointAnalytics && (isFollowUpAnalytics || isAnalyticsQuery(cleanUserMessage))) {
            const isAllDays = /(?:все\s+дни|всех\s+дней|весь\s+период|вс[её]\s+время|вместе\s+взят)/i.test(cleanUserMessage);
            if (isAllDays && effectivePointAnalytics.allDaysSummary) {
                const allDaysReply = generateAllDaysReply(effectivePointAnalytics.allDaysSummary, effectivePointAnalytics.locationName, cleanUserMessage);
                if (allDaysReply) return allDaysReply;
            }

            const isHistory = /(?:прошл|предыдущ|вчера|позавчера|раньше|архив|истори|было\s+(?:ли|самое)?)/i.test(cleanUserMessage);
            if (isHistory && effectivePointAnalytics.historyData) {
                const historyReply = generateHistoryReply(effectivePointAnalytics.historyData, effectivePointAnalytics.locationName, cleanUserMessage);
                if (historyReply) return historyReply;
            }

            const isForecast = /(?:прогноз|3\s+дня|три\s+дня|завтра|послезавтра|будет)/i.test(cleanUserMessage);
            if (isForecast && effectivePointAnalytics.forecast3Days) {
                const forecastReply = generateForecastReply(effectivePointAnalytics.forecast3Days, effectivePointAnalytics.locationName);
                if (forecastReply) return forecastReply;
            }
            return generatePointAnalyticsReply(effectivePointAnalytics, cleanUserMessage);
        }

        // Fallback для перехода к городу при оффлайне/сбое LLM (если это не второй шаг аналитики)
        const fallbackCity = isFollowUpAnalytics ? null : extractCityIntent(cleanUserMessage);
        if (fallbackCity) {
            const resolved = await resolveCity(fallbackCity);
            if (resolved) {
                const wantsAnalytics = /(?:воздух|аналитик|дыш|aqi|аки|маки|eaqi|пм|pm|замер|смог|чист|показател|качество|погод|прогноз|прошл|предыдущ|вчера|все\s+дни|весь\s+период|вс[её]\s+время|пик|средн)/i.test(cleanUserMessage);
                return {
                    reply: `Секундочку! Перемещаемся в ${toAccusativeCity(resolved.cityName)}, смотрю свежие замеры воздуха, ня! ✨`,
                    model: aiConfig.model,
                    emotion: 'happy',
                    action: {
                        type: 'set_location',
                        lat: resolved.lat,
                        lon: resolved.lon,
                        cityName: resolved.cityName,
                        ...(wantsAnalytics ? { followUpAnalytics: true } : {})
                    }
                };
            } else {
                return {
                    reply: `Хмпф! Я обыскала карту, но города "${fallbackCity}" не нашла! 😾 Проверь название или выбери другой город, ня! ✨`,
                    model: aiConfig.model,
                    emotion: 'alert',
                    action: null
                };
            }
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
    detectActionFromReply,
    extractCityIntent,
    extractCityFromReply,
    resolveCity,
    isAnalyticsQuery,
    generatePointAnalyticsReply,
    generateForecastReply,
    generateHistoryReply,
    generateAllDaysReply,
    isNotCityName
};