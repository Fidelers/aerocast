// src/utils/timeUtils.js — утилиты группировки и обработки временных меток airData

const WEEKDAYS_RU = Object.freeze(['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ']);


export function parseIsoTimeString(timeStr) {
    if (typeof timeStr !== 'string') return null;

    const match = timeStr.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
    if (match) {
        const dateStr = match[1];
        const hour = parseInt(match[2], 10);
        const minute = match[3];
        return {
            dateStr,
            timeLabel: `${match[2]}:${minute}`,
            hour
        };
    }

    const d = new Date(timeStr);
    if (Number.isNaN(d.getTime())) return null;

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = d.getHours();
    const hourStr = String(hour).padStart(2, '0');
    const minuteStr = String(d.getMinutes()).padStart(2, '0');

    return {
        dateStr: `${year}-${month}-${day}`,
        timeLabel: `${hourStr}:${minuteStr}`,
        hour
    };
}


export function formatDateKey(date) {
    if (!date) return '';
    if (typeof date === 'string') {
        const parsed = parseIsoTimeString(date);
        if (parsed) return parsed.dateStr;
        const match = date.match(/^(\d{4}-\d{2}-\d{2})/);
        return match ? match[1] : '';
    }
    if (date instanceof Date && !Number.isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    return '';
}


export function getDayInfo(dateStr) {
    if (typeof dateStr !== 'string') {
        return { dayOfWeek: '', dayOfMonth: '' };
    }

    const parts = dateStr.split('-');
    if (parts.length !== 3) {
        return { dayOfWeek: '', dayOfMonth: '' };
    }

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const d = new Date(year, month, day);
    if (Number.isNaN(d.getTime())) {
        return { dayOfWeek: '', dayOfMonth: '' };
    }

    const dayOfWeek = WEEKDAYS_RU[d.getDay()] || '';
    const dayOfMonth = String(day);

    return { dayOfWeek, dayOfMonth };
}

export function groupTimesByDay(timeArray, referenceDate = new Date(), options = 3) {
    if (!Array.isArray(timeArray) || timeArray.length === 0) {
        return [];
    }

    const stepHours = typeof options === 'number'
        ? options
        : (options?.stepHours ?? 3);

    const refDateStr = formatDateKey(referenceDate);
    const daysMap = new Map();

    timeArray.forEach((timeStr, index) => {
        const parsed = parseIsoTimeString(timeStr);
        if (!parsed) return;

        const { dateStr, timeLabel, hour } = parsed;

        if (!daysMap.has(dateStr)) {
            const { dayOfWeek, dayOfMonth } = getDayInfo(dateStr);
            const isToday = Boolean(refDateStr && dateStr === refDateStr);
            const isForecast = Boolean(refDateStr && dateStr > refDateStr);
            const isPast = Boolean(refDateStr && dateStr < refDateStr);

            daysMap.set(dateStr, {
                dateStr,
                dayOfWeek,
                dayOfMonth,
                isToday,
                isForecast,
                isPast,
                hours: []
            });
        }

        // Фильтрация с шагом: например, при stepHours = 3 берутся часы 0, 3, 6, 9, 12, 15, 18, 21
        if (stepHours > 1 && hour % stepHours !== 0) {
            return;
        }

        const dayGroup = daysMap.get(dateStr);
        dayGroup.hours.push({
            index,
            timeStr,
            timeLabel,
            hour,
            dateStr
        });
    });

    return Array.from(daysMap.values());
}

export function findDefaultTimeIndex(timeArray, referenceDate = new Date(), options = 3) {
    if (!Array.isArray(timeArray) || timeArray.length === 0) {
        return null;
    }

    const stepHours = typeof options === 'number'
        ? options
        : (options?.stepHours ?? 3);

    const refDateStr = formatDateKey(referenceDate);
    let targetHour = null;
    if (referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())) {
        targetHour = referenceDate.getHours();
    }

    let exactMatchIndex = -1;
    let closestHourIndex = -1;
    let minHourDiff = Infinity;
    let todayFirstIndex = -1;
    let fallbackClosestIndex = -1;
    let fallbackMinDiff = Infinity;

    for (let i = 0; i < timeArray.length; i++) {
        const parsed = parseIsoTimeString(timeArray[i]);
        if (!parsed) continue;

        const isStepMatch = !stepHours || stepHours <= 1 || parsed.hour % stepHours === 0;

        if (parsed.dateStr === refDateStr) {
            if (todayFirstIndex === -1 && isStepMatch) {
                todayFirstIndex = i;
            }
            if (targetHour !== null) {
                const diff = Math.abs(parsed.hour - targetHour);
                if (isStepMatch) {
                    if (parsed.hour === targetHour) {
                        exactMatchIndex = i;
                        break;
                    }
                    if (diff < minHourDiff) {
                        minHourDiff = diff;
                        closestHourIndex = i;
                    }
                } else {
                    if (diff < fallbackMinDiff) {
                        fallbackMinDiff = diff;
                        fallbackClosestIndex = i;
                    }
                }
            }
        }
    }

    if (exactMatchIndex !== -1) return exactMatchIndex;
    if (closestHourIndex !== -1) return closestHourIndex;
    if (todayFirstIndex !== -1) return todayFirstIndex;
    if (fallbackClosestIndex !== -1) return fallbackClosestIndex;

    return 0;
}
