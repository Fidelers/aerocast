// tests/utils/timeUtils.test.js — тесты утилит группировки времени
import { describe, it, expect } from 'vitest';
import {
    parseIsoTimeString,
    formatDateKey,
    getDayInfo,
    groupTimesByDay,
    findDefaultTimeIndex
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
        });
    });

    describe('formatDateKey', () => {
        it('форматирует объект Date в строку YYYY-MM-DD', () => {
            const d = new Date(2026, 8, 28); // Сентябрь (8)
            expect(formatDateKey(d)).toBe('2026-09-28');
        });

        it('извлекает ключ из ISO-строки', () => {
            expect(formatDateKey('2026-09-28T15:00')).toBe('2026-09-28');
        });

        it('возвращает пустую строку для null/undefined', () => {
            expect(formatDateKey(null)).toBe('');
            expect(formatDateKey(undefined)).toBe('');
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
    });
});
