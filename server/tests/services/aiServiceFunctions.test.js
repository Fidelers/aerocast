const aiService = require('../../ai/services/aiService');
const geocodingService = require('../../services/geocodingService');
const axios = require('axios');

jest.mock('../../services/geocodingService');

describe('aiService helper functions and intent detection', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('detectMapLayerIntent', () => {
        it('возвращает null для пустых значений и вопросов', () => {
            expect(aiService.detectMapLayerIntent('')).toBeNull();
            expect(aiService.detectMapLayerIntent(null)).toBeNull();
            expect(aiService.detectMapLayerIntent('какие слои есть?')).toBeNull();
            expect(aiService.detectMapLayerIntent('как переключить карту?')).toBeNull();
        });

        it('распознает включение спутника', () => {
            expect(aiService.detectMapLayerIntent('включи спутник')).toBe('satellite');
            expect(aiService.detectMapLayerIntent('покажи космос')).toBe('satellite');
            expect(aiService.detectMapLayerIntent('переключи на спутниковый снимок')).toBe('satellite');
            expect(aiService.detectMapLayerIntent('спутник')).toBe('satellite');
        });

        it('распознает выключение спутника и возврат osm', () => {
            expect(aiService.detectMapLayerIntent('выключи спутник')).toBe('osm');
            expect(aiService.detectMapLayerIntent('верни схему')).toBe('osm');
            expect(aiService.detectMapLayerIntent('включи osm')).toBe('osm');
            expect(aiService.detectMapLayerIntent('убери спутник')).toBe('osm');
            expect(aiService.detectMapLayerIntent('обычная карта')).toBe('osm');
        });
    });

    describe('detectColorBlindIntent', () => {
        it('возвращает null для вопросов и пустых строк', () => {
            expect(aiService.detectColorBlindIntent('')).toBeNull();
            expect(aiService.detectColorBlindIntent('что такое дальтонизм?')).toBeNull();
        });

        it('распознает отключение режима дальтонизма', () => {
            expect(aiService.detectColorBlindIntent('выключи режим дальтонизма')).toEqual({ enabled: false });
            expect(aiService.detectColorBlindIntent('убери дальтонизм')).toEqual({ enabled: false });
            expect(aiService.detectColorBlindIntent('верни обычные цвета')).toEqual({ enabled: false });
        });

        it('распознает конкретные типы дальтонизма', () => {
            expect(aiService.detectColorBlindIntent('включи режим дейтеранопия')).toEqual({ enabled: true, colorBlindType: 'deuteranopia' });
            expect(aiService.detectColorBlindIntent('включи протанопию')).toEqual({ enabled: true, colorBlindType: 'protanopia' });
            expect(aiService.detectColorBlindIntent('включи тританопию')).toEqual({ enabled: true, colorBlindType: 'tritanopia' });
            expect(aiService.detectColorBlindIntent('включи окабе')).toEqual({ enabled: true, colorBlindType: 'okabe' });
        });

        it('обрабатывает неподдерживаемые типы', () => {
            expect(aiService.detectColorBlindIntent('включи режим ахроматопсия')).toEqual({ unsupported: true });
            expect(aiService.detectColorBlindIntent('включи вид дальтонизма монохромный')).toEqual({ unsupported: true, requested: 'монохромный' });
        });

        it('по умолчанию при фразе "включи дальтонизм" ставит okabe', () => {
            expect(aiService.detectColorBlindIntent('включи дальтонизм')).toEqual({ enabled: true, colorBlindType: 'okabe' });
            expect(aiService.detectColorBlindIntent('дальтонизм')).toEqual({ enabled: true, colorBlindType: 'okabe' });
        });
    });

    describe('detectThemeIntent', () => {
        it('возвращает null для вопросов и пустых строк', () => {
            expect(aiService.detectThemeIntent('')).toBeNull();
            expect(aiService.detectThemeIntent('какая тема лучше?')).toBeNull();
        });

        it('распознает переключение на темную тему', () => {
            expect(aiService.detectThemeIntent('включи темную тему')).toBe('dark');
            expect(aiService.detectThemeIntent('сделай ночной режим')).toBe('dark');
            expect(aiService.detectThemeIntent('поставь темную')).toBe('dark');
        });

        it('распознает переключение на светлую тему', () => {
            expect(aiService.detectThemeIntent('включи светлую тему')).toBe('light');
            expect(aiService.detectThemeIntent('сделай дневной режим')).toBe('light');
            expect(aiService.detectThemeIntent('верни светлую')).toBe('light');
        });
    });

    describe('detectActionFromReply', () => {
        it('извлекает action из естественного языка ответа Аи', () => {
            expect(aiService.detectActionFromReply('Переключаю на тёмную тему, ня! ✨')).toEqual({
                type: 'set_theme',
                theme: 'dark'
            });
            expect(aiService.detectActionFromReply('Возвращаю светлую тему, ня! ✨')).toEqual({
                type: 'set_theme',
                theme: 'light'
            });
            expect(aiService.detectActionFromReply('Переключаю карту на спутниковые снимки, ня! ✨')).toEqual({
                type: 'set_base_layer',
                layer: 'satellite'
            });
            expect(aiService.detectActionFromReply('Возвращаю схему OpenStreetMap, ня! ✨')).toEqual({
                type: 'set_base_layer',
                layer: 'osm'
            });
            expect(aiService.detectActionFromReply('Включаю режим дейтеранопия, ня! ✨')).toEqual({
                type: 'set_colorblind',
                enabled: true,
                colorBlindType: 'deuteranopia'
            });
            expect(aiService.detectActionFromReply('Включаю режим протанопия, ня! ✨')).toEqual({
                type: 'set_colorblind',
                enabled: true,
                colorBlindType: 'protanopia'
            });
            expect(aiService.detectActionFromReply('Включаю режим тританопия, ня! ✨')).toEqual({
                type: 'set_colorblind',
                enabled: true,
                colorBlindType: 'tritanopia'
            });
            expect(aiService.detectActionFromReply('Включаю палитру окабе, ня! ✨')).toEqual({
                type: 'set_colorblind',
                enabled: true,
                colorBlindType: 'okabe'
            });
            expect(aiService.detectActionFromReply('Возвращаю стандартные цвета, ня! ✨')).toEqual({
                type: 'set_colorblind',
                enabled: false
            });
            expect(aiService.detectActionFromReply('Хмпф! Такого режима у нас нет')).toBeNull();
            expect(aiService.detectActionFromReply('просто текст без действий')).toBeNull();
        });
    });

    describe('extractCityIntent & extractCityFromReply', () => {
        it('распознает намерение города из различных фраз', () => {
            expect(aiService.extractCityIntent('что с качеством воздуха в Томске')).toBe('Томске');
            expect(aiService.extractCityIntent('про воздух в Омске')).toBe('Омске');
            expect(aiService.extractCityIntent('какая погода в городе Барнаул')).toBe('Барнаул');
            expect(aiService.extractCityIntent('перейди в Москву')).toBe('Москву');
        });

        it('извлекает город из ответа модели', () => {
            expect(aiService.extractCityFromReply('Перемещаюсь в город Самара, смотрю замеры')).toBe('Самара');
            expect(aiService.extractCityFromReply('Летим в Томск на карте')).toBe('Томск');
            expect(aiService.extractCityFromReply('Никакого города здесь нет')).toBeNull();
        });
    });

    describe('isNotCityName & cityMatchesLocation', () => {
        it('распознает слова, не являющиеся городами', () => {
            expect(aiService.isNotCityName('погода')).toBe(true);
            expect(aiService.isNotCityName('воздух')).toBe(true);
            expect(aiService.isNotCityName('прогноз')).toBe(true);
            expect(aiService.isNotCityName('Кемерово')).toBe(false);
        });

        it('проверяет совпадение города с текущей локацией', () => {
            expect(aiService.cityMatchesLocation('Новокузнецк', 'Новокузнецк, Россия')).toBe(true);
            expect(aiService.cityMatchesLocation('Москва', 'Новокузнецк, Россия')).toBe(false);
            expect(aiService.cityMatchesLocation(null, 'Томск')).toBe(false);
            expect(aiService.cityMatchesLocation('Томск', null)).toBe(false);
        });
    });

    describe('resolveCity', () => {
        it('находит координаты для известных городов', async () => {
            const msk = await aiService.resolveCity('Москва');
            expect(msk).toBeDefined();
            expect(msk.lat).toBeCloseTo(55.75, 1);
            expect(msk.lon).toBeCloseTo(37.61, 1);
            expect(msk.cityName).toContain('Москва');

            const nsk = await aiService.resolveCity('Новосибирск');
            expect(nsk).toBeDefined();
            expect(nsk.cityName).toContain('Новосибирск');

            expect(await aiService.resolveCity('НеизвестныйГород12345')).toBeNull();
        });

        it('использует геокодер для неизвестного в локальной базе города', async () => {
            geocodingService.search.mockResolvedValueOnce([
                { display_name: 'Владивосток, Приморский край, Россия', lat: '43.1155', lon: '131.8855' }
            ]);

            const res = await aiService.resolveCity('Владивосток');
            expect(res).toBeDefined();
            expect(res.lat).toBeCloseTo(43.11, 1);
            expect(res.lon).toBeCloseTo(131.88, 1);
        });
    });

    describe('isAnalyticsQuery', () => {
        it('определяет запросы аналитики качества воздуха', () => {
            expect(aiService.isAnalyticsQuery('какой сейчас воздух?')).toBe(true);
            expect(aiService.isAnalyticsQuery('какой aqi в точке?')).toBe(true);
            expect(aiService.isAnalyticsQuery('сколько pm2.5?')).toBe(true);
            expect(aiService.isAnalyticsQuery('можно ли гулять?')).toBe(true);
            expect(aiService.isAnalyticsQuery('привет как дела')).toBe(false);
            expect(aiService.isAnalyticsQuery('кто тебя создал?')).toBe(false);
        });
    });

    describe('Шаблонизаторы ответов аналитики и уровни AQI', () => {
        const mockPointAnalytics = {
            locationName: 'Кемерово',
            aqi: 32,
            pm2_5: 14.5,
            historyData: {
                pastDaysCount: 7,
                pastMaxAqi: { aqi: 45, label: 'Понедельник, 15:00' },
                pastMinAqi: { aqi: 12, label: 'Среда, 04:00' },
                pastAvgAqi: 22,
                pastAvgPm25: 11
            },
            forecast3Days: {
                periodAvgAqi: 25,
                periodMinAqi: 18,
                periodMaxAqi: 35,
                periodAvgPm25: 12,
                days: [
                    { dayLabel: 'Завтра', avgAqi: 22, status: 'Хорошо' }
                ]
            },
            allDaysSummary: {
                totalDaysCount: 11,
                overallAvgAqi: 24,
                overallMaxAqi: { aqi: 50, label: 'Пн' },
                overallMinAqi: { aqi: 10, label: 'Вс' },
                overallAvgPm25: 12
            }
        };

        it('generatePointAnalyticsReply генерирует ответ о текущем воздухе для разных уровней AQI', () => {
            const res32 = aiService.generatePointAnalyticsReply(mockPointAnalytics, 'какой сейчас воздух?');
            expect(res32.reply).toContain('Кемерово');
            expect(res32.reply).toContain('32');
            expect(res32.emotion).toBe('happy');

            const res55 = aiService.generatePointAnalyticsReply({ ...mockPointAnalytics, aqi: 55 });
            expect(res55.reply).toContain('Удовлетворительно');
            expect(res55.emotion).toBe('think');

            const res75 = aiService.generatePointAnalyticsReply({ ...mockPointAnalytics, aqi: 75 });
            expect(res75.reply).toContain('Плохо');
            expect(res75.emotion).toBe('alert');

            const res110 = aiService.generatePointAnalyticsReply({ ...mockPointAnalytics, aqi: 110 });
            expect(res110.reply).toContain('Опасно');
            expect(res110.emotion).toBe('alert');
        });

        it('generateForecastReply генерирует ответ по прогнозу на 3 дня', () => {
            const res = aiService.generateForecastReply(mockPointAnalytics.forecast3Days, mockPointAnalytics.locationName);
            expect(res.reply).toContain('прогноз');
            expect(res.reply).toContain('25');
        });

        it('generateHistoryReply генерирует ответ по архиву за прошлые дни', () => {
            const res = aiService.generateHistoryReply(mockPointAnalytics.historyData, mockPointAnalytics.locationName);
            expect(res.reply).toContain('архив');
            expect(res.reply).toContain('22');
        });

        it('generateAllDaysReply генерирует ответ по всем 11 дням', () => {
            const res = aiService.generateAllDaysReply(mockPointAnalytics.allDaysSummary, mockPointAnalytics.locationName);
            expect(res.reply).toContain('11 дней');
            expect(res.reply).toContain('24');
        });

        it('generateFullAnalyticsReply генерирует комплексную аналитику', () => {
            const res = aiService.generateFullAnalyticsReply(mockPointAnalytics);
            expect(res.reply).toContain('Кемерово');
            expect(res.reply).toContain('архив');
        });
    });

    describe('sendChatMessage интеграция с legacy pointData/forecastData/historyData', () => {
        it('собирает pointAnalytics из отдельных полей pointData, forecastData, historyData', async () => {
            const result = await aiService.sendChatMessage({
                userMessage: 'какой воздух?',
                pointData: { lat: 55.75, lon: 37.61, aqi: 15, level: 'Отлично', pm25: 10, pm10: 20 },
                forecastData: [{ day: 'Завтра', aqi: 18, minAqi: 15, maxAqi: 22, level: 'Отлично' }],
                historyData: { peakAqi: 40, peakDate: '26 октября' }
            });

            expect(result).toBeDefined();
            expect(result.reply).toContain('Точка (55.75, 37.61)');
            expect(result.reply).toContain('15');
        });
    });

    describe('transcribeAudio', () => {
        it('выбрасывает ошибку, так как локальный Whisper не подключен', async () => {
            await expect(aiService.transcribeAudio({ audioBase64: 'base64...' }))
                .rejects.toThrow('Транскрипция аудио пока не поддерживается локальной моделью.');
        });
    });
    describe('ensureFemininePersonaReply & aqiToEmotion branches', () => {
        it('покрывает оффлайн-fallback для аналитики (прогноз, архив, все дни)', async () => {
            const pointAnalytics = {
                locationName: 'Кемерово',
                aqi: 70,
                historyData: {
                    pastDaysCount: 7,
                    pastMaxAqi: { aqi: 45, label: 'Понедельник' },
                    pastAvgAqi: 22
                },
                forecast3Days: {
                    days: [{ dayLabel: 'Завтра', avgAqi: 25 }],
                    periodAvgAqi: 25
                },
                allDaysSummary: {
                    totalDaysCount: 11,
                    overallAvgAqi: 24
                }
            };

            const resForecast = await aiService.sendChatMessage({
                userMessage: 'какой прогноз на 3 дня?',
                pointAnalytics
            });
            expect(resForecast.reply).toContain('прогноз');

            const resHistory = await aiService.sendChatMessage({
                userMessage: 'какой архив за прошлые дни?',
                pointAnalytics
            });
            expect(resHistory.reply).toContain('архив');

            const resAllDays = await aiService.sendChatMessage({
                userMessage: 'какие показатели за все дни?',
                pointAnalytics
            });
            expect(resAllDays.reply).toContain('11 дней');
        });

        it('проверяет переключение слоев карты в оффлайн-fallback', async () => {
            const resSat = await aiService.sendChatMessage({
                userMessage: 'включи спутник'
            });
            expect(resSat.action).toEqual({ type: 'set_base_layer', layer: 'satellite' });

            const resOsm = await aiService.sendChatMessage({
                userMessage: 'выключи спутник', currentLayer: 'satellite'
            });
            expect(resOsm.action).toEqual({ type: 'set_base_layer', layer: 'osm' });
        });

        it('проверяет переключение тем и дальтонизма в оффлайн-fallback', async () => {
            const resTheme = await aiService.sendChatMessage({
                userMessage: 'включи темную тему'
            });
            expect(resTheme.action).toEqual({ type: 'set_theme', theme: 'dark' });

            const resCb = await aiService.sendChatMessage({
                userMessage: 'включи режим дейтеранопия'
            });
            expect(resCb.action).toEqual({
                type: 'set_colorblind',
                enabled: true,
                colorBlindType: 'deuteranopia'
            });
        });
    });

});
