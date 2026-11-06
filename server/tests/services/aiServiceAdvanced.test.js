const aiService = require('../../ai/services/aiService');
const axios = require('axios');

describe('aiService advanced coverage for LLM response post-processing', () => {
    const mockPointAnalytics = {
        locationName: 'Кемерово',
        aqi: 25,
        historyData: { pastDaysCount: 7, pastAvgAqi: 20 },
        forecast3Days: { days: [{ dayLabel: 'Завтра', avgAqi: 22 }], periodAvgAqi: 22 },
        allDaysSummary: { totalDaysCount: 11, overallAvgAqi: 21 }
    };

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('обрабатывает пустой ответ от LLM для разных типов аналитических запросов', async () => {
        const mockEmpty = {
            data: { choices: [{ message: { content: '   ' }, finish_reason: 'stop' }] }
        };

        jest.spyOn(axios, 'post').mockResolvedValue(mockEmpty);

        const resFull = await aiService.sendChatMessage({
            userMessage: 'покажи полную аналитику',
            pointAnalytics: mockPointAnalytics,
            isFollowUpAnalytics: true
        });
        expect(resFull.reply).toContain('Кемерово');

        const resAllDays = await aiService.sendChatMessage({
            userMessage: 'показатели за все дни',
            pointAnalytics: mockPointAnalytics,
            isFollowUpAnalytics: true
        });
        expect(resAllDays.reply).toContain('11 дней');

        const resHist = await aiService.sendChatMessage({
            userMessage: 'архив за прошлые дни',
            pointAnalytics: mockPointAnalytics,
            isFollowUpAnalytics: true
        });
        expect(resHist.reply).toContain('архив');

        const resForecast = await aiService.sendChatMessage({
            userMessage: 'какой прогноз на 3 дня',
            pointAnalytics: mockPointAnalytics,
            isFollowUpAnalytics: true
        });
        expect(resForecast.reply).toContain('прогноз');

        const resPoint = await aiService.sendChatMessage({
            userMessage: 'какой сейчас воздух в точке',
            pointAnalytics: mockPointAnalytics,
            isFollowUpAnalytics: true
        });
        expect(resPoint.reply).toContain('25');
    });

    it('обрабатывает пустой ответ от LLM без аналитики с finish_reason length и stop', async () => {
        jest.spyOn(axios, 'post')
            .mockResolvedValueOnce({
                data: { choices: [{ message: { content: '' }, finish_reason: 'length' }] }
            })
            .mockResolvedValueOnce({
                data: { choices: [{ message: { content: '' }, finish_reason: 'stop' }] }
            });

        const resLength = await aiService.sendChatMessage({ userMessage: 'расскажи очень длинную историю', isFollowUpAnalytics: true });
        expect(resLength.reply).toContain('Ответ получился слишком длинным');

        const resStop = await aiService.sendChatMessage({ userMessage: 'просто скажи что-нибудь', isFollowUpAnalytics: true });
        expect(resStop.reply).toContain('локальная модель вернула пустой ответ');
    });

    it('заменяет сторонних разработчиков на Николаева Артёма и очищает упоминания DICPlay', async () => {
        jest.spyOn(axios, 'post').mockResolvedValueOnce({
            data: {
                choices: [{
                    message: { content: 'Я русскоязычный ИИ-ассистент от компании DICPlay, созданный Даниилом Кириллиным.' },
                    finish_reason: 'stop'
                }]
            }
        });

        const res = await aiService.sendChatMessage({ userMessage: 'кто тебя создал?', isFollowUpAnalytics: true });
        expect(res.reply).toContain('Николаев Артём');
        expect(res.reply).not.toContain('DICPlay');
        expect(res.reply).not.toContain('Кириллин');
    });

    it('корректирует ответ на вопрос "какие слои карты"', async () => {
        jest.spyOn(axios, 'post').mockResolvedValueOnce({
            data: {
                choices: [{
                    message: { content: 'У нас есть карта и разные данные.' },
                    finish_reason: 'stop'
                }]
            }
        });

        const res = await aiService.sendChatMessage({ userMessage: 'какие слои карты у вас есть?', isFollowUpAnalytics: true });
        expect(res.reply).toContain('OpenStreetMap');
        expect(res.reply).toContain('ESRI World Imagery');
    });

    it('перехватывает код в ответе модели и заменяет на отказ', async () => {
        jest.spyOn(axios, 'post').mockResolvedValueOnce({
            data: {
                choices: [{
                    message: { content: 'Вот код: def solve(): return 42' },
                    finish_reason: 'stop'
                }]
            }
        });

        const res = await aiService.sendChatMessage({ userMessage: 'дай решение', isFollowUpAnalytics: true });
        expect(res.reply).toContain('а не генератор кода');
        expect(res.emotion).toBe('alert');
    });

    it('перехватывает зависание на аналитике (IS_STALLING_ON_ANALYTICS)', async () => {
        jest.spyOn(axios, 'post').mockResolvedValueOnce({
            data: {
                choices: [{
                    message: { content: 'Это довольно объемная задача, дай мне знать если...' },
                    finish_reason: 'stop'
                }]
            }
        });

        const res = await aiService.sendChatMessage({
            userMessage: 'покажи полную аналитику по городу',
            pointAnalytics: mockPointAnalytics,
            isFollowUpAnalytics: true
        });
        expect(res.reply).toContain('Кемерово');
    });

    it('корректирует ответ при включении дальтонизма без уточнения режима', async () => {
        jest.spyOn(axios, 'post').mockResolvedValueOnce({
            data: {
                choices: [{
                    message: { content: 'Включаю режим, но ты же не уточнил какой именно режим дальтонизма нужен.' },
                    finish_reason: 'stop'
                }]
            }
        });

        const res = await aiService.sendChatMessage({
            userMessage: 'включи режим доступности для дальтоников',
            isFollowUpAnalytics: true
        });
        expect(res.action?.type).toBe('set_colorblind');
        expect(res.reply).toContain('палитрой Окабе по умолчанию');
    });

    it('переключает эмоции в зависимости от вопроса и уровня AQI', async () => {
        jest.spyOn(axios, 'post')
            .mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: { content: '[mood:happy] Озон образуется в воздухе.' },
                        finish_reason: 'stop'
                    }]
                }
            })
            .mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: { content: '[mood:happy] Внимание, зафиксирован вредный пик!' },
                        finish_reason: 'stop'
                    }]
                }
            });

        const resThink = await aiService.sendChatMessage({
            userMessage: 'что такое приземный озон?',
            isFollowUpAnalytics: true
        });
        expect(resThink.emotion).toBe('think');

        const resPeak = await aiService.sendChatMessage({
            userMessage: 'какой был пик загрязнения?',
            isFollowUpAnalytics: true
        });
        expect(resPeak.emotion).toBe('think');
    });

    it('перехватывает попытку запроса кода напрямую в userMessage', async () => {
        const res = await aiService.sendChatMessage({
            userMessage: 'напиши мне скрипт на python для парсинга'
        });
        expect(res.reply).toContain('репетитор по программированию');
        expect(res.emotion).toBe('alert');
    });
    it('обрабатывает усечение слишком длинного ответа модели (> charLimit)', async () => {
        const longReply = 'Предложение один. '.repeat(100);
        jest.spyOn(axios, 'post').mockResolvedValueOnce({
            data: {
                choices: [{
                    message: { content: longReply },
                    finish_reason: 'stop'
                }]
            }
        });

        const res = await aiService.sendChatMessage({
            userMessage: 'расскажи подробно',
            isFollowUpAnalytics: true
        });
        expect(res.reply.length).toBeLessThanOrEqual(1050);
        expect(res.reply).toContain('Предложение один.');
    });

    it('обрабатывает усечение длинного ответа без знаков препинания по пробелу', async () => {
        const longWordyReply = 'слово '.repeat(300);
        jest.spyOn(axios, 'post').mockResolvedValueOnce({
            data: {
                choices: [{
                    message: { content: longWordyReply },
                    finish_reason: 'stop'
                }]
            }
        });

        const res = await aiService.sendChatMessage({
            userMessage: 'расскажи',
            isFollowUpAnalytics: true
        });
        expect(res.reply.length).toBeLessThanOrEqual(1050);
        expect(res.reply).toContain('...');
    });

    it('корректирует грамматику на вопрос "ты мог бы" на "я могла бы"', async () => {
        jest.spyOn(axios, 'post').mockResolvedValueOnce({
            data: {
                choices: [{
                    message: { content: 'Да, я могу рассказать про воздух' },
                    finish_reason: 'stop'
                }]
            }
        });

        const res = await aiService.sendChatMessage({
            userMessage: 'ты мог бы рассказать про воздух?',
            isFollowUpAnalytics: true
        });
        expect(res.reply).toContain('могла бы');
    });

    it('добавляет имя Ая если модель не назвала себя на вопрос "как тебя зовут"', async () => {
        jest.spyOn(axios, 'post').mockResolvedValueOnce({
            data: {
                choices: [{
                    message: { content: 'Я просто маскот AeroCast для мониторинга' },
                    finish_reason: 'stop'
                }]
            }
        });

        const res = await aiService.sendChatMessage({
            userMessage: 'как тебя зовут?',
            isFollowUpAnalytics: true
        });
        expect(res.reply).toContain('Ая');
    });

    it('добавляет фразу "я сама всё проверила" на вопрос "ты сам проверил"', async () => {
        jest.spyOn(axios, 'post').mockResolvedValueOnce({
            data: {
                choices: [{
                    message: { content: 'Все замеры точные.' },
                    finish_reason: 'stop'
                }]
            }
        });

        const res = await aiService.sendChatMessage({
            userMessage: 'ты сам проверил эти датчики?',
            isFollowUpAnalytics: true
        });
        expect(res.reply).toContain('сама всё проверила');
    });

    it('распознает перемещение в город из текста ответа модели', async () => {
        const oldJev = process.env.JEV_ENABLED;
        process.env.JEV_ENABLED = 'false';
        try {
            jest.spyOn(axios, 'post').mockResolvedValue({
                data: {
                    choices: [{
                        message: { content: 'Перехожу в город Новосибирск на карте, смотрю датчики.' },
                        finish_reason: 'stop'
                    }]
                }
            });

            const res = await aiService.sendChatMessage({
                userMessage: 'поехали',
                isFollowUpAnalytics: false
            });
            expect(res.action?.type).toBe('set_location');
            expect(res.action?.cityName).toContain('Новосибирск');
        } finally {
            process.env.JEV_ENABLED = oldJev;
        }
    });

    it('добавляет женские реплики для вопросов ты сама видела и ты когда-нибудь ошибался', async () => {
        const oldJev = process.env.JEV_ENABLED;
        process.env.JEV_ENABLED = 'false';
        try {
            jest.spyOn(axios, 'post').mockResolvedValue({
                data: {
                    choices: [{
                        message: { content: 'Датчики зафиксировали плотный дым.' },
                        finish_reason: 'stop'
                    }]
                }
            });

            const res1 = await aiService.sendChatMessage({
                userMessage: 'ты сама видела?',
                isFollowUpAnalytics: true
            });
            expect(res1.reply).toContain('Я сама видела');

            const res2 = await aiService.sendChatMessage({
                userMessage: 'ты когда-нибудь ошибался?',
                isFollowUpAnalytics: true
            });
            expect(res2.reply).toContain('Я стараюсь быть точной');
        } finally {
            process.env.JEV_ENABLED = oldJev;
        }
    });

    it('переключает эмоцию alert на think при информационном вопросе (IS_INFO_Q)', async () => {
        const oldJev = process.env.JEV_ENABLED;
        process.env.JEV_ENABLED = 'false';
        try {
            jest.spyOn(axios, 'post').mockResolvedValue({
                data: {
                    choices: [{
                        message: { content: '[mood:alert] Это диоксид азота из выхлопных газов.' },
                        finish_reason: 'stop'
                    }]
                }
            });

            const res = await aiService.sendChatMessage({
                userMessage: 'что такое диоксид азота?',
                isFollowUpAnalytics: true
            });
            expect(res.emotion).toBe('think');
        } finally {
            process.env.JEV_ENABLED = oldJev;
        }
    });

    it('переключает эмоцию на happy при выполнении команды действия (action)', async () => {
        const oldJev = process.env.JEV_ENABLED;
        process.env.JEV_ENABLED = 'false';
        try {
            jest.spyOn(axios, 'post').mockResolvedValue({
                data: {
                    choices: [{
                        message: { content: '[action:set_theme:dark][mood:alert] Переключаю на тёмную тему.' },
                        finish_reason: 'stop'
                    }]
                }
            });

            const res = await aiService.sendChatMessage({
                userMessage: 'сделай темную тему',
                isFollowUpAnalytics: false
            });
            expect(res.action?.type).toBe('set_theme');
            expect(res.emotion).toBe('happy');
        } finally {
            process.env.JEV_ENABLED = oldJev;
        }
    });

    it('определяет целевую эмоцию из периода прогноза, если текущий aqi не задан', async () => {
        const oldJev = process.env.JEV_ENABLED;
        process.env.JEV_ENABLED = 'false';
        try {
            jest.spyOn(axios, 'post').mockResolvedValue({
                data: {
                    choices: [{
                        message: { content: 'Вот данные по прогнозу.' },
                        finish_reason: 'stop'
                    }]
                }
            });

            const res = await aiService.sendChatMessage({
                userMessage: 'прогноз на несколько дней',
                pointAnalytics: {
                    forecast3Days: { periodAvgAqi: 25 }
                },
                isFollowUpAnalytics: true
            });
            expect(res.emotion).toBe('happy');
        } finally {
            process.env.JEV_ENABLED = oldJev;
        }
    });

    it('извлекает переключение темы и слоя из текста ответа модели без явных тегов', async () => {
        const oldJev = process.env.JEV_ENABLED;
        process.env.JEV_ENABLED = 'false';
        try {
            jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: { content: 'Активирую тёмную тему оформления приложения, ня!' },
                        finish_reason: 'stop'
                    }]
                }
            });

            const resTheme = await aiService.sendChatMessage({
                userMessage: 'сделай темно',
                isFollowUpAnalytics: false
            });
            expect(resTheme.action?.type).toBe('set_theme');
            expect(resTheme.action?.theme).toBe('dark');

            jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: { content: 'Включаю спутниковый снимок на карте местности, ня!' },
                        finish_reason: 'stop'
                    }]
                }
            });

            const resLayer = await aiService.sendChatMessage({
                userMessage: 'вруби спутник',
                isFollowUpAnalytics: false
            });
            expect(resLayer.action?.type).toBe('set_base_layer');
            expect(resLayer.action?.layer).toBe('satellite');
        } finally {
            process.env.JEV_ENABLED = oldJev;
        }
    });

});
