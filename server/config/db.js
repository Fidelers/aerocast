// config/db.js — подключение к базе данных (SQLite, файл cache.db)

// Единая точка доступа к базе: таблица api_cache (быстрый кэш ответов внешних источников) и air_quality_history (архив замеров).

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

// Файл базы лежит в корне server/ (рядом с этим модулем).
// Переменной окружения DB_PATH можно указать своё расположение.
const DB_FILE = process.env.DB_PATH || path.join(__dirname, '..', 'cache.db');

let dbPromise = null;

// Создаёт таблицы, если их ещё нет (миграция при первом старте).
async function migrate(db) {
    await db.exec(`
        CREATE TABLE IF NOT EXISTS api_cache (
            key TEXT PRIMARY KEY,   
            data TEXT,               
            expires_at INTEGER,            
            updated_at INTEGER             
        );

        CREATE TABLE IF NOT EXISTS air_quality_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            latitude REAL,
            longitude REAL,
            timestamp INTEGER,        
            pollutant_data TEXT,           
            source TEXT
        );
    `);
    return db;
}

// Открывает соединение и прогоняет миграции.
function openDB() {
    dbPromise = open({ filename: DB_FILE, driver: sqlite3.Database })
        .then(migrate)
        .catch((error) => {
            dbPromise = null;
            throw error;
        });
    return dbPromise;
}

// соединение открывается при первом обращении server.js не трогает базу на старте, и сервер поднимается даже при
// отсутствующем/битом файле cache.db — сервисы сами перейдут во in-memory fallback.
async function getDB() {
    if (!dbPromise) {
        dbPromise = openDB();
    }
    return dbPromise;
}

// Явная инициализация при старте сервера: открывает файл и создаёт таблицы.
async function initDB() {
    return getDB();
}

// Закрывает соединение (при выключении сервера). Следующий getDB() откроет базу заново.
async function closeDB() {
    if (!dbPromise) return;
    const db = await dbPromise;
    await db.close();
    dbPromise = null;
}

module.exports = { getDB, initDB, closeDB };