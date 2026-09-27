require('dotenv').config();

const express = require('express');
const cors = require('cors');

const apiRoutes = require('./routes/api');
const { initDB, closeDB } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173'
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));
app.use(express.json());

app.use('/api', apiRoutes);

app.get('/ping', (req, res) => {
    res.json({ message: 'Бэкенд на связи!' });
});

// Обработчик 404 для неизвестных маршрутов
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Глобальный перехватчик ошибок
app.use((err, req, res, next) => {
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ error: 'CORS forbidden' });
    }
    console.error('Unhandled server error:', err.message || err);
    res.status(500).json({ error: 'Internal server error' });
});

let serverInstance = null;

async function startServer(port = PORT) {
    try {
        await initDB();
        return new Promise((resolve) => {
            serverInstance = app.listen(port, () => {
                console.log(`Сервер запущен на http://localhost:${port}`);
                resolve(serverInstance);
            });
        });
    } catch (error) {
        console.error('Ошибка инициализации сервера или базы данных:', error);
        process.exit(1);
    }
}

async function stopServer() {
    return new Promise((resolve) => {
        if (serverInstance) {
            serverInstance.close(async () => {
                await closeDB();
                serverInstance = null;
                resolve();
            });
        } else {
            closeDB().then(resolve);
        }
    });
}

function handleSignal(signal) {
    console.log(`Получен сигнал ${signal}. Завершение работы...`);
    stopServer().then(() => {
        console.log('Сервер и соединение с БД успешно закрыты.');
        process.exit(0);
    }).catch((err) => {
        console.error('Ошибка при остановке сервера:', err);
        process.exit(1);
    });
}

if (require.main === module) {
    startServer();
    process.on('SIGINT', () => handleSignal('SIGINT'));
    process.on('SIGTERM', () => handleSignal('SIGTERM'));
}

module.exports = app;
module.exports.startServer = startServer;
module.exports.stopServer = stopServer;