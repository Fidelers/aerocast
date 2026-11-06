const request = require('supertest');
const express = require('express');

describe('AI Controller and Route error handling', () => {
    it('aiRoutes asyncHandler возвращает 500 при сбое обработчика', async () => {
        let app;
        const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        jest.isolateModules(() => {
            const ctrl = require('../../ai/controllers/aiController');
            jest.spyOn(ctrl, 'getStatus').mockImplementation(() => {
                throw new Error('Forced route crash');
            });

            const freshRoutes = require('../../ai/routes/aiRoutes');
            app = express();
            app.use(express.json());
            app.use('/api/ai', freshRoutes);
        });

        const res = await request(app).get('/api/ai/status');
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Internal AI server error');
        errSpy.mockRestore();
    });

    it('aiController.handleChat возвращает 500 при ошибке aiService', async () => {
        const aiService = require('../../ai/services/aiService');
        const aiController = require('../../ai/controllers/aiController');
        jest.spyOn(aiService, 'sendChatMessage').mockRejectedValueOnce(new Error('Fatal error'));
        const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const app = express();
        app.use(express.json());
        app.post('/api/ai/chat', aiController.handleChat);

        const res = await request(app).post('/api/ai/chat').send({ message: 'тест' });
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Внутренняя ошибка AI модуля');
        errSpy.mockRestore();
    });
});
