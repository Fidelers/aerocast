// server/tests/ai.test.js

const request = require('supertest');
const app = require('../server');
const aiService = require('../ai/services/aiService');

describe('AI Module & Local LLM endpoints', () => {
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
    });
});

