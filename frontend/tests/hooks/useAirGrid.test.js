import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAirGrid, getMicroGridCacheKey } from '../../src/hooks/useAirGrid';

// Мокаем глобальный fetch
globalThis.fetch = vi.fn();

describe('Hook: useAirGrid (Управление жизненным циклом и состоянием сетки)', () => {
    const mockMacroData = {
        type: 'macro',
        points_count: 85,
        time_steps_count: 264,
        used_source: 'open-meteo',
        time: ['2026-10-01T00:00'],
        points: [{ lat: 55.75, lon: 37.61, european_aqi: [20] }]
    };

    const mockMicroData = {
        type: 'micro',
        bbox: [86.85, 53.45, 87.45, 54.05],
        points_count: 25,
        time_steps_count: 264,
        used_source: 'open-meteo',
        time: ['2026-10-01T00:00'],
        points: [{ lat: 53.55, lon: 86.95, european_aqi: [25] }]
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => { });
        vi.spyOn(console, 'warn').mockImplementation(() => { });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('1. getMicroGridCacheKey(lat, lon, step)', () => {
        it('квантует координаты к шагу 0.2° и возвращает ключ grid_micro_${qLat}_${qLon}', () => {
            const key = getMicroGridCacheKey(53.7596, 87.1467);
            expect(key).toBe('grid_micro_53.80_87.20');
        });

        it('корректно обрабатывает отрицательные координаты', () => {
            const key = getMicroGridCacheKey(-33.8688, 151.2093);
            expect(key).toBe('grid_micro_-33.80_151.20');
        });

        it('поддерживает произвольный шаг квантования (например, 0.1°)', () => {
            const key = getMicroGridCacheKey(55.7512, 37.6184, 0.1);
            expect(key).toBe('grid_micro_55.80_37.60');
        });

        it('выбрасывает ошибку при невалидных координатах', () => {
            expect(() => getMicroGridCacheKey(null, 37.61)).toThrow();
            expect(() => getMicroGridCacheKey('abc', 37.61)).toThrow();
            expect(() => getMicroGridCacheKey(55.75, NaN)).toThrow();
        });
    });

    describe('2. Автоматическая загрузка макро-сетки при монтировании', () => {
        it('запрашивает /api/air-quality/grid/macro и сохраняет результат в macroGrid', async () => {
            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockMacroData
            });

            const { result } = renderHook(() => useAirGrid({ autoLoadMacro: true }));

            expect(result.current.isLoadingGrid).toBe(true);

            await waitFor(() => {
                expect(result.current.isLoadingGrid).toBe(false);
            });

            expect(globalThis.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/air-quality/grid/macro'),
                expect.any(Object)
            );
            expect(result.current.macroGrid).toEqual(mockMacroData);
            expect(result.current.gridError).toBeNull();
        });

        it('обрабатывает сетевую ошибку при загрузке макро-сетки', async () => {
            globalThis.fetch.mockRejectedValueOnce(new Error('Network offline'));

            const { result } = renderHook(() => useAirGrid({ autoLoadMacro: true }));

            await waitFor(() => {
                expect(result.current.isLoadingGrid).toBe(false);
            });

            expect(result.current.macroGrid).toBeNull();
            expect(result.current.gridError).toBe('Network offline');
        });

        it('не отправляет запрос макро-сетки, если autoLoadMacro: false', () => {
            const { result } = renderHook(() => useAirGrid({ autoLoadMacro: false }));

            expect(globalThis.fetch).not.toHaveBeenCalled();
            expect(result.current.macroGrid).toBeNull();
            expect(result.current.isLoadingGrid).toBe(false);
        });
    });

    describe('3. Загрузка микро-сетки (loadMicroGrid)', () => {
        it('запрашивает /api/air-quality/grid/micro с координатами и обновляет microGrid', async () => {
            // Первый запрос для макро, второй для микро
            globalThis.fetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockMacroData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockMicroData
                });

            const { result } = renderHook(() => useAirGrid({ autoLoadMacro: true }));

            await waitFor(() => {
                expect(result.current.macroGrid).toEqual(mockMacroData);
            });

            await act(async () => {
                await result.current.loadMicroGrid(53.75, 87.15);
            });

            expect(globalThis.fetch).toHaveBeenLastCalledWith(
                expect.stringMatching(/\/api\/air-quality\/grid\/micro\?.*lat=53\.75.*lon=87\.15/),
                expect.any(Object)
            );
            expect(result.current.microGrid).toEqual(mockMicroData);
        });

        it('сохраняет загруженную микро-сетку в lruGridCache по квантованному ключу', async () => {
            globalThis.fetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockMacroData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockMicroData
                });

            const { result } = renderHook(() => useAirGrid({ autoLoadMacro: false }));

            await act(async () => {
                await result.current.loadMicroGrid(53.75, 87.15);
            });

            const expectedKey = 'grid_micro_53.80_87.20';
            expect(result.current.lruGridCache.has(expectedKey)).toBe(true);
            expect(result.current.lruGridCache.get(expectedKey)).toEqual(mockMicroData);
        });
    });

    describe('4. Быстрый путь из кэша (0 мс, без повторных сетевых запросов)', () => {
        it('при повторном запросе того же или соседнего узла (в пределах 0.2°) берет из памяти без fetch', async () => {
            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockMicroData
            });

            const { result } = renderHook(() => useAirGrid({ autoLoadMacro: false }));

            // 1-й запрос: 53.75, 87.15 -> квантуется в 53.80, 87.20 (сетевой вызов)
            await act(async () => {
                await result.current.loadMicroGrid(53.75, 87.15);
            });
            expect(globalThis.fetch).toHaveBeenCalledTimes(1);

            // 2-й запрос: 53.78, 87.18 -> то же квантование 53.80, 87.20 (из кэша)
            await act(async () => {
                await result.current.loadMicroGrid(53.78, 87.18);
            });

            // Сетевой запрос НЕ должен вызываться повторно!
            expect(globalThis.fetch).toHaveBeenCalledTimes(1);
            expect(result.current.microGrid).toEqual(mockMicroData);
        });
    });

    describe('5. Отмена предыдущих запросов через AbortController', () => {
        it('прерывает предыдущий незавершенный запрос при быстром перемещении карты', async () => {
            let capturedSignals = [];
            globalThis.fetch.mockImplementation((url, options) => {
                if (options?.signal) {
                    capturedSignals.push(options.signal);
                }
                return new Promise(() => { }); // зависший промис
            });

            const { result } = renderHook(() => useAirGrid({ autoLoadMacro: false }));

            act(() => {
                result.current.loadMicroGrid(55.75, 37.61);
            });

            expect(capturedSignals.length).toBe(1);
            expect(capturedSignals[0].aborted).toBe(false);

            // Быстрый второй сдвиг до завершения первого
            act(() => {
                result.current.loadMicroGrid(59.93, 30.31);
            });

            expect(capturedSignals.length).toBe(2);
            // Первый сигнал должен быть прерван!
            expect(capturedSignals[0].aborted).toBe(true);
            expect(capturedSignals[1].aborted).toBe(false);
        });

        it('не устанавливает ошибку gridError при отмене запроса через AbortError', async () => {
            const abortError = new Error('The user aborted a request.');
            abortError.name = 'AbortError';

            globalThis.fetch.mockRejectedValueOnce(abortError);

            const { result } = renderHook(() => useAirGrid({ autoLoadMacro: false }));

            await act(async () => {
                await result.current.loadMicroGrid(55.75, 37.61);
            });

            expect(result.current.gridError).toBeNull();
        });
    });

    describe('6. Лимит LRU-кэша и вытеснение старых регионов (Max 20)', () => {
        it('ограничивает размер кэша 20 записями, вытесняя самые старые', async () => {
            const { result } = renderHook(() => useAirGrid({ autoLoadMacro: false }));

            // Эмулируем последовательную загрузку 22 разных регионов
            for (let i = 0; i < 22; i++) {
                const lat = 40 + i * 0.5;
                const lon = 30 + i * 0.5;
                const customData = { ...mockMicroData, points_count: i };

                globalThis.fetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => customData
                });

                await act(async () => {
                    await result.current.loadMicroGrid(lat, lon);
                });
            }

            expect(result.current.lruGridCache.size).toBeLessThanOrEqual(20);

            // Первый регион (i=0: lat 40, lon 30) должен быть вытеснен
            const firstKey = getMicroGridCacheKey(40, 30);
            expect(result.current.lruGridCache.has(firstKey)).toBe(false);
        });
    });

    describe('7. Отказоустойчивость: ошибка микро-сетки не ломает макро-покрытие', () => {
        it('при сбое microGrid существующий macroGrid остается доступным', async () => {
            globalThis.fetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockMacroData
                })
                .mockRejectedValueOnce(new Error('500 Internal Server Error'));

            const { result } = renderHook(() => useAirGrid({ autoLoadMacro: true }));

            await waitFor(() => {
                expect(result.current.macroGrid).toEqual(mockMacroData);
            });

            await act(async () => {
                await result.current.loadMicroGrid(53.75, 87.15);
            });

            // Ошибка зафиксирована
            expect(result.current.gridError).toBe('500 Internal Server Error');
            // Но макро-сетка не потеряна и продолжает отображаться!
            expect(result.current.macroGrid).toEqual(mockMacroData);
        });
    });
});
