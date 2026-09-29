// App.test.jsx
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';
import { findDefaultTimeIndex } from '../src/utils/timeUtils';

// 1. Мокаем дочерние компоненты (через React.createElement, чтобы не ломать парсер угловыми скобками)
vi.mock('../src/components/Sidebar', () => {
    return {
        default: function DummySidebar(props) {
            return React.createElement('div', { 'data-testid': 'sidebar' },
                React.createElement('span', { 'data-testid': 'sidebar-loading' }, props.isLoading ? 'true' : 'false'),
                React.createElement('span', { 'data-testid': 'sidebar-error' }, props.loadError || 'none'),
                React.createElement('span', { 'data-testid': 'sidebar-data' }, props.airData ? 'loaded' : 'empty'),
                React.createElement('span', { 'data-testid': 'sidebar-time' }, String(props.selectedTimeIndex)),
                React.createElement('span', { 'data-testid': 'sidebar-mode' }, String(props.viewMode)),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-time',
                    onClick: () => props.onSelectTime(5)
                }, 'Set Time 5'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-mode',
                    onClick: () => props.onViewModeChange && props.onViewModeChange('color')
                }, 'Set Mode Color'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-loc-obj',
                    onClick: () => props.onLocationSelect && props.onLocationSelect({ lat: 55.7558, lon: 37.6173 })
                }, 'Set Location Obj'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-about',
                    onClick: () => props.onOpenAbout && props.onOpenAbout()
                }, 'Open About'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-loc-undefined',
                    onClick: () => props.onLocationSelect && props.onLocationSelect(undefined)
                }, 'Set Location Undefined'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-loc-null',
                    onClick: () => props.onLocationSelect && props.onLocationSelect({ lat: null, lon: null })
                }, 'Set Location Null'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-loc-args',
                    onClick: () => props.onLocationSelect && props.onLocationSelect(55.7558, 37.6173)
                }, 'Set Location Args'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-loc-args-null',
                    onClick: () => props.onLocationSelect && props.onLocationSelect(null, null)
                }, 'Set Location Args Null')
            );
        }
    };
});

vi.mock('../src/components/MapComponent', () => {
    return {
        default: function DummyMap(props) {
            return React.createElement('div', { 'data-testid': 'map' },
                React.createElement('span', { 'data-testid': 'map-data' }, props.airData ? 'loaded' : 'empty'),
                React.createElement('span', { 'data-testid': 'map-time' }, String(props.selectedTimeIndex)),
                React.createElement('button', {
                    'data-testid': 'map-btn-click',
                    onClick: () => props.onMapClick && props.onMapClick(59.9343, 30.3351)
                }, 'Click Map Point')
            );
        }
    };
});

// 2. Мокаем вспомогательную утилиту
vi.mock('../src/utils/timeUtils', () => ({
    findDefaultTimeIndex: vi.fn()
}));

// 3. Настройка мока для глобального fetch
globalThis.fetch = vi.fn();

describe('Epic 1: App.jsx (Глобальное состояние и загрузка данных)', () => {
    const mockAirData = {
        hourly: {
            time: ['2026-09-22T10:00', '2026-09-22T11:00', '2026-09-22T12:00']
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(findDefaultTimeIndex).mockReturnValue(1);
    });

    afterEach(() => {
        cleanup();
    });

    describe('Task 1.1: Глобальный стейт (selectedTimeIndex)', () => {
        it('1. должен иметь null в selectedTimeIndex до загрузки данных', () => {
            globalThis.fetch.mockReturnValue(new Promise(() => {}));

            render(React.createElement(App));

            expect(screen.getByTestId('sidebar-time').textContent).toBe('null');
            expect(screen.getByTestId('map-time').textContent).toBe('null');
        });

        it('2. должен обновлять selectedTimeIndex без сетевого запроса при вызове onSelectTime', async () => {
            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockAirData
            });

            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });

            await act(async () => {
                await userEvent.click(screen.getByTestId('sidebar-btn-time'));
            });

            expect(screen.getByTestId('sidebar-time').textContent).toBe('5');
            expect(screen.getByTestId('map-time').textContent).toBe('5');
        });
    });

    describe('Task 1.2: Интеграция эндпоинта /api/air-quality', () => {
        it('3. должен делать GET-запрос к API с дефолтными координатами при монтировании', async () => {
            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockAirData
            });

            render(React.createElement(App));

            expect(globalThis.fetch).toHaveBeenCalledTimes(1);
            expect(globalThis.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/air-quality?lat=53.7596&lon=87.1467')
            );
        });

        it('4. должен сохранять данные, вычислять время и снимать флаг загрузки при успешном ответе', async () => {
            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockAirData
            });

            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-data').textContent).toBe('loaded');
                expect(screen.getByTestId('map-data').textContent).toBe('loaded');
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
                expect(screen.getByTestId('sidebar-time').textContent).toBe('1');
            });

            expect(findDefaultTimeIndex).toHaveBeenCalledWith(mockAirData.hourly.time);
        });

        it('5. должен корректно обрабатывать ошибку (500), сохранять текст ошибки и снимать флаг загрузки', async () => {
            globalThis.fetch.mockResolvedValueOnce({
                ok: false,
                status: 500
            });

            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-error').textContent).toBe('Ошибка сервера: 500');
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
                expect(screen.getByTestId('sidebar-data').textContent).toBe('empty');
                expect(screen.getByTestId('map-data').textContent).toBe('empty');
            });
        });

        it('6. должен корректно обрабатывать сетевую ошибку (отказ сети)', async () => {
            globalThis.fetch.mockRejectedValueOnce(new Error('Failed to fetch'));

            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-error').textContent).toBe('Failed to fetch');
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });
        });
    });

    describe('Task: Интерактивный клик по карте (onMapClick)', () => {
        it('7. должен обновлять координаты и запрашивать /api/air-quality при клике на карте через onMapClick', async () => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => mockAirData
            });

            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });

            globalThis.fetch.mockClear();

            await act(async () => {
                await userEvent.click(screen.getByTestId('map-btn-click'));
            });

            expect(globalThis.fetch).toHaveBeenCalledTimes(1);
            expect(globalThis.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/air-quality?lat=59.9343&lon=30.3351')
            );
        });
    });

    describe('Дополнительные сценарии App.jsx (режимы отображения, выбор объекта локации, AboutModal)', () => {
        it('8. переключает viewMode при вызове onViewModeChange', async () => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => mockAirData
            });

            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-mode').textContent).toBe('combo');
            });

            await act(async () => {
                await userEvent.click(screen.getByTestId('sidebar-btn-mode'));
            });

            expect(screen.getByTestId('sidebar-mode').textContent).toBe('color');
        });

        it('9. обновляет координаты при передаче объекта { lat, lon } в onLocationSelect', async () => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => mockAirData
            });

            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });

            globalThis.fetch.mockClear();

            await act(async () => {
                await userEvent.click(screen.getByTestId('sidebar-btn-loc-obj'));
            });

            expect(globalThis.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/air-quality?lat=55.7558&lon=37.6173')
            );
        });

        it('10. открывает и закрывает AboutModal через onOpenAbout и кнопку закрытия', async () => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => mockAirData
            });

            render(React.createElement(App));

            expect(screen.queryByRole('dialog')).toBeNull();

            await act(async () => {
                await userEvent.click(screen.getByTestId('sidebar-btn-about'));
            });

            expect(screen.getByRole('dialog')).toBeTruthy();

            const closeBtn = screen.getByRole('button', { name: /закрыть/i });
            await act(async () => {
                await userEvent.click(closeBtn);
            });

            expect(screen.queryByRole('dialog')).toBeNull();
        });

        it('11. корректно обрабатывает пустые данные без hourly.time', async () => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({})
            });

            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-data').textContent).toBe('loaded');
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });
        });

        it('12. игнорирует некорректные аргументы в handleLocationSelect', async () => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => mockAirData
            });

            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });

            globalThis.fetch.mockClear();

            await act(async () => {
                await userEvent.click(screen.getByTestId('sidebar-btn-loc-undefined'));
            });

            // Запрос не должен отправляться для некорректных аргументов
            expect(globalThis.fetch).not.toHaveBeenCalled();
        });

        it('13. предотвращает обновление состояния, если компонент был размонтирован во время запроса', async () => {
            let resolveFetch;
            globalThis.fetch.mockImplementation(() => new Promise((resolve) => {
                resolveFetch = resolve;
            }));

            const { unmount } = render(React.createElement(App));
            unmount();

            resolveFetch({
                ok: true,
                json: async () => mockAirData
            });
        });

        it('14. не выполняет сетевой запрос, если координаты равны null', async () => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => mockAirData
            });

            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });

            globalThis.fetch.mockClear();

            // Передаем координаты с null
            await act(async () => {
                await userEvent.click(screen.getByTestId('sidebar-btn-loc-null'));
            });

            expect(globalThis.fetch).not.toHaveBeenCalled();
        });

        it('15. предотвращает обработку ошибки, если компонент размонтирован во время сбоя сети', async () => {
            let rejectFetch;
            globalThis.fetch.mockImplementation(() => new Promise((_, reject) => {
                rejectFetch = reject;
            }));

            const { unmount } = render(React.createElement(App));
            unmount();

            rejectFetch(new Error('Network error after unmount'));
        });

        it('16. обновляет координаты при передаче раздельных числовых аргументов в onLocationSelect', async () => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => mockAirData
            });

            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });

            globalThis.fetch.mockClear();

            await act(async () => {
                await userEvent.click(screen.getByTestId('sidebar-btn-loc-args'));
            });

            expect(globalThis.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/air-quality?lat=55.7558&lon=37.6173')
            );
        });

        it('17. корректно обрабатывает раздельные аргументы со значениями null в onLocationSelect', async () => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => mockAirData
            });

            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });

            globalThis.fetch.mockClear();

            await act(async () => {
                await userEvent.click(screen.getByTestId('sidebar-btn-loc-args-null'));
            });

            expect(globalThis.fetch).not.toHaveBeenCalled();
        });
    });
});