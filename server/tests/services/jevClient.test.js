const axios = require('axios');
const { scoreDecisions } = require('../../ai/services/jevClient');

jest.mock('axios');

describe('jevClient.scoreDecisions', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('успешно возвращает данные решений от микросервиса', async () => {
        const mockData = {
            map_layer: { answer: 'set_satellite', top_probability: 0.99 },
            guardrail: { answer: 'safe', top_probability: 1.0 }
        };
        axios.post.mockResolvedValueOnce({ data: mockData });

        const result = await scoreDecisions('включи спутник', { theme: 'dark' });
        expect(result).toEqual(mockData);
        expect(axios.post).toHaveBeenCalledWith(
            expect.stringContaining('/decide_many'),
            expect.objectContaining({
                state: expect.objectContaining({
                    app: 'AeroCast',
                    user_message: 'включи спутник'
                })
            }),
            expect.any(Object)
        );
    });

    it('обрабатывает null или пустое сообщение', async () => {
        axios.post.mockResolvedValueOnce({ data: { guardrail: { answer: 'safe' } } });
        const result = await scoreDecisions(null);
        expect(result).toBeDefined();
        expect(axios.post).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                state: { app: 'AeroCast', user_message: '' }
            }),
            expect.any(Object)
        );
    });

    it('возвращает null и логирует warn при ошибке сети или таймауте', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        axios.post.mockRejectedValueOnce(new Error('Connection timed out'));

        const result = await scoreDecisions('тест ошибки');
        expect(result).toBeNull();
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('[JevClient] Service unavailable or timeout:'),
            'Connection timed out'
        );
        warnSpy.mockRestore();
    });
});
