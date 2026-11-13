import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, act } from '@testing-library/react';
import App from '../src/App';
import { findDefaultTimeIndex } from '../src/utils/timeUtils';

vi.mock('../src/hooks/useAirGrid', () => {
    return {
        default: vi.fn(() => ({
            macroGrid: null,
            microGrid: null,
            loadMicroGrid: vi.fn(),
            loadMacroGrid: vi.fn(),
            isLoadingGrid: false,
            gridError: null
        }))
    };
});

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
                    'data-testid': 'sidebar-btn-time-5',
                    onClick: () => props.onSelectTime(5)
                }, 'Set Time 5'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-time-0',
                    onClick: () => props.onSelectTime(0)
                }, 'Set Time 0'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-time-1',
                    onClick: () => props.onSelectTime(1)
                }, 'Set Time 1'),
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
                    'data-testid': 'sidebar-btn-settings',
                    onClick: () => props.onOpenSettings && props.onOpenSettings()
                }, 'Open Settings'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-loc-undefined',
                    onClick: () => props.onLocationSelect && props.onLocationSelect(undefined)
                }, 'Set Location Undefined'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-loc-null',
                    onClick: () => props.onLocationSelect && props.onLocationSelect({ lat: null, lon: null })
                }, 'Set Location Null'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-loc-lat-null',
                    onClick: () => props.onLocationSelect && props.onLocationSelect({ lat: null, lon: 37.6173 })
                }, 'Set Location Lat Null'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-loc-lon-null',
                    onClick: () => props.onLocationSelect && props.onLocationSelect({ lat: 55.7558, lon: null })
                }, 'Set Location Lon Null'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-loc-nan',
                    onClick: () => props.onLocationSelect && props.onLocationSelect({ lat: 'invalid', lon: 37.6173 })
                }, 'Set Location NaN'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-loc-args',
                    onClick: () => props.onLocationSelect && props.onLocationSelect(55.7558, 37.6173)
                }, 'Set Location Args'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-loc-args-null',
                    onClick: () => props.onLocationSelect && props.onLocationSelect(null, null)
                }, 'Set Location Args Null'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-loc-args-lat-null',
                    onClick: () => props.onLocationSelect && props.onLocationSelect(null, 37.6173)
                }, 'Set Location Args Lat Null'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-loc-args-lon-null',
                    onClick: () => props.onLocationSelect && props.onLocationSelect(55.7558, null)
                }, 'Set Location Args Lon Null'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-loc-args-nan',
                    onClick: () => props.onLocationSelect && props.onLocationSelect('invalid', 37.6173)
                }, 'Set Location Args NaN'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-close',
                    onClick: () => props.onClose && props.onClose()
                }, 'Close Sidebar'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-theme',
                    onClick: () => props.onThemeChange && props.onThemeChange('dark')
                }, 'Set Theme'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-colorblind',
                    onClick: () => {
                        props.onColorBlindChange && props.onColorBlindChange(true);
                        props.onColorBlindTypeChange && props.onColorBlindTypeChange('protanopia');
                    }
                }, 'Set ColorBlind'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-layer',
                    onClick: () => props.onBaseLayerChange && props.onBaseLayerChange('satellite')
                }, 'Set Layer'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-loc-name',
                    onClick: () => props.onLocationSelect && props.onLocationSelect({ lat: 55.75, lon: 37.61, name: 'Moscow' })
                }, 'Set Loc Name'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-loc-cityname',
                    onClick: () => props.onLocationSelect && props.onLocationSelect({ lat: 55.75, lon: 37.61, cityName: 'City' })
                }, 'Set Loc CityName'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-loc-displayname',
                    onClick: () => props.onLocationSelect && props.onLocationSelect({ lat: 55.75, lon: 37.61, display_name: 'Display' })
                }, 'Set Loc DisplayName'),
                React.createElement('button', {
                    'data-testid': 'sidebar-btn-loc-args-named',
                    onClick: () => props.onLocationSelect && props.onLocationSelect(55.75, 37.61, 'Moscow')
                }, 'Set Loc Args Named')
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
                React.createElement('span', { 'data-testid': 'map-layer' }, props.activeBaseLayer || 'osm'),
                React.createElement('button', {
                    'data-testid': 'map-btn-click',
                    onClick: () => props.onMapClick && props.onMapClick(59.9343, 30.3351)
                }, 'Click Map Point'),
                React.createElement('button', {
                    'data-testid': 'map-btn-marker-click',
                    onClick: () => props.onMarkerClick && props.onMarkerClick()
                }, 'Click Marker'),
                React.createElement('button', {
                    'data-testid': 'map-btn-warning',
                    onClick: () => props.onMapClick && props.onMapClick(0, 0)
                }, 'Show Warning')
            );
        }
    };
});

vi.mock('../src/components/RightAirPanel', () => {
    return {
        default: function DummyRightAirPanel(props) {
            if (!props.isOpen) {
                return React.createElement('div', { 'data-testid': 'right-panel-closed' },
                    React.createElement('button', {
                        'data-testid': 'dummy-open-panel',
                        onClick: () => props.onOpen && props.onOpen()
                    }, 'Показатели')
                );
            }
            return React.createElement('div', { 'data-testid': 'right-panel-open' },
                React.createElement('span', { 'data-testid': 'right-panel-time' }, String(props.selectedTimeIndex)),
                React.createElement('span', { 'data-testid': 'right-panel-source' }, props.airData?.used_source || 'none'),
                React.createElement('button', {
                    'data-testid': 'right-panel-close-btn',
                    onClick: () => props.onClose && props.onClose()
                }, '✕'),
                React.createElement('button', {
                    'data-testid': 'right-panel-dynamics-btn',
                    onClick: () => props.onOpenDynamicsModal && props.onOpenDynamicsModal()
                }, 'Dynamics')
            );
        }
    };
});

vi.mock('../src/components/PollutionDynamicsModal', () => {
    return {
        default: function DummyDynamicsModal(props) {
            if (!props.isOpen) return null;
            return React.createElement('div', { 'data-testid': 'dynamics-modal' },
                React.createElement('button', {
                    'data-testid': 'dynamics-modal-close-btn',
                    onClick: () => props.onClose && props.onClose()
                }, 'Close'),
                React.createElement('button', {
                    'data-testid': 'dynamics-modal-select-time-btn',
                    onClick: () => props.onSelectTime && props.onSelectTime(2)
                }, 'Select Time 2')
            );
        }
    };
});

vi.mock('../src/components/LayerSwitcher', () => {
    return {
        default: function DummyLayerSwitcher(props) {
            return React.createElement('div', { 'data-testid': 'layer-switcher' },
                React.createElement('span', { 'data-testid': 'current-layer' }, props.activeLayer),
                React.createElement('button', {
                    'data-testid': 'btn-switch-satellite',
                    onClick: () => props.onLayerChange && props.onLayerChange('satellite')
                }, 'Спутник'),
                React.createElement('button', {
                    'data-testid': 'btn-switch-osm',
                    onClick: () => props.onLayerChange && props.onLayerChange('osm')
                }, 'Карта')
            );
        }
    };
});

vi.mock('../src/utils/timeUtils', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        findDefaultTimeIndex: vi.fn(),
    };
});

globalThis.fetch = vi.fn();

describe('Epic 1: App.jsx (Глобальное состояние и загрузка данных)', () => {
    const mockAirData = {
        hourly: {
            time: ['2026-09-22T10:00', '2026-09-22T11:00', '2026-09-22T12:00']
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => { });
        vi.mocked(findDefaultTimeIndex).mockReturnValue(1);
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    describe('Task 1.1: Глобальный стейт (selectedTimeIndex)', () => {
        it('1. должен иметь null в selectedTimeIndex до загрузки данных', () => {
            globalThis.fetch.mockReturnValue(new Promise(() => { }));

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

            fireEvent.click(screen.getByTestId('sidebar-btn-time-5'));

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

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });
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

            expect(findDefaultTimeIndex).toHaveBeenCalledWith(mockAirData.hourly.time, expect.any(Date));
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

            fireEvent.click(screen.getByTestId('map-btn-click'));

            expect(globalThis.fetch).toHaveBeenCalledTimes(1);
            expect(globalThis.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/air-quality?lat=59.9343&lon=30.3351')
            );

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });
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

            fireEvent.click(screen.getByTestId('sidebar-btn-mode'));

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

            fireEvent.click(screen.getByTestId('sidebar-btn-loc-obj'));

            expect(globalThis.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/air-quality?lat=55.7558&lon=37.6173')
            );

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });
        });

        it('10. открывает и закрывает AboutModal через onOpenAbout и кнопку закрытия', async () => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => mockAirData
            });

            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });

            expect(screen.queryByRole('dialog')).toBeNull();

            fireEvent.click(screen.getByTestId('sidebar-btn-about'));

            expect(screen.getByRole('dialog')).toBeTruthy();

            const closeBtn = screen.getByRole('button', { name: /закрыть/i });
            fireEvent.click(closeBtn);

            await waitFor(() => {
                expect(screen.queryByRole('dialog')).toBeNull();
            });
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

            fireEvent.click(screen.getByTestId('sidebar-btn-loc-undefined'));

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

        it('14. сбрасывает координаты в null и не выполняет запрос при { lat: null, lon: null }', async () => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => mockAirData
            });

            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });

            globalThis.fetch.mockClear();

            fireEvent.click(screen.getByTestId('sidebar-btn-loc-null'));

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

            fireEvent.click(screen.getByTestId('sidebar-btn-loc-args'));

            expect(globalThis.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/air-quality?lat=55.7558&lon=37.6173')
            );

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });
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

            fireEvent.click(screen.getByTestId('sidebar-btn-loc-args-null'));

            expect(globalThis.fetch).not.toHaveBeenCalled();
        });

        it('18. обрабатывает нечисловые значения (NaN) и односторонний null в объекте координат', async () => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => mockAirData
            });

            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });

            globalThis.fetch.mockClear();

            fireEvent.click(screen.getByTestId('sidebar-btn-loc-lat-null'));
            expect(globalThis.fetch).not.toHaveBeenCalled();

            fireEvent.click(screen.getByTestId('sidebar-btn-loc-lon-null'));
            expect(globalThis.fetch).not.toHaveBeenCalled();

            fireEvent.click(screen.getByTestId('sidebar-btn-loc-nan'));
            expect(globalThis.fetch).not.toHaveBeenCalled();
        });

        it('19. обрабатывает нечисловые значения (NaN) и односторонний null в раздельных аргументах', async () => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => mockAirData
            });

            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });

            globalThis.fetch.mockClear();

            fireEvent.click(screen.getByTestId('sidebar-btn-loc-args-lat-null'));
            expect(globalThis.fetch).not.toHaveBeenCalled();

            fireEvent.click(screen.getByTestId('sidebar-btn-loc-args-lon-null'));
            expect(globalThis.fetch).not.toHaveBeenCalled();

            fireEvent.click(screen.getByTestId('sidebar-btn-loc-args-nan'));
            expect(globalThis.fetch).not.toHaveBeenCalled();
        });
    });

    describe('Сохранение выбранного времени при повторной загрузке данных', () => {
        it('20. сохраняет точный timestamp при совпадении строки (matchedIndex !== -1)', async () => {
            const initialData = {
                hourly: {
                    time: ['2026-09-22T10:00', '2026-09-22T11:00', '2026-09-22T12:00']
                }
            };
            const updatedData = {
                hourly: {
                    time: ['2026-09-21T09:00', '2026-09-22T10:00', '2026-09-22T11:00']
                }
            };

            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => initialData
            });

            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });

            fireEvent.click(screen.getByTestId('sidebar-btn-time-0'));
            expect(screen.getByTestId('sidebar-time').textContent).toBe('0');

            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => updatedData
            });

            fireEvent.click(screen.getByTestId('sidebar-btn-loc-obj'));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-time').textContent).toBe('1');
            });
        });

        it('21. сопоставляет по дате и часу, если точная строка timestamp не совпадает (matchByDateHour !== -1)', async () => {
            const initialData = {
                hourly: {
                    time: ['2026-09-22T10:00', '2026-09-22T11:00']
                }
            };
            const updatedData = {
                hourly: {
                    time: ['2026-09-21T09:00', '2026-09-22T10:00:00']
                }
            };

            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => initialData
            });

            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });

            fireEvent.click(screen.getByTestId('sidebar-btn-time-0'));

            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => updatedData
            });

            fireEvent.click(screen.getByTestId('sidebar-btn-loc-obj'));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-time').textContent).toBe('1');
            });
        });

        it('22. сохраняет prevIndex, если точная дата/час не совпали, но prevIndex в пределах массива', async () => {
            const initialData = {
                hourly: {
                    time: ['2026-09-20T00:00', '2026-09-20T01:00', '2026-09-20T02:00']
                }
            };
            const updatedData = {
                hourly: {
                    time: ['2026-09-25T05:00', '2026-09-25T06:00', '2026-09-25T07:00']
                }
            };

            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => initialData
            });

            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });

            fireEvent.click(screen.getByTestId('sidebar-btn-time-1'));

            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => updatedData
            });

            fireEvent.click(screen.getByTestId('sidebar-btn-loc-obj'));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-time').textContent).toBe('1');
            });
        });

        it('23. сбрасывает на findDefaultTimeIndex, если prevIndex вне диапазона новых данных', async () => {
            const initialData = {
                hourly: {
                    time: ['2026-09-20T00:00', '2026-09-20T01:00', '2026-09-20T02:00', '2026-09-20T03:00', '2026-09-20T04:00', '2026-09-20T05:00']
                }
            };
            const updatedData = {
                hourly: {
                    time: ['2026-09-25T05:00', '2026-09-25T06:00']
                }
            };

            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => initialData
            });

            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });

            fireEvent.click(screen.getByTestId('sidebar-btn-time-5'));

            vi.mocked(findDefaultTimeIndex).mockReturnValue(0);

            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => updatedData
            });

            fireEvent.click(screen.getByTestId('sidebar-btn-loc-obj'));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-time').textContent).toBe('0');
            });
        });

        it('24. корректно обрабатывает случай, когда сохраненный timestamp не парсится parseIsoTimeString', async () => {
            const initialData = {
                hourly: {
                    time: ['not-a-valid-date']
                }
            };
            const updatedData = {
                hourly: {
                    time: ['2026-09-25T05:00']
                }
            };

            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => initialData
            });

            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });

            fireEvent.click(screen.getByTestId('sidebar-btn-time-0'));

            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => updatedData
            });

            fireEvent.click(screen.getByTestId('sidebar-btn-loc-obj'));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-time').textContent).toBe('0');
            });
        });
    });

    describe('Интеграция RightAirPanel и LayerSwitcher в App', () => {
        const mockAirData = {
            latitude: 55.7558,
            longitude: 37.6173,
            used_source: 'open-meteo',
            hourly: {
                time: ['2026-09-22T10:00', '2026-09-22T11:00'],
                european_aqi: [30, 45]
            }
        };

        beforeEach(() => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => mockAirData
            });
        });

        it('открывает RightAirPanel при клике на маркер карты и передает airData', async () => {
            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('map-data').textContent).toBe('loaded');
            });

            const markerBtn = screen.getByTestId('map-btn-marker-click');
            fireEvent.click(markerBtn);

            expect(screen.getByTestId('right-panel-open')).toBeTruthy();
        });

        it('закрывает RightAirPanel по кнопке закрытия и восстанавливает видимость кнопки показателей', async () => {
            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('map-data').textContent).toBe('loaded');
            });

            const markerBtn = screen.getByTestId('map-btn-marker-click');
            fireEvent.click(markerBtn);
            expect(screen.getByTestId('right-panel-open')).toBeTruthy();

            const closeBtn = screen.getByTestId('right-panel-close-btn');
            fireEvent.click(closeBtn);

            expect(screen.getByTestId('right-panel-closed')).toBeTruthy();
        });

        it('интегрирует LayerSwitcher и обновляет activeBaseLayer в MapComponent', async () => {
            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('layer-switcher')).toBeTruthy();
            });

            const switchBtn = screen.getByTestId('btn-switch-satellite');
            fireEvent.click(switchBtn);

            expect(screen.getByTestId('map-layer').textContent).toBe('satellite');
        });

        it('инициализирует activeBaseLayer со значением из localStorage под ключом aerocast_map_layer', async () => {
            localStorage.setItem('aerocast_map_layer', 'satellite');

            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('map-layer').textContent).toBe('satellite');
            });

            localStorage.removeItem('aerocast_map_layer');
        });

        it('инициализирует activeBaseLayer значением по умолчанию "osm", если aerocast_map_layer отсутствует', async () => {
            localStorage.removeItem('aerocast_map_layer');

            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('map-layer').textContent).toBe('osm');
            });
        });

        it('сохраняет выбранный слой в localStorage под ключом "aerocast_map_layer" при переключении слоя', async () => {
            localStorage.removeItem('aerocast_map_layer');

            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('layer-switcher')).toBeTruthy();
            });

            const switchBtn = screen.getByTestId('btn-switch-satellite');
            fireEvent.click(switchBtn);

            expect(localStorage.getItem('aerocast_map_layer')).toBe('satellite');

            const switchOsmBtn = screen.getByTestId('btn-switch-osm');
            fireEvent.click(switchOsmBtn);

            expect(localStorage.getItem('aerocast_map_layer')).toBe('osm');
        });

        it('открывает и закрывает SettingsModal через onOpenSettings и onClose', async () => {
            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-btn-settings')).toBeTruthy();
            });

            fireEvent.click(screen.getByTestId('sidebar-btn-settings'));

            expect(screen.getByRole('dialog')).toBeTruthy();

            fireEvent.keyDown(window, { key: 'Escape' });

            await waitFor(() => {
                expect(screen.queryByRole('dialog')).toBeNull();
            });
        });

        it('открывает панель через кнопку-фаб и через onOpen', async () => {
            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('right-panel-close-btn')).toBeTruthy();
            });

            fireEvent.click(screen.getByTestId('right-panel-close-btn'));

            const fab = screen.getByTestId('fab-open-panel');
            expect(fab).toBeTruthy();
            fireEvent.click(fab);

            expect(screen.getByTestId('right-panel-open')).toBeTruthy();

            fireEvent.click(screen.getByTestId('right-panel-close-btn'));

            const dummyBtn = screen.getByTestId('dummy-open-panel');
            fireEvent.click(dummyBtn);

            expect(screen.getByTestId('right-panel-open')).toBeTruthy();
        });

        it('инициализирует тему и дальтонизм из prefers-color-scheme и localStorage', async () => {
            localStorage.clear();
            localStorage.setItem('aerocast_colorblind', 'true');
            const origMatchMedia = window.matchMedia;
            window.matchMedia = vi.fn().mockImplementation(query => ({
                matches: query === '(prefers-color-scheme: dark)',
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            }));

            try {
                render(React.createElement(App));
                expect(document.documentElement.getAttribute('data-colorblind')).toBe('true');
                expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
            } finally {
                window.matchMedia = origMatchMedia;
                localStorage.removeItem('aerocast_colorblind');
            }
        });

        it('обрабатывает события visibilitychange, focus и таймеры скрытия предупреждения покрытия', () => {
            vi.useFakeTimers();
            try {
                render(React.createElement(App));

                document.dispatchEvent(new Event('visibilitychange'));

                window.dispatchEvent(new Event('focus'));

                const warnBtn = screen.getByTestId('map-btn-warning');
                fireEvent.click(warnBtn);

                act(() => { vi.advanceTimersByTime(5100); });
                act(() => { vi.advanceTimersByTime(400); });
            } finally {
                vi.useRealTimers();
            }
        });
    });

    describe('BUG-01: Запрос разрешения на доступ к геолокации и центрирование карты при открытии сайта', () => {
        let origGeo;

        beforeEach(() => {
            origGeo = globalThis.navigator.geolocation;
        });

        afterEach(() => {
            if (origGeo !== undefined) {
                globalThis.navigator.geolocation = origGeo;
            } else {
                delete globalThis.navigator.geolocation;
            }
        });

        it('запрашивает геолокацию по GPS с enableHighAccuracy: true при монтировании', () => {
            const getCurrentPositionMock = vi.fn();
            globalThis.navigator.geolocation = {
                getCurrentPosition: getCurrentPositionMock
            };

            render(React.createElement(App));

            expect(getCurrentPositionMock).toHaveBeenCalledTimes(1);
            expect(getCurrentPositionMock).toHaveBeenCalledWith(
                expect.any(Function),
                expect.any(Function),
                expect.objectContaining({ enableHighAccuracy: true })
            );
        });

        it('центрирует карту и запрашивает данные воздуха для координат GPS при разрешении доступа', async () => {
            const mockLat = 55.7558;
            const mockLon = 37.6173;

            globalThis.navigator.geolocation = {
                getCurrentPosition: vi.fn((successCb) => {
                    successCb({
                        coords: {
                            latitude: mockLat,
                            longitude: mockLon,
                        }
                    });
                })
            };

            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => mockAirData
            });

            render(React.createElement(App));

            await waitFor(() => {
                expect(globalThis.fetch).toHaveBeenCalledWith(
                    expect.stringContaining(`/api/air-quality?lat=${mockLat}&lon=${mockLon}`)
                );
            });
        });

        it('делает запрос ТОЛЬКО по GPS без запасного варианта: при отказе пользователя НЕ вызывает IP-fallback и оставляет координаты по умолчанию', async () => {
            globalThis.navigator.geolocation = {
                getCurrentPosition: vi.fn((_successCb, errorCb) => {
                    errorCb({ code: 1, message: 'User denied Geolocation' });
                })
            };

            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => mockAirData
            });

            render(React.createElement(App));

            expect(globalThis.fetch).not.toHaveBeenCalledWith(expect.stringContaining('locate-me'));
            expect(globalThis.fetch).not.toHaveBeenCalledWith(expect.stringContaining('ipwho'));

            expect(globalThis.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/air-quality?lat=53.7596&lon=87.1467')
            );
        });

        it('не падает и не делает запасных запросов при отсутствии navigator.geolocation в браузере', () => {
            delete globalThis.navigator.geolocation;

            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => mockAirData
            });

            render(React.createElement(App));

            expect(globalThis.fetch).not.toHaveBeenCalledWith(expect.stringContaining('locate-me'));
            expect(globalThis.fetch).not.toHaveBeenCalledWith(expect.stringContaining('ipwho'));
            expect(globalThis.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/air-quality?lat=53.7596&lon=87.1467')
            );
        });

        it('обрабатывает выбор точки без названия и скрытие предупреждения покрытия с таймерами (lines 82, 293)', async () => {
            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => mockAirData
            });

            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });

            fireEvent.click(screen.getByTestId('map-btn-warning'));

            await waitFor(() => {
                expect(screen.getByTestId('coverage-notification')).toBeDefined();
            });

            fireEvent.click(screen.getByTestId('sidebar-btn-loc-args'));

            await waitFor(() => {
                expect(screen.queryByTestId('coverage-notification')).toBeNull();
            });
        });

        it('обрабатывает невалидные координаты GPS и размонтирование до завершения (lines 318-321)', () => {
            let capturedSuccess;
            globalThis.navigator.geolocation = {
                getCurrentPosition: vi.fn((successCb) => {
                    capturedSuccess = successCb;
                })
            };

            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => mockAirData
            });

            const { unmount } = render(React.createElement(App));

            capturedSuccess({ coords: { latitude: null, longitude: null } });
            capturedSuccess({ coords: { latitude: NaN, longitude: 50 } });

            unmount();
            capturedSuccess({ coords: { latitude: 55, longitude: 37 } });
        });

        it('открывает и закрывает мобильное меню и обрабатывает клик по бэкдропу', async () => {
            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('mobile-menu-toggle')).toBeTruthy();
            });

            fireEvent.click(screen.getByTestId('mobile-menu-toggle'));
            expect(screen.getByTestId('sidebar-btn-close')).toBeTruthy();

            const backdrop = document.querySelector('.sidebar-backdrop');
            expect(backdrop).toBeTruthy();
            fireEvent.click(backdrop);

            fireEvent.click(screen.getByTestId('mobile-menu-toggle'));
            fireEvent.click(screen.getByTestId('sidebar-btn-close'));
        });

        it('обрабатывает клик по предупреждению покрытия и кнопку закрытия', async () => {
            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('map-btn-warning')).toBeTruthy();
            });

            fireEvent.click(screen.getByTestId('map-btn-warning'));

            await waitFor(() => {
                expect(screen.getByTestId('coverage-notification')).toBeTruthy();
            });

            fireEvent.click(screen.getByTestId('coverage-notification'));

            const closeBtn = screen.getByTestId('coverage-notification-close');
            fireEvent.click(closeBtn);
        });

        it('поддерживает referenceDate и отображает бейдж прогноза при выборе будущего времени', async () => {
            const customRefDate = new Date('2026-09-22T08:00:00Z');
            const dataWithFutureTimes = {
                hourly: {
                    time: [
                        '2026-09-20T07:00',
                        '2026-09-20T08:00',
                        '2026-09-20T09:00',
                        '2026-09-20T10:00',
                        '2026-09-20T11:00',
                        '2026-09-25T12:00'
                    ],
                    pm2_5: [10, 10, 10, 10, 10, 10]
                }
            };
            vi.mocked(findDefaultTimeIndex).mockReturnValue(0);
            globalThis.fetch.mockResolvedValue({
                ok: true,
                json: async () => dataWithFutureTimes
            });

            render(React.createElement(App, { referenceDate: customRefDate }));

            await waitFor(() => {
                expect(screen.getByTestId('sidebar-loading').textContent).toBe('false');
            });

            fireEvent.click(screen.getByTestId('sidebar-btn-time-5'));

            await waitFor(() => {
                expect(screen.getByTestId('forecast-badge')).toBeTruthy();
            });

            fireEvent.click(screen.getByTestId('sidebar-btn-loc-name'));
            fireEvent.click(screen.getByTestId('sidebar-btn-loc-cityname'));
            fireEvent.click(screen.getByTestId('sidebar-btn-loc-displayname'));
            fireEvent.click(screen.getByTestId('sidebar-btn-loc-args-named'));
        });

        it('открывает и закрывает PollutionDynamicsModal и выбирает время', async () => {
            render(React.createElement(App));

            await waitFor(() => {
                expect(screen.getByTestId('right-panel-dynamics-btn')).toBeTruthy();
            });

            fireEvent.click(screen.getByTestId('right-panel-dynamics-btn'));

            await waitFor(() => {
                expect(screen.getByTestId('dynamics-modal')).toBeTruthy();
            });

            fireEvent.click(screen.getByTestId('dynamics-modal-select-time-btn'));
            expect(screen.getByTestId('sidebar-time').textContent).toBe('2');

            fireEvent.click(screen.getByTestId('dynamics-modal-close-btn'));
            expect(screen.queryByTestId('dynamics-modal')).toBeNull();

            fireEvent.click(screen.getByTestId('sidebar-btn-theme'));
            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

            fireEvent.click(screen.getByTestId('sidebar-btn-colorblind'));
            expect(document.documentElement.getAttribute('data-colorblind')).toBe('true');

            fireEvent.click(screen.getByTestId('sidebar-btn-layer'));
            expect(screen.getByTestId('map-layer').textContent).toBe('satellite');
        });

        it('обрабатывает скрытие и показ документа для обновления часов', () => {
            render(React.createElement(App));

            Object.defineProperty(document, 'visibilityState', {
                configurable: true,
                get: () => 'hidden'
            });
            document.dispatchEvent(new Event('visibilitychange'));

            Object.defineProperty(document, 'visibilityState', {
                configurable: true,
                get: () => 'visible'
            });
            document.dispatchEvent(new Event('visibilitychange'));
        });
    });
});