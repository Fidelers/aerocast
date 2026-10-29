// Единая точка доступа к базе: таблица api_cache (быстрый кэш ответов внешних источников) и air_quality_history (архив замеров).

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

// Переменной окружения DB_PATH можно указать своё расположение
const DB_FILE = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'cache.db');

let dbPromise = null;

async function migrate(db) {
    await db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA busy_timeout = 5000;
        PRAGMA synchronous = NORMAL;

        CREATE TABLE IF NOT EXISTS api_cache (
            key TEXT PRIMARY KEY,   
            data TEXT,               
            expires_at INTEGER,            
            updated_at INTEGER             
        );

        CREATE INDEX IF NOT EXISTS idx_api_cache_expires_at ON api_cache(expires_at);
        CREATE INDEX IF NOT EXISTS idx_api_cache_updated_at ON api_cache(updated_at);

        CREATE TABLE IF NOT EXISTS air_quality_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            latitude REAL,
            longitude REAL,
            timestamp INTEGER,        
            pollutant_data TEXT,           
            source TEXT,
            UNIQUE(latitude, longitude, timestamp)
        );
    `);
    return db;
}

const fs = require('fs');

function openDB() {
    if (DB_FILE !== ':memory:') {
        const dbDir = path.dirname(DB_FILE);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
    }

    dbPromise = open({ filename: DB_FILE, driver: sqlite3.Database })
        .then(migrate)
        .catch((error) => {
            dbPromise = null;
            throw error;
        });
    return dbPromise;
}

// Соединение открывается при первом обращении: server.js не трогает базу на старте,
// и сервер поднимается даже при битом/отсутствующем файле cache.db (сервисы перейдут во in-memory fallback)
async function getDB() {
    if (!dbPromise) {
        dbPromise = openDB();
    }
    return dbPromise;
}

async function initDB() {
    return getDB();
}

async function closeDB() {
    if (!dbPromise) return;
    const db = await dbPromise;
    await db.close();
    dbPromise = null;
}

module.exports = { getDB, initDB, closeDB };