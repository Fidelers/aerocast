import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import App from '../../src/App';
import { isForecastTime } from '../../src/utils/timeUtils';

// Мокаем MapComponent, так как MapLibre GL требует WebGL
vi.mock('../../src/components/MapComponent', () => ({
    default: function DummyMap(props) {
        return (
            <div data-testid="map">
                <span data-testid="map-time">{String(props.selectedTimeIndex)}</span>
                <span data-testid="map-iso">{props.selectedIsoTime || 'none'}</span>
            </div>
        );
    }
}));

// Мокаем хук useAirGrid
vi.mock('../../src/hooks/useAirGrid', () => ({
    default: vi.fn(() => ({
        macroGrid: null,
        microGrid: null,
        loadMicroGrid: vi.fn(),
        loadMacroGrid: vi.fn(),
        isLoadingGrid: false,
        gridError: null
    }))
}));

describe('Forecast Badge (Плашка «Прогноз» на карте)', () => {
    // Временная шкала:
    // 2026-10-20 (вчера, архив, индекс 0..7)
    // 2026-10-21 (сегодня, индекс 8..15)
    // 2026-10-22 (прогноз, индекс 16..23)
    const mockHours = [
        // Вчера (2026-10-20)
        '2026-10-20T00:00', '2026-10-20T03:00', '2026-10-20T06:00', '2026-10-20T09:00',
        '2026-10-20T12:00', '2026-10-20T15:00', '2026-10-20T18:00', '2026-10-20T21:00',
        // Сегодня (2026-10-21)
        '2026-10-21T00:00', '2026-10-21T03:00', '2026-10-21T06:00', '2026-10-21T09:00',
        '2026-10-21T12:00', '2026-10-21T15:00', '2026-10-21T18:00', '2026-10-21T21:00',
        // Завтра / Прогноз (2026-10-22)
        '2026-10-22T00:00', '2026-10-22T03:00', '2026-10-22T06:00', '2026-10-22T09:00',
        '2026-10-22T12:00', '2026-10-22T15:00', '2026-10-22T18:00', '2026-10-22T21:00'
    ];

    const mockAirData = {
        latitude: 53.7596,
        longitude: 87.1467,
        used_source: 'open-meteo',
        hourly: {
            time: mockHours,
            european_aqi: new Array(mockHours.length).fill(25),
            pm2_5: new Array(mockHours.length).fill(10),
            pm10: new Array(mockHours.length).fill(20),
            nitrogen_dioxide: new Array(mockHours.length).fill(15),
            sulphur_dioxide: new Array(mockHours.length).fill(5),
            ozone: new Array(mockHours.length).fill(30),
            carbon_monoxide: new Array(mockHours.length).fill(200)
        }
    };

    // Текущее контрольное время: 21 октября 2026, 15:00
    const refToday = new Date('2026-10-21T15:00:00');

    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => mockAirData
        });
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('1. Не отображает плашку прогноза при начальной загрузке текущего часа (15:00 21-го числа)', async () => {
        render(<App referenceDate={refToday} />);

        await waitFor(() => {
            expect(document.querySelector('.days')).toBeTruthy();
        });

        // По умолчанию выбран текущий час (15:00 21-го числа) — не прогноз
        const badge = screen.queryByTestId('forecast-badge');
        expect(badge).toBeNull();
    });

    it('2. Отображает плашку «Прогноз» при клике на будущий час сегодняшнего дня (18:00 21-го числа при текущих 15:00)', async () => {
        const { container } = render(<App referenceDate={refToday} />);

        await waitFor(() => {
            expect(container.querySelector('.days')).toBeTruthy();
        });

        // Находим кнопку 18:00 сегодняшнего дня
        const btn18 = Array.from(container.querySelectorAll('.times .time')).find(
            (b) => b.textContent.trim() === '18:00'
        );
        expect(btn18).toBeTruthy();

        // Кликаем по 18:00 (будущее время сегодня)
        fireEvent.click(btn18);

        // Плашка «Прогноз» должна появиться
        await waitFor(() => {
            const badge = screen.getByTestId('forecast-badge');
            expect(badge).toBeTruthy();
            expect(badge.textContent).toContain('Прогноз');
            expect(badge.querySelector('.forecast-badge__dot')).toBeTruthy();
            expect(badge.querySelector('.forecast-badge__label')).toBeTruthy();
        });
    });

    it('3. Скрывает плашку «Прогноз» при переключении на прошедший час сегодняшнего дня (12:00 21-го числа)', async () => {
        const { container } = render(<App referenceDate={refToday} />);

        await waitFor(() => {
            expect(container.querySelector('.days')).toBeTruthy();
        });

        // Выбираем 18:00 (прогноз)
        const btn18 = Array.from(container.querySelectorAll('.times .time')).find(
            (b) => b.textContent.trim() === '18:00'
        );
        fireEvent.click(btn18);

        await waitFor(() => {
            expect(screen.getByTestId('forecast-badge')).toBeTruthy();
        });

        // Переключаем на 12:00 (прошедший час)
        const btn12 = Array.from(container.querySelectorAll('.times .time')).find(
            (b) => b.textContent.trim() === '12:00'
        );
        fireEvent.click(btn12);

        // Плашка должна скрыться
        await waitFor(() => {
            expect(screen.queryByTestId('forecast-badge')).toBeNull();
        });
    });

    it('4. Отображает плашку «Прогноз» при клике на прогнозируемый день (завтра, 22-е число)', async () => {
        const { container } = render(<App referenceDate={refToday} />);

        await waitFor(() => {
            expect(container.querySelector('.days')).toBeTruthy();
        });

        const day22Card = container.querySelector('.day-card[title="2026-10-22"]');
        expect(day22Card).toBeTruthy();

        fireEvent.click(day22Card);

        await waitFor(() => {
            const badge = screen.getByTestId('forecast-badge');
            expect(badge).toBeTruthy();
            expect(badge.textContent).toContain('Прогноз');
        });
    });

    it('5. Не отображает плашку «Прогноз» при переключении на прошедший архивный день (вчера, 20-е число)', async () => {
        const { container } = render(<App referenceDate={refToday} />);

        await waitFor(() => {
            expect(container.querySelector('.days')).toBeTruthy();
        });

        const day20Card = container.querySelector('.day-card[title="2026-10-20"]');
        fireEvent.click(day20Card);

        await waitFor(() => {
            expect(screen.queryByTestId('forecast-badge')).toBeNull();
        });
    });

    it('6. Плашка имеет правильную семантику accessibility (role="status" и title)', async () => {
        const { container } = render(<App referenceDate={refToday} />);

        await waitFor(() => {
            expect(container.querySelector('.days')).toBeTruthy();
        });

        const day22Card = container.querySelector('.day-card[title="2026-10-22"]');
        fireEvent.click(day22Card);

        await waitFor(() => {
            const badge = screen.getByTestId('forecast-badge');
            expect(badge.getAttribute('role')).toBe('status');
            expect(badge.getAttribute('title')).toBeTruthy();
        });
    });
});

describe('isForecastTime unit tests', () => {
    const ref = new Date('2026-10-21T15:00:00');

    it('возвращает true для будущего дня', () => {
        expect(isForecastTime('2026-10-22T00:00', ref)).toBe(true);
        expect(isForecastTime('2026-10-23T12:00', ref)).toBe(true);
    });

    it('возвращает true для будущего часа того же дня (18:00 > 15:00)', () => {
        expect(isForecastTime('2026-10-21T18:00', ref)).toBe(true);
        expect(isForecastTime('2026-10-21T21:00', ref)).toBe(true);
    });

    it('возвращает false для текущего часа того же дня (15:00)', () => {
        expect(isForecastTime('2026-10-21T15:00', ref)).toBe(false);
    });

    it('возвращает false для прошедшего часа того же дня (12:00 < 15:00)', () => {
        expect(isForecastTime('2026-10-21T12:00', ref)).toBe(false);
        expect(isForecastTime('2026-10-21T00:00', ref)).toBe(false);
    });

    it('возвращает false для архивных прошедших дней', () => {
        expect(isForecastTime('2026-10-20T18:00', ref)).toBe(false);
        expect(isForecastTime('2026-10-19T21:00', ref)).toBe(false);
    });

    it('поддерживает referenceDate в виде строки ISO', () => {
        expect(isForecastTime('2026-10-21T18:00', '2026-10-21T15:00')).toBe(true);
        expect(isForecastTime('2026-10-21T12:00', '2026-10-21T15:00')).toBe(false);
    });

    it('обрабатывает null и невалидные входные данные без ошибок', () => {
        expect(isForecastTime(null, ref)).toBe(false);
        expect(isForecastTime('', ref)).toBe(false);
        expect(isForecastTime('invalid', ref)).toBe(false);
    });
});
