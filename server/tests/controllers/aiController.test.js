const aiController = require('../../ai/controllers/aiController');
const aiService = require('../../ai/services/aiService');

describe('aiController unit tests', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('корректно обрабатывает appContext fallback для isColorBlind и isFollowUpAnalytics', async () => {
        const spy = jest.spyOn(aiService, 'sendChatMessage').mockResolvedValue({
            reply: 'ok'
        });

        const req = {
            body: {
                message: 'тест',
                appContext: {
                    isColorBlind: true,
                    isFollowUpAnalytics: true,
                    history: 'not-an-array'
                }
            }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await aiController.handleChat(req, res);

        expect(spy).toHaveBeenCalledWith(expect.objectContaining({
            isColorBlind: true,
            isFollowUpAnalytics: true,
            history: []
        }));
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            reply: 'ok',
            emotion: 'idle',
            action: null
        }));
    });

    it('handleTranscribe с дефолтным mimeType и ошибкой без message', async () => {
        const spy = jest.spyOn(aiService, 'transcribeAudio').mockResolvedValue('распознано');
        const req = {
            body: {
                audio: 'dGVzdA=='
            }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await aiController.handleTranscribe(req, res);
        expect(spy).toHaveBeenCalledWith({
            audioBase64: 'dGVzdA==',
            mimeType: 'audio/webm'
        });
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            text: 'распознано'
        }));

        spy.mockRejectedValueOnce({});
        await aiController.handleTranscribe(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Ошибка транскрипции аудио'
        });
    });

    it('использует прямые поля req.body (history, isColorBlind, isFollowUpAnalytics) вместо appContext', async () => {
        const spy = jest.spyOn(aiService, 'sendChatMessage').mockResolvedValue({
            reply: 'ok',
            emotion: 'happy',
            action: { type: 'set_theme', theme: 'dark' }
        });

        const req = {
            body: {
                message: 'тест',
                history: [{ role: 'user', content: 'привет' }],
                isColorBlind: false,
                isFollowUpAnalytics: false,
                appContext: {
                    isColorBlind: true,
                    isFollowUpAnalytics: true
                }
            }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await aiController.handleChat(req, res);

        expect(spy).toHaveBeenCalledWith(expect.objectContaining({
            history: [{ role: 'user', content: 'привет' }],
            isColorBlind: false,
            isFollowUpAnalytics: false
        }));
    });

    it('aiConfig.apiKey возвращает "not-needed", если LLM_API_KEY не задан', () => {
        const aiConfig = require('../../ai/config/aiConfig');
        const prevKey = process.env.LLM_API_KEY;
        delete process.env.LLM_API_KEY;
        try {
            expect(aiConfig.apiKey).toBe('not-needed');
        } finally {
            if (prevKey !== undefined) {
                process.env.LLM_API_KEY = prevKey;
            }
        }
    });
});
