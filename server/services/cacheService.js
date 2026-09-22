// services/cacheService.js — кэширование ответов внешних запросов
// Если база недоступна (битый файл, нет драйвера) — кэш на время
// запроса деградирует во in-memory Map, сервер при этом продолжает работать.

const { getDB } = require('../config/db');

// Предел хранения записей: 7 суток
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const memory = new Map();

// Любой сбой даёт null — кэш в этом случае уходит во in-memory запас и сервер продолжает работать.
async function getDbOrNull() {
    try {
        const db = await Promise.resolve(getDB());
        return db || null;
    } catch (error) {
        return null;
    }
}

// Прочитать кэш. key — строка ключа; ignoreTTL — игнорировать срок действия
async function getCache(key, ignoreTTL = false) {
    const db = await getDbOrNull();
    if (!db) {
        const m = memory.get(key);
        if (!m) return null;
        if (!ignoreTTL && Date.now() >= m.expiresAt) {
            memory.delete(key);
            return null;
        }
        return m.data;
    }

    const row = await db.get('SELECT data, expires_at FROM api_cache WHERE key = ?', [key]);
    if (!row) return null;
    if (!ignoreTTL && Date.now() >= row.expires_at) return null;
    return JSON.parse(row.data);
}

// Записать данные в кэш. key — ключ; data — объект (сериализуется в JSON); ttlSeconds — срок действия в секундах.
async function setCache(key, data, ttlSeconds) {
    const db = await getDbOrNull();
    const expiresAt = Date.now() + ttlSeconds * 1000;

    if (!db) {
        memory.set(key, { data, expiresAt });
        return;
    }

    await db.run(
        'INSERT OR REPLACE INTO api_cache (key, data, expires_at, updated_at) VALUES (?, ?, ?, ?)',
        [key, JSON.stringify(data), expiresAt, Date.now()]
    );
    // Чистка записей старше 7 суток.
    await db.run('DELETE FROM api_cache WHERE updated_at < ?', [Date.now() - SEVEN_DAYS_MS]);
}

// общее число записей и число уже просроченных.
async function getCacheStats() {
    const db = await getDbOrNull();
    if (!db) {
        const now = Date.now();
        let expired = 0;
        for (const { expiresAt } of memory.values()) {
            if (now >= expiresAt) expired += 1;
        }
        return { entries: memory.size, expired };
    }

    const entriesRow = await db.get('SELECT COUNT(*) AS count FROM api_cache');
    const expiredRow = await db.get(
        'SELECT COUNT(*) AS count FROM api_cache WHERE expires_at < ?',
        [Date.now()]
    );
    return { entries: entriesRow.count, expired: expiredRow.count };
}

// Принудительная очистка кэша: по конкретному ключу или всей таблицы (без ключа).
// Возвращает число удалённых записей.
async function clear(key) {
    const db = await getDbOrNull();
    if (!db) {
        if (key === undefined) {
            const total = memory.size;
            memory.clear();
            return total;
        }
        return memory.delete(key) ? 1 : 0;
    }

    if (key === undefined) {
        const result = await db.run('DELETE FROM api_cache');
        return result ? result.changes : 0;
    }
    const result = await db.run('DELETE FROM api_cache WHERE key = ?', [key]);
    return result ? result.changes : 0;
}

module.exports = { getCache, setCache, getCacheStats, clear };
