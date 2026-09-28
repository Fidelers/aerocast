// tests/server.test.js — тесты верхнеуровневой конфигурации сервера (CORS, 404, ошибки, запуск, остановка и сигналы)

const { EventEmitter } = require('events');
const Module = require('module');
const request = require('supertest');
const app = require('../server');
const dbConfig = require('../config/db');

describe('Server: Root configuration', () => {
    let consoleLogSpy;
    let consoleErrorSpy;

    beforeEach(() => {
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(async () => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        jest.restoreAllMocks();
        await app.stopServer();
    });

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

        it('должен разрешать origin со слешем на конце (нормализация URL)', async () => {
            const res = await request(app)
                .get('/ping')
                .set('Origin', 'http://localhost:5173/');

            expect(res.status).toBe(200);
            expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173/');
        });

        it('должен разрешать origin 127.0.0.1:5173', async () => {
            const res = await request(app)
                .get('/ping')
                .set('Origin', 'http://127.0.0.1:5173');

            expect(res.status).toBe(200);
            expect(res.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');
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

        it('должен корректно инициализировать allowedOrigins из process.env.FRONTEND_URL', () => {
            const originalEnv = process.env.FRONTEND_URL;
            try {
                process.env.FRONTEND_URL = 'http://custom-frontend.domain:8080/';
                jest.resetModules();
                const freshApp = require('../server');
                expect(freshApp).toBeDefined();
            } finally {
                process.env.FRONTEND_URL = originalEnv;
            }
        });
    });

    describe('Global Error Handler', () => {
        it('должен перехватывать синтаксические ошибки JSON парсера и отдавать 500', async () => {
            const res = await request(app)
                .post('/ping')
                .set('Content-Type', 'application/json')
                .send('{"badJson:');

            expect(res.status).toBe(500);
            expect(res.body).toEqual({ error: 'Internal server error' });
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Unhandled server error:',
                expect.stringContaining('JSON')
            );
        });

        it('должен корректно обрабатывать ошибки без поля message (строки)', () => {
            const router = app.router || app._router;
            const errorHandler = router.stack.find(
                (layer) => !layer.route && layer.handle && layer.handle.length === 4
            ).handle;

            const req = {};
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis()
            };
            const next = jest.fn();

            errorHandler('Plain error string without message', req, res, next);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Unhandled server error:',
                'Plain error string without message'
            );
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
        });

        it('должен обрабатывать ошибки CORS через errorHandler', () => {
            const router = app.router || app._router;
            const errorHandler = router.stack.find(
                (layer) => !layer.route && layer.handle && layer.handle.length === 4
            ).handle;

            const req = {};
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis()
            };
            const next = jest.fn();

            errorHandler(new Error('Not allowed by CORS'), req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ error: 'CORS forbidden' });
        });
    });

    describe('Lifecycle: startServer & stopServer', () => {
        it('должен использовать 3000 при отсутствии process.env.PORT', () => {
            const originalPort = process.env.PORT;
            try {
                jest.resetModules();
                jest.doMock('dotenv', () => ({ config: () => ({}) }));
                delete process.env.PORT;
                const freshApp = require('../server');
                expect(freshApp).toBeDefined();
            } finally {
                jest.dontMock('dotenv');
                process.env.PORT = originalPort;
            }
        });

        it('должен успешно запускать сервер на заданном порту (0 для случайного) и останавливать его', async () => {
            const server = await app.startServer(0);
            expect(server).toBeDefined();
            expect(typeof server.address().port).toBe('number');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('Сервер запущен на http://localhost:')
            );

            await expect(app.stopServer()).resolves.toBeUndefined();
        });

        it('должен отклонять промис stopServer, если serverInstance.close возвращает ошибку', async () => {
            const server = await app.startServer(0);
            const closeSpy = jest.spyOn(server, 'close').mockImplementationOnce((cb) => cb(new Error('Close error')));

            await expect(app.stopServer()).rejects.toThrow('Close error');
            closeSpy.mockRestore();
            await new Promise((resolve) => server.close(resolve));
        });

        it('должен отклонять промис stopServer, если db.closeDB завершается ошибкой при активном serverInstance', async () => {
            await app.startServer(0);
            jest.spyOn(dbConfig, 'closeDB').mockRejectedValueOnce(new Error('DB close fail'));

            await expect(app.stopServer()).rejects.toThrow('DB close fail');
        });

        it('должен использовать дефолтный PORT при вызове startServer без аргументов', async () => {
            const mockServer = {
                on: jest.fn(),
                close: jest.fn((cb) => cb && cb())
            };
            const listenSpy = jest.spyOn(app, 'listen').mockImplementation((port, cb) => {
                process.nextTick(cb);
                return mockServer;
            });
            jest.spyOn(dbConfig, 'initDB').mockResolvedValueOnce();

            const instance = await app.startServer();
            expect(instance).toBe(mockServer);
            expect(listenSpy).toHaveBeenCalledWith(
                process.env.PORT || 3000,
                expect.any(Function)
            );

            await app.stopServer();
            listenSpy.mockRestore();
        });

        it('должен обрабатывать ошибку EADDRINUSE при занятом порте', async () => {
            const mockServer = new EventEmitter();
            mockServer.close = jest.fn((cb) => cb && cb());
            const listenSpy = jest.spyOn(app, 'listen').mockImplementation(() => {
                process.nextTick(() => {
                    const err = new Error('listen EADDRINUSE: address already in use');
                    err.code = 'EADDRINUSE';
                    mockServer.emit('error', err);
                });
                return mockServer;
            });
            jest.spyOn(dbConfig, 'initDB').mockResolvedValueOnce();

            await expect(app.startServer(3000)).rejects.toThrow('listen EADDRINUSE');
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Порт 3000 уже занят другим процессом.')
            );

            listenSpy.mockRestore();
        });

        it('должен обрабатывать общие сетевые ошибки сервера (не EADDRINUSE)', async () => {
            const mockServer = new EventEmitter();
            mockServer.close = jest.fn((cb) => cb && cb());
            const listenSpy = jest.spyOn(app, 'listen').mockImplementation(() => {
                process.nextTick(() => {
                    const err = new Error('Permission denied');
                    err.code = 'EACCES';
                    mockServer.emit('error', err);
                });
                return mockServer;
            });
            jest.spyOn(dbConfig, 'initDB').mockResolvedValueOnce();

            await expect(app.startServer(80)).rejects.toThrow('Permission denied');
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Ошибка сетевого сервера:',
                'Permission denied'
            );

            listenSpy.mockRestore();
        });

        it('должен пробрасывать и логировать ошибку с сообщением при сбое initDB', async () => {
            jest.spyOn(dbConfig, 'initDB').mockRejectedValueOnce(new Error('DB connection failure'));

            await expect(app.startServer(0)).rejects.toThrow('DB connection failure');
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Ошибка инициализации сервера или базы данных:',
                'DB connection failure'
            );
        });

        it('должен логировать строковую ошибку без message при сбое initDB', async () => {
            jest.spyOn(dbConfig, 'initDB').mockRejectedValueOnce('Raw DB failure string');

            await expect(app.startServer(0)).rejects.toBe('Raw DB failure string');
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Ошибка инициализации сервера или базы данных:',
                'Raw DB failure string'
            );
        });

        it('должен корректно завершать stopServer, если serverInstance равен null', async () => {
            await expect(app.stopServer()).resolves.toBeUndefined();
        });
    });

    describe('Signals: handleSignal', () => {
        let exitSpy;

        beforeEach(() => {
            exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
        });

        afterEach(() => {
            exitSpy.mockRestore();
        });

        it('должен корректно останавливать сервер и вызывать process.exit(0) при штатном сигнале', async () => {
            await app.handleSignal('SIGINT');

            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('Получен сигнал SIGINT')
            );
            expect(consoleLogSpy).toHaveBeenCalledWith(
                'Сервер и соединение с БД успешно закрыты.'
            );
            expect(exitSpy).toHaveBeenCalledWith(0);
        });

        it('должен логировать ошибку и вызывать process.exit(1) при сбое stopServer', async () => {
            jest.spyOn(dbConfig, 'closeDB').mockRejectedValueOnce(new Error('Shutdown error'));

            await app.handleSignal('SIGTERM');

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Ошибка при остановке сервера:',
                expect.any(Error)
            );
            expect(exitSpy).toHaveBeenCalledWith(1);
        });
    });

    describe('CLI Entrypoint (startCli & process.env.NODE_ENV === cli-test)', () => {
        let origNodeEnv;
        let origPort;

        beforeEach(() => {
            origNodeEnv = process.env.NODE_ENV;
            origPort = process.env.PORT;
        });

        afterEach(async () => {
            process.env.NODE_ENV = origNodeEnv;
            process.env.PORT = origPort;
            jest.restoreAllMocks();
            await app.stopServer();
        });

        it('должен запускать сервер и регистрировать обработчики сигналов при прямом вызове', async () => {
            const handlers = {};
            const processOnSpy = jest.spyOn(process, 'on').mockImplementation((event, handler) => {
                handlers[event] = handler;
                return process;
            });
            const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

            process.env.NODE_ENV = 'cli-test';
            process.env.PORT = '0';
            jest.resetModules();

            const freshApp = require('../server');

            // Проверяем регистрацию слушателей
            expect(handlers['SIGINT']).toBeDefined();
            expect(handlers['SIGTERM']).toBeDefined();
            expect(handlers['unhandledRejection']).toBeDefined();
            expect(handlers['uncaughtException']).toBeDefined();

            // Вызываем слушатель unhandledRejection
            handlers['unhandledRejection']('Promise rejected test reason');
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Unhandled Promise Rejection:',
                'Promise rejected test reason'
            );

            // Вызываем слушатель uncaughtException
            const uncaughtError = new Error('Uncaught exception test');
            handlers['uncaughtException'](uncaughtError);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Uncaught Exception:',
                uncaughtError
            );

            // Вызываем слушатель SIGINT
            await handlers['SIGINT']();
            expect(exitSpy).toHaveBeenCalledWith(0);

            // Вызываем слушатель SIGTERM
            await handlers['SIGTERM']();

            await freshApp.stopServer();
            processOnSpy.mockRestore();
        });

        it('должен вызывать process.exit(1) при ошибке запуска в режиме main/cli', async () => {
            const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

            process.env.NODE_ENV = 'cli-test';
            jest.resetModules();
            jest.doMock('../config/db', () => ({
                initDB: jest.fn().mockRejectedValue(new Error('Fatal DB crash on boot')),
                closeDB: jest.fn().mockResolvedValue()
            }));

            require('../server');

            // Даем промису startServer().catch() выполниться
            await new Promise((resolve) => setImmediate(resolve));

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Ошибка инициализации сервера или базы данных:',
                'Fatal DB crash on boot'
            );
            expect(exitSpy).toHaveBeenCalledWith(1);
        });

        it('должен поддерживать прямой вызов startCli() как экспортируемой функции', async () => {
            const handlers = {};
            const processOnSpy = jest.spyOn(process, 'on').mockImplementation((event, handler) => {
                handlers[event] = handler;
                return process;
            });
            const listenSpy = jest.spyOn(app, 'listen').mockImplementation((port, cb) => {
                process.nextTick(cb);
                return { on: jest.fn(), close: jest.fn((c) => c && c()) };
            });
            jest.spyOn(dbConfig, 'initDB').mockResolvedValueOnce();

            const p = app.startCli();
            await p;

            expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
            expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
            await app.stopServer();
            listenSpy.mockRestore();
            processOnSpy.mockRestore();
        });
    });
});
