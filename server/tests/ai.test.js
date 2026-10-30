process.env.JEV_ENABLED = 'false';
const request = require('supertest');
const app = require('../server');
const aiService = require('../ai/services/aiService');

describe('AI Module & Local LLM endpoints', () => {
    beforeAll(() => {
        process.env.JEV_ENABLED = 'false';
    });
    afterAll(async () => {
        await app.stopServer();
    });

    describe('GET /api/ai/status', () => {
        it('возвращает статус модуля AI и активную модель', async () => {
            const res = await request(app).get('/api/ai/status');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
            expect(res.body.model).toBeDefined();
            expect(res.body).toHaveProperty('hasApiKey');
        });
    });

    describe('POST /api/ai/chat', () => {
        it('возвращает ошибку 400 при пустом сообщении', async () => {
            const res = await request(app)
                .post('/api/ai/chat')
                .send({ message: '   ' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBeDefined();
        });

        it('корректно возвращает action при переключении слоев карты', async () => {
            const spy = jest.spyOn(aiService, 'sendChatMessage').mockResolvedValueOnce({
                reply: 'Включаю спутник, ня!',
                model: 'gemma-4-E2B-it-Q4_K_M',
                emotion: 'happy',
                action: { type: 'set_base_layer', layer: 'satellite' }
            });

            const res = await request(app)
                .post('/api/ai/chat')
                .send({ message: 'Включи спутник', currentLayer: 'osm' });

            expect(res.status).toBe(200);
            expect(res.body.action).toEqual({ type: 'set_base_layer', layer: 'satellite' });
            expect(spy).toHaveBeenCalledWith(expect.objectContaining({ currentLayer: 'osm' }));
            spy.mockRestore();
        });

        it('корректно обрабатывает мокнутый успешный ответ Local LLM', async () => {
            const spy = jest.spyOn(aiService, 'sendChatMessage').mockResolvedValueOnce({
                reply: 'Привет! Я Ани, чем могу помочь?',
                model: 'am/free',
                emotion: 'happy'
            });

            const res = await request(app)
                .post('/api/ai/chat')
                .send({ message: 'Привет Ани' });

            expect(res.status).toBe(200);
            expect(res.body.reply).toBe('Привет! Я Ани, чем могу помочь?');
            expect(res.body.emotion).toBe('happy');
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });

        it('разрешает CORS для мобильных устройств в локальной сети (192.168.x.x) и портов разработки', async () => {
            const spy = jest.spyOn(aiService, 'sendChatMessage').mockResolvedValueOnce({
                reply: 'Привет с мобильного!',
                model: 'am/free',
                emotion: 'idle'
            });

            const res = await request(app)
                .post('/api/ai/chat')
                .set('Origin', 'http://192.168.1.120:5173')
                .send({ message: 'Привет с мобильного' });

            expect(res.status).not.toBe(403);
            expect(res.headers['access-control-allow-origin']).toBe('http://192.168.1.120:5173');
            spy.mockRestore();
        });
    });

    describe('POST /api/ai/transcribe', () => {
        it('возвращает 400 если аудио не передано или пустое', async () => {
            const res = await request(app)
                .post('/api/ai/transcribe')
                .send({ audio: '   ' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBeDefined();
        });

        it('возвращает 200 и текст при успешной транскрипции аудио', async () => {
            const spy = jest.spyOn(aiService, 'transcribeAudio').mockResolvedValueOnce('Какое качество воздуха в Москве?');

            const res = await request(app)
                .post('/api/ai/transcribe')
                .send({
                    audio: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
                    mimeType: 'audio/webm'
                });

            expect(res.status).toBe(200);
            expect(res.body.text).toBe('Какое качество воздуха в Москве?');
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });

        it('обрабатывает ошибку транскрипции со статусом 500', async () => {
            const spy = jest.spyOn(aiService, 'transcribeAudio').mockRejectedValueOnce(new Error('Whisper API offline'));

            const res = await request(app)
                .post('/api/ai/transcribe')
                .send({
                    audio: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
                    mimeType: 'audio/webm'
                });

            expect(res.status).toBe(500);
            expect(res.body.error).toMatch(/Whisper API offline/);
            spy.mockRestore();
        });
    });

    describe('aiService and promptManager sanitation & anti-looping', () => {
        const axios = require('axios');
        const promptManager = require('../ai/services/promptManager');

        it('системный промпт не содержит триггерных слов вроде "китайский" или "шанс 50%"', () => {
            const prompt = promptManager.getSystemPrompt();
            expect(prompt).not.toMatch(/китайск/i);
            expect(prompt).not.toMatch(/шанс\s*\d+%/i);
            expect(prompt).toMatch(/русском языке/i);
        });

        it('фильтрует просочившиеся иероглифы и устраняет зацикленные повторы', async () => {
            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: '[mood:happy] Я Ая — ассистент по空气质量. Чем помочь? Чем помочь? Чем помочь?'
                        }
                    }]
                }
            });

            const result = await aiService.sendChatMessage({ userMessage: 'Привет' });
            expect(result.emotion).toBe('happy');
            expect(result.reply).not.toMatch(/[\u4e00-\u9fff]/);
            expect(result.reply).toContain('качество воздуха');
            const matches = result.reply.match(/Чем помочь\?/g) || [];
            expect(matches.length).toBeLessThanOrEqual(1);

            axiosSpy.mockRestore();
        });

        it('нормализует мужской род глаголов и местоимений в женский от лица Аи', async () => {
            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: '[mood:happy] Я рад помочь! Я готов показать карту, я сам все проверил.'
                        }
                    }]
                }
            });

            const result = await aiService.sendChatMessage({ userMessage: 'Помоги' });
            expect(result.reply).toContain('Я рада помочь');
            expect(result.reply).toContain('Я готова показать');
            expect(result.reply).toContain('я сама все проверила');

            axiosSpy.mockRestore();
        });

        it('удаляет висячие обрывки нумерации списков (например "5.") в конце ответа', async () => {
            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: '[mood:idle] 1. Проверить воздух;\n2. Надеть маску;\n3.'
                        }
                    }]
                }
            });

            const result = await aiService.sendChatMessage({ userMessage: 'Что делать?' });
            expect(result.reply).not.toMatch(/\b3\.$/);
            expect(result.reply).toContain('2. Надеть маску;');

            axiosSpy.mockRestore();
        });

        it('удаляет упоминания сторонней компании DICPlay из ответа', async () => {
            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: '[mood:happy] Меня зовут Ая. Я — русскоязычный ИИ-ассистент от компании DICPlay. С удовольствием помогу!'
                        }
                    }]
                }
            });

            const result = await aiService.sendChatMessage({ userMessage: 'Кто ты?' });
            expect(result.reply).not.toMatch(/DICPlay/i);
            expect(result.reply).toContain('AeroCast');

            axiosSpy.mockRestore();
        });

        it('заменяет Даниила Кириллина на Николаева Артёма и убирает упоминание "большая языковая модель"', async () => {
            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: '[mood:idle] Я — большая языковая модель AeroCast. Мой создатель и ведущий разработчик — Даниил Кириллин.'
                        }
                    }]
                }
            });

            const result = await aiService.sendChatMessage({ userMessage: 'Кто твой создатель?' });
            expect(result.reply).not.toContain('Даниил Кириллин');
            expect(result.reply).not.toContain('большая языковая модель');
            expect(result.reply).toContain('Николаев Артём');
            expect(result.reply).toContain('маскот AeroCast');

            axiosSpy.mockRestore();
        });

        it('системный промпт содержит Николаева Артёма как создателя и запрет на посторонние темы вроде Python', () => {
            const prompt = promptManager.getSystemPrompt();
            expect(prompt).toContain('Николаев Артём');
            expect(prompt).toMatch(/Python/i);
            expect(prompt).toMatch(/репетитор/i);
        });

        it('системный промпт содержит полную информацию об интерфейсе: панели, спутник, аналитика, настройки', () => {
            const prompt = promptManager.getSystemPrompt();
            expect(prompt).toContain('Левая панель');
            expect(prompt).toContain('Правая панель');
            expect(prompt).toContain('Спутник');
            expect(prompt).toContain('ESRI World Imagery');
            expect(prompt).toContain('OpenStreetMap');
            expect(prompt).toContain('Аналитика');
            expect(prompt).toContain('Настройки');
            expect(prompt).toContain('Окабе');
            expect(prompt).toContain('Дейтеранопия');
            expect(prompt).toContain('Open-Meteo');
            expect(prompt).toContain('OpenWeatherMap');
        });

        it('перехватывает прямой запрос на написание кода и возвращает цундере отказ', async () => {
            const result = await aiService.sendChatMessage({ userMessage: 'Сделай код на пайтон калькулятор' });
            expect(result.emotion).toBe('alert');
            expect(result.reply).toContain('репетитор по программированию');
            expect(result.reply).toContain('Не буду я тебе код писать');
        });

        it('очищает шаблонные фразы об отсечке знаний до 2024 года', async () => {
            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: '[mood:happy] Я стараюсь помогать тебе, опираясь на знания о мире до ноября 2024 года. Качество воздуха отличное!'
                        }
                    }]
                }
            });

            const result = await aiService.sendChatMessage({ userMessage: 'Что нового?' });
            expect(result.reply).not.toContain('2024');
            expect(result.reply).not.toContain('знания о мире');
            expect(result.reply).toContain('Качество воздуха отличное!');

            axiosSpy.mockRestore();
        });

        it('перехватывает сгенерированные блоки кода в ответе и заменяет на отказ', async () => {
            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: 'Конечно! Вот код:\n```python\ndef calc(): pass\n```'
                        }
                    }]
                }
            });

            const result = await aiService.sendChatMessage({ userMessage: 'Как сложить числа?' });
            expect(result.reply).not.toContain('def calc');
            expect(result.reply).toContain('генератор кода');
            expect(result.emotion).toBe('alert');

            axiosSpy.mockRestore();
        });

        it('если ответ модели целиком состоит из отсечки знаний до ноября 2024, заменяет на ответ AeroCast в реальном времени', async () => {
            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: 'Я стараюсь помогать тебе, опираясь на знания о мире до ноября 2024 года. Если ты имеешь в виду какое-то конкретное событие, дай мне знать! 😊'
                        }
                    }]
                }
            });

            const result = await aiService.sendChatMessage({ userMessage: 'Расскажи что происходит' });
            expect(result.reply).not.toContain('2024 года');
            expect(result.reply).toContain('AeroCast');
            expect(result.reply).toContain('в реальном времени');
            expect(result.emotion).toBe('think');

            axiosSpy.mockRestore();
        });

        it('перехватывает запросы пользователя про года и события в мире', async () => {
            const result = await aiService.sendChatMessage({ userMessage: 'До какого года твои знания?' });
            expect(result.reply).toContain('старые архивы');
            expect(result.reply).toContain('AeroCast');
            expect(result.emotion).toBe('think');
        });

        it('перехватывает непрофильные запросы (математика, рецепты) и возвращает отказ', async () => {
            const mathResult = await aiService.sendChatMessage({ userMessage: 'Сколько будет 25 умножить на 4' });
            expect(mathResult.reply).toContain('калькулятор');
            expect(mathResult.reply).toContain('AeroCast');
            expect(mathResult.emotion).toBe('think');

            const recipeResult = await aiService.sendChatMessage({ userMessage: 'Как приготовить борщ' });
            expect(recipeResult.reply).toContain('AeroCast');
            expect(recipeResult.emotion).toBe('think');
        });

        it('распознает тег [action:set_layer:satellite] и возвращает action, удаляя тег из ответа', async () => {
            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: '[mood:happy] [action:set_layer:satellite] Переключаю на спутниковые снимки, ня! ✨'
                        }
                    }]
                }
            });

            const result = await aiService.sendChatMessage({ userMessage: 'Переключи на спутник' });
            expect(result.emotion).toBe('happy');
            expect(result.reply).toBe('Переключаю на спутниковые снимки, ня! ✨');
            expect(result.reply).not.toContain('[action:');
            expect(result.action).toEqual({ type: 'set_base_layer', layer: 'satellite' });

            axiosSpy.mockRestore();
        });

        it('распознает тег [action:set_layer:osm] при возврате на обычную карту', async () => {
            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: '[mood:happy] [action:set_layer:osm] Возвращаю схему OpenStreetMap, ня! ✨'
                        }
                    }]
                }
            });

            const result = await aiService.sendChatMessage({ userMessage: 'Верни обычную карту' });
            expect(result.reply).toBe('Возвращаю схему OpenStreetMap, ня! ✨');
            expect(result.action).toEqual({ type: 'set_base_layer', layer: 'osm' });

            axiosSpy.mockRestore();
        });

        it('дополняет action по намерению пользователя, если модель забыла вставить тег', async () => {
            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: '[mood:happy] Секундочку, перехожу на спутник!'
                        }
                    }]
                }
            });

            const result = await aiService.sendChatMessage({ userMessage: 'Включи спутник' });
            expect(result.action).toEqual({ type: 'set_base_layer', layer: 'satellite' });

            axiosSpy.mockRestore();
        });

        it('срабатывает защитный fallback при сбое/оффлайне LLM для запросов смены слоя', async () => {
            const axiosSpy = jest.spyOn(axios, 'post').mockRejectedValueOnce(new Error('Connection refused'));

            const satResult = await aiService.sendChatMessage({ userMessage: 'Включи спутник' });
            expect(satResult.action).toEqual({ type: 'set_base_layer', layer: 'satellite' });
            expect(satResult.reply).toContain('Переключаю карту на спутниковые снимки');

            const osmResult = await aiService.sendChatMessage({ userMessage: 'Верни обычную карту' });
            expect(osmResult.action).toEqual({ type: 'set_base_layer', layer: 'osm' });
            expect(osmResult.reply).toContain('Возвращаю привычную схему');

            axiosSpy.mockRestore();
        });

        it('распознает тег [action:set_colorblind:okabe] и возвращает action, удаляя тег', async () => {
            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: '[mood:happy] [action:set_colorblind:okabe] Включаю палитру Окабе, ня! ✨'
                        }
                    }]
                }
            });

            const result = await aiService.sendChatMessage({ userMessage: 'Включи дальтонизм' });
            expect(result.emotion).toBe('happy');
            expect(result.reply).toBe('Включаю палитру Окабе, ня! ✨');
            expect(result.action).toEqual({ type: 'set_colorblind', enabled: true, colorBlindType: 'okabe' });

            axiosSpy.mockRestore();
        });

        it('при запросе "включи дальтонизм" без указания типа по умолчанию активирует Окабе', async () => {
            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: '[mood:happy] Включаю режим для дальтоников!'
                        }
                    }]
                }
            });

            const result = await aiService.sendChatMessage({ userMessage: 'Включи режим дальтонизма' });
            expect(result.action).toEqual({ type: 'set_colorblind', enabled: true, colorBlindType: 'okabe' });

            axiosSpy.mockRestore();
        });

        it('при указании конкретного типа (дейтеранопия, протанопия, тританопия) включает соответствующий тип', async () => {
            const deutSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: '[mood:happy] [action:set_colorblind:deuteranopia] Переключаю на Дейтеранопию, ня! ✨'
                        }
                    }]
                }
            });

            const deutResult = await aiService.sendChatMessage({ userMessage: 'Переключи на дейтеранопию' });
            expect(deutResult.action).toEqual({ type: 'set_colorblind', enabled: true, colorBlindType: 'deuteranopia' });
            deutSpy.mockRestore();

            const protSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: '[mood:happy] Ставлю протанопию!'
                        }
                    }]
                }
            });

            const protResult = await aiService.sendChatMessage({ userMessage: 'Включи протанопию' });
            expect(protResult.action).toEqual({ type: 'set_colorblind', enabled: true, colorBlindType: 'protanopia' });
            protSpy.mockRestore();
        });

        it('при запросе нереализованного вида дальтонизма говорит что такого нет и не возвращает action', async () => {
            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: '[mood:happy] [action:set_colorblind:achromatopsia] Включаю ахроматопсию!'
                        }
                    }]
                }
            });

            const result = await aiService.sendChatMessage({ userMessage: 'Включи ахроматопсию' });
            expect(result.action).toBeNull();
            expect(result.reply).toContain('Такого режима дальтонизма у нас нет');
            expect(result.reply).toContain('Окабе');
            expect(result.reply).toContain('Дейтеранопия');
            expect(result.reply).toContain('Протанопия');
            expect(result.reply).toContain('Тританопия');
            expect(result.emotion).toBe('alert');

            axiosSpy.mockRestore();
        });

        it('корректно выключает режим дальтонизма по запросу пользователя', async () => {
            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: '[mood:happy] [action:set_colorblind:off] Выключаю дальтонизм, ня! ✨'
                        }
                    }]
                }
            });

            const result = await aiService.sendChatMessage({ userMessage: 'Выключи дальтонизм' });
            expect(result.action).toEqual({ type: 'set_colorblind', enabled: false });

            axiosSpy.mockRestore();
        });

        it('распознает выключение дальтонизма при вежливых формулировках и местоимениях', async () => {
            const axiosSpy1 = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: 'Как скажешь! Возвращаю стандартную цветовую гамму, ня! ✨'
                        }
                    }]
                }
            });

            const res1 = await aiService.sendChatMessage({ userMessage: 'выключи пожалуйста режим дальтонизма' });
            expect(res1.action).toEqual({ type: 'set_colorblind', enabled: false });
            axiosSpy1.mockRestore();

            const axiosSpy2 = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: 'Как скажешь! Выключаю режим дальтонизма, ня! ✨'
                        }
                    }]
                }
            });

            const res2 = await aiService.sendChatMessage({
                userMessage: 'можешь пожалуйста выключить его',
                isColorBlind: true,
                history: [
                    { role: 'user', content: 'включи дальтонизм' },
                    { role: 'assistant', content: 'Включаю режим дальтонизма' }
                ]
            });
            expect(res2.action).toEqual({ type: 'set_colorblind', enabled: false });
            axiosSpy2.mockRestore();
        });

        it('извлекает action из текста реплики, если модель забыла тег [action:...]', async () => {
            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: 'Как скажешь! Выключаю режим дальтонизма, ня! ✨'
                        }
                    }]
                }
            });

            const res = await aiService.sendChatMessage({ userMessage: 'отключи' });
            expect(res.action).toEqual({ type: 'set_colorblind', enabled: false });
            axiosSpy.mockRestore();
        });

        it('срабатывает защитный fallback при сбое/оффлайне LLM для смены дальтонизма', async () => {
            const axiosSpy = jest.spyOn(axios, 'post').mockRejectedValue(new Error('Connection refused'));

            const okabeResult = await aiService.sendChatMessage({ userMessage: 'Включи дальтонизм' });
            expect(okabeResult.action).toEqual({ type: 'set_colorblind', enabled: true, colorBlindType: 'okabe' });
            expect(okabeResult.reply).toContain('Окабе');

            const unsuppResult = await aiService.sendChatMessage({ userMessage: 'Включи монохромазию' });
            expect(unsuppResult.action).toBeNull();
            expect(unsuppResult.reply).toContain('Такого режима дальтонизма у нас нет');

            const offResult = await aiService.sendChatMessage({ userMessage: 'Выключи дальтонизм' });
            expect(offResult.action).toEqual({ type: 'set_colorblind', enabled: false });
            expect(offResult.reply).toContain('Возвращаю стандартную цветовую гамму');

            axiosSpy.mockRestore();
        });

        it('распознает теги [action:set_theme:dark] и [action:set_theme:light]', async () => {
            const darkSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: '[mood:happy] [action:set_theme:dark] Включаю тёмную тему, ня! ✨'
                        }
                    }]
                }
            });

            const darkRes = await aiService.sendChatMessage({ userMessage: 'Включи темную тему' });
            expect(darkRes.action).toEqual({ type: 'set_theme', theme: 'dark' });
            expect(darkRes.reply).toBe('Включаю тёмную тему, ня! ✨');
            darkSpy.mockRestore();

            const lightSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: '[mood:happy] [action:set_theme:light] Включаю светлую тему, ня! ✨'
                        }
                    }]
                }
            });

            const lightRes = await aiService.sendChatMessage({ userMessage: 'Включи светлую тему' });
            expect(lightRes.action).toEqual({ type: 'set_theme', theme: 'light' });
            expect(lightRes.reply).toBe('Включаю светлую тему, ня! ✨');
            lightSpy.mockRestore();
        });

        it('дополняет action смены темы по намерению, если модель не сгенерировала тег', async () => {
            const darkSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: '[mood:happy] Перехожу на тёмную тему!'
                        }
                    }]
                }
            });

            const darkRes = await aiService.sendChatMessage({ userMessage: 'Поставь ночной режим' });
            expect(darkRes.action).toEqual({ type: 'set_theme', theme: 'dark' });
            darkSpy.mockRestore();

            const lightSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: '[mood:happy] Перехожу на светлую тему!'
                        }
                    }]
                }
            });

            const lightRes = await aiService.sendChatMessage({ userMessage: 'Сделай светлую тему' });
            expect(lightRes.action).toEqual({ type: 'set_theme', theme: 'light' });
            lightSpy.mockRestore();
        });

        it('срабатывает защитный fallback при сбое/оффлайне LLM для смены темы оформления', async () => {
            const axiosSpy = jest.spyOn(axios, 'post').mockRejectedValue(new Error('Connection refused'));

            const darkRes = await aiService.sendChatMessage({ userMessage: 'Включи темную тему' });
            expect(darkRes.action).toEqual({ type: 'set_theme', theme: 'dark' });
            expect(darkRes.reply).toContain('тёмную тему');

            const lightRes = await aiService.sendChatMessage({ userMessage: 'Включи светлую тему' });
            expect(lightRes.action).toEqual({ type: 'set_theme', theme: 'light' });
            expect(lightRes.reply).toContain('светлую тему');

            axiosSpy.mockRestore();
        });

        it('распознает тег [action:set_location:Москва] и геокодирует город', async () => {
            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: '[mood:happy] [action:set_location:Москва] Перемещаемся в столицу, ня! ✨'
                        }
                    }]
                }
            });

            const result = await aiService.sendChatMessage({ userMessage: 'Перейди в Москву' });
            expect(result.action).toBeDefined();
            expect(result.action.type).toBe('set_location');
            expect(result.action.lat).toBeCloseTo(55.75, 1);
            expect(result.action.lon).toBeCloseTo(37.61, 1);
            expect(result.action.cityName).toContain('Москва');
            expect(result.reply).not.toContain('[action:');

            axiosSpy.mockRestore();
        });

        it('дополняет action перехода к городу по фразе пользователя ("перейди в Казань")', async () => {
            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: '[mood:happy] Конечно, открываю город на карте, ня! ✨'
                        }
                    }]
                }
            });

            const result = await aiService.sendChatMessage({ userMessage: 'Перейди в Казань пожалуйста' });
            expect(result.action).toBeDefined();
            expect(result.action.type).toBe('set_location');
            expect(result.action.lat).toBeCloseTo(55.78, 1);
            expect(result.action.lon).toBeCloseTo(49.12, 1);
            expect(result.action.cityName).toContain('Казань');

            axiosSpy.mockRestore();
        });

        it('распознает инфинитив "переместить в Екатеринбург" и извлекает город из реплики модели', async () => {
            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: 'Секундочку! Перемещаюсь в Екатеринбург, смотрю показатели качества воздуха, ня! ✨'
                        }
                    }]
                }
            });

            const result = await aiService.sendChatMessage({ userMessage: 'переместить в Екатеринбург' });
            expect(result.action).toBeDefined();
            expect(result.action.type).toBe('set_location');
            expect(result.action.lat).toBeCloseTo(56.85, 1);
            expect(result.action.lon).toBeCloseTo(60.61, 1);
            expect(result.action.cityName).toContain('Екатеринбург');

            axiosSpy.mockRestore();
        });

        it('срабатывает защитный fallback при оффлайне LLM для перехода к городу', async () => {
            const axiosSpy = jest.spyOn(axios, 'post').mockRejectedValue(new Error('Connection refused'));

            const result = await aiService.sendChatMessage({ userMessage: 'Покажи Сочи' });
            expect(result.action).toBeDefined();
            expect(result.action.type).toBe('set_location');
            expect(result.action.lat).toBeCloseTo(43.59, 1);
            expect(result.action.lon).toBeCloseTo(39.72, 1);
            expect(result.reply).toContain('Сочи');

            axiosSpy.mockRestore();
        });

        it('если город не найден, сообщает об этом пользователю и не выполняет переход', async () => {
            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: '[mood:happy] [action:set_location:НесуществующийГород12345] Летим туда!'
                        }
                    }]
                }
            });

            const result = await aiService.sendChatMessage({ userMessage: 'Перейди в НесуществующийГород12345' });
            expect(result.action).toBeNull();
            expect(result.reply).toContain('не нашла');
            expect(result.emotion).toBe('alert');

            axiosSpy.mockRestore();
        });

        it('форматирует контекст аналитики выбранной точки в системный промпт', () => {
            const sampleAnalytics = {
                locationName: 'Казань, Россия',
                lat: 55.78,
                lon: 49.12,
                time: '2026-10-29T14:00',
                aqi: 28,
                pm2_5: 14.2,
                pm10: 22.5,
                no2: 18.0,
                so2: 5.1,
                o3: 42.0,
                co: 320.0
            };

            const prompt = promptManager.getSystemPrompt(sampleAnalytics);
            expect(prompt).toContain('ДАННЫЕ ТЕКУЩЕЙ ВЫБРАННОЙ ТОЧКИ НА КАРТЕ:');
            expect(prompt).toContain('Казань, Россия');
            expect(prompt).toContain('EAQI: 28');
            expect(prompt).toContain('PM2.5 (мелкодисперсные частицы): 14.2 мкг/м³');
            expect(prompt).toContain('PM10 (крупная пыль): 22.5 мкг/м³');
            expect(prompt).toContain('Диоксид азота (NO₂): 18.0 мкг/м³');
        });

        it('отвечает аналитикой по текущей точке при запросе пользователя к модели', async () => {
            const sampleAnalytics = {
                locationName: 'Самара, Россия',
                lat: 53.20,
                lon: 50.13,
                aqi: 18,
                pm2_5: 8.5,
                pm10: 15.0
            };

            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    choices: [{
                        message: {
                            content: '[mood:happy] В Самаре сейчас воздух отличный! Индекс EAQI всего 18, а PM2.5 около 8.5 мкг/м³, ня! ✨'
                        }
                    }]
                }
            });

            const result = await aiService.sendChatMessage({
                userMessage: 'Какая аналитика по текущей точке?',
                pointAnalytics: sampleAnalytics
            });

            expect(result.reply).toContain('Самаре');
            expect(result.reply).toContain('18');
            expect(result.emotion).toBe('happy');

            // Проверяем, что в системном сообщении axios были переданы данные точки
            const calledPayload = axiosSpy.mock.calls[0][1];
            const systemMsg = calledPayload.messages.find(m => m.role === 'system');
            expect(systemMsg.content).toContain('Самара, Россия');
            expect(systemMsg.content).toContain('EAQI: 18');

            axiosSpy.mockRestore();
        });

        it('срабатывает защитный fallback с реальными данными точки при оффлайне LLM', async () => {
            const sampleAnalytics = {
                locationName: 'Новокузнецк, Россия',
                lat: 53.75,
                lon: 87.14,
                aqi: 35,
                pm2_5: 19.4,
                pm10: 31.0
            };

            const axiosSpy = jest.spyOn(axios, 'post').mockRejectedValueOnce(new Error('Connection refused'));

            const result = await aiService.sendChatMessage({
                userMessage: 'Какой тут сейчас воздух и какая аналитика?',
                pointAnalytics: sampleAnalytics
            });

            expect(result.reply).toContain('Новокузнецк, Россия');
            expect(result.reply).toContain('35');
            expect(result.reply).toContain('19.4 мкг/м³');
            expect(result.emotion).toBe('happy');

            axiosSpy.mockRestore();
        });

        it('извлекает город при вежливом вопросе о качестве воздуха ("можешь пожалуйста сказать что сейчас по воздуху в Москве")', () => {
            const city = aiService.extractCityIntent('можешь пожалуйста сказать что сейчас по воздуху в Москве');
            expect(city).toBe('Москве');
        });

        it('при запросе качества воздуха в городе устанавливает followUpAnalytics: true в action', async () => {
            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    model: 'aerocast-model',
                    choices: [{
                        message: {
                            content: '[mood:happy] [action:set_location:Москва] Секундочку! Перемещаемся в Москву, смотрю свежие замеры воздуха, ня! ✨'
                        }
                    }]
                }
            });

            const result = await aiService.sendChatMessage({
                userMessage: 'можешь пожалуйста сказать что сейчас по воздуху в Москве'
            });

            expect(result.action).toBeDefined();
            expect(result.action.type).toBe('set_location');
            expect(result.action.cityName).toContain('Москва');
            expect(result.action.followUpAnalytics).toBe(true);

            axiosSpy.mockRestore();
        });

        it('если запрашивается новый город, не передает аналитику старой точки в системный промпт', async () => {
            const oldPointAnalytics = {
                locationName: 'Новокузнецк, Россия',
                lat: 53.75,
                lon: 87.14,
                aqi: 70
            };

            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    model: 'aerocast-model',
                    choices: [{
                        message: {
                            content: '[mood:happy] [action:set_location:Москва] Секундочку! Перемещаемся в Москву, ня! ✨'
                        }
                    }]
                }
            });

            await aiService.sendChatMessage({
                userMessage: 'можешь пожалуйста сказать что сейчас по воздуху в Москве',
                pointAnalytics: oldPointAnalytics
            });

            const calledPayload = axiosSpy.mock.calls[0][1];
            const systemMsg = calledPayload.messages.find(m => m.role === 'system');
            // Проверяем, что данные старого города не переданы
            expect(systemMsg.content).not.toContain('Новокузнецк, Россия');

            axiosSpy.mockRestore();
        });

        it('isFollowUpAnalytics: true не генерирует set_location и передает аналитику в ответ', async () => {
            const moscowAnalytics = {
                locationName: 'Москва, Россия',
                lat: 55.75,
                lon: 37.61,
                aqi: 25,
                pm2_5: 12.0,
                pm10: 18.0
            };

            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    model: 'aerocast-model',
                    choices: [{
                        message: {
                            content: '[mood:happy] Смотри, в Москве отличный воздух, EAQI равен 25, ня! ✨'
                        }
                    }]
                }
            });

            const result = await aiService.sendChatMessage({
                userMessage: 'Предоставь подробную аналитику по воздуху для локации Москва, Россия',
                pointAnalytics: moscowAnalytics,
                isFollowUpAnalytics: true
            });

            expect(result.action).toBeNull();
            expect(result.reply).toContain('Москве отличный воздух');
            expect(result.reply).not.toContain('Перемещаемся');

            const calledPayload = axiosSpy.mock.calls[0][1];
            const systemMsg = calledPayload.messages.find(m => m.role === 'system');
            expect(systemMsg.content).toContain('Москва, Россия');

            axiosSpy.mockRestore();
        });

        it('не считает фразы прогноза (3 дня, три дня, завтра) за названия городов', () => {
            expect(aiService.extractCityIntent('Скажи на ближайшие 3 дня какая будет тут погода и сам воздух')).toBeNull();
            expect(aiService.extractCityIntent('какой прогноз на 3 дня')).toBeNull();
            expect(aiService.extractCityIntent('погода на завтра')).toBeNull();
            expect(aiService.extractCityIntent('замеры на три дня')).toBeNull();
        });

        it('запросы расчета средних/мин/макс показателей AQI не перехватываются как оффтоп-калькулятор', async () => {
            const forecastAnalytics = {
                locationName: 'Москва, Россия',
                lat: 55.75,
                lon: 37.61,
                aqi: 22,
                forecast3Days: {
                    days: [
                        { date: '2026-10-29', dayLabel: 'Сегодня', avgAqi: 22, minAqi: 15, maxAqi: 30, avgPm25: 11, status: 'Хорошо' },
                        { date: '2026-10-30', dayLabel: 'Завтра', avgAqi: 25, minAqi: 18, maxAqi: 35, avgPm25: 13, status: 'Хорошо' },
                        { date: '2026-10-31', dayLabel: 'Послезавтра', avgAqi: 18, minAqi: 12, maxAqi: 22, avgPm25: 9, status: 'Отлично' }
                    ],
                    periodAvgAqi: 21.7,
                    periodMinAqi: 12,
                    periodMaxAqi: 35,
                    periodAvgPm25: 11.0
                }
            };

            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    model: 'aerocast-model',
                    choices: [{
                        message: {
                            content: '[mood:happy] Средний индекс EAQI за 3 дня составит 21.7, минимум 12, максимум 35, ня! ✨'
                        }
                    }]
                }
            });

            const result = await aiService.sendChatMessage({
                userMessage: 'можешь пожалуйста сказать на ближайшие 3 дня точное значение среднего Аки плюс среднее значение и там максимально минимально',
                pointAnalytics: forecastAnalytics
            });

            expect(result.reply).not.toContain('Я же не калькулятор');
            expect(result.reply).toContain('21.7');

            axiosSpy.mockRestore();
        });

        it('при оффлайне LLM возвращает сводку прогноза на 3 дня, если переданы данные прогноза', async () => {
            const forecastAnalytics = {
                locationName: 'Новосибирск, Россия',
                lat: 55.02,
                lon: 82.93,
                aqi: 30,
                forecast3Days: {
                    days: [
                        { date: '2026-10-29', dayLabel: 'Сегодня', avgAqi: 25, minAqi: 18, maxAqi: 32, avgPm25: 12, status: 'Хорошо' },
                        { date: '2026-10-30', dayLabel: 'Завтра', avgAqi: 28, minAqi: 20, maxAqi: 38, avgPm25: 14, status: 'Хорошо' },
                        { date: '2026-10-31', dayLabel: 'Послезавтра', avgAqi: 19, minAqi: 14, maxAqi: 24, avgPm25: 9, status: 'Отлично' }
                    ],
                    periodAvgAqi: 24.0,
                    periodMinAqi: 14,
                    periodMaxAqi: 38,
                    periodAvgPm25: 11.7
                }
            };

            const result = await aiService.sendChatMessage({
                userMessage: 'Скажи на ближайшие 3 дня какая будет тут погода и сам воздух',
                pointAnalytics: forecastAnalytics
            });

            expect(result.reply).toContain('прогноз качества воздуха для Новосибирск, Россия на ближайшие 3 дня');
            expect(result.reply).toContain('24');
            expect(result.reply).toContain('минимум 14, максимум 38');
            expect(result.emotion).toBe('happy');
        });

        it('не считает слово точка или тачка за город и не геокодирует', async () => {
            expect(aiService.extractCityIntent('Привет Можешь сказать чтобы в данной тачке ближайшие 3 дня и по качеству воздуха конкретно и сколько сейчас есть')).toBeNull();
            expect(aiService.extractCityIntent('в этой точке')).toBeNull();
            expect(aiService.extractCityIntent('в точке')).toBeNull();
            expect(aiService.extractCityIntent('в тачке')).toBeNull();
            expect(await aiService.resolveCity('Точка')).toBeNull();
            expect(await aiService.resolveCity('Точку')).toBeNull();
        });

        it('если модель ошибочно вставила action:set_location:Точка, действие сбрасывается и выдается аналитика точки', async () => {
            const pointAnalytics = {
                locationName: 'Текущая точка',
                lat: 55.75,
                lon: 37.61,
                aqi: 22,
                pm2_5: 11.0,
                pm10: 17.0
            };
            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    model: 'aerocast-model',
                    choices: [{
                        message: {
                            content: '[mood:happy] [action:set_location:Точка] Секундочку! Перемещаемся в Точку, смотрю свежие замеры воздуха, ня! ✨'
                        }
                    }]
                }
            });
            const result = await aiService.sendChatMessage({
                userMessage: 'Привет Можешь сказать чтобы в данной тачке ближайшие 3 дня и по качеству воздуха конкретно и сколько сейчас есть',
                pointAnalytics
            });
            expect(result.action).toBeNull();
            expect(result.reply).not.toContain('Казахстан');
            expect(result.reply).not.toContain('Перемещаемся в Точку');
            expect(result.reply).toContain('22');
            axiosSpy.mockRestore();
        });
        it('форматирует исторические/архивные данные и метку выбранного времени в системный промпт', () => {
            const promptManager = require('../ai/services/promptManager');
            const sampleAnalytics = {
                locationName: 'Новосибирск',
                lat: 55.03,
                lon: 82.92,
                time: '2026-10-26T18:00',
                selectedTimeInfo: {
                    timeStr: '2026-10-26T18:00',
                    kind: 'past',
                    kindLabel: 'архивный замер в прошлом',
                    label: 'ПН, 26 октября в 18:00 (архивный замер в прошлом)'
                },
                aqi: 28,
                historyData: {
                    pastDaysCount: 7,
                    pastMaxAqi: {
                        aqi: 48,
                        date: '2026-10-26',
                        hour: 15,
                        timeLabel: '15:00',
                        label: 'ПН, 26 октября в 15:00'
                    },
                    pastMinAqi: {
                        aqi: 12,
                        date: '2026-10-24',
                        hour: 6,
                        timeLabel: '06:00',
                        label: 'СБ, 24 октября в 06:00'
                    },
                    pastAvgAqi: 27.5,
                    pastAvgPm25: 14.1,
                    pastDays: [
                        { date: '2026-10-26', dayLabel: 'ПН, 26 окт', avgAqi: 31, maxAqi: 48, maxAqiTime: '15:00', minAqi: 18, avgPm25: 16.2, status: 'Хорошо' }
                    ]
                }
            };

            const prompt = promptManager.formatPointAnalyticsContext(sampleAnalytics);
            expect(prompt).toContain('АРХИВНЫЕ ДАННЫЕ ЗА ПРОШЕДШИЕ ДНИ');
            expect(prompt).toContain('САМЫЙ ВЫСОКИЙ ПИК ЗАГРЯЗНЕНИЯ ЗА ПРОШЕДШИЕ ДНИ (максимум EAQI): 48 (зафиксировано: ПН, 26 октября в 15:00)');
            expect(prompt).toContain('САМЫЙ ЧИСТЫЙ ВОЗДУХ ЗА ПРОШЕДШИЕ ДНИ (минимум EAQI): 12 (зафиксировано: СБ, 24 октября в 06:00)');
            expect(prompt).toContain('ПН, 26 октября в 18:00 (архивный замер в прошлом)');
            expect(prompt).toContain('[ВНИМАНИЕ: пользователь выбрал точку в ПРОШЛОМ на таймлайне, это архивный замер!]');
        });

        it('распознает запросы про прошедшие дни, историю и пик загрязнения как аналитические', () => {
            expect(aiService.isAnalyticsQuery('а можешь пожалуйста называть какое было самое высокое число даже за предыдущие дни по значению Аки И в какой это было время')).toBe(true);
            expect(aiService.isAnalyticsQuery('что было вчера по воздуху?')).toBe(true);
            expect(aiService.isAnalyticsQuery('какой был пик загрязнения за предыдущие дни?')).toBe(true);
            expect(aiService.isAnalyticsQuery('покажи архивные замеры')).toBe(true);
        });

        it('generateHistoryReply формирует ответ с историческим пиком и временем', () => {
            const historyData = {
                pastDaysCount: 7,
                pastMaxAqi: {
                    aqi: 48,
                    label: 'в понедельник, 26 октября в 15:00'
                },
                pastMinAqi: {
                    aqi: 12,
                    label: 'в субботу, 24 октября в 06:00'
                },
                pastAvgAqi: 28,
                pastDays: [
                    { date: '2026-10-28', dayLabel: 'СР, 28 окт', avgAqi: 24, maxAqi: 35, maxAqiTime: '14:00', status: 'Хорошо' }
                ]
            };

            const peakReply = aiService.generateHistoryReply(historyData, 'Новосибирске', 'какое было самое высокое число даже за предыдущие дни по значению Аки И в какой это было время');
            expect(peakReply).not.toBeNull();
            expect(peakReply.reply).toContain('48');
            expect(peakReply.reply).toContain('в понедельник, 26 октября в 15:00');
            expect(peakReply.reply).toContain('Новосибирске');

            const yReply = aiService.generateHistoryReply(historyData, 'Новосибирске', 'что было вчера');
            expect(yReply.reply).toContain('Вчера в Новосибирске');
            expect(yReply.reply).toContain('24');
        });

        it('при запросе исторического максимума при оффлайне LLM возвращает архивный пик и время', async () => {
            const historyAnalytics = {
                locationName: 'Новосибирск',
                lat: 55.03,
                lon: 82.92,
                aqi: 28,
                historyData: {
                    pastDaysCount: 7,
                    pastMaxAqi: {
                        aqi: 48,
                        label: 'в понедельник, 26 октября в 15:00'
                    },
                    pastMinAqi: {
                        aqi: 12,
                        label: 'в субботу, 24 октября в 06:00'
                    },
                    pastAvgAqi: 28
                }
            };

            const result = await aiService.sendChatMessage({
                userMessage: 'а можешь пожалуйста называть какое было самое высокое число даже за предыдущие дни по значению Аки И в какой это было время',
                pointAnalytics: historyAnalytics
            });

            expect(result.reply).toContain('48');
            expect(result.reply).toContain('в понедельник, 26 октября в 15:00');
            expect(result.reply).not.toContain('я не калькулятор');
            expect(result.emotion).toBe('happy');
        });
        it('извлекает город из сложного предложения с опечаткой маки и дополнительными фразами', () => {
            const query = 'можешь пожалуйста сказать что было за предыдущие дни по значению маки в Новокузнецке мне бы хотелось знать среднее значение';
            const city = aiService.extractCityIntent(query);
            expect(city).toBe('Новокузнецке');
        });

        it('форматирует блок ДАННЫЕ ЗА ВСЕ ДНИ (прошедшие, сегодня и прогноз) в системный промпт', () => {
            const promptManager = require('../ai/services/promptManager');
            const sampleAnalytics = {
                locationName: 'Новокузнецк',
                lat: 53.75,
                lon: 87.14,
                aqi: 28,
                allDaysSummary: {
                    totalDaysCount: 11,
                    overallAvgAqi: 26.5,
                    overallMaxAqi: { aqi: 48, label: 'ПН, 26 октября в 15:00 (архив)' },
                    overallMinAqi: { aqi: 12, label: 'СБ, 31 октября в 06:00 (прогноз)' },
                    overallAvgPm25: 13.5,
                    days: [
                        { kindLabel: 'Архив', dayLabel: 'ПН, 26 окт', avgAqi: 31, maxAqi: 48, maxAqiTime: '15:00', minAqi: 18, avgPm25: 16.2, status: 'Хорошо' },
                        { kindLabel: 'Сегодня', dayLabel: 'ЧТ, 29 окт (Сегодня)', avgAqi: 25, maxAqi: 32, maxAqiTime: '12:00', minAqi: 20, avgPm25: 11.0, status: 'Хорошо' },
                        { kindLabel: 'Прогноз', dayLabel: 'ПТ, 30 окт', avgAqi: 22, maxAqi: 28, maxAqiTime: '18:00', minAqi: 14, avgPm25: 9.5, status: 'Хорошо' }
                    ]
                }
            };

            const prompt = promptManager.formatPointAnalyticsContext(sampleAnalytics);
            expect(prompt).toContain('ДАННЫЕ ЗА ВСЕ ДНИ (ОБЩИЙ ПЕРИОД: ПРОШЕДШИЕ ДНИ, СЕГОДНЯ И ПРОГНОЗ — ВСЕГО 11 ДН.)');
            expect(prompt).toContain('СРЕДНИЙ ИНДЕКС EAQI ЗА ВСЕ ДНИ (ПОЛНЫЙ ПЕРИОД): 26.5');
            expect(prompt).toContain('АБСОЛЮТНЫЙ ПИК ЗАГРЯЗНЕНИЯ ЗА ВСЕ ДНИ: 48 (зафиксирован: ПН, 26 октября в 15:00 (архив))');
            expect(prompt).toContain('АБСОЛЮТНЫЙ МИНИМУМ ЗА ВСЕ ДНИ: 12 (зафиксирован: СБ, 31 октября в 06:00 (прогноз))');
            expect(prompt).toContain('[Архив] ПН, 26 окт');
            expect(prompt).toContain('[Сегодня] ЧТ, 29 окт (Сегодня)');
            expect(prompt).toContain('[Прогноз] ПТ, 30 окт');
        });

        it('generateAllDaysReply формирует сводку за весь период с архивом и прогнозом', () => {
            const allDaysSummary = {
                totalDaysCount: 11,
                overallAvgAqi: 26.1,
                overallMaxAqi: { aqi: 48, label: 'в понедельник, 26 октября в 15:00 (архив)' },
                overallMinAqi: { aqi: 14, label: 'в субботу, 24 октября в 06:00 (архив)' }
            };

            const reply = aiService.generateAllDaysReply(allDaysSummary, 'Новокузнецке', 'какое среднее за все дни');
            expect(reply).not.toBeNull();
            expect(reply.reply).toContain('26.1');
            expect(reply.reply).toContain('48');
            expect(reply.reply).toContain('Новокузнецке');
            expect(reply.reply).toContain('все 11 дней');
        });

        it('при запросе за все дни при оффлайне LLM возвращает общую статистику за весь период', async () => {
            const allDaysAnalytics = {
                locationName: 'Новокузнецк',
                lat: 53.75,
                lon: 87.14,
                aqi: 28,
                allDaysSummary: {
                    totalDaysCount: 11,
                    overallAvgAqi: 26.1,
                    overallMaxAqi: { aqi: 48, label: 'в понедельник, 26 октября в 15:00 (архив)' },
                    overallMinAqi: { aqi: 14, label: 'в субботу, 24 октября в 06:00 (архив)' }
                }
            };

            const result = await aiService.sendChatMessage({
                userMessage: 'А можешь сказать среднее значение за все дни?',
                pointAnalytics: allDaysAnalytics
            });

            expect(result.reply).toContain('26.1');
            expect(result.reply).toContain('48');
            expect(result.reply).not.toContain('я не калькулятор');
            expect(result.reply).not.toContain('не историк');
            expect(result.emotion).toBe('happy');
        });

        it('корректно извлекает город из запросов полной/подробной аналитики и сопоставляет падежи', () => {
            expect(aiService.extractCityIntent('покажи полную аналитику по новосибирску')).toBe('новосибирску');
            expect(aiService.extractCityIntent('покажи аналитику по новосибирску')).toBe('новосибирску');
            expect(aiService.extractCityIntent('полная аналитика по новосибирску')).toBe('новосибирску');
            expect(aiService.extractCityIntent('подробная аналитика по москве')).toBe('москве');
            expect(aiService.extractCityIntent('сводка по казани')).toBe('казани');

            expect(aiService.cityMatchesLocation('новосибирску', 'Новосибирск, Новосибирская область, Россия')).toBe(true);
            expect(aiService.cityMatchesLocation('москве', 'Москва, Россия')).toBe(true);
            expect(aiService.cityMatchesLocation('казани', 'Казань, Татарстан, Россия')).toBe(true);
            expect(aiService.cityMatchesLocation('новосибирску', 'Москва, Россия')).toBe(false);
        });

        it('при запросе полной аналитики по новому городу перемещается с followUpAnalytics: true', async () => {
            const moscowAnalytics = {
                locationName: 'Москва, Россия',
                lat: 55.75,
                lon: 37.61,
                aqi: 20
            };

            const result = await aiService.sendChatMessage({
                userMessage: 'покажи полную аналитику по новосибирску',
                pointAnalytics: moscowAnalytics
            });

            expect(result.action).toBeDefined();
            expect(result.action.type).toBe('set_location');
            expect(result.action.cityName).toContain('Новосибирск');
            expect(result.action.followUpAnalytics).toBe(true);
            expect(result.reply).toContain('Новосибирск');
        });

        it('если модель вернула отговорку "это объемная задача", заменяет ее полной аналитикой', async () => {
            const nskAnalytics = {
                locationName: 'Новосибирск, Россия',
                lat: 55.02,
                lon: 82.93,
                aqi: 35,
                pm2_5: 14.5,
                historyData: {
                    pastMaxAqi: { aqi: 62, label: '27 октября, 18:00' },
                    pastAvgAqi: 28
                },
                forecast3Days: {
                    periodAvgAqi: 24,
                    periodMinAqi: 18,
                    periodMaxAqi: 32
                }
            };

            const axiosSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                data: {
                    model: 'gemma-4',
                    choices: [{
                        message: {
                            content: 'Хмпф! Полную аналитику за весь период, это довольно объемная задача, ня~. Я могу показать тебе подробный анализ по архиву последних семи дней'
                        }
                    }]
                }
            });

            const result = await aiService.sendChatMessage({
                userMessage: 'покажи полную аналитику по новосибирску',
                isFollowUpAnalytics: true,
                pointAnalytics: nskAnalytics
            });

            expect(result.reply).toContain('Новосибирск');
            expect(result.reply).toContain('35');
            expect(result.reply).toContain('62');
            expect(result.reply).toContain('24');
            expect(result.reply).not.toContain('объемная задача');

            axiosSpy.mockRestore();
        });
    });
});
