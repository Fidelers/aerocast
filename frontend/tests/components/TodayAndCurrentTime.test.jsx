import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Sidebar from '../../src/components/Sidebar';

describe('Today & Current Time Selection (Выделение сегодняшнего дня и кнопка «Выбрать текущее время»)', () => {
    // Временная шкала:
    // 2026-10-20 (вчера, индекс 0..7)
    // 2026-10-21 (сегодня, индекс 8..15: 00, 03, 06, 09, 12, 15, 18, 21)
    // 2026-10-22 (завтра, индекс 16..23)
    const mockHours = [
        '2026-10-20T00:00', '2026-10-20T03:00', '2026-10-20T06:00', '2026-10-20T09:00',
        '2026-10-20T12:00', '2026-10-20T15:00', '2026-10-20T18:00', '2026-10-20T21:00',
        '2026-10-21T00:00', '2026-10-21T03:00', '2026-10-21T06:00', '2026-10-21T09:00',
        '2026-10-21T12:00', '2026-10-21T15:00', '2026-10-21T18:00', '2026-10-21T21:00',
        '2026-10-22T00:00', '2026-10-22T03:00', '2026-10-22T06:00', '2026-10-22T09:00',
        '2026-10-22T12:00', '2026-10-22T15:00', '2026-10-22T18:00', '2026-10-22T21:00'
    ];

    const mockAirData = {
        latitude: 55.75,
        longitude: 37.61,
        hourly: {
            time: mockHours,
            european_aqi: new Array(mockHours.length).fill(20),
            pm2_5: new Array(mockHours.length).fill(10),
            pm10: new Array(mockHours.length).fill(15)
        }
    };

    // Текущее контрольное время: 21 октября 2026, 17:15 -> ближайший шаг: 18:00 (индекс 14)
    const refDate = new Date('2026-10-21T17:15:00');

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('1. Карточка сегодняшнего дня имеет специальный класс .day-card--today и метку «сег»', () => {
        const { container } = render(
            <Sidebar
                airData={mockAirData}
                referenceDate={refDate}
                selectedTimeIndex={14}
            />
        );

        const todayCard = container.querySelector('.day-card--today');
        expect(todayCard).toBeTruthy();
        expect(todayCard.getAttribute('data-is-today')).toBe('true');
        expect(todayCard.textContent).toContain('сег');
        expect(todayCard.textContent).toContain('21');
    });

    it('2. Карточки других дней (вчера, завтра) НЕ имеют класса .day-card--today', () => {
        const { container } = render(
            <Sidebar
                airData={mockAirData}
                referenceDate={refDate}
                selectedTimeIndex={14}
            />
        );

        const cards = container.querySelectorAll('.day-card');
        expect(cards.length).toBe(3);

        const yesterdayCard = cards[0];
        expect(yesterdayCard.classList.contains('day-card--today')).toBe(false);

        const tomorrowCard = cards[2];
        expect(tomorrowCard.classList.contains('day-card--today')).toBe(false);
    });

    it('3. Когда сегодняшний день выбран, он имеет классы .day-card--today и .day-card--active', () => {
        const { container } = render(
            <Sidebar
                airData={mockAirData}
                referenceDate={refDate}
                selectedTimeIndex={14} // 21 октября 18:00
            />
        );

        const todayCard = container.querySelector('.day-card--today');
        expect(todayCard.classList.contains('day-card--active')).toBe(true);
    });

    it('4. Отображается кнопка «Выбрать текущее время» с иконкой и текстом', () => {
        render(
            <Sidebar
                airData={mockAirData}
                referenceDate={refDate}
                selectedTimeIndex={0}
            />
        );

        const btn = screen.getByTestId('select-current-time-btn');
        expect(btn).toBeTruthy();
        expect(btn.textContent).toContain('Выбрать текущее время');
        expect(btn.querySelector('.date-nav__now-icon')).toBeTruthy();
    });

    it('5. Клик по кнопке «Выбрать текущее время» переключает на сегодня и выбирает ближайший час', () => {
        const handleSelectTime = vi.fn();
        const { container } = render(
            <Sidebar
                airData={mockAirData}
                referenceDate={refDate} // 2026-10-21T17:15 -> ближайший час 18:00 (индекс 14)
                selectedTimeIndex={0} // изначально выбран вчерашний день 2026-10-20 00:00
                onSelectTime={handleSelectTime}
            />
        );

        // Изначально активен вчерашний день
        const yesterdayCard = container.querySelectorAll('.day-card')[0];
        expect(yesterdayCard.classList.contains('day-card--active')).toBe(true);

        const btn = screen.getByTestId('select-current-time-btn');
        fireEvent.click(btn);

        // Должен вызваться onSelectTime с индексом 14 (18:00 сегодня)
        expect(handleSelectTime).toHaveBeenCalledWith(14);

        // Сегодняшний день должен стать активным
        const todayCard = container.querySelector('.day-card--today');
        expect(todayCard.classList.contains('day-card--active')).toBe(true);
    });

    it('6. Кнопка «Выбрать текущее время» подсвечивается как активная, когда выбрано текущее время', () => {
        const { rerender } = render(
            <Sidebar
                airData={mockAirData}
                referenceDate={refDate}
                selectedTimeIndex={0} // другое время
            />
        );

        const btn = screen.getByTestId('select-current-time-btn');
        expect(btn.classList.contains('date-nav__now-btn--active')).toBe(false);

        // Перерендериваем с выбранным текущим часом (индекс 14)
        rerender(
            <Sidebar
                airData={mockAirData}
                referenceDate={refDate}
                selectedTimeIndex={14}
            />
        );

        expect(btn.classList.contains('date-nav__now-btn--active')).toBe(true);
    });

    it('7. Корректно определяет ближайший час утром (например 08:45 -> 09:00)', () => {
        const morningDate = new Date('2026-10-21T08:45:00'); // шаг 09:00 (индекс 11)
        const handleSelectTime = vi.fn();

        render(
            <Sidebar
                airData={mockAirData}
                referenceDate={morningDate}
                selectedTimeIndex={20} // завтра
                onSelectTime={handleSelectTime}
            />
        );

        const btn = screen.getByTestId('select-current-time-btn');
        fireEvent.click(btn);

        expect(handleSelectTime).toHaveBeenCalledWith(11); // 09:00
    });
});
