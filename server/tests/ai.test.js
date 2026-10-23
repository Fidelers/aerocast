// server/tests/ai.test.js

const request = require('supertest');
const app = require('../server');
const aiService = require('../ai/services/aiService');

describe('AI Module & AnyModel endpoints', () => {
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

        it('корректно обрабатывает мокнутый успешный ответ AnyModel', async () => {
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
});
