// frontend/src/components/AiChat/AiChatModal.jsx

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import AyaMascot from './AyaMascot';
import { AYA_CHAT_DOCK_PHRASES } from '../../utils/ayaPhrases';
import { findDefaultTimeIndex, computeForecast3Days, computeAirHistory, formatSelectedTimeInfo, computeAllDaysSummary } from '../../utils/timeUtils';
import '../../styles/AiChatModal.css';

const INITIAL_GREETING = {
  id: 'init-1',
  role: 'assistant',
  content: 'Ну привет. Я Ая. Могу поболтать, могу подсказать по Aerocast.',
  timestamp: Date.now()
};

// Безопасное форматирование текста (**жирный**, *курсив*, переносы строк)
function formatMessageContent(text) {
  if (!text) return null;
  const lines = String(text).split('\n');

  return lines.map((line, lineIdx) => {
    const parts = [];
    const regex = /(\*\*.*?\*\*|\*.*?\*)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.substring(lastIndex, match.index));
      }

      const matchStr = match[0];
      if (matchStr.startsWith('**') && matchStr.endsWith('**')) {
        parts.push(
          <strong key={`${lineIdx}-${match.index}`}>
            {matchStr.slice(2, -2)}
          </strong>
        );
      } else if (matchStr.startsWith('*') && matchStr.endsWith('*')) {
        parts.push(
          <em key={`${lineIdx}-${match.index}`}>
            {matchStr.slice(1, -1)}
          </em>
        );
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < line.length) {
      parts.push(line.substring(lastIndex));
    }

    return (
      <span key={lineIdx} className="ai-chat-msg__line">
        {parts}
        {lineIdx < lines.length - 1 && <br />}
      </span>
    );
  });
}


function detectClientMapLayerIntent(text) {
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

// Распознавание команд переключения режима дальтонизма и палитр на клиенте
function detectClientColorBlindIntent(text, { isColorBlind = false, history = [] } = {}) {
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

  if (/(?:дейтераноп[а-я]*|deuteranop[a-z]*)/i.test(clean)) return { enabled: true, colorBlindType: 'deuteranopia' };
  if (/(?:протаноп[а-я]*|protanop[a-z]*)/i.test(clean)) return { enabled: true, colorBlindType: 'protanopia' };
  if (/(?:тританоп[а-я]*|tritanop[a-z]*)/i.test(clean)) return { enabled: true, colorBlindType: 'tritanopia' };
  if (/(?:окабе|okabe)/i.test(clean)) return { enabled: true, colorBlindType: 'okabe' };

  // 3. Запрос на включение дальтонизма без типа -> Окабе по умолчанию
  if ((hasOnWord && hasCbWord) || /^(?:дальтонизм|режим\s+дальтонизма)$/i.test(clean)) {
    return { enabled: true, colorBlindType: 'okabe' };
  }

  return null;
}

// Распознает команду переключения темы оформления на клиенте ('dark' / 'light')
function detectClientThemeIntent(text) {
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

const KNOWN_CLIENT_CITIES = {
  'москва': { lat: 55.75204, lon: 37.61781, name: 'Москва, Россия' },
  'санкт-петербург': { lat: 59.93863, lon: 30.31413, name: 'Санкт-Петербург, Россия' },
  'питер': { lat: 59.93863, lon: 30.31413, name: 'Санкт-Петербург, Россия' },
  'казань': { lat: 55.78874, lon: 49.12214, name: 'Казань, Татарстан, Россия' },
  'сочи': { lat: 43.59699, lon: 39.72477, name: 'Сочи, Краснодарский край, Россия' },
  'новосибирск': { lat: 55.02259, lon: 82.93175, name: 'Новосибирск, Россия' },
  'екатеринбург': { lat: 56.85733, lon: 60.61529, name: 'Екатеринбург, Россия' },
  'самара': { lat: 53.20767, lon: 50.13553, name: 'Самара, Россия' },
  'краснодар': { lat: 45.04534, lon: 38.98178, name: 'Краснодар, Россия' },
  'владивосток': { lat: 43.10562, lon: 131.87354, name: 'Владивосток, Россия' },
  'ростов-на-дону': { lat: 47.23135, lon: 39.72328, name: 'Ростов-на-Дону, Россия' },
  'ростов': { lat: 47.23135, lon: 39.72328, name: 'Ростов-на-Дону, Россия' },
  'уфа': { lat: 54.74306, lon: 55.96779, name: 'Уфа, Башкортостан, Россия' },
  'красноярск': { lat: 56.01839, lon: 92.86717, name: 'Красноярск, Россия' },
  'нижний новгород': { lat: 56.32867, lon: 44.00205, name: 'Нижний Новгород, Россия' },
  'челябинск': { lat: 55.15402, lon: 61.42915, name: 'Челябинск, Россия' },
  'омск': { lat: 54.99244, lon: 73.36859, name: 'Омск, Россия' },
  'воронеж': { lat: 51.67204, lon: 39.1843, name: 'Воронеж, Россия' },
  'пермь': { lat: 58.01046, lon: 56.22944, name: 'Пермь, Россия' },
  'волгоград': { lat: 48.71939, lon: 44.50183, name: 'Волгоград, Россия' },
  'томск': { lat: 56.50104, lon: 84.99245, name: 'Томск, Россия' },
  'кемерово': { lat: 55.33333, lon: 86.08333, name: 'Кемерово, Россия' },
  'новокузнецк': { lat: 53.7596, lon: 87.1467, name: 'Новокузнецк, Кемеровская область, Россия' },
  'барнаул': { lat: 53.36056, lon: 83.76361, name: 'Барнаул, Россия' },
  'иркутск': { lat: 52.29778, lon: 104.29639, name: 'Иркутск, Россия' },
  'тюмень': { lat: 57.15222, lon: 65.52722, name: 'Тюмень, Россия' },
  'хабаровск': { lat: 48.48278, lon: 135.08389, name: 'Хабаровск, Россия' },
  'ярославль': { lat: 57.62987, lon: 39.87368, name: 'Ярославль, Россия' }
};

function toAccusativeCity(name) {
  if (!name || typeof name !== 'string') return 'выбранный город';
  const base = name.split(',')[0].trim();
  return base.replace(/а$/i, 'у').replace(/я$/i, 'ю');
}

function isClientNotCityName(str) {
  if (!str) return true;
  const s = str.trim().toLowerCase();
  if (/^(?:точк[а-яё]*|тачк[а-яё]*|мест[а-яё]*|локаци[а-яё]*|координат[а-яё]*|карт[а-яё]*|тут|здесь|сейчас|сегодня)$/i.test(s)) return true;
  if (/(?:текущ[а-яё]*|выбранн[а-яё]*|эт[а-яё]*|данн[а-яё]*)\s+(?:точке?|тачке?|мест[а-яё]*|локаци[а-яё]*|координат[а-яё]*)/i.test(s)) return true;
  if (/(?:3\s+дня|три\s+дня|\d+\s+дн[еяй]|прогноз|завтра|послезавтра|недел|суток|сутки|ближайш|выходн)/i.test(s)) return true;
  if (/(?:полн[а-яё]*|кратк[а-яё]*|подробн[а-яё]*|общ[а-яё]*|вс[её]|всю)\s+(?:аналитик[а-яё]*|сводк[а-яё]*|анализ[а-яё]*|данн[а-яё]*|картин[а-яё]*|информаци[а-яё]*)/i.test(s)) return true;
  if (/^(?:значени[а-яё]*|качеств[а-яё]*|уровн[а-яё]*|воздух[а-яё]*|данн[а-яё]*|замер[а-яё]*|аналитик[а-яё]*|шкал[а-яё]*|индекс[а-яё]*|дн[еяй]*|недел[а-яё]*|месяц[а-яё]*|год[а-яё]*|времен[а-яё]*|период[а-яё]*|архив[а-яё]*|истори[а-яё]*|числ[а-яё]*|маки|аки|aqi|eaqi|пм|pm|средн[а-яё]*|максим[а-яё]*|миним[а-яё]*|пик[а-яё]*|норм[а-яё]*|мире|росси[а-яё]*|планет[а-яё]*|стран[а-яё]*)$/i.test(s)) return true;
  return false;
}

function detectClientCityIntent(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.trim();

  if (/^(?:какие\s+города|как\s+найти|где\s+найти|кто\s+ты|кто\s+тебя)\b/i.test(clean)) return null;
  if (/(?:т[её]мн|светл|ночн|дневн)\s+(?:тем[ау]|режим)/i.test(clean)) return null;
  if (/(?:спутник|схем|дальтонизм|окабе|дейтераноп|протаноп|тританоп)/i.test(clean)) return null;
  if (/(?:по|в|на)\s+(?:текущ[а-яё]*|выбранн[а-яё]*|эт[а-яё]*|данн[а-яё]*|сво[её]|мо[её])?\s*(?:точке?|тачке?|мест[а-яё]*|локаци[а-яё]*|координат[а-яё]*)/i.test(clean)) {
    const withoutPoint = clean.replace(/(?:по|в|на)\s+(?:текущ[а-яё]*|выбранн[а-яё]*|эт[а-яё]*|данн[а-яё]*|сво[её]|мо[её])?\s*(?:точке?|тачке?|мест[а-яё]*|локаци[а-яё]*|координат[а-яё]*)/gi, '').trim();
    if (!/(?:перейди|перемести|покажи|слетай|поехали|город|в|во|на|к|до)\s+[А-ЯЁ][а-яё]{2,}/i.test(withoutPoint)) {
      return null;
    }
  }

  // Снимаем вежливые вводные слова в начале («можешь пожалуйста сказать», «подскажи пожалуйста», «скажи», «хочу узнать»)
  const stripped = clean.replace(/^(?:(?:можешь|можете)(?:\s+ли)?(?:\s+пожалуйста|\s+пж|\s+плиз)?\s+(?:сказать|подсказать|рассказать|узнать|проверить|глянуть|посмотреть|показать)|подскажи(?:те)?(?:\s+пожалуйста|\s+пж|\s+плиз)?|скажи(?:те)?(?:\s+пожалуйста|\s+пж|\s+плиз)?|расскажи(?:те)?(?:\s+пожалуйста|\s+пж|\s+плиз)?|пожалуйста\s+|пж\s+|плиз\s+|хочу\s+узнать|интересно|дай\s+знать|проверь(?:те)?)\s+/i, '').trim();

  // Запросы вида «покажи полную аналитику по Новосибирску», «сводка по Казани», «подробная аналитика по Москве»
  const ANALYTICS_CITY_REGEX = /(?:(?:покажи(?:те)?|дай(?:те)?|выведи(?:те)?|открой(?:те)?|предоставь(?:те)?|сделай(?:те)?|глянь(?:те)?|посмотри(?:те)?|хочу)?\s*(?:полн[а-яё]*|кратк[а-яё]*|подробн[а-яё]*|общ[а-яё]*|вс[её]|всю)?\s*(?:аналитик[а-яё]*|сводк[а-яё]*|анализ[а-яё]*|данн[а-яё]*|картин[а-яё]*|информаци[а-яё]*)\s+(?:по|в|во|для|о|про)\s+(?:город[а-яё]*\s+)?)(.+)$/i;
  const analyticsMatch = stripped.match(ANALYTICS_CITY_REGEX) || clean.match(ANALYTICS_CITY_REGEX);
  let cityRaw = analyticsMatch ? analyticsMatch[1] : null;

  const NAV_REGEX = /(?:(?:перейди(?:те)?|перейти|переходим|переход|перемести(?:ть|сь|те)?|перемещаемся|перемещение|перенеси(?:ть|сь|те)?|открой(?:те)?|открыть|открываем|покажи(?:те)?|показать|показывай|полети(?:м)?|полетели|лететь|слетай(?:те)?|слетаем|поехали|погнали|сгоняй(?:те)?|сгоняем|переключи(?:ть|сь|те)?|переключай|найди(?:те)?|найти|поищи|ищи|глянь(?:те)?|глянем|погляди|посмотри(?:те)?|посмотрим|посмотреть|хочу|давай)\s+(?:пожалуйста\s+|пж\s+|плиз\s+)?(?:мне\s+)?(?:(?:в|во|на|к|до)\s+)?(?:город\s+)?|^(?:город)\s+)(.+)$/i;
  const navMatch = stripped.match(NAV_REGEX) || clean.match(NAV_REGEX);
  if (!cityRaw && navMatch) {
    cityRaw = navMatch[1];
  }

  if (!cityRaw) {
    const AIR_CITY_REGEX = /(?:(?:что(?:\s+там|\s+сейчас|\s+тут)*(?:\s+(?:с\s+воздухом|по\s+воздуху|с\s+аналитикой|по\s+аналитике|с\s+замерами|по\s+замерам))?|как(?:\s+там|\s+сейчас)?\s+(?:воздух|дышится|погода)|качество\s+воздуха|какая\s+аналитика|какой(?:\s+там|\s+сейчас)?\s+воздух|чем\s+дышат|воздух|погода|замеры|аналитика)\s+(?:пожалуйста\s+)?(?:в|во|на|по)\s+)(?:город\s+)?(.+)$/i;
    const airMatch = stripped.match(AIR_CITY_REGEX) || clean.match(AIR_CITY_REGEX);
    cityRaw = airMatch ? airMatch[1] : null;
  }

  if (!cityRaw) {
    const PRO_CITY_REGEX = /(?:про\s+(?:воздух|аналитику|погоду|замеры)\s+(?:в|во|на|по)\s+)(?:город\s+)?(.+)$/i;
    const proMatch = stripped.match(PRO_CITY_REGEX) || clean.match(PRO_CITY_REGEX);
    cityRaw = proMatch ? proMatch[1] : null;
  }

  if (!cityRaw) {
    const CAP_CITY_REGEX = /(?:^|\s)(?:в|во|на|к|до)\s+(?:городе\s+|город\s+)?([А-ЯЁ][а-яё\-]+(?:\s+[А-ЯЁ][а-яё\-]+)?)/g;
    let inMatch;
    while ((inMatch = CAP_CITY_REGEX.exec(clean)) !== null) {
      let cand = inMatch[1].trim().replace(/[.,!?;:()]+$/, '').trim();
      if (cand.length >= 2 && cand.length <= 40 && !isClientNotCityName(cand)) {
        cityRaw = cand;
        break;
      }
    }
  }

  const wantsAnalytics = /(?:воздух|аналитик|дыш|aqi|аки|маки|eaqi|пм|pm|замер|смог|чист|показател|качество|погод|прогноз|прошл|предыдущ|вчера|все\s+дни|весь\s+период|вс[её]\s+время|пик|средн)/i.test(clean);

  if (cityRaw) {
    let cleanCity = cityRaw.trim().replace(/[.,!?;:()]+$/, '').replace(/\s+(?:пожалуйста|пж|плиз)$/i, '').trim();
    cleanCity = cleanCity.replace(/^(?:в|во|на|к|до)\s+/i, '').trim();
    if (isClientNotCityName(cleanCity)) return null;

    const lower = cleanCity.toLowerCase();
    if (KNOWN_CLIENT_CITIES[lower]) {
      return { raw: cleanCity, wantsAnalytics, ...KNOWN_CLIENT_CITIES[lower] };
    }
    const normalized = lower.replace(/у$/i, 'а').replace(/е$/i, '').replace(/и$/i, 'ь');
    if (KNOWN_CLIENT_CITIES[normalized]) {
      return { raw: cleanCity, wantsAnalytics, ...KNOWN_CLIENT_CITIES[normalized] };
    }
    const candidates = [lower, lower.replace(/у$/i, ''), lower.replace(/у$/i, 'а'), lower.replace(/е$/i, ''), lower.replace(/е$/i, 'а'), lower.replace(/и$/i, 'ь'), lower.replace(/и$/i, 'я'), lower.replace(/и$/i, 'а')];
    for (const cand of candidates) {
      if (KNOWN_CLIENT_CITIES[cand]) return { raw: cleanCity, wantsAnalytics, ...KNOWN_CLIENT_CITIES[cand] };
    }
    const normalizedA = lower.replace(/е$/i, 'а').replace(/и$/i, 'я');
    if (KNOWN_CLIENT_CITIES[normalizedA]) {
      return { raw: cleanCity, wantsAnalytics, ...KNOWN_CLIENT_CITIES[normalizedA] };
    }
    if (cleanCity.length >= 2 && cleanCity.length <= 40) {
      return { raw: cleanCity, wantsAnalytics };
    }
  }

  return null;
}

function detectClientCityFromReply(replyText) {
  if (!replyText || typeof replyText !== 'string') return null;
  const clean = replyText.trim();
  const replyMatch = clean.match(/(?:перемещаюсь|перемещаемся|открываю|летим|перелетаем|перехожу|переходим|показываю)\s+(?:в|во|на)?\s*(?:город\s+)?([а-яёА-ЯЁa-zA-Z0-9\s-]+?)(?:,|\.|\!|\?|\s+смотрю|\s+проверяю|\s+глянем|\s+на\s+карте)/i);
  if (replyMatch) {
    const rawCity = replyMatch[1].trim().replace(/[.,!?;:()]+$/, '').trim();
    if (isClientNotCityName(rawCity)) return null;
    const lower = rawCity.toLowerCase();
    if (KNOWN_CLIENT_CITIES[lower]) return { raw: rawCity, ...KNOWN_CLIENT_CITIES[lower] };
    const norm = lower.replace(/у$/i, 'а').replace(/е$/i, '').replace(/и$/i, 'ь');
    if (KNOWN_CLIENT_CITIES[norm]) return { raw: rawCity, ...KNOWN_CLIENT_CITIES[norm] };
    const normA = lower.replace(/е$/i, 'а').replace(/и$/i, 'я');
    if (KNOWN_CLIENT_CITIES[normA]) return { raw: rawCity, ...KNOWN_CLIENT_CITIES[normA] };
  }
  return null;
}

export default function AiChatModal({
  isOpen,
  onClose,
  onOpenSettings,
  embedded = false,
  mascotUnderChat = false,
  activeBaseLayer = 'osm',
  onBaseLayerChange,
  isColorBlind,
  onColorBlindChange,
  colorBlindType,
  onColorBlindTypeChange,
  theme,
  onThemeChange,
  onLocationSelect,
  airData,
  selectedTimeIndex,
  coords,
  locationName
}) {
  const [messages, setMessages] = useState([INITIAL_GREETING]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem('aerocast_sound_enabled') !== 'false';
    } catch {
      return true;
    }
  });

  const currentEmotion = useMemo(() => {
    if (isLoading) return 'think';
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    return lastAssistant?.emotion || 'idle';
  }, [isLoading, messages]);

  const [dockedPhrase, setDockedPhrase] = useState(() => {
    return AYA_CHAT_DOCK_PHRASES[Math.floor(Math.random() * AYA_CHAT_DOCK_PHRASES.length)];
  });

  const mascotTimerRef = useRef(null);

  const resetMascotTimer = useCallback(() => {
    if (mascotTimerRef.current) {
      clearTimeout(mascotTimerRef.current);
      mascotTimerRef.current = null;
    }

    if (!embedded || !mascotUnderChat || !isOpen || currentEmotion !== 'idle') return;

    mascotTimerRef.current = setTimeout(() => {
      setDockedPhrase((prev) => {
        const others = AYA_CHAT_DOCK_PHRASES.filter((p) => p !== prev);
        return others[Math.floor(Math.random() * others.length)] || AYA_CHAT_DOCK_PHRASES[0];
      });
    }, 12000);
  }, [embedded, mascotUnderChat, isOpen, currentEmotion]);

  const handleMascotClick = useCallback(() => {
    setDockedPhrase((prev) => {
      const others = AYA_CHAT_DOCK_PHRASES.filter((p) => p !== prev);
      return others[Math.floor(Math.random() * others.length)] || AYA_CHAT_DOCK_PHRASES[0];
    });
    resetMascotTimer();
  }, [resetMascotTimer]);

  useEffect(() => {
    resetMascotTimer();
    return () => {
      if (mascotTimerRef.current) {
        clearTimeout(mascotTimerRef.current);
        mascotTimerRef.current = null;
      }
    };
  }, [resetMascotTimer, dockedPhrase]);

  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Скролл вниз при добавлении сообщений строго внутри контейнера сообщений (не дергая сайдбар и экран)
  const scrollToBottom = useCallback((smooth = true) => {
    const el = messagesContainerRef.current;
    if (el) {
      if (smooth && typeof el.scrollTo === 'function') {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      } else {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages, isLoading, scrollToBottom]);

  // Фокус поля ввода ТОЛЬКО при первичном открытии на десктопе (не на мобильных тач-устройствах)
  useEffect(() => {
    if (!isOpen || embedded) return;
    const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    if (!isTouch) {
      const timer = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, embedded]);

  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const transcriptRef = useRef('');
  const isCancelledRef = useRef(false);
  const messagesRef = useRef(messages);
  const inputMessageRef = useRef(inputMessage);
  const requestQueueRef = useRef([]);
  const isRequestingRef = useRef(false);
  const dialogGenerationRef = useRef(0);
  const abortControllerRef = useRef(null);
  const onBaseLayerChangeRef = useRef(onBaseLayerChange);
  const activeBaseLayerRef = useRef(activeBaseLayer);
  const onColorBlindChangeRef = useRef(onColorBlindChange);
  const onColorBlindTypeChangeRef = useRef(onColorBlindTypeChange);
  const onThemeChangeRef = useRef(onThemeChange);
  const onLocationSelectRef = useRef(onLocationSelect);
  const isColorBlindRef = useRef(isColorBlind);
  const colorBlindTypeRef = useRef(colorBlindType);
  const themeRef = useRef(theme);

  useEffect(() => {
    onBaseLayerChangeRef.current = onBaseLayerChange;
  }, [onBaseLayerChange]);

  useEffect(() => {
    activeBaseLayerRef.current = activeBaseLayer;
  }, [activeBaseLayer]);

  useEffect(() => {
    onColorBlindChangeRef.current = onColorBlindChange;
  }, [onColorBlindChange]);

  useEffect(() => {
    onColorBlindTypeChangeRef.current = onColorBlindTypeChange;
  }, [onColorBlindTypeChange]);

  useEffect(() => {
    onThemeChangeRef.current = onThemeChange;
  }, [onThemeChange]);

  useEffect(() => {
    onLocationSelectRef.current = onLocationSelect;
  }, [onLocationSelect]);

  useEffect(() => {
    isColorBlindRef.current = isColorBlind;
  }, [isColorBlind]);

  useEffect(() => {
    colorBlindTypeRef.current = colorBlindType;
  }, [colorBlindType]);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    inputMessageRef.current = inputMessage;
  }, [inputMessage]);

  const pointAnalytics = useMemo(() => {
    if (!airData?.hourly) return null;
    const defaultIdx = findDefaultTimeIndex(airData.hourly.time, new Date(), 1);
    const idx = (typeof selectedTimeIndex === 'number' && selectedTimeIndex >= 0 && selectedTimeIndex < (airData.hourly.time?.length || 0))
      ? selectedTimeIndex
      : ((typeof defaultIdx === 'number' && defaultIdx >= 0) ? defaultIdx : 0);

    const time = airData.hourly.time?.[idx] || null;
    const aqi = airData.hourly.european_aqi?.[idx] ?? null;
    const pm2_5 = airData.hourly.pm2_5?.[idx] ?? null;
    const pm10 = airData.hourly.pm10?.[idx] ?? null;
    const no2 = airData.hourly.nitrogen_dioxide?.[idx] ?? null;
    const so2 = airData.hourly.sulphur_dioxide?.[idx] ?? null;
    const o3 = airData.hourly.ozone?.[idx] ?? null;
    const co = airData.hourly.carbon_monoxide?.[idx] ?? null;
    const dust = airData.hourly.dust?.[idx] ?? null;
    const uv = airData.hourly.uv_index?.[idx] ?? null;
    const now = new Date();
    const selectedTimeInfo = time ? formatSelectedTimeInfo(time, now) : null;
    const forecast3Days = computeForecast3Days(airData.hourly, now);
    const historyData = computeAirHistory(airData.hourly, now);
    const allDaysSummary = computeAllDaysSummary(airData.hourly, now);

    return {
      locationName: locationName || (coords?.lat != null ? `Точка (${Number(coords.lat).toFixed(2)}, ${Number(coords.lon).toFixed(2)})` : 'Текущая точка'),
      lat: coords?.lat ?? airData.latitude ?? null,
      lon: coords?.lon ?? airData.longitude ?? null,
      time,
      aqi: aqi != null && !isNaN(Number(aqi)) ? Number(aqi) : null,
      pm2_5: pm2_5 != null && !isNaN(Number(pm2_5)) ? Number(pm2_5) : null,
      pm10: pm10 != null && !isNaN(Number(pm10)) ? Number(pm10) : null,
      no2: no2 != null && !isNaN(Number(no2)) ? Number(no2) : null,
      so2: so2 != null && !isNaN(Number(so2)) ? Number(so2) : null,
      o3: o3 != null && !isNaN(Number(o3)) ? Number(o3) : null,
      co: co != null && !isNaN(Number(co)) ? Number(co) : null,
      dust: dust != null && !isNaN(Number(dust)) ? Number(dust) : null,
      uv: uv != null && !isNaN(Number(uv)) ? Number(uv) : null,
      selectedTimeInfo,
      forecast3Days,
      historyData,
      allDaysSummary
    };
  }, [airData, selectedTimeIndex, coords, locationName]);

  const pointAnalyticsRef = useRef(pointAnalytics);
  useEffect(() => {
    pointAnalyticsRef.current = pointAnalytics;
  }, [pointAnalytics]);

  // Единая точка добавления сообщений: ref обновляется сразу, чтобы история
  // для следующего запроса была актуальной без ожидания рендера.
  const appendMessage = useCallback((message) => {
    messagesRef.current = [...messagesRef.current, message];
    setMessages(messagesRef.current);
  }, []);

  const toggleSound = () => {
    setIsSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('aerocast_sound_enabled', String(next));
      } catch (err) {
        console.warn('Could not save sound pref:', err);
      }
      return next;
    });
  };

  // Второй шаг двухэтапного сценария: подгрузка и озвучивание аналитики по новому городу
  const triggerFollowUpAnalytics = useCallback(async (targetLat, targetLon, cityName, generation, originalUserMessage = '') => {
    if (generation !== dialogGenerationRef.current) return;
    setIsLoading(true);

    let targetAnalytics = null;
    try {
      const airRes = await fetch(`/api/air-quality?lat=${targetLat}&lon=${targetLon}`);
      if (airRes.ok) {
        const airJson = await airRes.json();
        const hourly = airJson?.hourly;
        if (hourly && Array.isArray(hourly.time) && hourly.time.length > 0) {
          const defaultIdx = findDefaultTimeIndex(hourly.time, new Date(), 1);
          const idx = (typeof defaultIdx === 'number' && defaultIdx >= 0 && defaultIdx < hourly.time.length)
            ? defaultIdx
            : (hourly.time.length - 1);
          const now = new Date();
          const time = hourly.time[idx] || null;
          const selectedTimeInfo = time ? formatSelectedTimeInfo(time, now) : null;
          const forecast3Days = computeForecast3Days(hourly, now);
          const historyData = computeAirHistory(hourly, now);
          const allDaysSummary = computeAllDaysSummary(hourly, now);
          targetAnalytics = {
            locationName: cityName || `Точка (${Number(targetLat).toFixed(2)}, ${Number(targetLon).toFixed(2)})`,
            lat: targetLat,
            lon: targetLon,
            time,
            selectedTimeInfo,
            aqi: hourly.european_aqi?.[idx] ?? null,
            pm2_5: hourly.pm2_5?.[idx] ?? null,
            pm10: hourly.pm10?.[idx] ?? null,
            no2: hourly.nitrogen_dioxide?.[idx] ?? null,
            so2: hourly.sulphur_dioxide?.[idx] ?? null,
            o3: hourly.ozone?.[idx] ?? null,
            co: hourly.carbon_monoxide?.[idx] ?? null,
            dust: hourly.dust?.[idx] ?? null,
            uv: hourly.uv_index?.[idx] ?? null,
            forecast3Days,
            historyData,
            allDaysSummary
          };
        }
      }
    } catch (e) {
      console.warn('Не удалось загрузить данные воздуха для второго шага аналитики:', e);
    }

    if (generation !== dialogGenerationRef.current) return;

    const followUpHistory = messagesRef.current
      .filter((m) => m.id !== 'init-1' && !m.isError)
      .slice(-4)
      .map((m) => ({ role: m.role, content: m.content }));

    const followUpMessage = originalUserMessage
      ? `Предоставь подробную аналитику по воздуху для локации ${cityName}. Пользователь спрашивал: "${originalUserMessage}"`
      : `Предоставь подробную аналитику по воздуху для локации ${cityName}`;

    try {
      const followUpRes = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: followUpMessage,
          isFollowUpAnalytics: true,
          history: followUpHistory,
          currentLayer: activeBaseLayerRef.current,
          isColorBlind: isColorBlindRef.current,
          colorBlindType: colorBlindTypeRef.current,
          theme: themeRef.current,
          pointAnalytics: targetAnalytics
        })
      });

      if (generation !== dialogGenerationRef.current) return;

      if (followUpRes.ok) {
        const step2Data = await followUpRes.json();
        const isRepeatMove = step2Data.reply && /перемеща(?:емся|юсь)|перехожу|летим/i.test(step2Data.reply);
        let finalReply = (!isRepeatMove && step2Data.reply) ? step2Data.reply : null;
        if (!finalReply && targetAnalytics && targetAnalytics.aqi !== null) {
          finalReply = `Смотри, в ${cityName} индекс EAQI равен ${targetAnalytics.aqi}! PM2.5: ${targetAnalytics.pm2_5 != null ? targetAnalytics.pm2_5 + ' мкг/м³' : 'в норме'}, PM10: ${targetAnalytics.pm10 != null ? targetAnalytics.pm10 + ' мкг/м³' : 'в норме'}. Данные свежие, ня! ✨`;
        }

        appendMessage({
          id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: 'assistant',
          content: finalReply || 'Данные аналитики получены, ня! ✨',
          emotion: step2Data.emotion || 'happy',
          timestamp: Date.now()
        });
      } else {
        if (targetAnalytics && targetAnalytics.aqi !== null) {
          appendMessage({
            id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            role: 'assistant',
            content: `Смотри, в ${cityName} индекс EAQI равен ${targetAnalytics.aqi}! PM2.5: ${targetAnalytics.pm2_5 != null ? targetAnalytics.pm2_5 + ' мкг/м³' : 'в норме'}, PM10: ${targetAnalytics.pm10 != null ? targetAnalytics.pm10 + ' мкг/м³' : 'в норме'}. Данные свежие, ня! ✨`,
            emotion: 'happy',
            timestamp: Date.now()
          });
        }
      }
    } catch (e) {
      if (generation !== dialogGenerationRef.current) return;
      if (targetAnalytics && targetAnalytics.aqi !== null) {
        appendMessage({
          id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: 'assistant',
          content: `Смотри, в ${cityName} индекс EAQI равен ${targetAnalytics.aqi}! PM2.5: ${targetAnalytics.pm2_5 != null ? targetAnalytics.pm2_5 + ' мкг/м³' : 'в норме'}, PM10: ${targetAnalytics.pm10 != null ? targetAnalytics.pm10 + ' мкг/м³' : 'в норме'}. Данные свежие, ня! ✨`,
          emotion: 'happy',
          timestamp: Date.now()
        });
      }
    } finally {
      if (generation === dialogGenerationRef.current) {
        setIsLoading(false);
      }
    }
  }, [appendMessage]);

  // Последовательная обработка очереди: даже если пользователь отправил
  // несколько сообщений подряд, ответы придут в том же порядке.
  const processQueue = useCallback(async () => {
    if (isRequestingRef.current) return;
    isRequestingRef.current = true;

    try {
      while (requestQueueRef.current.length > 0) {
        const job = requestQueueRef.current.shift();

        // Задачи из старого диалога после «Начать новый диалог» игнорируем
        if (job.generation !== dialogGenerationRef.current) continue;

        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        abortControllerRef.current = controller;

        setIsLoading(true);

        // Собираем последние реплики для контекста (ровно до 4 реплик: 2 пары вопрос-ответ)
        const historyPayload = messagesRef.current
          .filter((m) => m.id !== 'init-1' && !m.isError && m.id !== job.userMessageId)
          .slice(-4)
          .map((m) => ({ role: m.role, content: m.content }));

        try {
          const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: job.text,
              history: historyPayload,
              currentLayer: activeBaseLayerRef.current,
              isColorBlind: isColorBlindRef.current,
              colorBlindType: colorBlindTypeRef.current,
              theme: themeRef.current,
              pointAnalytics: pointAnalyticsRef.current
            }),
            ...(controller ? { signal: controller.signal } : {})
          });

          // Пока ждали ответ, пользователь начал новый диалог — ответ не нужен
          if (job.generation !== dialogGenerationRef.current) continue;

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Ошибка сервера (${response.status})`);
          }

          const data = await response.json();

          if (job.generation !== dialogGenerationRef.current) continue;

          if (data?.action?.type === 'set_base_layer' && data.action.layer) {
            if (typeof onBaseLayerChangeRef.current === 'function') {
              onBaseLayerChangeRef.current(data.action.layer);
            }
          }

          if (data?.action?.type === 'set_colorblind') {
            if (data.action.enabled) {
              if (typeof onColorBlindChangeRef.current === 'function') {
                onColorBlindChangeRef.current(true);
              }
              if (data.action.colorBlindType && typeof onColorBlindTypeChangeRef.current === 'function') {
                onColorBlindTypeChangeRef.current(data.action.colorBlindType);
              }
            } else {
              if (typeof onColorBlindChangeRef.current === 'function') {
                onColorBlindChangeRef.current(false);
              }
            }
          }

          if (data?.action?.type === 'set_theme' && (data.action.theme === 'dark' || data.action.theme === 'light')) {
            if (typeof onThemeChangeRef.current === 'function') {
              onThemeChangeRef.current(data.action.theme);
            }
          }

          let pendingFollowUp = null;

          if (data?.action?.type === 'set_location' && data.action.lat != null && data.action.lon != null) {
            const targetLat = Number(data.action.lat);
            const targetLon = Number(data.action.lon);
            const targetName = data.action.cityName || data.action.name;
            if (typeof onLocationSelectRef.current === 'function') {
              onLocationSelectRef.current({
                lat: targetLat,
                lon: targetLon,
                display_name: targetName
              });
            }
            if (data.action.followUpAnalytics) {
              pendingFollowUp = {
                lat: targetLat,
                lon: targetLon,
                name: targetName
              };
            }
          } else if (!data?.action) {
            // Клиентская страховка: если в тексте ответа или вопросе подтвержден переход к городу
            const clientCity = detectClientCityIntent(job.text) || (data?.reply ? detectClientCityFromReply(data.reply) : null);
            if (clientCity && clientCity.lat != null && clientCity.lon != null) {
              const targetLat = Number(clientCity.lat);
              const targetLon = Number(clientCity.lon);
              const targetName = clientCity.name || clientCity.raw;
              if (typeof onLocationSelectRef.current === 'function') {
                onLocationSelectRef.current({
                  lat: targetLat,
                  lon: targetLon,
                  display_name: targetName
                });
              }
              if (clientCity.wantsAnalytics) {
                pendingFollowUp = {
                  lat: targetLat,
                  lon: targetLon,
                  name: targetName
                };
              }
            }
          }

          const isFollowUp = Boolean(pendingFollowUp || data?.action?.followUpAnalytics);
          const rawCityName = pendingFollowUp?.name || data?.action?.cityName || '';
          const shortCity = toAccusativeCity(rawCityName);

          appendMessage({
            id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            role: 'assistant',
            content: isFollowUp
              ? `Секундочку! Перемещаемся в ${shortCity}, смотрю свежие замеры воздуха, ня! ✨`
              : (data.reply || 'Ответ не получен.'),
            emotion: isFollowUp ? 'happy' : (data.emotion || 'idle'),
            timestamp: Date.now()
          });

          if (pendingFollowUp && job.generation === dialogGenerationRef.current) {
            await triggerFollowUpAnalytics(pendingFollowUp.lat, pendingFollowUp.lon, pendingFollowUp.name, job.generation, job.text);
          }
        } catch (err) {
          if (err?.name === 'AbortError') continue;
          if (job.generation !== dialogGenerationRef.current) continue;

          // Клиентский fallback: переключение карты при сбое сетевого запроса
          const fallbackLayer = detectClientMapLayerIntent(job.text);
          if (fallbackLayer) {
            if (typeof onBaseLayerChangeRef.current === 'function') {
              onBaseLayerChangeRef.current(fallbackLayer);
            }
            appendMessage({
              id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              role: 'assistant',
              content: fallbackLayer === 'satellite'
                ? 'Секундочку! Переключаю карту на спутниковые снимки ESRI, смотри как здорово видно местность из космоса, ня! ✨'
                : 'Как скажешь! Возвращаю привычную схему OpenStreetMap, ня! ✨',
              emotion: 'happy',
              timestamp: Date.now()
            });
            continue;
          }

          // Клиентский fallback: переключение режима дальтонизма при сбое сетевого запроса
          const fallbackCB = detectClientColorBlindIntent(job.text, {
            isColorBlind: isColorBlindRef.current,
            history: historyPayload
          });
          if (fallbackCB) {
            if (fallbackCB.unsupported) {
              appendMessage({
                id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                role: 'assistant',
                content: 'Хмпф! Такого режима дальтонизма у нас нет! 😾 В AeroCast поддерживаются только 4 проверенные палитры: Окабе (по умолчанию), Дейтеранопия, Протанопия и Тританопия. Выбери что-то из них, ня! ✨',
                emotion: 'alert',
                timestamp: Date.now()
              });
              continue;
            }
            if (fallbackCB.enabled === false) {
              if (typeof onColorBlindChangeRef.current === 'function') {
                onColorBlindChangeRef.current(false);
              }
              appendMessage({
                id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                role: 'assistant',
                content: 'Как скажешь! Возвращаю стандартную цветовую гамму, ня! ✨',
                emotion: 'happy',
                timestamp: Date.now()
              });
              continue;
            }
            if (fallbackCB.enabled === true) {
              const cbType = fallbackCB.colorBlindType || 'okabe';
              if (typeof onColorBlindChangeRef.current === 'function') {
                onColorBlindChangeRef.current(true);
              }
              if (typeof onColorBlindTypeChangeRef.current === 'function') {
                onColorBlindTypeChangeRef.current(cbType);
              }
              const typeLabels = { okabe: 'Окабе (по умолчанию)', deuteranopia: 'Дейтеранопию', protanopia: 'Протанопию', tritanopia: 'Тританопию' };
              appendMessage({
                id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                role: 'assistant',
                content: cbType === 'okabe'
                  ? 'Секундочку! Включаю режим доступности для людей с нарушением цветовосприятия с палитрой Окабе по умолчанию, теперь все показатели контрастные и различимые, ня! ✨'
                  : `Без проблем! Переключаю палитру дальтонизма на ${typeLabels[cbType] || 'Окабе'}, ня! ✨`,
                emotion: 'happy',
                timestamp: Date.now()
              });
              continue;
            }
          }

          // Клиентский fallback: переключение темы оформления при сбое сетевого запроса
          const fallbackTheme = detectClientThemeIntent(job.text);
          if (fallbackTheme) {
            if (typeof onThemeChangeRef.current === 'function') {
              onThemeChangeRef.current(fallbackTheme);
            }
            appendMessage({
              id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              role: 'assistant',
              content: fallbackTheme === 'dark'
                ? 'Секундочку! Переключаю интерфейс на уютную тёмную тему, ня! ✨'
                : 'Как скажешь! Возвращаю яркую светлую тему, ня! ✨',
              emotion: 'happy',
              timestamp: Date.now()
            });
            continue;
          }

          // Клиентский fallback: переход к городу при сбое сетевого запроса
          const fallbackCity = detectClientCityIntent(job.text);
          if (fallbackCity && fallbackCity.lat != null && fallbackCity.lon != null) {
            const targetLat = Number(fallbackCity.lat);
            const targetLon = Number(fallbackCity.lon);
            const targetName = fallbackCity.name || fallbackCity.raw;
            if (typeof onLocationSelectRef.current === 'function') {
              onLocationSelectRef.current({
                lat: targetLat,
                lon: targetLon,
                display_name: targetName
              });
            }
            appendMessage({
              id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              role: 'assistant',
              content: `Секундочку! Перемещаемся в ${toAccusativeCity(fallbackCity.name || fallbackCity.raw)}, смотрю свежие замеры воздуха, ня! ✨`,
              emotion: 'happy',
              timestamp: Date.now()
            });

            if (fallbackCity.wantsAnalytics && job.generation === dialogGenerationRef.current) {
              await triggerFollowUpAnalytics(targetLat, targetLon, targetName, job.generation);
            }
            continue;
          }

          console.error('AI chat error:', err);
          appendMessage({
            id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            role: 'assistant',
            isError: true,
            content: `Ошибка соединения: ${err.message}. Проверьте сервер и настройки AnyModel.`,
            timestamp: Date.now()
          });
        } finally {
          if (abortControllerRef.current === controller) {
            abortControllerRef.current = null;
          }
        }
      }
    } finally {
      isRequestingRef.current = false;
      setIsLoading(false);
    }
  }, [appendMessage]);

  const handleSendMessage = useCallback((e, directText = null) => {
    e?.preventDefault?.();

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (isListeningRef.current && !directText) {
      isCancelledRef.current = true;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
        mediaRecorderRef.current = null;
      }
      setIsListening(false);
      isListeningRef.current = false;
    }

    const rawText = typeof directText === 'string' ? directText : inputMessageRef.current;
    const trimmed = rawText.trim();
    if (!trimmed) return;

    const userMsg = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now()
    };

    // Сообщение сразу показываем в чате, а запрос ставим в очередь,
    // чтобы можно было писать следующее, не дожидаясь ответа.
    appendMessage(userMsg);
    setInputMessage('');
    inputMessageRef.current = '';

    requestQueueRef.current.push({
      text: trimmed,
      userMessageId: userMsg.id,
      generation: dialogGenerationRef.current
    });

    void processQueue();
  }, [appendMessage, processQueue]);

  // Новый диалог: сбрасываем очередь и отменяем незавершенный запрос,
  // чтобы его ответ не попал в новый чат.
  const handleNewDialog = useCallback(() => {
    dialogGenerationRef.current += 1;
    requestQueueRef.current = [];

    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch {}
      abortControllerRef.current = null;
    }

    messagesRef.current = [INITIAL_GREETING];
    setMessages(messagesRef.current);
    setInputMessage('');
    inputMessageRef.current = '';
  }, []);

  const blobToBase64 = useCallback((blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result;
        const base64 = typeof dataUrl === 'string' ? dataUrl.split(',')[1] : '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }, []);

  // Отправка аудио на бэкенд для распознавания (fallback для Firefox и браузеров без SpeechRecognition)
  const sendVoiceBlobToBackend = useCallback(async (blob) => {
    setIsTranscribing(true);
    try {
      // Попытка использовать локальный транскриптор, если нативный отсутствует
      if (typeof window !== 'undefined' && !window.SpeechRecognition && !window.webkitSpeechRecognition) {
        try {
          const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/+esm');
          env.allowLocalModels = false;
          const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');
          
          const arrayBuffer = await blob.arrayBuffer();
          const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const result = await transcriber(audioBuffer.getChannelData(0));
          
          if (result && result.text) {
            setInputMessage(result.text);
            await handleSendMessage(null, result.text);
            return;
          }
        } catch (localErr) {
          console.warn('Local WASM transcription failed, falling back:', localErr);
        }
      }

      const base64 = await blobToBase64(blob);
      if (!base64) {
        throw new Error('Пустая аудиозапись');
      }

      const response = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio: base64,
          mimeType: blob.type || 'audio/webm'
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Ошибка сервера (${response.status})`);
      }

      const data = await response.json();
      const transcribedText = (data.text || '').trim();
      if (!transcribedText) {
        throw new Error('Не удалось распознать речь в аудиозаписи');
      }

      setInputMessage(transcribedText);
      await handleSendMessage(null, transcribedText);
    } catch (err) {
      console.warn('Backend audio transcribe error:', err);
      appendMessage({
        id: `err-voice-${Date.now()}`,
        role: 'assistant',
        isError: true,
        content: `Ошибка распознавания аудио: ${err.message}.`,
        timestamp: Date.now()
      });
    } finally {
      setIsTranscribing(false);
    }
  }, [appendMessage, blobToBase64, handleSendMessage]);

  const handleCancelVoice = useCallback(() => {
    isCancelledRef.current = true;
    transcriptRef.current = '';
    audioChunksRef.current = [];

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
      mediaStreamRef.current = null;
    }

    setIsListening(false);
    isListeningRef.current = false;
    setInputMessage('');
    inputMessageRef.current = '';
  }, []);

  const handleToggleVoice = useCallback(async () => {
    if (isTranscribing) return;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (isListeningRef.current) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const unsupportedMsg = {
        id: `sys-${Date.now()}`,
        role: 'assistant',
        isError: true,
        content:
          'Запрос разрешения на микрофон не поддерживается в текущем окружении. Браузер требует безопасное соединение (HTTPS или http://localhost:5173).',
        timestamp: Date.now()
      };
      appendMessage(unsupportedMsg);
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.warn('Microphone permission error:', err);
      let errorText = 'Не удалось получить доступ к микрофону.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorText =
          'Разрешение на использование микрофона отклонено. Пожалуйста, разрешите доступ к микрофону в настройках браузера (значок микрофона или замка в адресной строке) и нажмите на микрофон снова.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorText = 'Микрофон не обнаружен. Пожалуйста, подключите микрофон к компьютеру.';
      }
      const deniedMsg = {
        id: `sys-${Date.now()}`,
        role: 'assistant',
        isError: true,
        content: errorText,
        timestamp: Date.now()
      };
      appendMessage(deniedMsg);
      return;
    }

    isCancelledRef.current = false;
    transcriptRef.current = '';
    audioChunksRef.current = [];

    const SpeechRecognition =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (SpeechRecognition) {
      // Освобождаем временный поток getUserMedia: SpeechRecognition использует аудиоканал автономно
      try {
        stream.getTracks().forEach((track) => track.stop());
      } catch {}

      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'ru-RU';
        // continuous = true позволяет пользователю делать естественные паузы между фразами
        // и договаривать предложения без преждевременного обрыва
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        const resetSilenceTimer = () => {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          // Если уже есть надиктованный текст, даем пользователю 3 секунды спокойной тишины перед автоотправкой
          if (transcriptRef.current.trim().length > 0) {
            silenceTimerRef.current = setTimeout(() => {
              if (isListeningRef.current && recognitionRef.current) {
                try {
                  recognitionRef.current.stop();
                } catch {}
              }
            }, 3000);
          }
        };

        recognition.onstart = () => {
          setIsListening(true);
          isListeningRef.current = true;
        };

        // Сброс таймера при обнаружении звука или речи пользователя
        recognition.onsoundstart = () => {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        };

        recognition.onspeechstart = () => {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        };

        recognition.onresult = (event) => {
          let final = '';
          let interim = '';

          for (let i = 0; i < event.results.length; ++i) {
            const item = event.results[i];
            const phrase = (item[0]?.transcript || '').trim();
            if (!phrase) continue;
            if (item.isFinal) {
              final = final ? `${final} ${phrase}` : phrase;
            } else {
              interim = interim ? `${interim} ${phrase}` : phrase;
            }
          }

          const currentText = (final && interim ? `${final} ${interim}` : (final || interim)).trim();
          transcriptRef.current = currentText;
          setInputMessage(currentText);

          resetSilenceTimer();
        };

        recognition.onerror = (event) => {
          console.warn('SpeechRecognition error:', event.error);
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            const errMsg = {
              id: `err-mic-${Date.now()}`,
              role: 'assistant',
              isError: true,
              content:
                'Доступ к микрофону заблокирован. Разрешите доступ к микрофону в настройках браузера для Aerocast.',
              timestamp: Date.now()
            };
            appendMessage(errMsg);
          }
          setIsListening(false);
          isListeningRef.current = false;
        };

        recognition.onend = () => {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          setIsListening(false);
          isListeningRef.current = false;
          recognitionRef.current = null;

          const textToSend = transcriptRef.current.trim();
          transcriptRef.current = '';

          if (!isCancelledRef.current && textToSend) {
            handleSendMessage(null, textToSend);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
        setIsListening(false);
        isListeningRef.current = false;
      }
      return;
    }

    // ВАРИАНТ Б: Браузер НЕ поддерживает Web Speech API (например, Mozilla Firefox),
    // но доступ к микрофону пользователь уже разрешил! Записываем через MediaRecorder и отправляем на бэкенд
    if (typeof MediaRecorder !== 'undefined') {
      try {
        mediaStreamRef.current = stream;
        const mimeType =
          typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
            ? 'audio/ogg;codecs=opus'
            : '';

        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.onstart = () => {
          setIsListening(true);
          isListeningRef.current = true;
        };

        recorder.onstop = async () => {
          setIsListening(false);
          isListeningRef.current = false;
          try {
            stream.getTracks().forEach((track) => track.stop());
          } catch {}
          mediaStreamRef.current = null;

          if (isCancelledRef.current) {
            audioChunksRef.current = [];
            return;
          }

          const recordedBlob = new Blob(audioChunksRef.current, {
            type: recorder.mimeType || 'audio/webm'
          });
          audioChunksRef.current = [];

          if (recordedBlob.size > 200) {
            await sendVoiceBlobToBackend(recordedBlob);
          }
        };

        recorder.start();
      } catch (err) {
        console.error('Failed to start MediaRecorder:', err);
        try {
          stream.getTracks().forEach((track) => track.stop());
        } catch {}
        setIsListening(false);
        isListeningRef.current = false;
      }
      return;
    }

    try {
      stream.getTracks().forEach((track) => track.stop());
    } catch {}
    const fallbackMsg = {
      id: `sys-${Date.now()}`,
      role: 'assistant',
      isError: true,
      content:
        'Разрешение на микрофон получено, однако ваш браузер не поддерживает распознавание речи (Web Speech API). Для работы голосового ввода рекомендуются Google Chrome, Microsoft Edge или Яндекс.Браузер.',
      timestamp: Date.now()
    };
    appendMessage(fallbackMsg);
  }, [appendMessage, isTranscribing, isListening, handleSendMessage, sendVoiceBlobToBackend]);

  useEffect(() => {
    if (!isOpen && isListening) {
      handleCancelVoice();
    }
  }, [isOpen, isListening, handleCancelVoice]);

  // Закрытие по клавише Escape (или отмена голосового ввода, если идет запись)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isListening) {
          handleCancelVoice();
        } else {
          onClose?.();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isListening, handleCancelVoice]);

  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  const chatWindowNode = (
    <div
      className={`ai-chat-window ${embedded ? 'ai-chat-window--embedded' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      <header className="ai-chat-header">
        <div className="ai-chat-header__info">
          {!embedded && (
            <AyaMascot
              size="header"
              emotion={currentEmotion}
              showBubble={false}
            />
          )}
          <span className="ai-chat-header__status-dot" aria-hidden="true" />
          <span className="ai-chat-header__name">Ая</span>
        </div>

        <div className="ai-chat-header__actions">
          <button
            type="button"
            className="ai-chat-header__btn"
            onClick={() => handleSendMessage(null, 'Какая аналитика по текущей точке?')}
            title={pointAnalytics ? `Аналитика: ${pointAnalytics.locationName}${pointAnalytics.aqi !== null ? ` · AQI ${pointAnalytics.aqi}` : ''}` : 'Аналитика по текущей точке'}
            aria-label={pointAnalytics ? `Аналитика: ${pointAnalytics.locationName}${pointAnalytics.aqi !== null ? ` · AQI ${pointAnalytics.aqi}` : ''}` : 'Аналитика по текущей точке'}
            data-testid="ai-chat-quick-analytics-btn"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </button>

          {onOpenSettings && (
            <button
              type="button"
              className="ai-chat-header__btn"
              onClick={onOpenSettings}
              title="Настройки"
              aria-label="Настройки"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
          )}

          <button
            type="button"
            className="ai-chat-header__btn"
            onClick={toggleSound}
            title={isSoundEnabled ? 'Звук включен' : 'Без звука'}
            aria-label={isSoundEnabled ? 'Выключить звук' : 'Включить звук'}
          >
              {isSoundEnabled ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              )}
            </button>

            <button
              type="button"
              className="ai-chat-header__btn"
              onClick={handleNewDialog}
              title="Начать новый диалог"
              aria-label="Начать новый диалог"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </button>

            <button
              type="button"
              className="ai-chat-header__btn ai-chat-header__close"
              onClick={onClose}
              title="Закрыть чат"
              aria-label="Закрыть чат"
            >
              &times;
            </button>
          </div>
        </header>

        <div className="ai-chat-messages" ref={messagesContainerRef}>
          {messages.map((msg) => {
            const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            });

            const msgClass = [
              'ai-chat-msg',
              msg.role === 'assistant' ? 'ai-chat-msg--assistant' : 'ai-chat-msg--user',
              msg.isError ? 'ai-chat-msg--error' : ''
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <div key={msg.id} className={msgClass}>
                <div className="ai-chat-msg__bubble">
                  {formatMessageContent(msg.content)}
                </div>
                <span className="ai-chat-msg__time">{timeStr}</span>
              </div>
            );
          })}

          {isLoading && (
            <div className="ai-chat-typing" aria-label="Ая печатает ответ">
              <span className="ai-chat-typing__dot" />
              <span className="ai-chat-typing__dot" />
              <span className="ai-chat-typing__dot" />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <footer className="ai-chat-footer">
          <form className="ai-chat-input-form" onSubmit={handleSendMessage}>
            <input
              ref={inputRef}
              type="text"
              className="ai-chat-input"
              value={inputMessage}
              onChange={(e) => {
                if (isListening) handleCancelVoice();
                inputMessageRef.current = e.target.value;
                setInputMessage(e.target.value);
              }}
              placeholder={
                isTranscribing
                  ? 'Распознавание речи...'
                  : isListening
                  ? 'Слушаю вас, говорите...'
                  : isLoading
                  ? 'Ая отвечает... можно написать ещё'
                  : 'Спроси что-нибудь...'
              }
              disabled={isTranscribing}
              maxLength={600}
            />
            {isListening && (
              <button
                type="button"
                className="ai-chat-cancel-voice-btn"
                onClick={handleCancelVoice}
                title="Отменить запись"
                aria-label="Отменить голосовой ввод"
                data-testid="ai-chat-cancel-voice-btn"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
            <button
              type="button"
              className={`ai-chat-mic-btn ${isListening ? 'ai-chat-mic-btn--listening' : ''}`}
              onClick={handleToggleVoice}
              disabled={isTranscribing}
              title={isListening ? "Остановить запись и отправить" : "Голосовой ввод"}
              aria-label={isListening ? "Остановить запись и отправить" : "Включить голосовой ввод"}
              data-testid="ai-chat-mic-btn"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </button>
            <button
              type="submit"
              className="ai-chat-send-btn"
              disabled={!inputMessage.trim() || isTranscribing}
              title="Отправить (Enter)"
              aria-label="Отправить сообщение"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </footer>
    </div>
  );

  if (embedded) {
    return (
      <div className="ai-chat-embedded-layout" role="region" aria-label="Чат с Аей">
        {chatWindowNode}
        {mascotUnderChat && (
          <div className="ai-chat-mascot-docked" data-testid="ai-chat-mascot-docked">
            <AyaMascot
              emotion={currentEmotion}
              size="chat-docked"
              showBubble={true}
              onClick={handleMascotClick}
              customBubbleText={
                isLoading
                  ? 'Хм-м-м, дай подумать...'
                  : currentEmotion === 'happy'
                  ? 'Ура! Рада помочь! ✨'
                  : currentEmotion === 'alert'
                  ? 'Б-бака! Чего ты натворил?! 💢'
                  : dockedPhrase
              }
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ai-chat-overlay" onClick={onClose} role="dialog" aria-modal="true">
      {chatWindowNode}
    </div>
  );
}
