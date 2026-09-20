// services/timeUtils.js — утилиты работы со временем
// Все метки времени в проекте приводятся к строке "ГГГГ-ММ-ДДTЧЧ:00"
// в часовом поясе Europe/Moscow (см. backupAirService и historyService).

const TIMEZONE = 'Europe/Moscow';

// Приводит Unix-время (секунды, UTC) к строке "ГГГГ-ММ-ДДTЧЧ:00" в Europe/Moscow.

function formatIsoHour(unixSeconds) {
    const date = new Date(unixSeconds * 1000);
    const parts = new Intl.DateTimeFormat('sv-SE', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date);

    const get = (type) => parts.find((part) => part.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

// То же самое, но на вход — Unix-время в миллисекундах
function formatIsoHourMillis(milliseconds) {
    return formatIsoHour(milliseconds / 1000);
}

module.exports = {
    formatIsoHour,
    formatIsoHourMillis
};