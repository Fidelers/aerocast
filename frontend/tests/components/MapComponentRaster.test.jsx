import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

// Подготовка hoisted моков для Vitest
const {
    MockMap,
    mockAddSource,
    mockAddLayer,
    mockSetPaintProperty,
    eventHandlers,
    createdSources,
    createdLayers
} = vi.hoisted(() => {
    const mockAddSource = vi.fn();
    const mockAddLayer = vi.fn();
    const mockSetPaintProperty = vi.fn();

    const eventHandlers = {};
    const createdSources = new Map();
    const createdLayers = new Map();

    const MockMap = vi.fn().mockImplementation(function (options) {
        this.options = options;
        this._zoom = options?.zoom ?? 11;
        this._center = options?.center ?? [87.1467, 53.7596];
        this.flyTo = vi.fn();
        this.remove = vi.fn();
        this.addControl = vi.fn();

        this.addSource = vi.fn().mockImplementation((id, sourceConfig) => {
            createdSources.set(id, {
                ...sourceConfig,
                updateImage: vi.fn().mockImplementation((newConfig) => {
                    Object.assign(createdSources.get(id), newConfig);
                })
            });
            mockAddSource(id, sourceConfig);
        });

        this.removeSource = vi.fn().mockImplementation((id) => {
            createdSources.delete(id);
        });

        this.getSource = vi.fn().mockImplementation((id) => {
            return createdSources.get(id) || null;
        });

        this.addLayer = vi.fn().mockImplementation((layerConfig, beforeId) => {
            createdLayers.set(layerConfig.id, { ...layerConfig, beforeId });
            mockAddLayer(layerConfig, beforeId);
        });

        this.removeLayer = vi.fn().mockImplementation((id) => {
            createdLayers.delete(id);
        });

        this.getLayer = vi.fn().mockImplementation((id) => {
            if (id === 'osm-layer' || id === 'satellite-layer') {
                return { id };
            }
            return createdLayers.get(id) || null;
        });

        this.setLayoutProperty = vi.fn().mockImplementation((id, prop, val) => {
            const l = createdLayers.get(id);
            if (l) {
                l.layout = l.layout || {};
                l.layout[prop] = val;
            }
        });

        this.setPaintProperty = vi.fn().mockImplementation((id, prop, val) => {
            mockSetPaintProperty(id, prop, val);
            const l = createdLayers.get(id);
            if (l) {
                l.paint = l.paint || {};
                l.paint[prop] = val;
            }
        });

        this.setMaxZoom = vi.fn();
        this.getZoom = vi.fn().mockImplementation(() => this._zoom);
        this.setZoom = vi.fn().mockImplementation((z) => { this._zoom = z; });
        this.getCenter = vi.fn().mockImplementation(() => ({ lng: this._center[0], lat: this._center[1] }));
        this.isStyleLoaded = vi.fn().mockReturnValue(true);

        this.on = vi.fn().mockImplementation((evt, cb) => {
            eventHandlers[evt] = eventHandlers[evt] || [];
            eventHandlers[evt].push(cb);
        });

        this.off = vi.fn().mockImplementation((evt, cb) => {
            if (eventHandlers[evt]) {
                eventHandlers[evt] = eventHandlers[evt].filter(f => f !== cb);
            }
        });

        return this;
    });

    return {
        MockMap,
        mockAddSource,
        mockAddLayer,
        mockSetPaintProperty,
        eventHandlers,
        createdSources,
        createdLayers
    };
});

// Мокирование MapLibre GL JS
vi.mock('maplibre-gl', () => {
    return {
        default: {
            Map: MockMap,
            Marker: vi.fn().mockImplementation(() => ({
                setLngLat: vi.fn().mockReturnThis(),
                addTo: vi.fn().mockReturnThis(),
                remove: vi.fn().mockReturnThis()
            })),
            NavigationControl: vi.fn()
        },
        Map: MockMap,
        Marker: vi.fn().mockImplementation(() => ({
            setLngLat: vi.fn().mockReturnThis(),
            addTo: vi.fn().mockReturnThis(),
            remove: vi.fn().mockReturnThis()
        })),
        NavigationControl: vi.fn()
    };
});

// Мокирование canvasFieldRenderer для быстрого тестирования без физического Canvas
vi.mock('../../src/utils/canvasFieldRenderer.js', () => {
    return {
        createFieldCanvas: vi.fn().mockImplementation((width = 150, height = 150) => ({
            width,
            height
        })),
        renderFieldToCanvas: vi.fn().mockImplementation(() => {
            return {
                toDataUrl: () => 'data:image/png;base64,MOCK_CANVAS_DATA_URL',
                width: 150,
                height: 150,
                hasPollution: true
            };
        })
    };
});

import MapComponent from '../../src/components/MapComponent';

describe('MapComponent - Растровый градиент и LOD MapLibre GL JS (#79)', () => {
    // Тестовые данные для макро-сетки (Россия / СФО)
    const mockMacroGrid = {
        bbox: [60.0, 45.0, 110.0, 65.0], // [minLon, minLat, maxLon, maxLat]
        points: [
            { lat: 53.75, lon: 87.14, eaqi: 45 },
            { lat: 55.00, lon: 82.90, eaqi: 60 }
        ]
    };

    // Тестовые данные для микро-сетки (Новокузнецк ~40x40 км)
    const mockMicroGrid = {
        bbox: [86.85, 53.55, 87.45, 53.95], // [minLon, minLat, maxLon, maxLat]
        expandBbox: false,
        center: { lat: 53.75, lon: 87.15 },
        points: [
            { lat: 53.75, lon: 87.14, eaqi: 55 },
            { lat: 53.80, lon: 87.20, eaqi: 70 }
        ]
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        createdSources.clear();
        createdLayers.clear();
        for (const k in eventHandlers) {
            delete eventHandlers[k];
        }
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    const triggerMapEvent = (name, payload = {}) => {
        if (eventHandlers[name]) {
            eventHandlers[name].forEach(cb => cb(payload));
        }
    };

    describe('1. Добавление слоев и источников в MapLibre', () => {
        it('1.1. Регистрирует источник air-grid-macro-source типа image с правильными 4 координатами углов bbox', () => {
            render(
                <MapComponent
                    macroGrid={mockMacroGrid}
                    selectedTimeIndex={0}
                />
            );

            expect(mockAddSource).toHaveBeenCalledWith(
                'air-grid-macro-source',
                expect.objectContaining({
                    type: 'image',
                    url: expect.stringContaining('data:image/png;base64,'),
                    coordinates: [
                        [19.5, 82.0],   // Top-Left: [minLon, maxLat]
                        [190.5, 82.0],  // Top-Right: [maxLon, maxLat]
                        [190.5, 41.0],  // Bottom-Right: [maxLon, minLat]
                        [19.5, 41.0]    // Bottom-Left: [minLon, minLat]
                    ]
                })
            );
        });

        it('1.1b. Макро-слой покрывает всю Россию: север > 81°N и восток > 190°E (Чукотка за антмеридианом)', () => {
            // Регресс-тест обрезки севера и востока: bbox макро-слоя не должен
            // вычисляться из опорных точек сетки (они доходят только до 71.6°N / 177.5°E)
            render(
                <MapComponent
                    macroGrid={mockMacroGrid}
                    selectedTimeIndex={0}
                />
            );

            const sourceCall = mockAddSource.mock.calls.find(c => c[0] === 'air-grid-macro-source');
            const coords = sourceCall[1].coordinates;
            const lons = coords.map(c => c[0]);
            const lats = coords.map(c => c[1]);

            expect(Math.max(...lats)).toBeGreaterThanOrEqual(81.85);  // maxLat: Земля Франца-Иосифа
            expect(Math.max(...lons)).toBeGreaterThanOrEqual(190.27); // maxLon: восточная Чукотка
            expect(Math.min(...lons)).toBeLessThanOrEqual(19.61);     // minLon: Калининград
            expect(Math.min(...lats)).toBeLessThanOrEqual(41.22);     // minLat: юг Дагестана
        });

        it('1.1c. Маска границы передается в рендерер без отрицательных долгот (Чукотка сдвинута в 180..191)', async () => {
            const { renderFieldToCanvas } = await import('../../src/utils/canvasFieldRenderer.js');
            render(
                <MapComponent
                    macroGrid={mockMacroGrid}
                    selectedTimeIndex={0}
                />
            );

            const renderCall = renderFieldToCanvas.mock.calls.find(c => c[3]?.maskPolygons);
            expect(renderCall).toBeTruthy();

            const rings = renderCall[3].maskPolygons;
            const allLons = rings.flat().map(pt => pt[0]);

            // Отрицательные долготы (Чукотка за антмеридианом) должны быть сдвинуты: -180..-169 -> 180..191
            expect(allLons.every(lon => lon >= 0)).toBe(true);
            expect(Math.max(...allLons)).toBeGreaterThan(180);
        });

        it('1.2. Создает слой air-grid-macro-layer типа raster с raster-fade-duration 300 строго под DOM-маркерами', () => {
            render(
                <MapComponent
                    macroGrid={mockMacroGrid}
                    selectedTimeIndex={0}
                />
            );

            expect(mockAddLayer).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'air-grid-macro-layer',
                    type: 'raster',
                    source: 'air-grid-macro-source',
                    paint: expect.objectContaining({
                        'raster-fade-duration': 300
                    })
                }),
                expect.any(String) // beforeId (слой маркеров)
            );
        });

        it('1.3. При получении microGrid регистрирует air-grid-micro-source и air-grid-micro-layer', () => {
            render(
                <MapComponent
                    macroGrid={mockMacroGrid}
                    microGrid={mockMicroGrid}
                    selectedTimeIndex={0}
                />
            );

            expect(mockAddSource).toHaveBeenCalledWith(
                'air-grid-micro-source',
                expect.objectContaining({
                    type: 'image',
                    coordinates: [
                        [86.85, 53.95], // Top-Left: [minLon, maxLat]
                        [87.45, 53.95], // Top-Right: [maxLon, maxLat]
                        [87.45, 53.55], // Bottom-Right: [maxLon, minLat]
                        [86.85, 53.55]  // Bottom-Left: [minLon, minLat]
                    ]
                })
            );

            expect(mockAddLayer).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'air-grid-micro-layer',
                    type: 'raster',
                    source: 'air-grid-micro-source'
                }),
                expect.any(String)
            );
        });

        it('1.3b. По умолчанию расширяет границы микро-сетки (expandBbox !== false), покрывая весь экран', () => {
            const defaultMicroGrid = {
                bbox: [86.85, 53.55, 87.45, 53.95],
                center: { lat: 53.75, lon: 87.15 },
                points: [
                    { lat: 53.75, lon: 87.14, eaqi: 55 }
                ]
            };

            render(
                <MapComponent
                    macroGrid={mockMacroGrid}
                    microGrid={defaultMicroGrid}
                    selectedTimeIndex={0}
                />
            );

            expect(mockAddSource).toHaveBeenCalledWith(
                'air-grid-micro-source',
                expect.objectContaining({
                    type: 'image',
                    coordinates: [
                        [83.15, 56.25],
                        [91.15, 56.25],
                        [91.15, 51.25],
                        [83.15, 51.25]
                    ]
                })
            );
        });

        it('1.4. При смене selectedTimeIndex обновляет изображение источника через updateImage или повторный рендер', () => {
            const { rerender } = render(
                <MapComponent
                    macroGrid={mockMacroGrid}
                    selectedTimeIndex={0}
                />
            );

            const initialSourceCalls = mockAddSource.mock.calls.length;

            rerender(
                <MapComponent
                    macroGrid={mockMacroGrid}
                    selectedTimeIndex={1}
                />
            );

            const source = createdSources.get('air-grid-macro-source');
            // Должен либо вызвать updateImage у источника, либо пересоздать источник
            const wasUpdated = source?.updateImage?.mock?.calls?.length > 0 || mockAddSource.mock.calls.length > initialSourceCalls;
            expect(wasUpdated).toBe(true);
        });
    });

    describe('2. Двухуровневый LOD (Level of Detail) и кроссфейд', () => {
        it('2.1. При zoom <= 8.5: макро-слой активен (opacity 0.70), микро-слой скрыт (opacity 0.0)', () => {
            render(
                <MapComponent
                    macroGrid={mockMacroGrid}
                    microGrid={mockMicroGrid}
                    selectedTimeIndex={0}
                />
            );

            const mapInstance = MockMap.mock.results[0].value;
            mapInstance._zoom = 7.0;

            triggerMapEvent('zoom');

            expect(mockSetPaintProperty).toHaveBeenCalledWith('air-grid-macro-layer', 'raster-opacity', 0.7);
            expect(mockSetPaintProperty).toHaveBeenCalledWith('air-grid-micro-layer', 'raster-opacity', 0);
        });

        it('2.2. При zoom >= 9.0: макро-слой активен (opacity 0.70) даже при близком приближении', () => {
            render(
                <MapComponent
                    macroGrid={mockMacroGrid}
                    microGrid={mockMicroGrid}
                    selectedTimeIndex={0}
                />
            );

            const mapInstance = MockMap.mock.results[0].value;
            mapInstance._zoom = 11.0;

            triggerMapEvent('zoom');

            expect(mockSetPaintProperty).toHaveBeenCalledWith('air-grid-macro-layer', 'raster-opacity', 0.7);
            expect(mockSetPaintProperty).toHaveBeenCalledWith('air-grid-micro-layer', 'raster-opacity', 0.7);
        });

        it('2.3. На интервале zoom 8.5..9.0 макро-слой сохраняет стабильную видимость (opacity 0.70)', () => {
            render(
                <MapComponent
                    macroGrid={mockMacroGrid}
                    microGrid={mockMicroGrid}
                    selectedTimeIndex={0}
                />
            );

            const mapInstance = MockMap.mock.results[0].value;
            mapInstance._zoom = 8.75;

            triggerMapEvent('zoom');

            const macroCalls = mockSetPaintProperty.mock.calls.filter(c => c[0] === 'air-grid-macro-layer' && c[1] === 'raster-opacity');
            const lastMacroOpacity = macroCalls[macroCalls.length - 1]?.[2];

            expect(lastMacroOpacity).toBeCloseTo(0.70, 1);
        });
    });

    describe('3. Обработка перемещения карты (viewportMoveManager)', () => {
        it('3.1. При movestart сетевые запросы блокируются, при zoom > 9 фоном отображается макро-слой', () => {
            const onViewportMove = vi.fn();

            render(
                <MapComponent
                    macroGrid={mockMacroGrid}
                    microGrid={mockMicroGrid}
                    selectedTimeIndex={0}
                    onViewportMove={onViewportMove}
                />
            );

            const mapInstance = MockMap.mock.results[0].value;
            mapInstance._zoom = 10.0;

            triggerMapEvent('movestart');

            // При movestart на zoom > 9 макро-слой плавно подсвечивается как фон подложки
            const macroCalls = mockSetPaintProperty.mock.calls.filter(c => c[0] === 'air-grid-macro-layer' && c[1] === 'raster-opacity');
            const lastOpacity = macroCalls[macroCalls.length - 1]?.[2];
            expect(lastOpacity).toBeGreaterThan(0);
            expect(onViewportMove).not.toHaveBeenCalled();
        });

        it('3.2. При moveend запускается дебаунс 500 мс и запрос не отправляется до истечения таймера', () => {
            const onViewportMove = vi.fn();

            render(
                <MapComponent
                    macroGrid={mockMacroGrid}
                    microGrid={mockMicroGrid}
                    selectedTimeIndex={0}
                    onViewportMove={onViewportMove}
                />
            );

            const mapInstance = MockMap.mock.results[0].value;
            mapInstance._zoom = 11.0;
            // Смещаем центр на 100 км
            mapInstance._center = [89.0, 54.5];

            triggerMapEvent('moveend');

            // Сразу после moveend вызова быть не должно
            expect(onViewportMove).not.toHaveBeenCalled();

            // Прошло 300 мс — всё еще не должен вызываться
            vi.advanceTimersByTime(300);
            expect(onViewportMove).not.toHaveBeenCalled();

            // Прошло 500 мс — вызывается
            vi.advanceTimersByTime(200);
            expect(onViewportMove).toHaveBeenCalledTimes(1);
        });

        it('3.3. Если смещение превысило 50% радиуса сетки (>20 км) -> инициируется загрузка новой микро-сетки', () => {
            const onViewportMove = vi.fn();

            render(
                <MapComponent
                    macroGrid={mockMacroGrid}
                    microGrid={mockMicroGrid}
                    selectedTimeIndex={0}
                    onViewportMove={onViewportMove}
                />
            );

            const mapInstance = MockMap.mock.results[0].value;
            mapInstance._zoom = 11.0;
            // Активный центр сетки: 87.15, 53.75.
            // Смещение по широте на 0.35 градуса (~38 км, что существенно > 20 км / 50% радиуса)
            mapInstance._center = [87.15, 54.10];

            triggerMapEvent('moveend');
            vi.advanceTimersByTime(500);

            expect(onViewportMove).toHaveBeenCalledTimes(1);
            expect(onViewportMove).toHaveBeenCalledWith(
                expect.objectContaining({
                    lat: 54.10,
                    lon: 87.15
                })
            );
        });

        it('3.4. Если смещение менее 50% радиуса сетки -> запрос не отправляется, существующее покрытие достаточно', () => {
            const onViewportMove = vi.fn();

            render(
                <MapComponent
                    macroGrid={mockMacroGrid}
                    microGrid={mockMicroGrid}
                    selectedTimeIndex={0}
                    onViewportMove={onViewportMove}
                />
            );

            const mapInstance = MockMap.mock.results[0].value;
            mapInstance._zoom = 11.0;
            // Активный центр сетки: 87.15, 53.75.
            // Микро-сдвиг на 0.02 градуса (~2 км, намного меньше 50% радиуса сетки 20 км)
            mapInstance._center = [87.16, 53.76];

            triggerMapEvent('moveend');
            vi.advanceTimersByTime(500);

            expect(onViewportMove).not.toHaveBeenCalled();
        });
    });

    describe('4. Синхронизация времени и защита от рассинхронизации по ISO-метке (#80)', () => {
        const timeSteps = [
            '2026-10-01T00:00',
            '2026-10-01T01:00',
            '2026-10-01T02:00',
            '2026-10-01T03:00'
        ];

        const timedMacroGrid = {
            bbox: [60.0, 45.0, 110.0, 65.0],
            time: timeSteps,
            points: [{ lat: 53.75, lon: 87.14, european_aqi: [10, 20, 30, 40] }]
        };

        it('4.1. Передает точный индекс времени из сетки при совпадении selectedIsoTime', async () => {
            const { renderFieldToCanvas } = await import('../../src/utils/canvasFieldRenderer.js');
            render(
                <MapComponent
                    macroGrid={timedMacroGrid}
                    selectedTimeIndex={0}
                    selectedIsoTime="2026-10-01T02:00"
                />
            );

            expect(renderFieldToCanvas).toHaveBeenCalledWith(
                expect.anything(),
                timedMacroGrid.points,
                [19.5, 41.0, 190.5, 82.0],
                expect.objectContaining({ timeIndex: 2 })
            );
        });

        it('4.2. Сопоставляет по dateStr и hour, если точная строка timestamp не совпадает', async () => {
            const { renderFieldToCanvas } = await import('../../src/utils/canvasFieldRenderer.js');
            render(
                <MapComponent
                    macroGrid={timedMacroGrid}
                    selectedTimeIndex={0}
                    selectedIsoTime="2026-10-01T03:00:00.000Z"
                />
            );

            expect(renderFieldToCanvas).toHaveBeenCalledWith(
                expect.anything(),
                timedMacroGrid.points,
                [19.5, 41.0, 190.5, 82.0],
                expect.objectContaining({ timeIndex: 3 })
            );
        });

        it('4.3. При отсутствии совпадения использует fallback selectedTimeIndex', async () => {
            const { renderFieldToCanvas } = await import('../../src/utils/canvasFieldRenderer.js');
            render(
                <MapComponent
                    macroGrid={timedMacroGrid}
                    selectedTimeIndex={1}
                    selectedIsoTime="2026-10-05T12:00"
                />
            );

            expect(renderFieldToCanvas).toHaveBeenCalledWith(
                expect.anything(),
                timedMacroGrid.points,
                [19.5, 41.0, 190.5, 82.0],
                expect.objectContaining({ timeIndex: 1 })
            );
        });
    });

    describe('5. Управление видимостью растровых слоев в зависимости от viewMode', () => {
        it('5.1. В режиме "Цифровой" (viewMode="numeric") скрывает растровые слои (visibility: none)', () => {
            render(
                <MapComponent
                    macroGrid={mockMacroGrid}
                    microGrid={mockMicroGrid}
                    selectedTimeIndex={0}
                    viewMode="numeric"
                />
            );

            const macroLayer = createdLayers.get('air-grid-macro-layer');
            const microLayer = createdLayers.get('air-grid-micro-layer');

            expect(macroLayer).toBeDefined();
            expect(macroLayer.layout?.visibility).toBe('none');

            expect(microLayer).toBeDefined();
            expect(microLayer.layout?.visibility).toBe('none');
        });

        it('5.2. В режимах "Цветовой" (viewMode="color") и "Комбо" (viewMode="combo") растровые слои видимы (visibility: visible)', () => {
            const { rerender } = render(
                <MapComponent
                    macroGrid={mockMacroGrid}
                    microGrid={mockMicroGrid}
                    selectedTimeIndex={0}
                    viewMode="color"
                />
            );

            let macroLayer = createdLayers.get('air-grid-macro-layer');
            let microLayer = createdLayers.get('air-grid-micro-layer');

            expect(macroLayer.layout?.visibility).toBe('visible');
            expect(microLayer.layout?.visibility).toBe('visible');

            rerender(
                <MapComponent
                    macroGrid={mockMacroGrid}
                    microGrid={mockMicroGrid}
                    selectedTimeIndex={0}
                    viewMode="combo"
                />
            );

            macroLayer = createdLayers.get('air-grid-macro-layer');
            microLayer = createdLayers.get('air-grid-micro-layer');

            expect(macroLayer.layout?.visibility).toBe('visible');
            expect(microLayer.layout?.visibility).toBe('visible');
        });

        it('5.3. При динамическом переключении с "combo" на "numeric" скрывает слои, а обратно на "color" — отображает', () => {
            const { rerender } = render(
                <MapComponent
                    macroGrid={mockMacroGrid}
                    microGrid={mockMicroGrid}
                    selectedTimeIndex={0}
                    viewMode="combo"
                />
            );

            expect(createdLayers.get('air-grid-macro-layer')?.layout?.visibility).toBe('visible');

            // Пользователь переключает на "Цифровой"
            rerender(
                <MapComponent
                    macroGrid={mockMacroGrid}
                    microGrid={mockMicroGrid}
                    selectedTimeIndex={0}
                    viewMode="numeric"
                />
            );

            expect(createdLayers.get('air-grid-macro-layer')?.layout?.visibility).toBe('none');
            expect(createdLayers.get('air-grid-micro-layer')?.layout?.visibility).toBe('none');

            // Пользователь переключает на "Цветовой"
            rerender(
                <MapComponent
                    macroGrid={mockMacroGrid}
                    microGrid={mockMicroGrid}
                    selectedTimeIndex={0}
                    viewMode="color"
                />
            );

            expect(createdLayers.get('air-grid-macro-layer')?.layout?.visibility).toBe('visible');
            expect(createdLayers.get('air-grid-micro-layer')?.layout?.visibility).toBe('visible');
        });
    });

    describe('6. Пульсирование загрязненных зон (41-100+) и стабильность маркера', () => {
        it('6.1. При наличии точек с AQI > 40 регистрирует пульсирующий слой air-grid-macro-pollution-layer', () => {
            const pollutedMacroGrid = {
                points: [
                    { lat: 55.75, lon: 37.61, eaqi: 20 },
                    { lat: 53.75, lon: 87.14, eaqi: 65 } // AQI > 40
                ]
            };

            render(
                <MapComponent
                    macroGrid={pollutedMacroGrid}
                    selectedTimeIndex={0}
                    viewMode="combo"
                />
            );

            expect(mockAddSource).toHaveBeenCalledWith(
                'air-grid-macro-pollution-source',
                expect.objectContaining({
                    type: 'image'
                })
            );

            expect(mockAddLayer).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'air-grid-macro-pollution-layer',
                    type: 'raster',
                    source: 'air-grid-macro-pollution-source'
                }),
                expect.any(String)
            );
        });

        it('6.2. В цифровом режиме скрывает пульсирующий слой загрязнения', () => {
            const pollutedMacroGrid = {
                points: [
                    { lat: 53.75, lon: 87.14, eaqi: 70 }
                ]
            };

            render(
                <MapComponent
                    macroGrid={pollutedMacroGrid}
                    selectedTimeIndex={0}
                    viewMode="numeric"
                />
            );

            const pollutionLayer = createdLayers.get('air-grid-macro-pollution-layer');
            expect(pollutionLayer?.layout?.visibility).toBe('none');
        });
    });
});


