// Все метки времени в проекте приводятся к строке "ГГГГ-ММ-ДДTЧЧ:00" в часовом поясе Europe/Moscow
const TIMEZONE = 'Europe/Moscow';

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

function formatIsoHourMillis(milliseconds) {
    return formatIsoHour(milliseconds / 1000);
}

function getTodayDateString(timestamp = Date.now()) {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
    const parts = new Intl.DateTimeFormat('sv-SE', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);

    const get = (type) => parts.find((part) => part.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
}

function isToday(timestampOrDate, referenceDate = Date.now()) {
    if (!timestampOrDate && timestampOrDate !== 0) return false;
    let ms = timestampOrDate;
    if (timestampOrDate instanceof Date) {
        ms = timestampOrDate.getTime();
    } else if (typeof timestampOrDate === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(timestampOrDate)) {
            return timestampOrDate === getTodayDateString(referenceDate);
        }
        ms = new Date(timestampOrDate).getTime();
    }
    if (typeof ms !== 'number' || isNaN(ms)) return false;
    return getTodayDateString(ms) === getTodayDateString(referenceDate);
}

module.exports = {
    TIMEZONE,
    formatIsoHour,
    formatIsoHourMillis,
    getTodayDateString,
    isToday
};