const dbConfig = require('../config/db');
const timeUtils = require('./timeUtils');

// In-memory fallback хранилище
const _memCache = new Map();

function quantizeCoordinates(lat, lon, step = 0.2) {
    if (lat === undefined || lat === null || lon === undefined || lon === null) {
        throw new Error('Coordinates are required');
    }
    if (typeof lat !== 'number' || typeof lon !== 'number' || !isFinite(lat) || !isFinite(lon)) {
        throw new Error('Coordinates must be finite numbers');
    }
    if (lat < -90 || lat > 90) {
        throw new Error(`Latitude ${lat} is out of valid range [-90, 90]`);
    }
    if (lon < -180 || lon > 180) {
        throw new Error(`Longitude ${lon} is out of valid range [-180, 180]`);
    }

    // Квантование к ближайшему шагу через Math.round
    const qLatRaw = Math.round(lat / step) * step;
    const qLonRaw = Math.round(lon / step) * step;

    // Устранение FP-артефактов
    const qLatNum = Math.round(qLatRaw * 100) / 100;
    const qLonNum = Math.round(qLonRaw * 100) / 100;

    const qLat = Object.is(qLatNum, -0) ? '0.00' : qLatNum.toFixed(2);
    const qLon = Object.is(qLonNum, -0) ? '0.00' : qLonNum.toFixed(2);

    return {
        qLat,
        qLon,
        cacheKey: `grid_micro_${qLat}_${qLon}`
    };
}

async function getSpatialCache(cacheKey, ignoreTTL = false) {
    try {
        const db = dbConfig.getDB();

        //in-memory fallback
        if (!db) {
            const entry = _memCache.get(cacheKey);
            if (!entry) return null;
            if (!ignoreTTL && Date.now() >= entry.expiresAt) {
                _memCache.delete(cacheKey);
                return null;
            }
            return entry.data;
        }
        const row = await db.get(
            'SELECT data, expires_at FROM api_cache WHERE key = ?',
            [cacheKey]
        );

        if (!row) return null;
        if (!ignoreTTL && Date.now() >= row.expires_at) return null;

        try {
            return JSON.parse(row.data);
        } catch (_) {
            return null;
        }
    } catch {
        const entry = _memCache.get(cacheKey);
        if (!entry) return null;
        if (!ignoreTTL && Date.now() >= entry.expiresAt) {
            _memCache.delete(cacheKey);
            return null;
        }
        return entry.data;
    }
}


async function setSpatialCache(cacheKey, gridData, ttlSeconds = 3600) {
    const now = Date.now();
    const expiresAt = now + ttlSeconds * 1000;
    const serialized = JSON.stringify(gridData);
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    _memCache.set(cacheKey, { data: gridData, expiresAt, updatedAt: now });

    try {
        const db = dbConfig.getDB();

        
        if (!db) return;
        
        await db.run(
            'INSERT OR REPLACE INTO api_cache (key, data, expires_at, updated_at) VALUES (?, ?, ?, ?)',
            [cacheKey, serialized, expiresAt, now]
        );
        await db.run(
            'DELETE FROM api_cache WHERE updated_at < ?',
            [sevenDaysAgo]
        );
    } catch {

    }
}


async function clearSpatialCache(pattern = 'grid_%') {
    let memDeleted = 0;
    const regex = new RegExp('^' + pattern.replace(/%/g, '.*') + '$');

    for (const key of _memCache.keys()) {
        if (regex.test(key)) {
            _memCache.delete(key);
            memDeleted++;
        }
    }

    try {
        const db = dbConfig.getDB();
        if (!db) return memDeleted;

        const result = await db.run('DELETE FROM api_cache WHERE key LIKE ?', [pattern]);
        return result?.changes ?? 0;
    } catch {
    }
}

// Извлекает запись кэша вместе с метаданными времени обновления
async function getSpatialCacheEntry(cacheKey) {
    try {
        const db = dbConfig.getDB();

        if (!db) {
            const entry = _memCache.get(cacheKey);
            if (!entry) return null;
            return {
                data: entry.data,
                expiresAt: entry.expiresAt,
                updatedAt: entry.updatedAt || entry.expiresAt
            };
        }

        const row = await db.get(
            'SELECT data, expires_at, updated_at FROM api_cache WHERE key = ?',
            [cacheKey]
        );

        if (!row) return null;

        try {
            return {
                data: JSON.parse(row.data),
                expiresAt: row.expires_at,
                updatedAt: row.updated_at
            };
        } catch (_) {
            return null;
        }
    } catch {
        const entry = _memCache.get(cacheKey);
        if (!entry) return null;
        return {
            data: entry.data,
            expiresAt: entry.expiresAt,
            updatedAt: entry.updatedAt || entry.expiresAt
        };
    }
}

// Проверяет, была ли запись кэша сохранена сегодня в Europe/Moscow
function isRecordSavedToday(record, updatedAt) {
    if (!record) return false;
    const todayStr = timeUtils.getTodayDateString();

    if (record.cached_date) {
        return record.cached_date === todayStr;
    }

    const timestamp = updatedAt || record.cached_at || record.updated_at;
    if (timestamp !== undefined && timestamp !== null) {
        return timeUtils.isToday(timestamp);
    }

    return true;
}

// Возвращает макросетку, если она ещё свежая по TTL или сохранена за сегодня.
// Проверка TTL имеет приоритет над календарным днём: сетка, загруженная перед
// полночью, не считается устаревшей только из-за смены даты. Это предотвращает
// лишний запрос к Open-Meteo ровно в 00:00, когда API часто недоступно.
async function getTodayMacroGrid(cacheKey = 'grid_macro_russia') {
    const entry = await getSpatialCacheEntry(cacheKey);
    if (!entry || !entry.data) return null;

    const now = Date.now();

    // Если TTL ещё не истёк, данные свежие — отдаём их независимо от смены календарного дня
    if (entry.expiresAt && now < entry.expiresAt) {
        return entry.data;
    }

    // Иначе — только если запись сохранена именно сегодня (принудительное обновление со сменой суток)
    if (!isRecordSavedToday(entry.data, entry.updatedAt)) {
        return null;
    }

    return entry.data;
}

// Проверяет факт наличия сохраненной макросетки за сегодня (в этот день)
async function isMacroGridSavedToday(cacheKey = 'grid_macro_russia') {
    const grid = await getTodayMacroGrid(cacheKey);
    return grid !== null;
}

module.exports = {
    quantizeCoordinates,
    getSpatialCache,
    setSpatialCache,
    clearSpatialCache,
    getSpatialCacheEntry,
    isRecordSavedToday,
    getTodayMacroGrid,
    isMacroGridSavedToday
};

