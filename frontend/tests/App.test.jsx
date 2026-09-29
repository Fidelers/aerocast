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
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-time',
                    onClick: () => props.onSelectTime(5)
                }, 'Set Time 5')
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

    describe('Task 1.1: Архитектура состояний React', () => {
        it('1. должен передавать правильные начальные состояния в дочерние компоненты (loading: true, data: null)', async () => {
            globalThis.fetch.mockImplementation(() => new Promise(() => {}));

            render(React.createElement(App));

            expect(screen.getByTestId('sidebar-loading').textContent).toBe('true');
            expect(screen.getByTestId('sidebar-error').textContent).toBe('none');
            expect(screen.getByTestId('sidebar-data').textContent).toBe('empty');
            expect(screen.getByTestId('map-data').textContent).toBe('empty');
        });

        it('2. должен обновлять глобальное состояние selectedTimeIndex при вызове onSelectTime из Sidebar и передавать его в MapComponent', async () => {
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
});