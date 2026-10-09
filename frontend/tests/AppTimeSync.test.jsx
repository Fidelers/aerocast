import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import App from '../src/App';

vi.mock('../src/components/Sidebar', () => {
    return {
        default: function DummySidebar(props) {
            return (
                <div data-testid="sidebar">
                    <span data-testid="sidebar-loading">{props.isLoading ? 'true' : 'false'}</span>
                    <span data-testid="sidebar-time">{String(props.selectedTimeIndex)}</span>
                    <button
                        data-testid="btn-time-10"
                        onClick={() => props.onSelectTime(10)}
                    >
                        Time 10
                    </button>
                    <button
                        data-testid="btn-time-50"
                        onClick={() => props.onSelectTime(50)}
                    >
                        Time 50
                    </button>
                    <button
                        data-testid="btn-new-location"
                        onClick={() => props.onLocationSelect && props.onLocationSelect({ lat: 59.9386, lon: 30.3141 })}
                    >
                        Set Spb
                    </button>
                </div>
            );
        }
    };
});

vi.mock('../src/components/MapComponent', () => {
    return {
        default: function DummyMap(props) {
            return (
                <div data-testid="map">
                    <span data-testid="map-time">{String(props.selectedTimeIndex)}</span>
                    <span data-testid="map-iso-time">{props.selectedIsoTime || 'none'}</span>
                    <span data-testid="map-macro">{props.macroGrid ? 'present' : 'none'}</span>
                    <span data-testid="map-micro">{props.microGrid ? 'present' : 'none'}</span>
                    <button
                        data-testid="map-click-loc"
                        onClick={() => props.onLocationSelect && props.onLocationSelect(55.7558, 37.6173)}
                    >
                        Click Moscow
                    </button>
                </div>
            );
        }
    };
});

vi.mock('../src/components/RightAirPanel', () => {
    return {
        default: function DummyRightAirPanel(props) {
            return (
                <div data-testid="right-panel">
                    <span data-testid="panel-time">{String(props.selectedTimeIndex)}</span>
                </div>
            );
        }
    };
});

vi.mock('../src/components/AboutModal', () => ({
    default: () => <div data-testid="about-modal" />
}));

vi.mock('../src/components/LayerSwitcher', () => ({
    default: () => <div data-testid="layer-switcher" />
}));

// Настройка глобального fetch
globalThis.fetch = vi.fn();

describe('Epic: App.jsx и синхронизация по времени (Timeline & Grid Sync)', () => {
    // 264 часа (7 дней архив + 1 день сегодня + 4 дня прогноз)
    const mock264Hours = Array.from({ length: 264 }, (_, i) => {
        const day = String(Math.floor(i / 24) + 1).padStart(2, '0');
        const hour = String(i % 24).padStart(2, '0');
        return `2026-10-${day}T${hour}:00`;
    });

    const mockAirData = {
        latitude: 53.7596,
        longitude: 87.1467,
        used_source: 'open-meteo',
        hourly: {
            time: mock264Hours,
            european_aqi: Array.from({ length: 264 }, (_, i) => 20 + (i % 15))
        }
    };

    const mockMacroGrid = {
        type: 'macro',
        points_count: 85,
        time_steps_count: 264,
        time: mock264Hours,
        points: [{ lat: 55.75, lon: 37.61, european_aqi: [20] }]
    };

    const mockMicroGrid = {
        type: 'micro',
        bbox: [86.85, 53.45, 87.45, 54.05],
        points_count: 25,
        time_steps_count: 264,
        time: mock264Hours,
        points: [{ lat: 53.75, lon: 87.15, european_aqi: [25] }]
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => { });
        vi.spyOn(console, 'warn').mockImplementation(() => { });

        // Базовый роутинг ответов fetch
        globalThis.fetch.mockImplementation((url) => {
            const urlStr = String(url);
            if (urlStr.includes('/api/air-quality/grid/macro')) {
                return Promise.resolve({ ok: true, json: async () => mockMacroGrid });
            }
            if (urlStr.includes('/api/air-quality/grid/micro')) {
                return Promise.resolve({ ok: true, json: async () => mockMicroGrid });
            }
            if (urlStr.includes('/api/air-quality')) {
                return Promise.resolve({ ok: true, json: async () => mockAirData });
            }
            return Promise.resolve({ ok: true, json: async () => ({}) });
        });
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    describe('1. Интеграция пространственной сетки в App.jsx', () => {
        it('передает macroGrid и microGrid в MapComponent после загрузки', async () => {
            render(<App />);

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });

            // MapComponent должен получить сетки
            await waitFor(() => {
                expect(screen.getByTestId('map-macro').textContent).toBe('present');
                expect(screen.getByTestId('map-micro').textContent).toBe('present');
            });
        });

        it('запрашивает новую microGrid при смене координат города', async () => {
            render(<App />);

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });

            // Пользователь выбирает Санкт-Петербург (59.9386, 30.3141)
            fireEvent.click(screen.getByTestId('btn-new-location'));

            await waitFor(() => {
                expect(globalThis.fetch).toHaveBeenCalledWith(
                    expect.stringMatching(/\/api\/air-quality\/grid\/micro\?.*lat=59\.9386.*lon=30\.3141/),
                    expect.any(Object)
                );
            });
        });
    });

    describe('2. Синхронность во всех временных диапазонах (Timeline Scrubbing)', () => {
        it('синхронно обновляет selectedTimeIndex во всех компонентах без сетевых запросов', async () => {
            render(<App />);

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });

            const initialFetchCount = globalThis.fetch.mock.calls.length;

            // Кликаем на 10-й час (прошлое)
            fireEvent.click(screen.getByTestId('btn-time-10'));

            expect(screen.getByTestId('sidebar-time').textContent).toBe('10');
            expect(screen.getByTestId('map-time').textContent).toBe('10');
            expect(screen.getByTestId('right-panel').textContent).toContain('10');

            // Кликаем на 50-й час (будущее/прогноз)
            fireEvent.click(screen.getByTestId('btn-time-50'));

            expect(screen.getByTestId('sidebar-time').textContent).toBe('50');
            expect(screen.getByTestId('map-time').textContent).toBe('50');
            expect(screen.getByTestId('right-panel').textContent).toContain('50');

            // КРИТИЧЕСКИ: Ни одного дополнительного сетевого запроса не отправлено!
            expect(globalThis.fetch.mock.calls.length).toBe(initialFetchCount);
        });

        it('передает в MapComponent актуальную ISO-метку времени (selectedIsoTime) для защиты от рассинхронизации', async () => {
            render(<App />);

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });

            fireEvent.click(screen.getByTestId('btn-time-10'));

            const expectedIso = mock264Hours[10];
            await waitFor(() => {
                expect(screen.getByTestId('map-iso-time').textContent).toBe(expectedIso);
            });
        });
    });

    describe('3. Защита от рассинхронизации при несовпадении массивов истории', () => {
        it('сопоставляет срез сетки по строке ISO timestamp, если массивы имеют разную длину', async () => {
            // Имитируем airData со смещенным временем (на 5 часов меньше)
            const shiftedHours = mock264Hours.slice(5);
            const shiftedAirData = {
                ...mockAirData,
                hourly: {
                    ...mockAirData.hourly,
                    time: shiftedHours
                }
            };

            globalThis.fetch.mockImplementation((url) => {
                const urlStr = String(url);
                if (urlStr.includes('/api/air-quality/grid/macro')) {
                    return Promise.resolve({ ok: true, json: async () => mockMacroGrid });
                }
                if (urlStr.includes('/api/air-quality/grid/micro')) {
                    return Promise.resolve({ ok: true, json: async () => mockMicroGrid });
                }
                if (urlStr.includes('/api/air-quality')) {
                    return Promise.resolve({ ok: true, json: async () => shiftedAirData });
                }
                return Promise.resolve({ ok: true, json: async () => ({}) });
            });

            render(<App />);

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });

            // Выбираем нулевой индекс shiftedAirData (соответствует 5-му часу mock264Hours)
            fireEvent.click(screen.getByTestId('btn-time-10'));

            const expectedIso = shiftedHours[10]; // точная строка ISO
            expect(screen.getByTestId('map-iso-time').textContent).toBe(expectedIso);
        });
    });

    describe('4. Отказоустойчивость: сбой сетки не ломает основные точечные графики', () => {
        it('при ошибке загрузки микро-сетки App не падает и отображает точечные данные города', async () => {
            globalThis.fetch.mockImplementation((url) => {
                const urlStr = String(url);
                if (urlStr.includes('/api/air-quality/grid/micro')) {
                    return Promise.reject(new Error('500 Service Unavailable'));
                }
                if (urlStr.includes('/api/air-quality/grid/macro')) {
                    return Promise.resolve({ ok: true, json: async () => mockMacroGrid });
                }
                if (urlStr.includes('/api/air-quality')) {
                    return Promise.resolve({ ok: true, json: async () => mockAirData });
                }
                return Promise.resolve({ ok: true, json: async () => ({}) });
            });

            render(<App />);

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });

            // Данные города на месте, макро-сетка на месте, экран не упал
            expect(screen.getByTestId('sidebar')).toBeDefined();
            expect(screen.getByTestId('map')).toBeDefined();
            expect(screen.getByTestId('map-macro').textContent).toBe('present');
            expect(screen.getByTestId('map-micro').textContent).toBe('none');
        });
    });
});
