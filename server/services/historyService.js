// services/historyService.js — хранение и работа с историей замеров

// Архив живёт в SQLite (таблица air_quality_history), соединение через config/db.
// Метки времени в базе хранятся в UTC-миллисекундах, а в ответах внешних источников время дано в Europe/Moscow

const { getDB } = require('../config/db');
const { formatIsoHourMillis } = require('./timeUtils');

// Предел хранения архива: 7 суток
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MOSCOW_OFFSET = '+03:00';

async function getDbOrNull() {
    try {
        const db = await Promise.resolve(getDB());
        return db || null;
    } catch (error) {
        return null;
    }
}


function parseMoscowHourToMillis(hourString) {
    const value = String(hourString).trim();
    // Если это уже полноценная — парсим как есть.
    if (/[zZ]$/.test(value) || /[+-]\d{2}:\d{2}$/.test(value)) {
        return Date.parse(value);
    }
    // "ГГГГ-ММ-ДДTЧЧ:00" -> дописываем секунды и фиксированное смещение +03:00.
    const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
        ? `${value}:00`
        : value;
    return Date.parse(`${withSeconds}${MOSCOW_OFFSET}`);
}

// Из нормализованного ответа air-эндпоинта сохраняются только ПРОШЕДШИЕ часы.
// После записи удаляются записи старше 7 суток.
async function saveFromResponse(data) {
    const db = await getDbOrNull();
    if (!db) return; // БД недоступна — архив не блокирует ответ клиенту

    const { latitude, longitude, used_source, hourly } = data || {};
    if (!hourly || !Array.isArray(hourly.time)) return;

    const now = Date.now();
    const source = used_source || 'unknown';
    const pollutants = Object.keys(hourly).filter((field) => field !== 'time');

    for (let i = 0; i < hourly.time.length; i += 1) {
        const timestamp = parseMoscowHourToMillis(hourly.time[i]);
        // Только прошедшие часы
        if (!Number.isFinite(timestamp) || timestamp >= now) continue;

        const point = {};
        for (const field of pollutants) {
            const values = hourly[field];
            if (Array.isArray(values)) point[field] = values[i];
        }
        if (Object.keys(point).length === 0) continue;

        await db.run(
            'INSERT OR IGNORE INTO air_quality_history (latitude, longitude, timestamp, pollutant_data, source) VALUES (?, ?, ?, ?, ?)',
            [latitude, longitude, timestamp, JSON.stringify(point), source]
        );
    }

    // всё, что старше 7 суток, удаляем.
    await db.run('DELETE FROM air_quality_history WHERE timestamp < ?', [now - SEVEN_DAYS_MS]);
}

// Последняя запись для заданных координат.
async function getLatest(lat, lon) {
    const db = await getDbOrNull();
    if (!db) return null;

    return db.get(
        'SELECT * FROM air_quality_history WHERE latitude = ? AND longitude = ? ORDER BY timestamp DESC LIMIT 1',
        [lat, lon]
    );
}

// Слияние свежих данных с архивом (приоритет у свежих).
async function mergeWithFresh(freshData, lat, lon) {
    if (!freshData || !freshData.hourly || !Array.isArray(freshData.hourly.time) || freshData.hourly.time.length === 0) {
        return freshData;
    }

    // Координаты округляем до 2 знаков (~1.1 км) — разрешение хранения в архиве.
    const lat2 = Number(Number(lat).toFixed(2));
    const lon2 = Number(Number(lon).toFixed(2));

    const db = await getDbOrNull();
    const archiveRows = db
        ? await db.all(
            `SELECT timestamp, pollutant_data, source
             FROM air_quality_history
             WHERE latitude = ? AND longitude = ?
               AND timestamp >= ?
             ORDER BY timestamp ASC`,
            [lat2, lon2, Date.now() - SEVEN_DAYS_MS]
        )
        : [];

    // Карта "ГГГГ-ММ-ДДTЧЧ:00" -> значения. Сначала свежие данные (высший
    // приоритет), затем архив — только если ключа ещё нет.
    const byHour = new Map();
    const freshTime = freshData.hourly.time;
    const pollutants = Object.keys(freshData.hourly).filter((field) => field !== 'time');

    freshTime.forEach((timeStr, i) => {
        const values = {};
        for (const field of pollutants) {
            const arr = freshData.hourly[field];
            if (Array.isArray(arr)) values[field] = arr[i];
        }
        byHour.set(String(timeStr), values);
    });

    let archiveAdded = false;
    for (const row of archiveRows) {
        const hourKey = formatIsoHourMillis(row.timestamp);
        if (byHour.has(hourKey)) continue; // свежие данные важнее архива
        let parsed = {};
        try {
            parsed = JSON.parse(row.pollutant_data);
        } catch (error) {
            parsed = {};
        }
        byHour.set(hourKey, parsed || {});
        archiveAdded = true;
    }

    const sortedKeys = [...byHour.keys()].sort();

    const merged = { ...freshData };
    merged.hourly = { time: sortedKeys };
    for (const field of pollutants) {
        merged.hourly[field] = sortedKeys.map(
            (hourKey) => (Object.prototype.hasOwnProperty.call(byHour.get(hourKey), field) ? byHour.get(hourKey)[field] : null)
        );
    }

    // Флаг при котором в ответ были добавлены данные из архива.
    if (archiveAdded) merged.history_merged = true;

    return merged;
}

module.exports = { saveFromResponse, getLatest, mergeWithFresh };
