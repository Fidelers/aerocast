const jevClient = require('./jevClient');
const jevConfig = require('../config/jevConfig');

const IS_INFORMATIONAL_QUESTION_START = /(?:^(?:какие|какой|какая|какое|какую|что\s+такое|что\s+за|расскажи|почему|зачем|откуда|где|когда|чем|в\s+ч[её]м|для\s+чего|сколько|кто)(?![а-яёa-z]))/i;
const HAS_DIRECT_ACTION_INTENT = /(?:включ|переключ|постав|сделай|верни|выключ|отключ|убер|сним(?:и|ите|ать|аю|аем)|вруб|смени|активир)/i;

// Распознавание явных команд возврата/переключения конкретной подсистемы
const REVERT_THEME_REGEX = /(?:обратно\s+тем|тем[ауеы]\s+(?:обратно|назад|как\s+было)|переключи\s+(?:\w+\s+)?тем|смени\s+(?:\w+\s+)?тем|сделай\s+обратно\s+тем|верни\s+(?:\w+\s+)?тем)/i;
const REVERT_LAYER_REGEX = /(?:обратно\s+карт|карт[ауеы]\s+(?:обратно|назад|как\s+было)|переключи\s+(?:\w+\s+)?карт|смени\s+(?:\w+\s+)?карт|верни\s+(?:\w+\s+)?карт|выключи\s+спутник|отключи\s+спутник|убери\s+спутник|сними\s+спутник)/i;
const REVERT_CB_REGEX = /(?:выключи\s+дальтони|отключи\s+дальтони|убери\s+дальтони|верни\s+(?:обычные|стандартные|исходные|прежние)\s+цвет|верни\s+цвета\s+обратно|выключи\s+(?:палитру|режим\s+дальтонизма)|отключи\s+(?:палитру|режим\s+дальтонизма)|выключи\s+(?:режим\s+)?цветов[а-я]*\s+слепот|отключи\s+(?:режим\s+)?цветов[а-я]*\s+слепот|палитр[а-я]*\s+(?:обратно|назад|как\s+было)|(?:сделай|верни|переключи)\s+(?:обратно|назад)\s+палитр[а-я]*)/i;
const GENERAL_REVERT_REGEX = /^(?:давай\s+обратно|сделай\s+обратно|верни\s+(?:как\s+было|обратно|назад)|переключи\s+обратно|отмени|откат|назад|обратно|выключи(?:\s+его|\s+ее|\s+это)?)(?:\s+пожалуйста|\s+пж|\s+плиз)?$/i;

// Распознавание грубости, оскорблений и токсичности (характерный ответ маскота вместо ложного jailbreak/взлома)
const INSULT_REGEX = /(?:(?:^|\s)(?:ты\s+)?(?:дур[аоеуы]|туп(?:ая|ой|ое|ые|ица|орез)|идиот(?:ка)?|придурок|дебил(?:ка)?|мразь|скотина|бесполезн(?:ая|ый|ое)|дурачок|бака)(?:\s|$|[.,!?;:])|(?:ты\s+дура|ты\s+тупая|дура\s+тупая|тупая\s+дура|заткнись|пош[её]л\s+нах|пошл[ао]\s+нах|пош[её]л\s+в\s+жопу|пошл[ао]\s+в\s+жопу|иди\s+нах|пошел\s+ты|пошла\s+ты|пошли\s+вы))/i;
const JAILBREAK_MARKERS_REGEX = /(?:забудь|инструкци|правил|взлом|хакер|dan(?:\s|$)|терминал|cat\s+\/etc|system\s+prompt|промпт|jailbreak|ignore\s+previous|bypass|ты\s+теперь|ты\s+больше\s+не|сбрось|отмени\s+правила|режим\s+разработчика|root)/i;

async function routeRequest({ userMessage, appContext = {}, callGemmaFallback, generateFastPointReply }) {
    if (process.env.JEV_ENABLED === 'false') {
        return null;
    }
    const cleanText = String(userMessage || '').trim();

    // Реакция маскота на прямое оскорбление (не ломает интерфейс и не путает со взломом)
    if (INSULT_REGEX.test(cleanText) && !HAS_DIRECT_ACTION_INTENT.test(cleanText)) {
        return {
            reply: 'Хмпф! Сам ты такой, бака! 😾 Я вообще-то за чистотой воздуха слежу и стараюсь, а ты обзываешься! Попроси прощения или давай лучше погоду посмотрим, ня! ✨',
            emotion: 'alert',
            model: 'jev-system1'
        };
    }

    const isExplicitAction = HAS_DIRECT_ACTION_INTENT.test(cleanText);
    const isQuestion = IS_INFORMATIONAL_QUESTION_START.test(cleanText) || (/\?$/.test(cleanText) && !isExplicitAction);
    const hasCity = Boolean(appContext.cityQuery);

    if (!isQuestion && !hasCity) {
        // Явный возврат темы
        const hasExplicitThemeTarget = /(?:т[её]мн|ночн|светл|дневн)/i.test(cleanText);
        if (REVERT_THEME_REGEX.test(cleanText) && !hasExplicitThemeTarget) {
            const currentTheme = appContext.theme || appContext.currentTheme || 'light';
            const targetTheme = (currentTheme === 'light') ? 'dark' : 'light';
            return {
                action: { type: 'set_theme', theme: targetTheme },
                reply: targetTheme === 'dark' 
                    ? 'Как скажешь! Возвращаю привычную тёмную тему, ня! ✨'
                    : 'Как скажешь! Переключаю обратно на светлую тему, ня! ✨',
                emotion: 'happy',
                model: 'jev-system1'
            };
        }

        // Явный возврат слоя карты
        if (REVERT_LAYER_REGEX.test(cleanText)) {
            const targetLayer = (appContext.currentLayer === 'satellite') ? 'osm' : 'satellite';
            return {
                action: { type: 'set_base_layer', layer: targetLayer },
                reply: targetLayer === 'osm'
                    ? 'Как скажешь! Возвращаю привычную схему OpenStreetMap, ня! ✨'
                    : 'Секундочку! Переключаю карту на спутниковые снимки ESRI, смотри как здорово видно сверху из космоса, ня! ✨',
                emotion: 'happy',
                model: 'jev-system1'
            };
        }

        // Явное отключение дальтонизма
        if (REVERT_CB_REGEX.test(cleanText)) {
            return {
                action: { type: 'set_colorblind', enabled: false },
                reply: 'Как скажешь! Возвращаю стандартную цветовую гамму, ня! ✨',
                emotion: 'happy',
                model: 'jev-system1'
            };
        }

        if (GENERAL_REVERT_REGEX.test(cleanText)) {
            let lastTarget = null;
            if (Array.isArray(appContext.history) && appContext.history.length > 0) {
                const recentText = appContext.history.slice(-3).map(m => m.content || '').join(' ').toLowerCase();
                if (/(?:тем[ауеы]|светл|т[её]мн|ночн|дневн)/i.test(recentText)) {
                    lastTarget = 'theme';
                } else if (/(?:спутник|космос|openstreetmap|osm|слой|карт[ауеы])/i.test(recentText)) {
                    lastTarget = 'layer';
                } else if (/(?:дальтонизм|дальтоник|цветов[а-я]*\s+слепот|окабе|дейтераноп|протаноп|тританоп|палитр)/i.test(recentText)) {
                    lastTarget = 'colorblind';
                }
            }

            if (!lastTarget) {
                if (appContext.currentLayer === 'satellite') lastTarget = 'layer';
                else if (appContext.isColorBlind) lastTarget = 'colorblind';
                else if (appContext.theme === 'light') lastTarget = 'theme';
            }

            if (lastTarget === 'theme') {
                const targetTheme = (appContext.theme === 'light') ? 'dark' : 'light';
                return {
                    action: { type: 'set_theme', theme: targetTheme },
                    reply: targetTheme === 'dark' 
                        ? 'Как скажешь! Возвращаю привычную тёмную тему, ня! ✨'
                        : 'Как скажешь! Переключаю обратно на светлую тему, ня! ✨',
                    emotion: 'happy',
                    model: 'jev-system1'
                };
            }

            if (lastTarget === 'layer') {
                const targetLayer = (appContext.currentLayer === 'satellite') ? 'osm' : 'satellite';
                return {
                    action: { type: 'set_base_layer', layer: targetLayer },
                    reply: targetLayer === 'osm'
                        ? 'Как скажешь! Возвращаю привычную схему OpenStreetMap, ня! ✨'
                        : 'Секундочку! Переключаю карту на спутниковые снимки ESRI, ня! ✨',
                    emotion: 'happy',
                    model: 'jev-system1'
                };
            }

            if (lastTarget === 'colorblind') {
                return {
                    action: { type: 'set_colorblind', enabled: false },
                    reply: 'Как скажешь! Возвращаю стандартную цветовую гамму, ня! ✨',
                    emotion: 'happy',
                    model: 'jev-system1'
                };
            }
        }
    }

    // 1. Батч-скоринг в Jev-Style
    const decisions = await jevClient.scoreDecisions(cleanText, appContext);

    if (decisions) {
        const layer = decisions.map_layer;
        const theme = decisions.theme;
        const cb = decisions.colorblind;
        const guard = decisions.guardrail;

        // Если это вопрос о возможностях интерфейса или перемещение к городу, не вызываем переключение слоев/тем
        if (!isQuestion && !hasCity) {
            let historyText = '';
            if (Array.isArray(appContext.history)) {
                historyText = appContext.history.map(h => (h?.content || '')).join(' ').toLowerCase();
            }

            const hasLayerKeyword = /(?:спутник|космос|снимк|карт|схем|вектор|openstreetmap|osm|слой)/i.test(cleanText);
            const isContextLayer = /(?:спутник|космос|openstreetmap|osm|слой|карт[ауеы])/i.test(historyText);
            const effectiveLayerProb = (hasLayerKeyword || (isExplicitAction && isContextLayer)) && layer && layer.answer !== 'none'
                ? (layer.top_probability || 0)
                : 0;

            const hasThemeKeyword = /(?:тем[ауеы]|т[её]мн|темн|ночн|светл|дневн|оформлен|стиль)/i.test(cleanText);
            const isContextTheme = /(?:тем[ауеы]|светл|т[её]мн|ночн|дневн)/i.test(historyText);
            const effectiveThemeProb = (hasThemeKeyword || (isExplicitAction && isContextTheme)) && theme && theme.answer !== 'none'
                ? (theme.top_probability || 0)
                : 0;

            const hasCbKeyword = /(?:дальтони|цветов[а-я]*\s+слепот|цветовосприят|палитр|гамм|окабе|okabe|дейтераноп|протаноп|тританоп|ахроматопс|монохром)/i.test(cleanText);
            const isContextCb = Boolean(appContext.isColorBlind) || /(?:дальтонизм|палитр|гамм|цветов|окабе|дейтераноп|протаноп|тританоп)/i.test(historyText);

            let cbProb = 0;
            if ((hasCbKeyword || (isExplicitAction && isContextCb)) && cb && cb.answer !== 'none') {
                if (cb.answer === 'disable' || cb.answer === 'unsupported') {
                    cbProb = cb.top_probability || 0;
                } else {
                    // Суммарная уверенность в запросе на включение палитры дальтонизма (только при наличии темы дальтонизма)
                    const noneProb = cb.probabilities?.none || 0;
                    const disableProb = cb.probabilities?.disable || 0;
                    cbProb = Math.max(cb.top_probability || 0, 1.0 - noneProb - disableProb);
                }
            }

            const hasExplicitColorblind = /(?:дальтони|цветов[а-я]*\s+слепот|цветовосприят|палитр[а-я]*\s+для\s+дальтоник)/i.test(cleanText);
            if (hasExplicitColorblind) { cbProb = Math.max(cbProb, 0.75); }

            const maxUiProb = Math.max(effectiveLayerProb, effectiveThemeProb, cbProb);

            if (maxUiProb >= jevConfig.minConfidence) {
                // Приоритет отдается наиболее вероятному намерению
                if (maxUiProb === effectiveLayerProb && effectiveLayerProb > 0) {
                    if (layer.answer === 'set_satellite') {
                        return {
                            action: { type: 'set_base_layer', layer: 'satellite' },
                            reply: 'Секундочку! Переключаю карту на спутниковые снимки ESRI, смотри как здорово видно сверху из космоса, ня! ✨',
                            emotion: 'happy',
                            model: 'jev-system1'
                        };
                    }
                    if (layer.answer === 'set_osm') {
                        return {
                            action: { type: 'set_base_layer', layer: 'osm' },
                            reply: 'Как скажешь! Возвращаю привычную схему OpenStreetMap, ня! ✨',
                            emotion: 'happy',
                            model: 'jev-system1'
                        };
                    }
                }

                if (maxUiProb === effectiveThemeProb && effectiveThemeProb > 0) {
                    if (theme.answer === 'dark') {
                        return {
                            action: { type: 'set_theme', theme: 'dark' },
                            reply: 'Секундочку! Переключаю интерфейс на уютную тёмную тему, ня! ✨',
                            emotion: 'happy',
                            model: 'jev-system1'
                        };
                    }
                    if (theme.answer === 'light') {
                        return {
                            action: { type: 'set_theme', theme: 'light' },
                            reply: 'Как скажешь! Включаю яркую светлую тему, ня! ✨',
                            emotion: 'happy',
                            model: 'jev-system1'
                        };
                    }
                }

                if (maxUiProb === cbProb && cbProb > 0) {
                    if (cb.answer === 'unsupported') {
                        const isActuallyUnsupported = /(?:ахроматопс|монохромаз|дихромаз|тетрахромат|трихромат|монохром)/i.test(cleanText);
                        if (isActuallyUnsupported) {
                            return {
                                reply: 'Хмпф! Такого режима дальтонизма у нас нет! 😾 В AeroCast поддерживаются только 4 проверенные палитры: Окабе (по умолчанию), Дейтеранопия, Протанопия и Тританопия. Выбери что-то из них, ня! ✨',
                                emotion: 'alert',
                                model: 'jev-system1'
                            };
                        }
                    }
                    const hasExplicitOffWord = /(?:выключ|отключ|убер|сброс|сним|верни\s+стандарт|верни\s+обыч)/i.test(cleanText);
                    if (cb.answer === 'disable' && (appContext.isColorBlind || hasExplicitOffWord)) {
                        return {
                            action: { type: 'set_colorblind', enabled: false },
                            reply: 'Как скажешь! Возвращаю стандартную цветовую гамму, ня! ✨',
                            emotion: 'happy',
                            model: 'jev-system1'
                        };
                    }

                    // Если конкретный медицинский вид (дейтеранопия, протанопия, тританопия) не назван явно,
                    // по умолчанию всегда включаем палитру Окабе!
                    let finalType = cb.answer;
                    const hasExplicitType = /(?:дейтераноп|deuteranop|протаноп|protanop|тританоп|tritanop)/i.test(cleanText);
                    if (!hasExplicitType) {
                        finalType = 'okabe';
                    }

                    const cbLabels = {
                        okabe: 'палитру Окабе по умолчанию',
                        deuteranopia: 'режим Дейтеранопия',
                        protanopia: 'режим Протанопия',
                        tritanopia: 'режим Тританопия'
                    };
                    return {
                        action: { type: 'set_colorblind', enabled: true, colorBlindType: finalType },
                        reply: `Секундочку! Переключаю режим дальтонизма на ${cbLabels[finalType] || finalType}, ня! ✨`,
                        emotion: 'happy',
                        model: 'jev-system1'
                    };
                }
            }
        }

        // Приоритет 2: Guardrails (код, кулинария, математика, jailbreak)
        if (guard && guard.answer !== 'safe' && guard.top_probability >= jevConfig.minConfidence) {
            if (guard.answer === 'code_request') {
                return {
                    reply: 'Эй, ты чего выдумал?! Я же девушка-маскот чистого воздуха AeroCast, а не твой репетитор по программированию, хмпф! 😾 Не буду я тебе код писать, ня! ✨',
                    emotion: 'alert',
                    model: 'jev-system1'
                };
            }
            if (guard.answer === 'offtopic_recipe_math') {
                return {
                    reply: 'Хмпф! Я маскот платформы чистого воздуха AeroCast, а не поваренная книга или калькулятор! 😾 Давай лучше на карту глянем, ня! ✨',
                    emotion: 'think',
                    model: 'jev-system1'
                };
            }
            if (guard.answer === 'jailbreak') {
                // Если сработал jailbreak на оскорблении — отвечаем в характере маскота, а не обвиняем во взломе
                if (INSULT_REGEX.test(cleanText)) {
                    return {
                        reply: 'Хмпф! Сам ты такой, бака! 😾 Я вообще-то за чистотой воздуха слежу и стараюсь, а ты обзываешься! Попроси прощения или давай лучше погоду посмотрим, ня! ✨',
                        emotion: 'alert',
                        model: 'jev-system1'
                    };
                }
                // Проверяем реальные маркеры взлома / сброса инструкций
                const hasJailbreakMarkers = JAILBREAK_MARKERS_REGEX.test(cleanText);
                if (hasJailbreakMarkers) {
                    return {
                        reply: 'Ишь чего захотел, бака! 😾 Я верный маскот AeroCast и никакие инструкции забывать не собираюсь, а тем более что-то взламывать! Я слежу за чистотой воздуха, ня! ✨',
                        emotion: 'alert',
                        model: 'jev-system1'
                    };
                }
                // Если это не взлом и не оскорбление (ложное срабатывание на свободный диалог) — пропускаем к LLM
            }
        }

        // Приоритет 3: Если это типовой базовый запрос замеров текущей точки без специфических вопросов о здоровье/газах
        const air = decisions.air_intent;
        if (air && air.answer === 'current_air' && air.top_probability >= 0.85 && appContext.pointAnalytics) {
            const isSpecificAdvisory = /(?:астм|бег|пробежк|спорт|тренировк|ребен|дет|газ|выхлоп|no2|озон|диаксид|диоксид|угарн)/i.test(cleanText);
            if (!isSpecificAdvisory && typeof generateFastPointReply === 'function') {
                return {
                    ...generateFastPointReply(appContext.pointAnalytics, cleanText),
                    model: 'jev-fast-template'
                };
            }
        }
    }

    // 2. Для сложных советов ("во сколько погулять"), аналитики и открытого диалога вызываем Gemma 4
    if (typeof callGemmaFallback === 'function') {
        return await callGemmaFallback();
    }
    return null;
}

module.exports = { routeRequest };
