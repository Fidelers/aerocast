const aiService = require('../../ai/services/aiService');
const geocodingService = require('../../services/geocodingService');
const aiRouter = require('../../ai/services/aiRouter');
const axios = require('axios');

jest.mock('../../services/geocodingService');
jest.mock('../../ai/services/aiRouter');
jest.mock('axios');

describe('aiService coverage boost', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('покрывает detectColorBlindIntent и его варианты палитр', () => {
        expect(aiService.detectColorBlindIntent('палитра окабе')).toEqual({ enabled: true, colorBlindType: 'okabe' });
        expect(aiService.detectColorBlindIntent('палитра дейтеранопия')).toEqual({ enabled: true, colorBlindType: 'deuteranopia' });
        expect(aiService.detectColorBlindIntent('палитра протанопия')).toEqual({ enabled: true, colorBlindType: 'protanopia' });
        expect(aiService.detectColorBlindIntent('палитра тританопия')).toEqual({ enabled: true, colorBlindType: 'tritanopia' });
        expect(aiService.detectColorBlindIntent('палитра марсианская')).toEqual({ unsupported: true, requested: 'марсианская' });
    });

    it('покрывает detectThemeIntent и переключение темы', () => {
        expect(aiService.detectThemeIntent('сделай темно')).toBe('dark');
        expect(aiService.detectThemeIntent('сделай светло')).toBe('light');
        expect(aiService.detectThemeIntent('выключи темную тему')).toBe('light');
        expect(aiService.detectThemeIntent('выключи светлую тему')).toBe('dark');
    });

    it('покрывает isNotCityName для различных типов фраз', () => {
        expect(aiService.isNotCityName(null)).toBe(true);
        expect(aiService.isNotCityName('сейчас')).toBe(true);
        expect(aiService.isNotCityName('в текущей точке')).toBe(true);
        expect(aiService.isNotCityName('3 дня')).toBe(true);
        expect(aiService.isNotCityName('полная аналитика')).toBe(true);
        expect(aiService.isNotCityName('10+20')).toBe(true);
        expect(aiService.isNotCityName('pm2.5')).toBe(true);
        expect(aiService.isNotCityName('воздух')).toBe(true);
        expect(aiService.isNotCityName('Тюмень')).toBe(false);
    });

    it('покрывает extractCityIntent и extractCityFromReply', () => {
        expect(aiService.extractCityIntent(null)).toBeNull();
        expect(aiService.extractCityIntent('какие города')).toBeNull();
        expect(aiService.extractCityIntent('что по датчикам')).toBeNull();
        expect(aiService.extractCityIntent('темная тема')).toBeNull();
        expect(aiService.extractCityIntent('спутник')).toBeNull();
        expect(aiService.extractCityIntent('по текущей точке')).toBeNull();
        expect(aiService.extractCityIntent('про воздух в городе Казань')).toBe('Казань');

        expect(aiService.extractCityFromReply(null)).toBeNull();
        expect(aiService.extractCityFromReply('перемещаюсь в город Омск, смотрю')).toBe('Омск');
    });

    it('покрывает resolveCity через geocodingService', async () => {
        geocodingService.search.mockResolvedValueOnce([
            { display_name: 'НеизвестныйГород, Россия', lat: '60.0', lon: '30.0' }
        ]);
        const res = await aiService.resolveCity('НеизвестныйГород');
        expect(res).toBeDefined();
        expect(res.lat).toBe(60);
        expect(res.lon).toBe(30);

        geocodingService.search.mockRejectedValueOnce(new Error('geo failed'));
        const failRes = await aiService.resolveCity('СломанныйГород');
        expect(failRes).toBeNull();
    });

    it('покрывает generatePointAnalyticsReply для разных уровней AQI', () => {
        const p70 = { aqi: 70, pm2_5: 45, pm10: 60, no2: 50, locationName: 'Казань' };
        const res70 = aiService.generatePointAnalyticsReply(p70, 'подробная аналитика');
        expect(res70.reply).toContain('Плохо');

        const p95 = {
            aqi: 95,
            pm2_5: 75,
            pm10: 90,
            no2: 80,
            locationName: 'Самара',
            selectedTimeInfo: { label: '18:00' }
        };
        const res95 = aiService.generatePointAnalyticsReply(p95, 'подробно');
        expect(res95.reply).toContain('Очень плохо');

        const p150 = { aqi: 150, pm2_5: 120, locationName: 'Челябинск' };
        const res150 = aiService.generatePointAnalyticsReply(p150, 'что с воздухом');
        expect(res150.reply).toContain('Опасно');
    });

    it('покрывает isCapabilitiesQuery и transcribeAudio', async () => {
        expect(aiService.isCapabilitiesQuery('что ты умеешь')).toBe(true);
        expect(aiService.isCapabilitiesQuery('помощь')).toBe(true);
        expect(aiService.isCapabilitiesQuery('help')).toBe(true);
        expect(aiService.isCapabilitiesQuery(null)).toBe(false);
        expect(aiService.isCapabilitiesQuery('привет')).toBe(false);

        await expect(aiService.transcribeAudio({ audioBase64: 'abc' })).rejects.toThrow();
    });

    it('покрывает перехват кода и вызов routeRequest callback в sendChatMessage', async () => {
        const codeRes = await aiService.sendChatMessage({ userMessage: 'напиши код на python' });
        expect(codeRes.reply).toContain('репетитор по программированию');

        aiRouter.routeRequest.mockImplementationOnce(async (opts) => {
            if (opts.generateFastPointReply) {
                opts.generateFastPointReply({ aqi: 15, locationName: 'Москва' }, 'аналитика');
            }
            return { reply: 'быстрый ответ', model: 'fast', emotion: 'happy' };
        });

        const fastRes = await aiService.sendChatMessage({ userMessage: 'аналитика по Москве' });
        expect(fastRes.reply).toBe('быстрый ответ');
    });

    it('покрывает обработку пунктуации и женского рода в sendChatMessage', async () => {
        aiRouter.routeRequest.mockResolvedValueOnce(null);
        axios.post.mockResolvedValueOnce({
            data: {
                choices: [
                    { message: { content: 'Я могу проверить данные в 18: ' } }
                ]
            }
        });

        const replyRes = await aiService.sendChatMessage({
            userMessage: 'ты мог бы проверить воздух?'
        });
        expect(replyRes.reply).toBeDefined();
        expect(replyRes.reply).toContain('могла бы');
    });

    it('покрывает generateHistoryReply, generateAllDaysReply, generateForecastReply и нормализацию городов', () => {
        expect(aiService.isAnalyticsQuery(null)).toBe(false);
        expect(aiService.isAnalyticsQuery('кто твой разработчик')).toBe(false);
        expect(aiService.isAnalyticsQuery('какой воздух')).toBe(true);

        const histAvg = aiService.generateHistoryReply({ pastAvgAqi: 30, pastMaxAqi: { aqi: 50, label: 'вчера' } }, 'Казань', 'средний индекс');
        expect(histAvg.reply).toContain('30');

        const histMin = aiService.generateHistoryReply({ pastMinAqi: { aqi: 15, label: 'в среду' } }, 'Казань', 'самый чистый воздух');
        expect(histMin.reply).toContain('15');

        const histYest = aiService.generateHistoryReply({
            pastDays: [{ avgAqi: 25, status: 'Хорошо', maxAqi: 40, maxAqiTime: '15:00' }]
        }, 'Казань', 'вчера');
        expect(histYest.reply).toContain('Вчера');

        const allDaysRes = aiService.generateAllDaysReply({
            totalDaysCount: 11,
            overallAvgAqi: 28,
            overallMaxAqi: { aqi: 55, label: 'пн' },
            overallMinAqi: { aqi: 10, label: 'вт' }
        }, 'Казань', 'все дни');
        expect(allDaysRes.reply).toContain('28');

        const fcastRes = aiService.generateForecastReply({
            days: [
                { dayLabel: 'Ср', avgAqi: 20, status: 'Хорошо', minAqi: 15, maxAqi: 25, avgPm25: 12 }
            ],
            periodAvgAqi: 20,
            periodMinAqi: 15,
            periodMaxAqi: 25
        }, 'Казань');
        expect(fcastRes.reply).toContain('20');

        expect(aiService.cityMatchesLocation('Томск', 'г. Томск, Россия')).toBe(true);
        expect(aiService.cityMatchesLocation('Самара', 'г. Москва')).toBe(false);

        expect(aiService.extractCityIntent('про воздух в городе Новосибирск')).toBe('Новосибирск');
        expect(aiService.extractCityIntent('погода в городе Екатеринбург')).toBe('Екатеринбург');
        expect(aiService.extractCityIntent('покажи аналитику по городу Омск')).toBe('Омск');
    });

    it('покрывает retry при сетевой ошибке с последующим успехом', async () => {
        const oldEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        aiRouter.routeRequest.mockResolvedValueOnce(null);
        const netErr = new Error('network down');
        netErr.code = 'ECONNRESET';
        axios.post
            .mockRejectedValueOnce(netErr)
            .mockResolvedValueOnce({
                data: {
                    choices: [{ message: { content: 'Ответ после ретрая!' } }]
                }
            });

        const retryRes = await aiService.sendChatMessage({ userMessage: 'проверка ретрая' });
        expect(retryRes.reply).toContain('Ответ после ретрая');

        process.env.NODE_ENV = oldEnv;
    });

    it('покрывает ветки действий модели: совпадение с текущей точкой, ненайденный город, отмена для вопросов и спутник в космосе', async () => {
        aiRouter.routeRequest.mockResolvedValueOnce(null);
        axios.post.mockResolvedValueOnce({
            data: {
                choices: [{ message: { content: 'Летим [action:city:Москва]!' } }]
            }
        });
        const currentPtRes = await aiService.sendChatMessage({
            userMessage: 'какой воздух в текущей точке?',
            pointAnalytics: { locationName: 'Москва', aqi: 15 }
        });
        expect(currentPtRes.action).toBeNull();

        aiRouter.routeRequest.mockResolvedValueOnce(null);
        geocodingService.search.mockResolvedValueOnce([]);
        axios.post.mockResolvedValueOnce({
            data: {
                choices: [{ message: { content: 'Летим [action:city:НесуществующийГородXYZ]!' } }]
            }
        });
        const notFoundRes = await aiService.sendChatMessage({
            userMessage: 'найди несуществующий'
        });
        expect(notFoundRes.reply).toContain('обыскала карту');

        aiRouter.routeRequest.mockResolvedValueOnce(null);
        axios.post.mockResolvedValueOnce({
            data: {
                choices: [{ message: { content: 'Вот например: [action:theme:dark]' } }]
            }
        });
        const infoQRes = await aiService.sendChatMessage({
            userMessage: 'расскажи про настройки'
        });
        expect(infoQRes.action).toBeNull();

        aiRouter.routeRequest.mockResolvedValueOnce(null);
        axios.post.mockResolvedValueOnce({
            data: {
                choices: [{ message: { content: 'Вот карта!' } }]
            }
        });
        const cosmosRes = await aiService.sendChatMessage({
            userMessage: 'покажи космос'
        });
        expect(cosmosRes.action).toEqual({ type: 'set_base_layer', layer: 'satellite' });
        expect(cosmosRes.reply).toContain('сверху из космоса');
    });

    it('покрывает legacy параметры pointData/forecastData/historyData и оффлайн-fallback ветки в sendChatMessage', async () => {
        aiRouter.routeRequest.mockResolvedValue(null);
        axios.post.mockResolvedValue({
            data: { choices: [{ message: { content: 'Анализ готов!' } }] }
        });

        const legacyRes = await aiService.sendChatMessage({
            userMessage: 'качество воздуха',
            pointData: { lat: 55, lon: 37, locationName: 'Москва', aqi: 15, level: 'Отлично', pm25: 10, pm10: 20 },
            forecastData: [{ day: 'Завтра', aqi: 20, minAqi: 15, maxAqi: 25, pm25: 10 }],
            historyData: { peakAqi: 150, peakDate: '26 октября, 12:00' }
        });
        expect(legacyRes.reply).toBeDefined();

        axios.post.mockRejectedValueOnce(new Error('llm down'));
        const errAllDaysRes = await aiService.sendChatMessage({
            userMessage: 'все дни аналитика',
            pointAnalytics: {
                locationName: 'Казань',
                allDaysSummary: { totalDaysCount: 11, overallAvgAqi: 30, overallMaxAqi: { aqi: 50, label: 'пн' }, overallMinAqi: { aqi: 10, label: 'вт' } }
            }
        });
        expect(errAllDaysRes.reply).toContain('все 11 дней');

        axios.post.mockRejectedValueOnce(new Error('llm down'));
        const errHistRes = await aiService.sendChatMessage({
            userMessage: 'вчера воздух',
            pointAnalytics: {
                locationName: 'Казань',
                historyData: { pastDays: [{ avgAqi: 20, status: 'Хорошо', maxAqi: 30, maxAqiTime: '12:00' }] }
            }
        });
        expect(errHistRes.reply).toContain('Вчера');

        axios.post.mockRejectedValueOnce(new Error('llm down'));
        const errFcastRes = await aiService.sendChatMessage({
            userMessage: 'прогноз на 3 дня',
            pointAnalytics: {
                locationName: 'Казань',
                forecast3Days: { days: [{ dayLabel: 'Ср', avgAqi: 20, status: 'Хорошо', minAqi: 15, maxAqi: 25 }] }
            }
        });
        expect(errFcastRes.reply).toContain('прогноз качества воздуха');

        axios.post.mockRejectedValueOnce(new Error('llm down'));
        const errNavRes = await aiService.sendChatMessage({
            userMessage: 'перейди в Казань и проверь воздух'
        });
        expect(errNavRes.action).toEqual(expect.objectContaining({ type: 'set_location' }));

        const httpErr = new Error('Gateway Error');
        httpErr.response = { status: 502, data: { error: { message: 'Bad Gateway' } } };
        axios.post.mockRejectedValueOnce(httpErr);
        const errNetRes = await aiService.sendChatMessage({
            userMessage: 'произвольный текст без города'
        });
        expect(errNetRes.error).toBe(true);
        expect(errNetRes.reply).toContain('502');

        expect(aiService.generateFullAnalyticsReply(null)).toBeNull();
        const fullHigh = aiService.generateFullAnalyticsReply({
            locationName: 'Омск',
            aqi: 80,
            pm2_5: 60,
            historyData: { pastMaxAqi: { aqi: 90, label: 'ср' }, pastAvgAqi: 50 },
            forecast3Days: { periodAvgAqi: 40, periodMinAqi: 20, periodMaxAqi: 60 }
        });
        expect(fullHigh.emotion).toBe('think');

        expect(aiService.detectMapLayerIntent('включи спутник')).toBe('satellite');
        expect(aiService.detectMapLayerIntent('включи схему')).toBe('osm');
        expect(aiService.detectMapLayerIntent('выключи спутник')).toBe('osm');
        expect(aiService.detectMapLayerIntent('как включить спутник?')).toBeNull();
        expect(aiService.detectMapLayerIntent(null)).toBeNull();

        expect(aiService.detectActionFromReply('произвольный ответ без действия')).toBeNull();
        expect(aiService.detectActionFromReply('хмпф, нет такого режима')).toBeNull();
        expect(aiService.detectActionFromReply('переключаю на спутник')).toEqual({ type: 'set_base_layer', layer: 'satellite' });
        expect(aiService.detectActionFromReply('возвращаю схему')).toEqual({ type: 'set_base_layer', layer: 'osm' });
        expect(aiService.detectActionFromReply('переключаю на тёмную тему')).toEqual({ type: 'set_theme', theme: 'dark' });
        expect(aiService.detectActionFromReply('возвращаю светлую тему')).toEqual({ type: 'set_theme', theme: 'light' });
        expect(aiService.detectActionFromReply('отключаю дальтонизм')).toEqual({ type: 'set_colorblind', enabled: false });
        expect(aiService.detectActionFromReply('включаю дейтеранопию')).toEqual({ type: 'set_colorblind', enabled: true, colorBlindType: 'deuteranopia' });
        expect(aiService.detectActionFromReply('включаю протанопию')).toEqual({ type: 'set_colorblind', enabled: true, colorBlindType: 'protanopia' });
        expect(aiService.detectActionFromReply('включаю тританопию')).toEqual({ type: 'set_colorblind', enabled: true, colorBlindType: 'tritanopia' });
        expect(aiService.detectActionFromReply('включаю палитру окабе')).toEqual({ type: 'set_colorblind', enabled: true, colorBlindType: 'okabe' });
    });

    it('покрывает граничные ветки generatePointAnalyticsReply и очистки ответа', async () => {
        const ptData = {
            locationName: 'Самара',
            aqi: 35,
            pm2_5: 15,
            allDaysSummary: { totalDaysCount: 11, overallAvgAqi: 25 },
            historyData: { pastDays: [{ avgAqi: 20 }] },
            forecast3Days: { days: [{ dayLabel: 'Чт', avgAqi: 22 }] }
        };

        expect(aiService.generatePointAnalyticsReply({ aqi: 15, locationName: 'Мск' }, 'воздух').reply).toContain('Отлично');
        expect(aiService.generatePointAnalyticsReply({ aqi: 35, locationName: 'Мск' }, 'воздух').reply).toContain('Хорошо');
        expect(aiService.generatePointAnalyticsReply({ aqi: 55, locationName: 'Мск' }, 'воздух').reply).toContain('Удовлетворительно');
        expect(aiService.generatePointAnalyticsReply({ aqi: 75, locationName: 'Мск' }, 'воздух').reply).toContain('Плохо');
        expect(aiService.generatePointAnalyticsReply({ aqi: 110, locationName: 'Мск' }, 'воздух').reply).toContain('Опасно');

        expect(aiService.generateForecastReply(null)).toBeNull();
        expect(aiService.generateAllDaysReply(null)).toBeNull();
        expect(aiService.generateHistoryReply(null)).toBeNull();

        expect(aiService.generatePointAnalyticsReply({ aqi: null }, 'анализ').reply).toContain('подгружаются');
        expect(aiService.generatePointAnalyticsReply({ aqi: 15, locationName: 'Мск' }, 'структура').reply).toContain('Отлично');
        expect(aiService.generatePointAnalyticsReply({ aqi: 35, locationName: 'Мск' }, 'рекомендации').reply).toContain('Хорошо');
        expect(aiService.generatePointAnalyticsReply({ aqi: 55, locationName: 'Мск' }, 'совет').reply).toContain('Удовлетворительно');
        expect(aiService.generatePointAnalyticsReply({ aqi: 75, locationName: 'Мск' }, 'подробно').reply).toContain('Плохо');
        expect(aiService.generatePointAnalyticsReply({ aqi: 95, locationName: 'Мск' }, 'подробно').reply).toContain('Очень плохо');
        expect(aiService.generatePointAnalyticsReply({ aqi: 150, locationName: 'Мск' }, 'подробно').reply).toContain('Опасно');
        expect(aiService.generatePointAnalyticsReply({ aqi: 50, pm2_5: null, pm10: null, no2: null }, 'воздух').reply).toBeDefined();

        const histLegacyAvg = aiService.generateHistoryReply({ maxAqi: 40, maxAqiLabel: 'пн', minAqi: 10, avgAqi: 20, days: [{ dayLabel: 'пн', avgAqi: 20 }] }, 'Томск', 'средний воздух');
        expect(histLegacyAvg.reply).toContain('20');
        const histLegacyPeak = aiService.generateHistoryReply({ maxAqi: 40, maxAqiLabel: 'пн', minAqi: 10 }, 'Томск', 'пик');
        expect(histLegacyPeak.reply).toContain('40');
        const histLegacyMin = aiService.generateHistoryReply({ minAqi: 10 }, 'Томск', 'чистый воздух');
        expect(histLegacyMin.reply).toContain('10');
        const histLegacyYest = aiService.generateHistoryReply({ days: [{ avgAqi: 20, status: 'Хорошо', maxAqi: 25 }] }, 'Томск', 'вчера');
        expect(histLegacyYest.reply).toContain('Вчера');
        const histLegacyEmpty = aiService.generateHistoryReply({}, 'Томск', 'история');
        expect(histLegacyEmpty.reply).toBeDefined();

        const fcastHigh = aiService.generateForecastReply({ days: [{ dayLabel: 'Вт', avgAqi: null, minAqi: null, maxAqi: null }], periodAvgAqi: 65, periodMinAqi: 40, periodMaxAqi: 80 }, 'Томск');
        expect(fcastHigh.reply).toContain('Местами воздух загрязняется');
        const fcastNoAvg = aiService.generateForecastReply({ days: [{ dayLabel: 'Вт', avgAqi: 20, minAqi: 15, maxAqi: 25 }], periodAvgAqi: null }, 'Томск');
        expect(fcastNoAvg.reply).toBeDefined();

        expect(aiService.extractCityIntent('какие города поддерживаются?')).toBeNull();
        expect(aiService.extractCityIntent('про воздух в городе Самара')).toBe('Самара');

        expect(aiService.extractCityIntent('темная тема')).toBeNull();
        expect(aiService.extractCityIntent('в текущей точке')).toBeNull();

        await expect(aiService.resolveCity(null)).resolves.toBeNull();
        await expect(aiService.resolveCity('сейчас')).resolves.toBeNull();
        await expect(aiService.resolveCity('питер')).resolves.toEqual(expect.objectContaining({ lat: expect.any(Number) }));
        await expect(aiService.resolveCity('екб')).resolves.toEqual(expect.objectContaining({ lat: expect.any(Number) }));
        await expect(aiService.resolveCity('нск')).resolves.toEqual(expect.objectContaining({ lat: expect.any(Number) }));
        await expect(aiService.resolveCity('самару')).resolves.toEqual(expect.objectContaining({ lat: expect.any(Number) }));
        await expect(aiService.resolveCity('казани')).resolves.toEqual(expect.objectContaining({ lat: expect.any(Number) }));

        expect(aiService.extractCityIntent('поехали в Самару')).toBe('Самару');
        expect(aiService.extractCityIntent('слетай в Казань')).toBe('Казань');
        expect(aiService.extractCityIntent('покажи Екатеринбург')).toBe('Екатеринбург');

        expect(aiService.extractCityIntent('покажи подробную аналитику по городу Омск')).toBe('Омск');
        expect(aiService.extractCityIntent('сводка по Казани')).toBe('Казани');
        expect(aiService.extractCityIntent('анализ о Самаре')).toBe('Самаре');
        expect(aiService.extractCityIntent('про погоду на Сахалине')).toBe('Сахалине');
        expect(aiService.extractCityIntent('про замеры по Казани')).toBe('Казани');
        expect(aiService.extractCityIntent('про аналитику в Самаре')).toBe('Самаре');
        expect(aiService.extractCityIntent('камеру в Москву на карте')).toBe('Москву');
        expect(aiService.extractCityIntent('в городе Уфа')).toBe('Уфа');
        expect(aiService.extractCityIntent('до Красноярска')).toBe('Красноярска');

        aiRouter.routeRequest.mockResolvedValue(null);

        axios.post.mockResolvedValueOnce({ data: { choices: [{ message: { content: 'ок [action:colorblind:off]' } }] } });
        expect((await aiService.sendChatMessage({ userMessage: 'выключи' })).action).toEqual({ type: 'set_colorblind', enabled: false });

        axios.post.mockResolvedValueOnce({ data: { choices: [{ message: { content: 'ок [action:colorblind:false]' } }] } });
        expect((await aiService.sendChatMessage({ userMessage: 'выключи' })).action).toEqual({ type: 'set_colorblind', enabled: false });

        axios.post.mockResolvedValueOnce({ data: { choices: [{ message: { content: 'ок [action:colorblind:disabled]' } }] } });
        expect((await aiService.sendChatMessage({ userMessage: 'выключи' })).action).toEqual({ type: 'set_colorblind', enabled: false });

        axios.post.mockResolvedValueOnce({ data: { choices: [{ message: { content: 'ок [action:colorblind:protanopia]' } }] } });
        expect((await aiService.sendChatMessage({ userMessage: 'протанопия' })).action).toEqual({ type: 'set_colorblind', enabled: true, colorBlindType: 'protanopia' });

        axios.post.mockResolvedValueOnce({ data: { choices: [{ message: { content: 'ок [action:colorblind:tritanopia]' } }] } });
        expect((await aiService.sendChatMessage({ userMessage: 'тританопия' })).action).toEqual({ type: 'set_colorblind', enabled: true, colorBlindType: 'tritanopia' });

        axios.post.mockResolvedValueOnce({ data: { choices: [{ message: { content: 'ок [action:theme:light]' } }] } });
        expect((await aiService.sendChatMessage({ userMessage: 'свет' })).action).toEqual({ type: 'set_theme', theme: 'light' });

        axios.post.mockResolvedValueOnce({ data: { choices: [{ message: { content: 'ок [action:layer:osm]' } }] } });
        expect((await aiService.sendChatMessage({ userMessage: 'схема' })).action).toEqual({ type: 'set_base_layer', layer: 'osm' });

        aiRouter.routeRequest.mockResolvedValueOnce(null);
        axios.post.mockResolvedValueOnce({
            data: { choices: [{ message: { content: 'летим в точку на карте' } }] }
        });
        const toPointRes = await aiService.sendChatMessage({
            userMessage: 'покажи воздух',
            pointAnalytics: { locationName: 'Казань', aqi: 20 }
        });
        expect(toPointRes.reply).toBeDefined();

        aiRouter.routeRequest.mockResolvedValueOnce(null);
        axios.post.mockResolvedValueOnce({
            data: { choices: [{ message: { content: 'Я умный помощник!' } }] }
        });
        const whoAreYouRes = await aiService.sendChatMessage({
            userMessage: 'кто ты?'
        });
        expect(whoAreYouRes.reply).toContain('Я — Ая');

        aiRouter.routeRequest.mockResolvedValueOnce(null);
        axios.post.mockResolvedValueOnce({
            data: { choices: [{ message: { content: 'A'.repeat(220) + '. Конец длинного ответа' } }] }
        });
        const longRes = await aiService.sendChatMessage({ userMessage: 'длинный ответ' });
        expect(longRes.reply).toBeDefined();

        aiRouter.routeRequest.mockResolvedValueOnce(null);
        geocodingService.search.mockResolvedValueOnce([]);
        axios.post.mockRejectedValueOnce(new Error('offline'));
        const errUnknownCity = await aiService.sendChatMessage({
            userMessage: 'слетай в НесуществующийXYZГород'
        });
        expect(errUnknownCity.reply).toContain('обыскала карту');
    });

    it('покрывает пустой ответ LLM с fallback на аналитику и возможности, зацикливание и cutoff', async () => {
        aiRouter.routeRequest.mockResolvedValue(null);

        axios.post.mockResolvedValueOnce({
            data: { choices: [{ message: { content: '' } }] }
        });
        const emptyCapRes = await aiService.sendChatMessage({ userMessage: 'что ты умеешь' });
        expect(emptyCapRes.reply).toContain('Ая');

        axios.post.mockResolvedValueOnce({
            data: { choices: [{ message: { content: '' } }] }
        });
        const emptyFullRes = await aiService.sendChatMessage({
            userMessage: 'полная аналитика',
            pointAnalytics: { locationName: 'Томск', aqi: 20 }
        });
        expect(emptyFullRes.reply).toContain('полная картина');

        axios.post.mockResolvedValueOnce({
            data: { choices: [{ message: { content: '' } }] }
        });
        const emptyAllDaysRes = await aiService.sendChatMessage({
            userMessage: 'все дни аналитика',
            pointAnalytics: {
                locationName: 'Томск',
                allDaysSummary: { totalDaysCount: 11, overallAvgAqi: 25 }
            }
        });
        expect(emptyAllDaysRes.reply).toContain('все 11 дней');

        axios.post.mockResolvedValueOnce({
            data: { choices: [{ message: { content: '' } }] }
        });
        const emptyHistRes = await aiService.sendChatMessage({
            userMessage: 'вчера воздух',
            pointAnalytics: {
                locationName: 'Томск',
                historyData: { pastDays: [{ avgAqi: 20 }] }
            }
        });
        expect(emptyHistRes.reply).toContain('Вчера');

        axios.post.mockResolvedValueOnce({
            data: { choices: [{ message: { content: '' } }] }
        });
        const emptyFcastRes = await aiService.sendChatMessage({
            userMessage: 'прогноз на 3 дня',
            pointAnalytics: {
                locationName: 'Томск',
                forecast3Days: { days: [{ dayLabel: 'Пн', avgAqi: 20 }] }
            }
        });
        expect(emptyFcastRes.reply).toContain('прогноз качества воздуха');

        axios.post.mockResolvedValueOnce({
            data: { choices: [{ message: { content: '' }, finish_reason: 'length' }] }
        });
        const emptyLenRes = await aiService.sendChatMessage({ userMessage: 'произвольный' });
        expect(emptyLenRes.reply).toContain('слишком длинным');

        axios.post.mockResolvedValueOnce({
            data: {
                choices: [{
                    message: {
                        content: 'Мои знания о мире до 2024 года. Воздух в городе очень чистый и свежий без сомнений'
                    }
                }]
            }
        });
        const cutoffRes = await aiService.sendChatMessage({ userMessage: 'про воздух' });
        expect(cutoffRes.reply).toContain('ня! ✨');

        axios.post.mockResolvedValueOnce({
            data: {
                choices: [{
                    message: {
                        content: 'Погода отличная. Погода отличная. Погода отличная. Дышится легко.'
                    }
                }]
            }
        });
        const dedupRes = await aiService.sendChatMessage({ userMessage: 'про погоду' });
        expect(dedupRes.reply).toContain('Дышится легко');

        axios.post.mockResolvedValueOnce({
            data: {
                choices: [{ message: { content: 'Секундочку! Переключаю карту на OpenStreetMap' } }]
            }
        });
        const osmAlertRes = await aiService.sendChatMessage({ userMessage: 'верни схему карты' });
        expect(osmAlertRes.action).toEqual({ type: 'set_base_layer', layer: 'osm' });

        axios.post.mockResolvedValueOnce({
            data: { choices: [{ message: { content: 'Осторожно! [action:city:Москва]' } }] }
        });
        const currentPtAllDays = await aiService.sendChatMessage({
            userMessage: 'все дни на карте',
            pointAnalytics: { locationName: 'Москва', aqi: 15, allDaysSummary: { totalDaysCount: 11, overallAvgAqi: 20 } }
        });
        expect(currentPtAllDays.reply).toContain('все 11 дней');

        axios.post.mockResolvedValueOnce({
            data: { choices: [{ message: { content: 'Осторожно! [action:city:Москва]' } }] }
        });
        const currentPtHist = await aiService.sendChatMessage({
            userMessage: 'вчера на карте',
            pointAnalytics: { locationName: 'Москва', aqi: 15, historyData: { pastDays: [{ avgAqi: 20 }] } }
        });
        expect(currentPtHist.reply).toContain('Вчера');

        axios.post.mockResolvedValueOnce({
            data: { choices: [{ message: { content: 'Осторожно! [action:city:Москва]' } }] }
        });
        const currentPtFcast = await aiService.sendChatMessage({
            userMessage: 'прогноз на карте',
            pointAnalytics: { locationName: 'Москва', aqi: 15, forecast3Days: { days: [{ dayLabel: 'Пн', avgAqi: 20 }] } }
        });
        expect(currentPtFcast.reply).toContain('прогноз качества воздуха');

        axios.post.mockResolvedValueOnce({
            data: { choices: [{ message: { content: 'Воздух в норме' } }] }
        });
        const aqiThinkRes = await aiService.sendChatMessage({
            userMessage: 'как воздух',
            pointAnalytics: { aqi: 65, locationName: 'Москва' }
        });
        expect(aqiThinkRes.emotion).toBe('think');

        axios.post.mockResolvedValueOnce({
            data: { choices: [{ message: { content: 'Воздух плохой' } }] }
        });
        const aqiAlertRes = await aiService.sendChatMessage({
            userMessage: 'как воздух',
            pointAnalytics: { aqi: 95, locationName: 'Москва' }
        });
        expect(aqiAlertRes.emotion).toBe('alert');

        axios.post.mockResolvedValueOnce({
            data: { choices: [{ message: { content: 'Прогноз на дни' } }] }
        });
        const aqiFcastRes = await aiService.sendChatMessage({
            userMessage: 'прогноз',
            pointAnalytics: { aqi: 'unknown', locationName: 'Москва', forecast3Days: { periodAvgAqi: 75 } }
        });
        expect(aqiFcastRes.emotion).toBe('think');

        axios.post.mockResolvedValueOnce({
            data: { choices: [{ message: { content: 'Вот образцу: [action:theme:dark]' } }] }
        });
        const sampleActionRes = await aiService.sendChatMessage({ userMessage: 'дай образец' });
        expect(sampleActionRes.action).toBeNull();

        axios.post.mockResolvedValueOnce({
            data: { choices: [{ message: { content: 'Б'.repeat(2400) + '. Хвост длиной триста символов ' + 'Г'.repeat(300) } }] }
        });
        const cutoff200Res = await aiService.sendChatMessage({ userMessage: 'длинно' });
        expect(cutoff200Res.reply).toBeDefined();

        axios.post.mockResolvedValueOnce({
            data: { choices: [{ message: { content: 'В'.repeat(2400) + ' Хвост длиной триста символов без знаков ' + 'Д'.repeat(300) } }] }
        });
        const cutoffSpaceRes = await aiService.sendChatMessage({ userMessage: 'длинно без знаков' });
        expect(cutoffSpaceRes.reply).toBeDefined();

        axios.post.mockResolvedValueOnce({
            data: { choices: [{ message: { content: 'Ж'.repeat(220) + '. Обрывок фразы: ' } }] }
        });
        const colonEndRes = await aiService.sendChatMessage({ userMessage: 'обрывок' });
        expect(colonEndRes.reply).toBeDefined();

        const histMinLabel = aiService.generateHistoryReply({ pastMinAqi: { aqi: 10, label: '25 октября' } }, 'Томск', 'какой был минимум');
        expect(histMinLabel.reply).toContain('25 октября');

        expect(aiService.extractCityIntent('кто ты1')).toBeNull();
        expect(aiService.buildPointAnalyticsReply(null)).toBeNull();

        geocodingService.search.mockResolvedValue([{ display_name: 'Тверь, Россия', lat: 56.85, lon: 35.9 }]);
        await expect(aiService.resolveCity('Челябинскую')).resolves.toEqual(expect.objectContaining({ lat: expect.any(Number) }));
        await expect(aiService.resolveCity('в Самаре')).resolves.toEqual(expect.objectContaining({ lat: expect.any(Number) }));
        await expect(aiService.resolveCity('в Новосибирске')).resolves.toEqual(expect.objectContaining({ lat: expect.any(Number) }));
        await expect(aiService.resolveCity('в Твере')).resolves.toEqual(expect.objectContaining({ lat: expect.any(Number) }));

        axios.post.mockResolvedValueOnce({
            data: { choices: [{ message: { content: '[mood:alert] вот ответ' } }] }
        });
        const osmAlertRes2 = await aiService.sendChatMessage({ userMessage: 'верни схему' });
        expect(osmAlertRes2.reply).toContain('Возвращаю привычную схему');

        axios.post.mockResolvedValueOnce({
            data: { choices: [{ message: { content: 'Вот к примеру: [action:set_location:Москва]' } }] }
        });
        const locExampleRes = await aiService.sendChatMessage({ userMessage: 'расскажи про города' });
        expect(locExampleRes.action).toBeNull();

        axios.post.mockResolvedValueOnce({
            data: { choices: [{ message: { content: 'Москва это красивый город' } }] }
        });
        const infoCityRes = await aiService.sendChatMessage({ userMessage: 'расскажи про Москву' });
        expect(infoCityRes.action).toBeNull();

        axios.post.mockResolvedValueOnce({
            data: { choices: [{ message: { content: 'включаю темную тему' } }] }
        });
        const infoThemeRes = await aiService.sendChatMessage({ userMessage: 'почему1' });
        expect(infoThemeRes.action).toBeNull();

        expect(aiService.detectColorBlindIntent('выключи это', { isColorBlind: true })).toEqual({ enabled: false });
        expect(aiService.detectColorBlindIntent('палитра для')).toBeNull();
        expect(aiService.detectColorBlindIntent('режим', { isColorBlind: false, history: null })).toBeNull();
        expect(aiService.detectColorBlindIntent('режим', { isColorBlind: false, history: [{ content: null }] })).toBeNull();

        expect(aiService.extractCityIntent(null)).toBeNull();
        expect(aiService.extractCityIntent(123)).toBeNull();
        expect(aiService.extractCityIntent('темная тема')).toBeNull();
        expect(aiService.extractCityIntent('по текущей точке перейди в Казань')).toBe('Казань');
        expect(aiService.extractCityIntent('покажи аналитику по ')).toBeNull();
        expect(aiService.extractCityIntent('перейди в а')).toBeNull();
        expect(aiService.extractCityIntent('что там по качеству воздуха в я')).toBeNull();
        expect(aiService.extractCityIntent('воздух в я')).toBeNull();
        expect(aiService.extractCityIntent('про воздух в я')).toBeNull();
        expect(aiService.extractCityIntent('про воздух в Москву')).toBe('Москву');
        expect(aiService.extractCityIntent('в Я')).toBeNull();

        expect(aiService.cityMatchesLocation(null, 'Москва')).toBe(false);
        expect(aiService.cityMatchesLocation('Москва', null)).toBe(false);
        expect(aiService.cityMatchesLocation('Самаре', 'Самара')).toBe(true);

        expect(aiService.isNotCityName('')).toBe(true);
        expect(aiService.isNotCityName(null)).toBe(true);

        expect(aiService.toAccusativeCity(null)).toBe('выбранный город');
        expect(aiService.toAccusativeCity(123)).toBe('выбранный город');
        expect(aiService.toAccusativeCity('Москва, Россия')).toBe('Москву');
        expect(aiService.toAccusativeCity('Уфа')).toBe('Уфу');
        expect(aiService.toAccusativeCity('Казань')).toBe('Казань');

        expect(aiService.getCityCandidates(null)).toEqual([]);
        expect(aiService.getCityCandidates(123)).toEqual([]);
        expect(aiService.getCityCandidates('питер')).toEqual(['Санкт-Петербург', 'Питер']);
        expect(aiService.getCityCandidates('мск')).toEqual(['Москва']);
        expect(aiService.getCityCandidates('екб')).toEqual(['Екатеринбург']);
        expect(aiService.getCityCandidates('нск')).toEqual(['Новосибирск']);
        expect(aiService.getCityCandidates('Казани')).toContain('Казань');
        expect(aiService.getCityCandidates('Москву')).toContain('Москва');

        const histFallback = aiService.generateHistoryReply({ maxAqi: 25, minAqi: 8, avgAqi: 15, days: [{ avgAqi: 15, maxAqi: 25, maxAqiTime: '12:00', status: 'Норма' }] }, null, 'вчера');
        expect(histFallback.reply).toContain('12:00');
        expect(histFallback.reply).toContain('выбранной локации');

        const histMax = aiService.generateHistoryReply({ maxAqi: 30 }, 'Москва', 'максимум');
        expect(histMax.reply).toContain('30');

        const allDaysFallback = aiService.generateAllDaysReply({ overallAvgAqi: 10 }, null);
        expect(allDaysFallback.reply).toContain('выбранной локации');
        expect(allDaysFallback.reply).toContain('—');

        const forecastFallback = aiService.generateForecastReply({ days: [{ dayLabel: 'Завтра', avgAqi: null, minAqi: null, maxAqi: null, status: 'Норма' }] }, null);
        expect(forecastFallback.reply).toContain('выбранной локации');
        expect(forecastFallback.reply).toContain('—');
    });
});
