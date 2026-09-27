// tests/server.test.js — тесты верхнеуровневой конфигурации сервера (CORS, 404, ошибки)

const request = require('supertest');
const app = require('../server');

describe('Server: Root configuration', () => {
    describe('GET /ping', () => {
        it('должен отвечать 200 и сообщением о связи', async () => {
            const res = await request(app).get('/ping');
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ message: 'Бэкенд на связи!' });
        });
    });

    describe('404 Not Found', () => {
        it('должен возвращать JSON 404 для неизвестных маршрутов', async () => {
            const res = await request(app).get('/unknown-random-path');
            expect(res.status).toBe(404);
            expect(res.body).toEqual({ error: 'Endpoint not found' });
        });
    });

    describe('CORS', () => {
        it('должен разрешать запросы от разрешенного FRONTEND_URL', async () => {
            const res = await request(app)
                .get('/ping')
                .set('Origin', 'http://localhost:5173');

            expect(res.status).toBe(200);
            expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
        });

        it('должен отклонять запросы с неразрешенного origin', async () => {
            const res = await request(app)
                .get('/ping')
                .set('Origin', 'http://malicious-site.com');

            expect(res.status).toBe(403);
            expect(res.body).toEqual({ error: 'CORS forbidden' });
        });

        it('должен разрешать запросы без Origin (curl, server-to-server)', async () => {
            const res = await request(app).get('/ping');
            expect(res.status).toBe(200);
        });
    });
});
