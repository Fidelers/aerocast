// src/utils/timeUtils.js — утилиты группировки и обработки временных меток airData

const WEEKDAYS_RU = Object.freeze(['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ']);
const MONTHS_RU = Object.freeze(['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']);
const MONTHS_RU_FULL = Object.freeze([
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
]);


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

    const dayOfWeek = WEEKDAYS_RU[d.getDay()];
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

export function isForecastTime(timeStr, referenceDate = new Date()) {
    if (!timeStr) return false;
    const parsed = parseIsoTimeString(timeStr);
    if (!parsed) return false;

    let refDateStr = '';
    let refHour = 0;

    if (referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())) {
        const year = referenceDate.getFullYear();
        const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
        const day = String(referenceDate.getDate()).padStart(2, '0');
        refDateStr = `${year}-${month}-${day}`;
        refHour = referenceDate.getHours();
    } else if (typeof referenceDate === 'string') {
        const parsedRef = parseIsoTimeString(referenceDate);
        if (parsedRef) {
            refDateStr = parsedRef.dateStr;
            refHour = parsedRef.hour;
        } else {
            const match = referenceDate.match(/^(\d{4}-\d{2}-\d{2})/);
            refDateStr = match ? match[1] : '';
        }
    }

    if (!refDateStr) return false;

    if (parsed.dateStr > refDateStr) {
        return true;
    }
    if (parsed.dateStr === refDateStr) {
        return parsed.hour > refHour;
    }
    return false;
}

/**
 * Рассчитывает агрегированную аналитику качества воздуха на 3 ближайших дня:
 * - Средний, минимальный и максимальный EAQI по каждому дню
 * - Средний PM2.5 и PM10 по каждому дню
 * - Общие агрегаты за весь 3-дневный период
 */
export function computeForecast3Days(hourly, referenceDate = new Date()) {
    if (!hourly || !Array.isArray(hourly.time) || hourly.time.length === 0) {
        return null;
    }

    const refDateStr = formatDateKey(referenceDate);
    const daysMap = new Map();

    hourly.time.forEach((timeStr, idx) => {
        const parsed = parseIsoTimeString(timeStr);
        if (!parsed) return;
        const { dateStr } = parsed;

        if (!daysMap.has(dateStr)) {
            daysMap.set(dateStr, {
                dateStr,
                aqiList: [],
                pm25List: [],
                pm10List: []
            });
        }

        const dayGroup = daysMap.get(dateStr);
        const aqi = hourly.european_aqi?.[idx];
        const pm25 = hourly.pm2_5?.[idx];
        const pm10 = hourly.pm10?.[idx];

        if (typeof aqi === 'number' && !isNaN(aqi)) dayGroup.aqiList.push(aqi);
        if (typeof pm25 === 'number' && !isNaN(pm25)) dayGroup.pm25List.push(pm25);
        if (typeof pm10 === 'number' && !isNaN(pm10)) dayGroup.pm10List.push(pm10);
    });

    const allDates = Array.from(daysMap.keys()).sort();
    let targetDates = allDates.filter(d => d >= refDateStr).slice(0, 3);
    if (targetDates.length === 0) {
        targetDates = allDates.slice(0, 3);
    }

    if (targetDates.length === 0) return null;

    const allPeriodAqi = [];
    const allPeriodPm25 = [];
    const allPeriodPm10 = [];

    const getStatus = (aqi) => {
        if (aqi <= 20) return 'Отлично';
        if (aqi <= 40) return 'Хорошо';
        if (aqi <= 60) return 'Удовлетворительно';
        if (aqi <= 80) return 'Плохо';
        if (aqi <= 100) return 'Очень плохо';
        return 'Опасно';
    };

    const days = targetDates.map((dateStr, i) => {
        const group = daysMap.get(dateStr);
        const aqiList = group.aqiList;
        const pm25List = group.pm25List;
        const pm10List = group.pm10List;

        allPeriodAqi.push(...aqiList);
        allPeriodPm25.push(...pm25List);
        allPeriodPm10.push(...pm10List);

        const avgAqi = aqiList.length > 0 ? Math.round(aqiList.reduce((a, b) => a + b, 0) / aqiList.length) : null;
        const minAqi = aqiList.length > 0 ? Math.min(...aqiList) : null;
        const maxAqi = aqiList.length > 0 ? Math.max(...aqiList) : null;
        const avgPm25 = pm25List.length > 0 ? Number((pm25List.reduce((a, b) => a + b, 0) / pm25List.length).toFixed(1)) : null;
        const avgPm10 = pm10List.length > 0 ? Number((pm10List.reduce((a, b) => a + b, 0) / pm10List.length).toFixed(1)) : null;

        let dayLabel;
        if (i === 0 && dateStr === refDateStr) {
            dayLabel = 'Сегодня';
        } else if (i === 1) {
            dayLabel = 'Завтра';
        } else if (i === 2) {
            dayLabel = 'Послезавтра';
        } else {
            const { dayOfWeek, dayOfMonth } = getDayInfo(dateStr);
            dayLabel = `${dayOfWeek}, ${dayOfMonth}`;
        }

        return {
            date: dateStr,
            dayLabel,
            avgAqi,
            minAqi,
            maxAqi,
            avgPm25,
            avgPm10,
            status: avgAqi !== null ? getStatus(avgAqi) : 'нет данных'
        };
    });

    const periodAvgAqi = allPeriodAqi.length > 0 ? Number((allPeriodAqi.reduce((a, b) => a + b, 0) / allPeriodAqi.length).toFixed(1)) : null;
    const periodMinAqi = allPeriodAqi.length > 0 ? Math.min(...allPeriodAqi) : null;
    const periodMaxAqi = allPeriodAqi.length > 0 ? Math.max(...allPeriodAqi) : null;
    const periodAvgPm25 = allPeriodPm25.length > 0 ? Number((allPeriodPm25.reduce((a, b) => a + b, 0) / allPeriodPm25.length).toFixed(1)) : null;
    const periodAvgPm10 = allPeriodPm10.length > 0 ? Number((allPeriodPm10.reduce((a, b) => a + b, 0) / allPeriodPm10.length).toFixed(1)) : null;

    return {
        days,
        periodAvgAqi,
        periodMinAqi,
        periodMaxAqi,
        periodAvgPm25,
        periodAvgPm10
    };
}

/**
 * Рассчитывает историческую / архивную аналитику за прошедшие дни:
 * - pastDays: статистика по каждому прошедшему дню (avg, min, max, maxTime, avgPm25)
 * - pastMaxAqi: абсолютный пик загрязнения за прошедшие дни и точное время/дата
 * - pastMinAqi: самый чистый час за прошедшие дни и точное время/дата
 * - pastAvgAqi, pastAvgPm25, pastAvgPm10: общие средние по архиву
 */
export function computeAirHistory(hourly, referenceDate = new Date()) {
    if (!hourly || !Array.isArray(hourly.time) || hourly.time.length === 0) {
        return null;
    }

    const refDateStr = formatDateKey(referenceDate);
    const daysMap = new Map();
    let pastMaxAqi = null;
    let pastMinAqi = null;

    const allPastAqi = [];
    const allPastPm25 = [];
    const allPastPm10 = [];

    const getStatus = (aqi) => {
        if (aqi <= 20) return 'Отлично';
        if (aqi <= 40) return 'Хорошо';
        if (aqi <= 60) return 'Удовлетворительно';
        if (aqi <= 80) return 'Плохо';
        if (aqi <= 100) return 'Очень плохо';
        return 'Опасно';
    };

    const getFullLabel = (dateStr, hour) => {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            const d = new Date(year, month, day);
            const dayOfWeek = WEEKDAYS_RU[d.getDay()] || '';
            const monthName = MONTHS_RU_FULL[month] || '';
            const hourStr = String(hour).padStart(2, '0') + ':00';
            return `${dayOfWeek}, ${day} ${monthName} в ${hourStr}`;
        }
        return `${dateStr} ${hour}:00`;
    };

    hourly.time.forEach((timeStr, idx) => {
        const parsed = parseIsoTimeString(timeStr);
        if (!parsed) return;
        const { dateStr, hour, timeLabel } = parsed;

        // Считаем прошедшими дни строго до сегодняшнего (dateStr < refDateStr)
        if (!refDateStr || dateStr >= refDateStr) {
            return;
        }

        if (!daysMap.has(dateStr)) {
            daysMap.set(dateStr, {
                dateStr,
                hours: [],
                aqiList: [],
                pm25List: [],
                pm10List: []
            });
        }

        const group = daysMap.get(dateStr);
        const aqi = hourly.european_aqi?.[idx];
        const pm25 = hourly.pm2_5?.[idx];
        const pm10 = hourly.pm10?.[idx];

        const hasAqi = typeof aqi === 'number' && !isNaN(aqi);
        const hasPm25 = typeof pm25 === 'number' && !isNaN(pm25);
        const hasPm10 = typeof pm10 === 'number' && !isNaN(pm10);

        if (hasAqi) {
            group.aqiList.push(aqi);
            allPastAqi.push(aqi);
            if (!pastMaxAqi || aqi > pastMaxAqi.aqi) {
                pastMaxAqi = {
                    aqi,
                    date: dateStr,
                    hour,
                    timeLabel,
                    timeStr,
                    label: getFullLabel(dateStr, hour)
                };
            }
            if (!pastMinAqi || aqi < pastMinAqi.aqi) {
                pastMinAqi = {
                    aqi,
                    date: dateStr,
                    hour,
                    timeLabel,
                    timeStr,
                    label: getFullLabel(dateStr, hour)
                };
            }
        }
        if (hasPm25) {
            group.pm25List.push(pm25);
            allPastPm25.push(pm25);
        }
        if (hasPm10) {
            group.pm10List.push(pm10);
            allPastPm10.push(pm10);
        }

        group.hours.push({
            hour,
            timeLabel,
            aqi: hasAqi ? aqi : null,
            pm25: hasPm25 ? pm25 : null,
            pm10: hasPm10 ? pm10 : null
        });
    });

    const pastDates = Array.from(daysMap.keys()).sort();
    if (pastDates.length === 0) {
        return null;
    }

    const pastDays = pastDates.map((dateStr) => {
        const group = daysMap.get(dateStr);
        const { aqiList, pm25List, pm10List, hours } = group;

        const avgAqi = aqiList.length > 0 ? Math.round(aqiList.reduce((a, b) => a + b, 0) / aqiList.length) : null;
        let maxDayAqi = null;
        let maxDayTime = null;
        let minDayAqi = null;

        hours.forEach(h => {
            if (h.aqi !== null) {
                if (maxDayAqi === null || h.aqi > maxDayAqi) {
                    maxDayAqi = h.aqi;
                    maxDayTime = h.timeLabel;
                }
                if (minDayAqi === null || h.aqi < minDayAqi) {
                    minDayAqi = h.aqi;
                }
            }
        });

        const avgPm25 = pm25List.length > 0 ? Number((pm25List.reduce((a, b) => a + b, 0) / pm25List.length).toFixed(1)) : null;
        const avgPm10 = pm10List.length > 0 ? Number((pm10List.reduce((a, b) => a + b, 0) / pm10List.length).toFixed(1)) : null;

        const parts = dateStr.split('-');
        let dayLabel = dateStr;
        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            const d = new Date(year, month, day);
            const dayOfWeek = WEEKDAYS_RU[d.getDay()] || '';
            const monthName = MONTHS_RU[month] || '';
            dayLabel = `${dayOfWeek}, ${day} ${monthName}`;
        }

        return {
            date: dateStr,
            dayLabel,
            avgAqi,
            minAqi: minDayAqi,
            maxAqi: maxDayAqi,
            maxAqiTime: maxDayTime,
            avgPm25,
            avgPm10,
            status: avgAqi !== null ? getStatus(avgAqi) : 'нет данных'
        };
    });

    const pastAvgAqi = allPastAqi.length > 0 ? Number((allPastAqi.reduce((a, b) => a + b, 0) / allPastAqi.length).toFixed(1)) : null;
    const pastAvgPm25 = allPastPm25.length > 0 ? Number((allPastPm25.reduce((a, b) => a + b, 0) / allPastPm25.length).toFixed(1)) : null;
    const pastAvgPm10 = allPastPm10.length > 0 ? Number((allPastPm10.reduce((a, b) => a + b, 0) / allPastPm10.length).toFixed(1)) : null;

    return {
        pastDaysCount: pastDays.length,
        pastMaxAqi,
        pastMinAqi,
        pastAvgAqi,
        pastAvgPm25,
        pastAvgPm10,
        pastDays
    };
}

/**
 * Определяет статус и человекочитаемую метку выбранного времени на шкале:
 * past — архивный замер в прошлом
 * current — текущее реальное время (актуальный замер)
 * forecast — прогноз на будущее
 */
export function formatSelectedTimeInfo(timeStr, referenceDate = new Date()) {
    if (!timeStr) return null;
    const parsed = parseIsoTimeString(timeStr);
    if (!parsed) return null;

    const refDateStr = formatDateKey(referenceDate);
    let refHour = 0;
    if (referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())) {
        refHour = referenceDate.getHours();
    } else if (typeof referenceDate === 'string') {
        const parsedRef = parseIsoTimeString(referenceDate);
        if (parsedRef) refHour = parsedRef.hour;
    }

    let kind = 'current';
    let kindLabel = 'актуальный замер прямо сейчас';

    if (refDateStr) {
        if (parsed.dateStr < refDateStr) {
            kind = 'past';
            kindLabel = 'архивный замер в прошлом';
        } else if (parsed.dateStr > refDateStr) {
            kind = 'forecast';
            kindLabel = 'прогноз на будущее';
        } else {
            const hourDiff = parsed.hour - refHour;
            if (hourDiff < -1) {
                kind = 'past';
                kindLabel = 'архивный замер ранее сегодня';
            } else if (hourDiff > 1) {
                kind = 'forecast';
                kindLabel = 'прогноз на более поздние часы сегодня';
            } else {
                kind = 'current';
                kindLabel = 'актуальный замер прямо сейчас';
            }
        }
    }

    const parts = parsed.dateStr.split('-');
    let dateFormatted = parsed.dateStr;
    if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        const dayOfWeek = WEEKDAYS_RU[d.getDay()] || '';
        const monthName = MONTHS_RU_FULL[month] || '';
        dateFormatted = `${dayOfWeek}, ${day} ${monthName}`;
    }

    const label = `${dateFormatted} в ${parsed.timeLabel} (${kindLabel})`;

    return {
        timeStr,
        dateStr: parsed.dateStr,
        hour: parsed.hour,
        timeLabel: parsed.timeLabel,
        kind,
        kindLabel,
        label
    };
}

/**
 * Рассчитывает общую сводку за ВСЕ доступные дни (прошедшие дни + сегодня + прогноз):
 * - totalDaysCount: общее количество дней (обычно 11-12)
 * - overallAvgAqi: средний EAQI за весь период
 * - overallMaxAqi: максимальный пик за все дни (с указанием даты, часа и периода: архив/прогноз)
 * - overallMinAqi: минимальный индекс за все дни
 * - overallAvgPm25, overallAvgPm10
 * - days: полный хронологический список дней со статусом (kind: past | today | forecast)
 */
export function computeAllDaysSummary(hourly, referenceDate = new Date()) {
    if (!hourly || !Array.isArray(hourly.time) || hourly.time.length === 0) {
        return null;
    }

    const refDateStr = formatDateKey(referenceDate);
    const daysMap = new Map();
    let overallMaxAqi = null;
    let overallMinAqi = null;

    const allAqi = [];
    const allPm25 = [];
    const allPm10 = [];

    const getStatus = (aqi) => {
        if (aqi <= 20) return 'Отлично';
        if (aqi <= 40) return 'Хорошо';
        if (aqi <= 60) return 'Удовлетворительно';
        if (aqi <= 80) return 'Плохо';
        if (aqi <= 100) return 'Очень плохо';
        return 'Опасно';
    };

    const getFullLabel = (dateStr, hour, kind) => {
        const parts = dateStr.split('-');
        let kindNote = '';
        if (kind === 'past') kindNote = ' (архив)';
        else if (kind === 'today') kindNote = ' (сегодня)';
        else if (kind === 'forecast') kindNote = ' (прогноз)';

        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            const d = new Date(year, month, day);
            const dayOfWeek = WEEKDAYS_RU[d.getDay()] || '';
            const monthName = MONTHS_RU_FULL[month] || '';
            const hourStr = String(hour).padStart(2, '0') + ':00';
            return `${dayOfWeek}, ${day} ${monthName} в ${hourStr}${kindNote}`;
        }
        return `${dateStr} ${hour}:00${kindNote}`;
    };

    hourly.time.forEach((timeStr, idx) => {
        const parsed = parseIsoTimeString(timeStr);
        if (!parsed) return;
        const { dateStr, hour, timeLabel } = parsed;

        let kind = 'today';
        if (refDateStr) {
            if (dateStr < refDateStr) kind = 'past';
            else if (dateStr > refDateStr) kind = 'forecast';
            else kind = 'today';
        }

        if (!daysMap.has(dateStr)) {
            daysMap.set(dateStr, {
                dateStr,
                kind,
                hours: [],
                aqiList: [],
                pm25List: [],
                pm10List: []
            });
        }

        const group = daysMap.get(dateStr);
        const aqi = hourly.european_aqi?.[idx];
        const pm25 = hourly.pm2_5?.[idx];
        const pm10 = hourly.pm10?.[idx];

        const hasAqi = typeof aqi === 'number' && !isNaN(aqi);
        const hasPm25 = typeof pm25 === 'number' && !isNaN(pm25);
        const hasPm10 = typeof pm10 === 'number' && !isNaN(pm10);

        if (hasAqi) {
            group.aqiList.push(aqi);
            allAqi.push(aqi);
            if (!overallMaxAqi || aqi > overallMaxAqi.aqi) {
                overallMaxAqi = {
                    aqi,
                    date: dateStr,
                    hour,
                    timeLabel,
                    timeStr,
                    kind,
                    label: getFullLabel(dateStr, hour, kind)
                };
            }
            if (!overallMinAqi || aqi < overallMinAqi.aqi) {
                overallMinAqi = {
                    aqi,
                    date: dateStr,
                    hour,
                    timeLabel,
                    timeStr,
                    kind,
                    label: getFullLabel(dateStr, hour, kind)
                };
            }
        }
        if (hasPm25) {
            group.pm25List.push(pm25);
            allPm25.push(pm25);
        }
        if (hasPm10) {
            group.pm10List.push(pm10);
            allPm10.push(pm10);
        }

        group.hours.push({
            hour,
            timeLabel,
            aqi: hasAqi ? aqi : null,
            pm25: hasPm25 ? pm25 : null,
            pm10: hasPm10 ? pm10 : null
        });
    });

    const allDates = Array.from(daysMap.keys()).sort();
    if (allDates.length === 0) {
        return null;
    }

    const days = allDates.map((dateStr) => {
        const group = daysMap.get(dateStr);
        const { aqiList, pm25List, pm10List, hours, kind } = group;

        const avgAqi = aqiList.length > 0 ? Math.round(aqiList.reduce((a, b) => a + b, 0) / aqiList.length) : null;
        let maxDayAqi = null;
        let maxDayTime = null;
        let minDayAqi = null;

        hours.forEach(h => {
            if (h.aqi !== null) {
                if (maxDayAqi === null || h.aqi > maxDayAqi) {
                    maxDayAqi = h.aqi;
                    maxDayTime = h.timeLabel;
                }
                if (minDayAqi === null || h.aqi < minDayAqi) {
                    minDayAqi = h.aqi;
                }
            }
        });

        const avgPm25 = pm25List.length > 0 ? Number((pm25List.reduce((a, b) => a + b, 0) / pm25List.length).toFixed(1)) : null;
        const avgPm10 = pm10List.length > 0 ? Number((pm10List.reduce((a, b) => a + b, 0) / pm10List.length).toFixed(1)) : null;

        const parts = dateStr.split('-');
        let dayLabel = dateStr;
        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            const d = new Date(year, month, day);
            const dayOfWeek = WEEKDAYS_RU[d.getDay()] || '';
            const monthName = MONTHS_RU[month] || '';
            dayLabel = `${dayOfWeek}, ${day} ${monthName}`;
            if (kind === 'today') dayLabel += ' (Сегодня)';
        }

        return {
            date: dateStr,
            kind,
            kindLabel: kind === 'past' ? 'Архив' : (kind === 'today' ? 'Сегодня' : 'Прогноз'),
            dayLabel,
            avgAqi,
            minAqi: minDayAqi,
            maxAqi: maxDayAqi,
            maxAqiTime: maxDayTime,
            avgPm25,
            avgPm10,
            status: avgAqi !== null ? getStatus(avgAqi) : 'нет данных'
        };
    });

    const overallAvgAqi = allAqi.length > 0 ? Number((allAqi.reduce((a, b) => a + b, 0) / allAqi.length).toFixed(1)) : null;
    const overallAvgPm25 = allPm25.length > 0 ? Number((allPm25.reduce((a, b) => a + b, 0) / allPm25.length).toFixed(1)) : null;
    const overallAvgPm10 = allPm10.length > 0 ? Number((allPm10.reduce((a, b) => a + b, 0) / allPm10.length).toFixed(1)) : null;

    const pastCount = days.filter(d => d.kind === 'past').length;
    const forecastCount = days.filter(d => d.kind === 'forecast').length;

    return {
        totalDaysCount: days.length,
        pastCount,
        forecastCount,
        overallAvgAqi,
        overallAvgPm25,
        overallAvgPm10,
        overallMaxAqi,
        overallMinAqi,
        days
    };
}
