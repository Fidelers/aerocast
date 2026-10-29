// tests/utils/timeUtils.test.js — тесты утилит группировки времени
import { describe, it, expect } from 'vitest';
import {
    parseIsoTimeString,
    formatDateKey,
    getDayInfo,
    groupTimesByDay,
    findDefaultTimeIndex,
    computeForecast3Days,
    computeAirHistory,
    formatSelectedTimeInfo,
    computeAllDaysSummary
} from '../../src/utils/timeUtils.js';

describe('timeUtils', () => {
    describe('parseIsoTimeString', () => {
        it('корректно парсит стандартный формат YYYY-MM-DDTHH:mm', () => {
            const res = parseIsoTimeString('2026-09-28T14:30');
            expect(res).toEqual({
                dateStr: '2026-09-28',
                timeLabel: '14:30',
                hour: 14
            });
        });

        it('корректно парсит полночь 00:00', () => {
            const res = parseIsoTimeString('2026-09-28T00:00');
            expect(res).toEqual({
                dateStr: '2026-09-28',
                timeLabel: '00:00',
                hour: 0
            });
        });

        it('возвращает null для нестроковых и некорректных значений', () => {
            expect(parseIsoTimeString(null)).toBeNull();
            expect(parseIsoTimeString(undefined)).toBeNull();
            expect(parseIsoTimeString(12345)).toBeNull();
            expect(parseIsoTimeString('not-a-date')).toBeNull();
        });
    });

    describe('getDayInfo', () => {
        it('корректно вычисляет дни недели и число месяца', () => {
            // 2026-09-21 — понедельник
            expect(getDayInfo('2026-09-21')).toEqual({ dayOfWeek: 'ПН', dayOfMonth: '21' });
            // 2026-09-22 — вторник
            expect(getDayInfo('2026-09-22')).toEqual({ dayOfWeek: 'ВТ', dayOfMonth: '22' });
            // 2026-09-23 — среда
            expect(getDayInfo('2026-09-23')).toEqual({ dayOfWeek: 'СР', dayOfMonth: '23' });
            // 2026-09-24 — четверг
            expect(getDayInfo('2026-09-24')).toEqual({ dayOfWeek: 'ЧТ', dayOfMonth: '24' });
            // 2026-09-25 — пятница
            expect(getDayInfo('2026-09-25')).toEqual({ dayOfWeek: 'ПТ', dayOfMonth: '25' });
            // 2026-09-26 — суббота
            expect(getDayInfo('2026-09-26')).toEqual({ dayOfWeek: 'СБ', dayOfMonth: '26' });
            // 2026-09-27 — воскресенье
            expect(getDayInfo('2026-09-27')).toEqual({ dayOfWeek: 'ВС', dayOfMonth: '27' });
        });

        it('обрабатывает некорректные даты без падения', () => {
            expect(getDayInfo('')).toEqual({ dayOfWeek: '', dayOfMonth: '' });
            expect(getDayInfo('invalid')).toEqual({ dayOfWeek: '', dayOfMonth: '' });
            expect(getDayInfo(null)).toEqual({ dayOfWeek: '', dayOfMonth: '' });
            expect(getDayInfo('foo-bar-baz')).toEqual({ dayOfWeek: '', dayOfMonth: '' });
        });
    });

    describe('formatDateKey', () => {
        it('форматирует объект Date в строку YYYY-MM-DD', () => {
            const d = new Date(2026, 8, 28); // Сентябрь (8)
            expect(formatDateKey(d)).toBe('2026-09-28');
        });

        it('извлекает ключ из ISO-строки', () => {
            expect(formatDateKey('2026-09-28T15:00')).toBe('2026-09-28');
            expect(formatDateKey('2026-09-28 with extra info')).toBe('2026-09-28');
            expect(formatDateKey('not-a-date-at-all')).toBe('');
        });

        it('возвращает пустую строку для null/undefined/чисел/невалидных дат', () => {
            expect(formatDateKey(null)).toBe('');
            expect(formatDateKey(undefined)).toBe('');
            expect(formatDateKey(12345)).toBe('');
            expect(formatDateKey(new Date('invalid'))).toBe('');
        });
    });

    describe('groupTimesByDay', () => {
        const mockTimes = [
            '2026-09-27T18:00', // index 0 (вчера, кратно 3)
            '2026-09-27T21:00', // index 1 (кратно 3)
            '2026-09-28T00:00', // index 2 (сегодня, кратно 3)
            '2026-09-28T01:00', // index 3 (НЕ кратно 3)
            '2026-09-28T02:00', // index 4 (НЕ кратно 3)
            '2026-09-28T03:00', // index 5 (кратно 3)
            '2026-09-28T06:00', // index 6 (кратно 3)
            '2026-09-29T00:00', // index 7 (завтра / прогноз, кратно 3)
            '2026-09-29T12:00'  // index 8 (кратно 3)
        ];

        const refDate = new Date('2026-09-28T10:00:00');

        it('возвращает пустой массив при отсутствии данных', () => {
            expect(groupTimesByDay(null)).toEqual([]);
            expect(groupTimesByDay(undefined)).toEqual([]);
            expect(groupTimesByDay([])).toEqual([]);
            expect(groupTimesByDay('not-array')).toEqual([]);
        });

        it('группирует метки времени по суткам с шагом 1 раз в 3 часа по умолчанию', () => {
            const days = groupTimesByDay(mockTimes, refDate);
            expect(days).toHaveLength(3);

            expect(days[0].dateStr).toBe('2026-09-27');
            expect(days[0].dayOfWeek).toBe('ВС');
            expect(days[0].dayOfMonth).toBe('27');
            expect(days[0].isPast).toBe(true);
            expect(days[0].isToday).toBe(false);
            expect(days[0].isForecast).toBe(false);
            expect(days[0].hours).toHaveLength(2); // 18:00, 21:00

            expect(days[1].dateStr).toBe('2026-09-28');
            expect(days[1].dayOfWeek).toBe('ПН');
            expect(days[1].dayOfMonth).toBe('28');
            expect(days[1].isPast).toBe(false);
            expect(days[1].isToday).toBe(true);
            expect(days[1].isForecast).toBe(false);
            // 00:00, 03:00, 06:00 (часы 01:00 и 02:00 отфильтрованы по шагу 3)
            expect(days[1].hours).toHaveLength(3);

            expect(days[2].dateStr).toBe('2026-09-29');
            expect(days[2].dayOfWeek).toBe('ВТ');
            expect(days[2].dayOfMonth).toBe('29');
            expect(days[2].isPast).toBe(false);
            expect(days[2].isToday).toBe(false);
            expect(days[2].isForecast).toBe(true);
            expect(days[2].hours).toHaveLength(2); // 00:00, 12:00
        });

        it('сохраняет точный глобальный индекс из исходного массива time', () => {
            const days = groupTimesByDay(mockTimes, refDate);

            // 2026-09-28: 00:00 (index 2), 03:00 (index 5), 06:00 (index 6)
            expect(days[1].hours[0]).toEqual({
                index: 2,
                timeStr: '2026-09-28T00:00',
                timeLabel: '00:00',
                hour: 0,
                dateStr: '2026-09-28'
            });
            expect(days[1].hours[1]).toEqual({
                index: 5,
                timeStr: '2026-09-28T03:00',
                timeLabel: '03:00',
                hour: 3,
                dateStr: '2026-09-28'
            });
            expect(days[1].hours[2]).toEqual({
                index: 6,
                timeStr: '2026-09-28T06:00',
                timeLabel: '06:00',
                hour: 6,
                dateStr: '2026-09-28'
            });
        });

        it('поддерживает шаг 1 час при передаче stepHours: 1', () => {
            const days = groupTimesByDay(mockTimes, refDate, { stepHours: 1 });
            // Для 2026-09-28 должны быть включены все 5 часов (00, 01, 02, 03, 06)
            expect(days[1].hours).toHaveLength(5);
        });

        it('игнорирует некорректные элементы массива', () => {
            const mixedTimes = ['invalid-time', '2026-09-28T06:00', null];
            const days = groupTimesByDay(mixedTimes, refDate);
            expect(days).toHaveLength(1);
            expect(days[0].hours).toHaveLength(1);
            expect(days[0].hours[0].index).toBe(1);
        });

        it('поддерживает options как пустой объект или null', () => {
            const days1 = groupTimesByDay(mockTimes, refDate, {});
            expect(days1).toHaveLength(3);

            const days2 = groupTimesByDay(mockTimes, refDate, null);
            expect(days2).toHaveLength(3);

            const days3 = groupTimesByDay(mockTimes);
            expect(Array.isArray(days3)).toBe(true);
        });
    });

    describe('findDefaultTimeIndex', () => {
        const mockTimes = [
            '2026-09-27T21:00', // 0
            '2026-09-28T00:00', // 1
            '2026-09-28T01:00', // 2 (не кратно 3)
            '2026-09-28T09:00', // 3 (кратно 3)
            '2026-09-28T10:00', // 4 (не кратно 3)
            '2026-09-28T15:00', // 5 (кратно 3)
            '2026-09-29T12:00'  // 6
        ];

        it('возвращает null для пустого массива', () => {
            expect(findDefaultTimeIndex([])).toBeNull();
            expect(findDefaultTimeIndex(null)).toBeNull();
        });

        it('находит точный час с учетом шага 3', () => {
            const refDate = new Date('2026-09-28T09:00:00');
            expect(findDefaultTimeIndex(mockTimes, refDate)).toBe(3);
        });

        it('находит ближайший час, кратный 3, если текущий час не кратен 3', () => {
            // В 10:00 ближайший час из кратных 3 (0, 9, 15) — это 09:00 (разница 1 час, index 3)
            const refDate = new Date('2026-09-28T10:00:00');
            expect(findDefaultTimeIndex(mockTimes, refDate)).toBe(3);

            // В 14:00 ближайший час из кратных 3 — это 15:00 (разница 1 час, index 5)
            const refDate2 = new Date('2026-09-28T14:00:00');
            expect(findDefaultTimeIndex(mockTimes, refDate2)).toBe(5);
        });

        it('возвращает 0, если сегодняшнего дня нет в данных', () => {
            const refDate = new Date('2025-01-01T12:00:00');
            expect(findDefaultTimeIndex(mockTimes, refDate)).toBe(0);
        });

        it('поддерживает options как объект, null или число', () => {
            const refDate = new Date('2026-09-28T09:00:00');
            expect(findDefaultTimeIndex(mockTimes, refDate, { stepHours: 3 })).toBe(3);
            expect(findDefaultTimeIndex(mockTimes, refDate, {})).toBe(3);
            expect(findDefaultTimeIndex(mockTimes, refDate, null)).toBe(3);
            expect(findDefaultTimeIndex(mockTimes, refDate, 0)).toBe(3);
            expect(findDefaultTimeIndex(mockTimes, refDate, 1)).toBe(3);
            expect(findDefaultTimeIndex(mockTimes)).not.toBeNull();
        });

        it('пропускает некорректные метки времени в массиве', () => {
            const timesWithInvalid = ['not-a-date', '2026-09-28T09:00'];
            const refDate = new Date('2026-09-28T09:00:00');
            expect(findDefaultTimeIndex(timesWithInvalid, refDate)).toBe(1);
        });

        it('возвращает todayFirstIndex, если targetHour равен null (строковая дата)', () => {
            expect(findDefaultTimeIndex(mockTimes, '2026-09-28')).toBe(1);
        });

        it('возвращает fallbackClosestIndex, если ни одна метка времени за сегодня не удовлетворяет шагу', () => {
            const oddTimes = [
                '2026-09-28T04:00', // diff 1 до 05:00 -> fallback closest!
                '2026-09-28T01:00'  // diff 4 до 05:00 -> diff < fallbackMinDiff evaluates to FALSE!
            ];
            const refDate = new Date('2026-09-28T05:00:00');
            // Шаг 3: ни 01, ни 04 не кратны 3 (01%3=1, 04%3=1)
            expect(findDefaultTimeIndex(oddTimes, refDate, 3)).toBe(0);
        });
    });

    describe('computeForecast3Days', () => {
        it('возвращает null для некорректных входных данных', () => {
            expect(computeForecast3Days(null)).toBeNull();
            expect(computeForecast3Days({})).toBeNull();
            expect(computeForecast3Days({ time: [] })).toBeNull();
        });

        it('рассчитывает средние, минимум и максимум за 3 дня', () => {
            const mockHourly = {
                time: [
                    '2026-10-29T00:00', '2026-10-29T12:00',
                    '2026-10-30T00:00', '2026-10-30T12:00',
                    '2026-10-31T00:00', '2026-10-31T12:00'
                ],
                european_aqi: [20, 30, 40, 50, 10, 20],
                pm2_5: [10, 15, 20, 25, 5, 10],
                pm10: [15, 20, 30, 35, 10, 15]
            };
            const refDate = new Date('2026-10-29T08:00:00');
            const res = computeForecast3Days(mockHourly, refDate);

            expect(res).not.toBeNull();
            expect(res.days).toHaveLength(3);
            expect(res.days[0].avgAqi).toBe(25);
            expect(res.days[0].minAqi).toBe(20);
            expect(res.days[0].maxAqi).toBe(30);
            expect(res.days[0].avgPm25).toBe(12.5);
            expect(res.days[0].dayLabel).toBe('Сегодня');
            expect(res.days[0].status).toBe('Хорошо');

            expect(res.days[1].avgAqi).toBe(45);
            expect(res.days[1].dayLabel).toBe('Завтра');
            expect(res.days[1].status).toBe('Удовлетворительно');

            expect(res.days[2].avgAqi).toBe(15);
            expect(res.days[2].dayLabel).toBe('Послезавтра');
            expect(res.days[2].status).toBe('Отлично');

            expect(res.periodMinAqi).toBe(10);
            expect(res.periodMaxAqi).toBe(50);
            expect(res.periodAvgAqi).toBe(28.3);
            expect(res.periodAvgPm25).toBe(14.2);
        });
    });

    describe('computeAirHistory', () => {
        it('возвращает null для некорректных или пустых данных', () => {
            expect(computeAirHistory(null)).toBeNull();
            expect(computeAirHistory({})).toBeNull();
            expect(computeAirHistory({ time: [] })).toBeNull();
        });

        it('возвращает null, если в данных нет прошедших дней', () => {
            const mockHourly = {
                time: ['2026-10-29T00:00', '2026-10-29T12:00', '2026-10-30T00:00'],
                european_aqi: [20, 30, 40]
            };
            const refDate = new Date('2026-10-29T08:00:00');
            expect(computeAirHistory(mockHourly, refDate)).toBeNull();
        });

        it('корректно вычисляет исторический максимум, минимум и разбивку по прошедшим дням', () => {
            const mockHourly = {
                time: [
                    '2026-10-26T00:00', '2026-10-26T15:00', '2026-10-26T18:00',
                    '2026-10-27T06:00', '2026-10-27T12:00',
                    '2026-10-28T09:00', '2026-10-28T21:00',
                    // Сегодня
                    '2026-10-29T00:00', '2026-10-29T12:00'
                ],
                european_aqi: [25, 48, 30, 12, 20, 35, 40, 22, 19],
                pm2_5: [10, 24, 15, 5, 8, 16, 20, 11, 9],
                pm10: [15, 30, 20, 8, 12, 22, 28, 14, 12]
            };
            const refDate = new Date('2026-10-29T08:00:00');
            const res = computeAirHistory(mockHourly, refDate);

            expect(res).not.toBeNull();
            expect(res.pastDaysCount).toBe(3);
            expect(res.pastDays).toHaveLength(3);

            // Проверяем пик за прошедшие дни
            expect(res.pastMaxAqi).not.toBeNull();
            expect(res.pastMaxAqi.aqi).toBe(48);
            expect(res.pastMaxAqi.date).toBe('2026-10-26');
            expect(res.pastMaxAqi.hour).toBe(15);
            expect(res.pastMaxAqi.timeLabel).toBe('15:00');
            expect(res.pastMaxAqi.label).toContain('26');
            expect(res.pastMaxAqi.label).toContain('15:00');

            // Проверяем минимум за прошедшие дни
            expect(res.pastMinAqi).not.toBeNull();
            expect(res.pastMinAqi.aqi).toBe(12);
            expect(res.pastMinAqi.date).toBe('2026-10-27');
            expect(res.pastMinAqi.timeLabel).toBe('06:00');

            // Проверяем средние
            expect(res.pastAvgAqi).toBeCloseTo(30, 0);

            // Дни по отдельности
            expect(res.pastDays[0].date).toBe('2026-10-26');
            expect(res.pastDays[0].maxAqi).toBe(48);
            expect(res.pastDays[0].maxAqiTime).toBe('15:00');
        });
    });

    describe('formatSelectedTimeInfo', () => {
        const refDate = new Date('2026-10-29T14:00:00');

        it('корректно помечает архивные замеры в прошлом', () => {
            const past = formatSelectedTimeInfo('2026-10-26T18:00', refDate);
            expect(past).not.toBeNull();
            expect(past.kind).toBe('past');
            expect(past.kindLabel).toBe('архивный замер в прошлом');
            expect(past.label).toContain('архивный замер в прошлом');
            expect(past.label).toContain('18:00');
        });

        it('корректно помечает текущий замер', () => {
            const curr = formatSelectedTimeInfo('2026-10-29T14:00', refDate);
            expect(curr).not.toBeNull();
            expect(curr.kind).toBe('current');
            expect(curr.kindLabel).toContain('актуальный замер');
        });

        it('корректно помечает прогноз на будущее', () => {
            const fc = formatSelectedTimeInfo('2026-10-31T12:00', refDate);
            expect(fc).not.toBeNull();
            expect(fc.kind).toBe('forecast');
            expect(fc.kindLabel).toBe('прогноз на будущее');
        });

        it('возвращает null для некорректных значений', () => {
            expect(formatSelectedTimeInfo(null)).toBeNull();
            expect(formatSelectedTimeInfo('')).toBeNull();
        });
    });
    describe('computeAllDaysSummary', () => {
        it('возвращает null для некорректных или пустых данных', () => {
            expect(computeAllDaysSummary(null)).toBeNull();
            expect(computeAllDaysSummary({})).toBeNull();
            expect(computeAllDaysSummary({ time: [] })).toBeNull();
        });

        it('рассчитывает общую статистику за все доступные дни (архив + сегодня + прогноз)', () => {
            const mockHourly = {
                time: [
                    '2026-10-26T00:00', '2026-10-26T15:00', // Прошлое
                    '2026-10-29T12:00',                      // Сегодня
                    '2026-10-31T06:00', '2026-10-31T18:00'  // Прогноз
                ],
                european_aqi: [30, 48, 22, 10, 18],
                pm2_5: [12, 25, 11, 4, 8],
                pm10: [18, 32, 16, 8, 12]
            };
            const refDate = new Date('2026-10-29T08:00:00');
            const res = computeAllDaysSummary(mockHourly, refDate);

            expect(res).not.toBeNull();
            expect(res.totalDaysCount).toBe(3);
            expect(res.pastCount).toBe(1);
            expect(res.forecastCount).toBe(1);

            // Пик за все дни
            expect(res.overallMaxAqi).not.toBeNull();
            expect(res.overallMaxAqi.aqi).toBe(48);
            expect(res.overallMaxAqi.kind).toBe('past');
            expect(res.overallMaxAqi.label).toContain('26');
            expect(res.overallMaxAqi.label).toContain('15:00');

            // Минимум за все дни
            expect(res.overallMinAqi).not.toBeNull();
            expect(res.overallMinAqi.aqi).toBe(10);
            expect(res.overallMinAqi.kind).toBe('forecast');

            // Среднее за все дни
            expect(res.overallAvgAqi).toBeCloseTo(25.6, 1);

            // Дни в списке
            expect(res.days).toHaveLength(3);
            expect(res.days[0].kind).toBe('past');
            expect(res.days[1].kind).toBe('today');
            expect(res.days[2].kind).toBe('forecast');
        });
    });
});
