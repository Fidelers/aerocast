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

// Любой сбой даёт null — кэш в этом случае уходит во in-memory запас и сервер продолжает работать.
// ВАЖНО: getDB() — async-функция, возвращающая Promise. Без await обращение к db.get/db.run
// падало с TypeError, ошибка молча глоталась catch'ем, и пространственный кэш НИКОГДА не попадал
// в файл cache.db — после перезапуска сервера все сетки терялись.
async function getDbOrNull() {
    try {
        const db = await dbConfig.getDB();
        return db || null;
    } catch (_) {
        return null;
    }
}

// Чтение из in-memory запаса процесса (fallback при недоступности/пустой SQLite)
function readMemCache(cacheKey, ignoreTTL = false) {
    const entry = _memCache.get(cacheKey);
    if (!entry) return null;
    if (!ignoreTTL && Date.now() >= entry.expiresAt) {
        _memCache.delete(cacheKey);
        return null;
    }
    return entry.data;
}

async function getSpatialCache(cacheKey, ignoreTTL = false) {
    try {
        const db = await getDbOrNull();

        if (db) {
            const row = await db.get(
                'SELECT data, expires_at FROM api_cache WHERE key = ?',
                [cacheKey]
            );

            if (row) {
                if (!ignoreTTL && Date.now() >= row.expires_at) return null;
                try {
                    return JSON.parse(row.data);
                } catch (_) {
                    // Битый JSON: обычное чтение — это промах,
                    // офлайн-резерв (ignoreTTL) пытается прочитать из памяти
                    if (!ignoreTTL) return null;
                }
            } else if (!ignoreTTL) {
                return null; // промах по БД в обычном режиме (БД — источник истины)
            }

            // Офлайн-резерв (ignoreTTL = true): записи в БД нет (например, запись не удалась
            // или строка была удалена) — обязательно пробуем in-memory кэш процесса, иначе
            // при недоступном Open-Meteo сетка не отрисовывается вовсе
            return readMemCache(cacheKey, true);
        }
    } catch (_) {
        // БД недоступна — используем in-memory запас ниже
    }

    return readMemCache(cacheKey, ignoreTTL);
}


async function setSpatialCache(cacheKey, gridData, ttlSeconds = 3600) {
    const now = Date.now();
    const expiresAt = now + ttlSeconds * 1000;
    const serialized = JSON.stringify(gridData);
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    _memCache.set(cacheKey, { data: gridData, expiresAt, updatedAt: now });

    try {
        const db = await getDbOrNull();

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
        // Сбой БД не должен ломать запрос: данные уже лежат в in-memory кэше
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
        const db = await getDbOrNull();
        if (!db) return memDeleted;

        const result = await db.run('DELETE FROM api_cache WHERE key LIKE ?', [pattern]);
        return result?.changes ?? 0;
    } catch {
        return memDeleted;
    }
}

// Извлекает запись кэша вместе с метаданными времени обновления
async function getSpatialCacheEntry(cacheKey) {
    try {
        const db = await getDbOrNull();

        if (db) {
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
        }
    } catch (_) {
        // БД недоступна — используем in-memory запас ниже
    }

    const entry = _memCache.get(cacheKey);
    if (!entry) return null;
    return {
        data: entry.data,
        expiresAt: entry.expiresAt,
        updatedAt: entry.updatedAt || entry.expiresAt
    };
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

// Горизонт прогноза макросетки: batchAirService запрашивает Open-Meteo с forecast_days=4,
// т.е. сегодня + 3 дня вперёд (264 часа = 7 суток архива + 4 суток прогноза).
const MACRO_COVER_DAYS_AHEAD = 3;

// Дата последнего часа, покрытого сеткой ("ГГГГ-ММ-ДД"), либо null, если массива time нет
function getGridLastCoveredDate(gridData) {
    const time = gridData?.time;
    if (!Array.isArray(time) || time.length === 0) return null;
    const lastDate = String(time[time.length - 1] || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(lastDate) ? lastDate : null;
}

// Покрывает ли сетка прогноз как минимум на 3 дня вперёд от сегодняшнего дня (Europe/Moscow).
// Пример (сегодня 20-е): сетка, загруженная вчера, заканчивается 22-м числом -> false (нужен
// новый запрос к Open-Meteo за точками на будущее); сетка, загруженная сегодня, заканчивается
// 23-м числом (сегодня+3) -> true, её можно отдавать из кэша вплоть до конца дня, в том числе
// после перезапуска сервера.
function coversForecastHorizon(gridData) {
    const lastCoveredDate = getGridLastCoveredDate(gridData);
    if (!lastCoveredDate) return false;
    const requiredDate = timeUtils.getTodayDateString(
        Date.now() + MACRO_COVER_DAYS_AHEAD * 24 * 60 * 60 * 1000
    );
    // Строки "ГГГГ-ММ-ДД" корректно сравниваются лексикографически
    return lastCoveredDate >= requiredDate;
}

// Возвращает макросетку из кэша, только если она пригодна для отрисовки сегодня:
// 1) покрывает прогноз как минимум на 3 дня вперёд (сегодня + 3) — основное правило;
// 2) иначе — запись без массива time (legacy), сохранённая сегодня (Europe/Moscow).
// TTL намеренно НЕ является основанием: сетка, загруженная вчера (пусть ещё в пределах
// TTL), покрывает только сегодня+2 и НЕ отдаётся — первый запрос в новый день гарантированно
// забирает свежие точки у Open-Meteo. Если API в этот момент недоступен, контроллер сетки
// отдаёт устаревший кэш с пометкой offline_database (см. gridAirController).
async function getTodayMacroGrid(cacheKey = 'grid_macro_russia') {
    const entry = await getSpatialCacheEntry(cacheKey);
    if (!entry || !entry.data) return null;

    const data = entry.data;

    if (coversForecastHorizon(data)) return data;

    // Legacy-записи без time: ориентируемся на дату сохранения.
    // Записи с time, но без покрытия горизонта, считаются устаревшими (иначе
    // повторный запрос к API при усечённом прогнозе не происходил бы вовсе).
    if (getGridLastCoveredDate(data) === null && !Array.isArray(data.time)
        && isRecordSavedToday(data, entry.updatedAt)) {
        return data;
    }

    return null;
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
    isMacroGridSavedToday,
    coversForecastHorizon
};

