import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import MapComponent, {
    bboxToImageCoordinates,
    normalizeBoundaryLongitudes,
    calculateDistanceKm,
    runWhenStyleReady,
    resolveGridTimeIndex
} from '../../src/components/MapComponent';

const {
    MockMap,
    MockMarker,
    MockPopup,
    mockInstances,
    eventHandlers,
    createdSources,
    createdLayers
} = vi.hoisted(() => {
    const mockInstances = [];
    const eventHandlers = {};
    const createdSources = new Map();
    const createdLayers = new Map();

    const MockMap = vi.fn().mockImplementation(function (options) {
        this.options = options;
        this._zoom = options?.zoom ?? 11;
        this._center = options?.center ?? [37.61, 55.75];
        this.flyTo = vi.fn();
        this.remove = vi.fn();
        this.addControl = vi.fn();

        this.addSource = vi.fn().mockImplementation((id, sourceConfig) => {
            createdSources.set(id, { ...sourceConfig });
        });

        this.removeSource = vi.fn().mockImplementation((id) => {
            createdSources.delete(id);
        });

        this.getSource = vi.fn().mockImplementation((id) => {
            return createdSources.get(id) || null;
        });

        this.addLayer = vi.fn().mockImplementation((layerConfig, beforeId) => {
            createdLayers.set(layerConfig.id, { ...layerConfig, beforeId });
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
            const l = createdLayers.get(id);
            if (l) {
                l.paint = l.paint || {};
                l.paint[prop] = val;
            }
        });

        this.setMaxZoom = vi.fn();
        this.getZoom = vi.fn().mockImplementation(() => this._zoom);
        this.setZoom = vi.fn().mockImplementation((z) => { this._zoom = z; });
        this.getCenter = vi.fn().mockImplementation(() => {
            return { lng: this._center[0], lat: this._center[1] };
        });
        this.isStyleLoaded = vi.fn().mockReturnValue(true);
        this.getStyle = vi.fn().mockReturnValue({ version: 8 });
        this.moveLayer = vi.fn();

        this.on = vi.fn().mockImplementation((evt, cb) => {
            eventHandlers[evt] = eventHandlers[evt] || [];
            eventHandlers[evt].push(cb);
        });

        this.once = vi.fn().mockImplementation((evt, cb) => {
            eventHandlers[evt] = eventHandlers[evt] || [];
            eventHandlers[evt].push(cb);
        });

        this.off = vi.fn().mockImplementation((evt, cb) => {
            if (eventHandlers[evt]) {
                eventHandlers[evt] = eventHandlers[evt].filter(f => f !== cb);
            }
        });

        mockInstances.push(this);
        return this;
    });

    const MockMarker = vi.fn().mockImplementation(function (element) {
        this.element = element;
        this.setLngLat = vi.fn().mockReturnThis();
        this.addTo = vi.fn().mockReturnThis();
        this.remove = vi.fn().mockReturnThis();
        return this;
    });

    const MockPopup = vi.fn().mockImplementation(function () {
        this.setLngLat = vi.fn().mockReturnThis();
        this.setHTML = vi.fn().mockReturnThis();
        this.addTo = vi.fn().mockReturnThis();
        this.remove = vi.fn().mockReturnThis();
        return this;
    });

    return {
        MockMap,
        MockMarker,
        MockPopup,
        mockInstances,
        eventHandlers,
        createdSources,
        createdLayers
    };
});

vi.mock('maplibre-gl', () => {
    const navCtrl = vi.fn();
    return {
        default: {
            Map: MockMap,
            Marker: MockMarker,
            Popup: MockPopup,
            NavigationControl: navCtrl
        },
        Map: MockMap,
        Marker: MockMarker,
        Popup: MockPopup,
        NavigationControl: navCtrl
    };
});

let mockShouldReturnPollution = true;
vi.mock('../../src/utils/canvasFieldRenderer.js', () => ({
    createFieldCanvas: vi.fn(() => ({
        getContext: vi.fn(() => ({
            clearRect: vi.fn(),
            putImageData: vi.fn()
        }))
    })),
    renderFieldToCanvas: vi.fn((canvas, points, bbox, options) => {
        if (options?.onlyPollution && !mockShouldReturnPollution) {
            return {
                toDataUrl: vi.fn(() => null),
                hasPollution: false,
                grid: new Float32Array(10)
            };
        }
        return {
            toDataUrl: vi.fn(() => 'data:image/png;base64,mockImage'),
            hasPollution: true,
            grid: new Float32Array(10)
        };
    })
}));

describe('MapComponentCoverage — граничные случаи и полное покрытие веток', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        cleanup();
        mockInstances.length = 0;
        createdSources.clear();
        createdLayers.clear();
        mockShouldReturnPollution = true;
        for (const k in eventHandlers) delete eventHandlers[k];
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe('1. Вспомогательные функции', () => {
        it('bboxToImageCoordinates обрабатывает валидные и невалидные bbox', () => {
            expect(bboxToImageCoordinates(null)).toBeNull();
            expect(bboxToImageCoordinates([])).toBeNull();
            expect(bboxToImageCoordinates([10, 20])).toBeNull();
            expect(bboxToImageCoordinates([10, 20, 30, 40, 50])).toBeNull();

            const coords = bboxToImageCoordinates([10, 20, 30, 40]);
            expect(coords).toEqual([
                [10, 40],
                [30, 40],
                [30, 20],
                [10, 20]
            ]);
        });

        it('normalizeBoundaryLongitudes обрабатывает не-массивы и отрицательные координаты', () => {
            expect(normalizeBoundaryLongitudes(null)).toBeNull();
            expect(normalizeBoundaryLongitudes(123)).toBe(123);

            const nonArrayRings = ['invalid_ring'];
            expect(normalizeBoundaryLongitudes(nonArrayRings)).toEqual(['invalid_ring']);

            const ringsWithVariousPoints = [
                [
                    [-170.5, 65.0],
                    [170.5, 65.0],
                    'invalid_pt',
                    [null, 65.0]
                ]
            ];
            const normalized = normalizeBoundaryLongitudes(ringsWithVariousPoints);
            expect(normalized[0][0]).toEqual([189.5, 65.0]);
            expect(normalized[0][1]).toEqual([170.5, 65.0]);
            expect(normalized[0][2]).toBe('invalid_pt');
        });

        it('calculateDistanceKm вычисляет географическое расстояние между точками', () => {
            const distSame = calculateDistanceKm(55.75, 37.61, 55.75, 37.61);
            expect(distSame).toBe(0);

            const distDiff = calculateDistanceKm(55.75, 37.61, 59.93, 30.33);
            expect(distDiff).toBeGreaterThan(500);
            expect(distDiff).toBeLessThan(800);
        });

        it('runWhenStyleReady обрабатывает отсутствие карты, готовый стиль и слушатели once', () => {
            const cb1 = vi.fn();
            runWhenStyleReady(null, cb1);
            expect(cb1).not.toHaveBeenCalled();

            const cb2 = vi.fn();
            runWhenStyleReady({ isStyleLoaded: () => true }, cb2);
            expect(cb2).toHaveBeenCalledTimes(1);

            const cb3 = vi.fn();
            runWhenStyleReady({ style: true, getStyle: () => ({ version: 8 }) }, cb3);
            expect(cb3).toHaveBeenCalledTimes(1);

            const onceMap = {
                style: null,
                isStyleLoaded: vi.fn().mockReturnValue(false),
                once: vi.fn()
            };
            const cb4 = vi.fn();
            runWhenStyleReady(onceMap, cb4);
            expect(onceMap.once).toHaveBeenCalledWith('load', expect.any(Function));

            const onReadyHandler = onceMap.once.mock.calls[0][1];
            onceMap.isStyleLoaded.mockReturnValue(true);
            onReadyHandler();
            expect(cb4).toHaveBeenCalledTimes(1);

            const cb5 = vi.fn();
            const onceMap2 = {
                style: null,
                isStyleLoaded: vi.fn().mockReturnValue(false),
                once: vi.fn()
            };
            runWhenStyleReady(onceMap2, cb5);
            const onReadyHandler2 = onceMap2.once.mock.calls[0][1];
            onReadyHandler2();
            expect(onceMap2.once).toHaveBeenCalledWith('styledata', onReadyHandler2);

            const cb6 = vi.fn();
            runWhenStyleReady({}, cb6);
            expect(cb6).toHaveBeenCalledTimes(1);
        });
    });

    describe('2. Обработчики перемещения, дебаунс и LOD прозрачность', () => {
        it('обрабатывает movestart при zoom > 9 в цветовом режиме и сбрасывает таймер дебаунса', () => {
            render(
                <MapComponent
                    lat={55.75}
                    lon={37.61}
                    viewMode="color"
                />
            );

            const mapInstance = mockInstances[0];
            mapInstance.getZoom.mockReturnValue(10);
            createdLayers.set('air-grid-macro-layer', { id: 'air-grid-macro-layer', paint: {} });

            const moveStartHandler = eventHandlers['movestart']?.[0];
            const moveEndHandler = eventHandlers['moveend']?.[0];
            expect(moveStartHandler).toBeDefined();
            expect(moveEndHandler).toBeDefined();

            act(() => {
                moveEndHandler();
            });

            act(() => {
                moveStartHandler();
            });

            expect(mapInstance.setPaintProperty).toHaveBeenCalledWith(
                'air-grid-macro-layer',
                'raster-opacity',
                0.70
            );
        });

        it('обрабатывает moveend с дебаунсом и вызывает onViewportMove', () => {
            const onViewportMove = vi.fn();
            render(
                <MapComponent
                    lat={55.75}
                    lon={37.61}
                    viewMode="color"
                    onViewportMove={onViewportMove}
                />
            );

            const mapInstance = mockInstances[0];
            const moveEndHandler = eventHandlers['moveend']?.[0];

            mapInstance.getCenter.mockReturnValue({ lng: 38.0, lat: 56.0 });
            act(() => {
                moveEndHandler();
                vi.advanceTimersByTime(500);
            });

            expect(onViewportMove).toHaveBeenCalledWith({ lat: 56.0, lon: 38.0 });
        });
    });

    describe('3. Спутниковый режим, ограничения зума и загрузка стилей', () => {
        it('уменьшает зум до targetMaxZoom если текущий зум превышает 17 на спутниковом слое', () => {
            const { rerender } = render(
                <MapComponent
                    lat={55.75}
                    lon={37.61}
                    activeBaseLayer="osm"
                />
            );

            const mapInstance = mockInstances[0];
            mapInstance.getZoom.mockReturnValue(18);

            rerender(
                <MapComponent
                    lat={55.75}
                    lon={37.61}
                    activeBaseLayer="satellite"
                />
            );

            expect(mapInstance.setMaxZoom).toHaveBeenCalledWith(17);
            expect(mapInstance.setZoom).toHaveBeenCalledWith(17);
        });

        it('откладывает updateLayers если стиль еще не загружен и слушает событие load', () => {
            const { rerender } = render(
                <MapComponent
                    lat={55.75}
                    lon={37.61}
                    activeBaseLayer="osm"
                />
            );

            const mapInstance = mockInstances[0];
            mapInstance.isStyleLoaded.mockReturnValue(false);

            rerender(
                <MapComponent
                    lat={55.75}
                    lon={37.61}
                    activeBaseLayer="satellite"
                />
            );

            expect(mapInstance.once).toHaveBeenCalledWith('load', expect.any(Function));
        });

        it('перехватывает ошибку при выбросе исключения в setLayoutProperty', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const { rerender } = render(
                <MapComponent
                    lat={55.75}
                    lon={37.61}
                    activeBaseLayer="osm"
                />
            );

            const mapInstance = mockInstances[0];
            mapInstance.setLayoutProperty.mockImplementation(() => {
                throw new Error('Layer not found');
            });

            rerender(
                <MapComponent
                    lat={55.75}
                    lon={37.61}
                    activeBaseLayer="satellite"
                />
            );

            expect(warnSpy).toHaveBeenCalled();
            warnSpy.mockRestore();
        });
    });

    describe('4. Отрисовка макро-слоя и запасные варианты', () => {
        const mockMacro = {
            points: [{ lat: 55.75, lon: 37.61, eaqi: 60 }],
            time: ['2026-10-01T00:00']
        };

        it('пересоздает источник и слой макро-сетки если у существующего источника нет updateImage', () => {
            const { rerender } = render(
                <MapComponent
                    lat={55.75}
                    lon={37.61}
                    macroGrid={mockMacro}
                    selectedTimeIndex={0}
                    viewMode="color"
                />
            );

            const mapInstance = mockInstances[0];
            createdSources.set('air-grid-macro-source', { type: 'image' });
            createdLayers.set('air-grid-macro-layer', { id: 'air-grid-macro-layer' });

            rerender(
                <MapComponent
                    lat={55.75}
                    lon={37.61}
                    macroGrid={{ ...mockMacro, points: [{ lat: 55.75, lon: 37.61, eaqi: 70 }] }}
                    selectedTimeIndex={0}
                    viewMode="color"
                />
            );

            expect(mapInstance.removeLayer).toHaveBeenCalledWith('air-grid-macro-layer');
            expect(mapInstance.removeSource).toHaveBeenCalledWith('air-grid-macro-source');
        });

        it('пересоздает источник и слой макро-загрязнения если у существующего источника нет updateImage', () => {
            const { rerender } = render(
                <MapComponent
                    lat={55.75}
                    lon={37.61}
                    macroGrid={mockMacro}
                    selectedTimeIndex={0}
                    viewMode="color"
                />
            );

            const mapInstance = mockInstances[0];
            createdSources.set('air-grid-macro-pollution-source', { type: 'image' });
            createdLayers.set('air-grid-macro-pollution-layer', { id: 'air-grid-macro-pollution-layer' });

            rerender(
                <MapComponent
                    lat={55.75}
                    lon={37.61}
                    macroGrid={{ ...mockMacro, points: [{ lat: 55.75, lon: 37.61, eaqi: 70 }] }}
                    selectedTimeIndex={0}
                    viewMode="color"
                />
            );

            expect(mapInstance.removeLayer).toHaveBeenCalledWith('air-grid-macro-pollution-layer');
            expect(mapInstance.removeSource).toHaveBeenCalledWith('air-grid-macro-pollution-source');
        });

        it('устанавливает видимость макро-загрязнения в none если pollutionDataUrl равен null', () => {
            mockShouldReturnPollution = false;
            createdLayers.set('air-grid-macro-pollution-layer', { id: 'air-grid-macro-pollution-layer' });

            render(
                <MapComponent
                    lat={55.75}
                    lon={37.61}
                    macroGrid={mockMacro}
                    selectedTimeIndex={0}
                    viewMode="color"
                />
            );

            const mapInstance = mockInstances[0];
            expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith(
                'air-grid-macro-pollution-layer',
                'visibility',
                'none'
            );
        });
    });

    describe('5. Отрисовка микро-слоя, запасные варианты и граничные случаи', () => {
        const mockMicroWithoutBbox = {
            points: [
                { lat: 55.0, lon: 37.0, eaqi: 30 },
                { lat: 56.0, lon: 38.0, eaqi: 45 }
            ],
            time: ['2026-10-01T00:00']
        };

        it('вычисляет bbox по точкам если bbox не передан в микро-сетке', () => {
            render(
                <MapComponent
                    lat={55.75}
                    lon={37.61}
                    microGrid={mockMicroWithoutBbox}
                    selectedTimeIndex={0}
                    viewMode="color"
                />
            );

            const mapInstance = mockInstances[0];
            expect(mapInstance.addSource).toHaveBeenCalledWith(
                'air-grid-micro-source',
                expect.objectContaining({ type: 'image' })
            );
        });

        it('досрочно завершает выполнение если массив точек микро-сетки пуст', () => {
            render(
                <MapComponent
                    lat={55.75}
                    lon={37.61}
                    microGrid={{ points: [] }}
                    selectedTimeIndex={0}
                    viewMode="color"
                />
            );

            const mapInstance = mockInstances[0];
            expect(mapInstance.addSource).not.toHaveBeenCalledWith(
                'air-grid-micro-source',
                expect.anything()
            );
        });

        it('пересоздает источник и слой микро-сетки если у существующего источника нет updateImage', () => {
            const { rerender } = render(
                <MapComponent
                    lat={55.75}
                    lon={37.61}
                    microGrid={mockMicroWithoutBbox}
                    selectedTimeIndex={0}
                    viewMode="color"
                />
            );

            const mapInstance = mockInstances[0];
            createdSources.set('air-grid-micro-source', { type: 'image' });
            createdLayers.set('air-grid-micro-layer', { id: 'air-grid-micro-layer' });

            rerender(
                <MapComponent
                    lat={55.75}
                    lon={37.61}
                    microGrid={{ ...mockMicroWithoutBbox, points: [{ lat: 55.0, lon: 37.0, eaqi: 35 }] }}
                    selectedTimeIndex={0}
                    viewMode="color"
                />
            );

            expect(mapInstance.removeLayer).toHaveBeenCalledWith('air-grid-micro-layer');
            expect(mapInstance.removeSource).toHaveBeenCalledWith('air-grid-micro-source');
        });

        it('пересоздает источник и слой микро-загрязнения если у существующего источника нет updateImage', () => {
            const { rerender } = render(
                <MapComponent
                    lat={55.75}
                    lon={37.61}
                    microGrid={mockMicroWithoutBbox}
                    selectedTimeIndex={0}
                    viewMode="color"
                />
            );

            const mapInstance = mockInstances[0];
            createdSources.set('air-grid-micro-pollution-source', { type: 'image' });
            createdLayers.set('air-grid-micro-pollution-layer', { id: 'air-grid-micro-pollution-layer' });

            rerender(
                <MapComponent
                    lat={55.75}
                    lon={37.61}
                    microGrid={{ ...mockMicroWithoutBbox, points: [{ lat: 55.0, lon: 37.0, eaqi: 35 }] }}
                    selectedTimeIndex={0}
                    viewMode="color"
                />
            );

            expect(mapInstance.removeLayer).toHaveBeenCalledWith('air-grid-micro-pollution-layer');
            expect(mapInstance.removeSource).toHaveBeenCalledWith('air-grid-micro-pollution-source');
        });

        it('устанавливает видимость микро-загрязнения в none если microPollutionDataUrl равен null', () => {
            mockShouldReturnPollution = false;
            createdLayers.set('air-grid-micro-pollution-layer', { id: 'air-grid-micro-pollution-layer' });

            render(
                <MapComponent
                    lat={55.75}
                    lon={37.61}
                    microGrid={mockMicroWithoutBbox}
                    selectedTimeIndex={0}
                    viewMode="color"
                />
            );

            const mapInstance = mockInstances[0];
            expect(mapInstance.setLayoutProperty).toHaveBeenCalledWith(
                'air-grid-micro-pollution-layer',
                'visibility',
                'none'
            );
        });

        it('рассчитывает initialOpacity для микро-слоя при зуме между 8.5 и 9.0', () => {
            MockMap.mockImplementationOnce(function (options) {
                this.options = options;
                this._zoom = 8.75;
                this._center = [37.61, 55.75];
                this.flyTo = vi.fn();
                this.remove = vi.fn();
                this.addControl = vi.fn();
                this.addSource = vi.fn();
                this.getSource = vi.fn(() => null);
                this.addLayer = vi.fn();
                this.getLayer = vi.fn(() => null);
                this.setLayoutProperty = vi.fn();
                this.setPaintProperty = vi.fn();
                this.setMaxZoom = vi.fn();
                this.getZoom = vi.fn(() => 8.75);
                this.isStyleLoaded = vi.fn(() => true);
                this.getStyle = vi.fn(() => ({ version: 8 }));
                this.on = vi.fn();
                this.once = vi.fn((e, cb) => cb());
                this.off = vi.fn();
                mockInstances.push(this);
                return this;
            });

            render(
                <MapComponent
                    lat={55.75}
                    lon={37.61}
                    microGrid={mockMicroWithoutBbox}
                    selectedTimeIndex={0}
                    viewMode="color"
                />
            );

            const mapInstance = mockInstances[0];
            expect(mapInstance.addLayer).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'air-grid-micro-layer',
                    paint: expect.objectContaining({
                        'raster-opacity': expect.closeTo(0.35, 2)
                    })
                }),
                'map-marker'
            );
        });

        it('безопасно перехватывает ошибки при сбое moveLayer', () => {
            MockMap.mockImplementationOnce(function (options) {
                this.options = options;
                this._zoom = 11;
                this._center = [37.61, 55.75];
                this.flyTo = vi.fn();
                this.remove = vi.fn();
                this.addControl = vi.fn();
                this.addSource = vi.fn();
                this.getSource = vi.fn(() => null);
                this.addLayer = vi.fn();
                this.getLayer = vi.fn(() => ({ id: 'mock' }));
                this.setLayoutProperty = vi.fn();
                this.setPaintProperty = vi.fn();
                this.setMaxZoom = vi.fn();
                this.getZoom = vi.fn(() => 11);
                this.isStyleLoaded = vi.fn(() => true);
                this.getStyle = vi.fn(() => ({ version: 8 }));
                this.moveLayer = vi.fn().mockImplementation(() => {
                    throw new Error('Cannot move layer');
                });
                this.on = vi.fn();
                this.once = vi.fn((e, cb) => cb());
                this.off = vi.fn();
                mockInstances.push(this);
                return this;
            });

            expect(() => {
                render(
                    <MapComponent
                        lat={55.75}
                        lon={37.61}
                        microGrid={mockMicroWithoutBbox}
                        selectedTimeIndex={0}
                        viewMode="color"
                    />
                );
            }).not.toThrow();
        });

        it('пересоздает макро и микро слои с видимостью none в числовом режиме viewMode', () => {
            const { rerender } = render(
                <MapComponent
                    lat={55.75}
                    lon={37.61}
                    macroGrid={{ points: [{ lat: 55, lon: 37, eaqi: 50 }], time: ['2026-10-01T00:00'] }}
                    microGrid={{ ...mockMicroWithoutBbox, points: [{ lat: 55, lon: 37, eaqi: 50 }] }}
                    selectedTimeIndex={0}
                    viewMode="numeric"
                />
            );

            const mapInstance = mockInstances[0];
            createdSources.set('air-grid-macro-source', { type: 'image' });
            createdSources.set('air-grid-macro-pollution-source', { type: 'image' });
            createdSources.set('air-grid-micro-source', { type: 'image' });
            createdSources.set('air-grid-micro-pollution-source', { type: 'image' });

            rerender(
                <MapComponent
                    lat={55.75}
                    lon={37.61}
                    macroGrid={{ points: [{ lat: 55, lon: 37, eaqi: 60 }], time: ['2026-10-01T00:00'] }}
                    microGrid={{ ...mockMicroWithoutBbox, points: [{ lat: 55, lon: 37, eaqi: 60 }] }}
                    selectedTimeIndex={0}
                    viewMode="numeric"
                />
            );

            expect(mapInstance.addLayer).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'air-grid-macro-layer',
                    layout: expect.objectContaining({ visibility: 'none' })
                }),
                expect.anything()
            );
            expect(mapInstance.addLayer).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'air-grid-micro-layer',
                    layout: expect.objectContaining({ visibility: 'none' })
                }),
                expect.anything()
            );
        });

        it('проверяет resolveGridTimeIndex с невалидной ISO-строкой и viewportMove с массивом координат и порогом расстояния', () => {
            const timeIdx = resolveGridTimeIndex({ time: ['2026-10-01T00:00'] }, 'invalid-iso-string', 3);
            expect(timeIdx).toBe(3);

            const onViewportMove = vi.fn();
            render(
                <MapComponent
                    lat="55.75"
                    lon="37.61"
                    microGrid={{
                        ...mockMicroWithoutBbox,
                        center: { lat: 55.75, lon: 37.61 }
                    }}
                    onViewportMove={onViewportMove}
                    recenterTrigger={1}
                />
            );

            const mapInstance = mockInstances[0];
            const moveEndHandler = eventHandlers['moveend']?.[0];

            mapInstance.getCenter.mockReturnValue([37.62, 55.75]);
            act(() => {
                moveEndHandler();
                vi.advanceTimersByTime(500);
            });
            expect(onViewportMove).not.toHaveBeenCalled();

            mapInstance.getCenter.mockReturnValue([38.50, 56.50]);
            act(() => {
                moveEndHandler();
                vi.advanceTimersByTime(500);
            });
            expect(onViewportMove).toHaveBeenCalledWith({ lat: 56.50, lon: 38.50 });

            mapInstance.getCenter.mockReturnValue(null);
            act(() => {
                moveEndHandler();
                vi.advanceTimersByTime(500);
            });
        });

        it('вызывает existingSource.updateImage когда микро-слои уже существуют', () => {
            const { rerender } = render(
                <MapComponent
                    lat="55.75"
                    lon="37.61"
                    microGrid={{
                        points: [
                            { lat: 55.7, lon: 37.6, eaqi: 20 },
                            { lat: 55.8, lon: 37.7, eaqi: 80 }
                        ],
                        bbox: [37.5, 55.6, 37.8, 55.9],
                        time: ['2026-10-01T00:00', '2026-10-01T01:00']
                    }}
                    selectedTimeIndex={0}
                    viewMode="combo"
                />
            );

            const microSource = createdSources.get('air-grid-micro-source');
            const microPollutionSource = createdSources.get('air-grid-micro-pollution-source');

            const updateImageMicroSpy = vi.fn();
            const updateImagePollutionSpy = vi.fn();
            if (microSource) microSource.updateImage = updateImageMicroSpy;
            if (microPollutionSource) microPollutionSource.updateImage = updateImagePollutionSpy;

            rerender(
                <MapComponent
                    lat="55.75"
                    lon="37.61"
                    microGrid={{
                        points: [
                            { lat: 55.7, lon: 37.6, eaqi: 20 },
                            { lat: 55.8, lon: 37.7, eaqi: 80 }
                        ],
                        bbox: [37.5, 55.6, 37.8, 55.9],
                        time: ['2026-10-01T00:00', '2026-10-01T01:00']
                    }}
                    selectedTimeIndex={1}
                    viewMode="combo"
                />
            );

            expect(updateImageMicroSpy).toHaveBeenCalled();
            expect(updateImagePollutionSpy).toHaveBeenCalled();
        });

        it('инициализирует карту со значением SATELLITE_MAX_ZOOM при satellite в activeBaseLayer', () => {
            render(
                <MapComponent
                    lat="55.75"
                    lon="37.61"
                    activeBaseLayer="satellite"
                />
            );

            const lastMockCall = MockMap.mock.calls[MockMap.mock.calls.length - 1][0];
            expect(lastMockCall.maxZoom).toBe(17);
        });

        it('обрабатывает цикл анимации пульсации и вызов cancelAnimationFrame при размонтировании', () => {
            let animCallback;
            const origRAF = globalThis.requestAnimationFrame;
            const origCAF = globalThis.cancelAnimationFrame;
            vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
                animCallback = cb;
                return 42;
            });
            const cafSpy = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(vi.fn());

            try {
                const { unmount } = render(
                    <MapComponent
                        lat="55.75"
                        lon="37.61"
                        viewMode="combo"
                    />
                );

                const mapInstance = mockInstances[mockInstances.length - 1];
                mapInstance.getLayer = vi.fn((id) => ({ id }));
                mapInstance.setPaintProperty = vi.fn();

                if (animCallback) {
                    animCallback(1100);
                }

                expect(mapInstance.setPaintProperty).toHaveBeenCalledWith(
                    'air-grid-macro-pollution-layer',
                    'raster-opacity',
                    expect.any(Number)
                );

                unmount();
                expect(cafSpy).toHaveBeenCalledWith(42);
            } finally {
                globalThis.requestAnimationFrame = origRAF;
                globalThis.cancelAnimationFrame = origCAF;
            }
        });

        it('вычисляет microOpacity = 0.0 при зуме между 8.5 и 9.0 когда microGrid равен null', () => {
            render(
                <MapComponent
                    lat="55.75"
                    lon="37.61"
                    viewMode="color"
                />
            );
            const mapInstance = mockInstances[mockInstances.length - 1];
            mapInstance.getZoom.mockReturnValue(8.8);
            mapInstance.getLayer = vi.fn().mockReturnValue({ id: 'some-layer' });
            mapInstance.setPaintProperty = vi.fn();

            const moveStartHandler = eventHandlers['movestart']?.[0];
            if (moveStartHandler) {
                act(() => { moveStartHandler(); });
            }
        });

        it('безопасно обрабатывает macroGrid и microGrid с некорректным bbox', () => {
            render(
                <MapComponent
                    lat="55.75"
                    lon="37.61"
                    macroGrid={{ points: [{ lat: 55, lon: 37, eaqi: 40 }], bbox: [1, 2] }}
                    microGrid={{ points: [], bbox: 'invalid' }}
                />
            );
        });

        it('предотвращает избыточный flyTo когда пропсы совпадают с последними координатами клика', () => {
            const onMapClick = vi.fn();
            const { rerender } = render(
                <MapComponent
                    lat="55.75"
                    lon="37.61"
                    onMapClick={onMapClick}
                />
            );
            const mapInstance = mockInstances[mockInstances.length - 1];
            const clickHandler = eventHandlers['click']?.[0];
            if (clickHandler) {
                act(() => {
                    clickHandler({ lngLat: { lng: 37.61001, lat: 55.75001 } });
                });
            }
            mapInstance.flyTo.mockClear();

            rerender(
                <MapComponent
                    lat="55.75001"
                    lon="37.61001"
                    onMapClick={onMapClick}
                />
            );
            expect(mapInstance.flyTo).not.toHaveBeenCalled();
        });

        it('обрабатывает moveend и клик по маркеру когда колбэки опущены', () => {
            render(
                <MapComponent
                    lat="55.75"
                    lon="37.61"
                />
            );
            const mapInstance = mockInstances[mockInstances.length - 1];

            const moveEndHandler = eventHandlers['moveend']?.[eventHandlers['moveend'].length - 1];
            mapInstance.getCenter.mockReturnValue({ lat: 56.5, lng: 38.5 });
            if (moveEndHandler) {
                act(() => {
                    moveEndHandler();
                    vi.advanceTimersByTime(500);
                });
            }

            const markerInstance = MockMarker.mock.results[MockMarker.mock.results.length - 1]?.value;
            const markerClickHandler = markerInstance?.getElement()?.onclick;
            if (markerClickHandler) {
                act(() => {
                    markerClickHandler(new MouseEvent('click'));
                });
            }
        });

        it('обрабатывает загрузку стиля когда map.once не определен, но доступен map.on', () => {
            const { rerender, unmount } = render(
                <MapComponent
                    lat="55.75"
                    lon="37.61"
                    activeBaseLayer="osm"
                />
            );
            const mapInstance = mockInstances[mockInstances.length - 1];
            mapInstance.isStyleLoaded = vi.fn().mockReturnValue(false);
            mapInstance.once = undefined;
            mapInstance.on = vi.fn();

            rerender(
                <MapComponent
                    lat="55.75"
                    lon="37.61"
                    activeBaseLayer="satellite"
                />
            );
            expect(mapInstance.on).toHaveBeenCalledWith('load', expect.any(Function));

            const onLoadedCallback = mapInstance.on.mock.calls[0]?.[1];
            if (onLoadedCallback) {
                mapInstance.isStyleLoaded = vi.fn().mockReturnValue(true);
                mapInstance.setLayoutProperty = vi.fn();
                mapInstance.getLayer = vi.fn().mockReturnValue({ id: 'satellite-layer' });
                act(() => {
                    onLoadedCallback();
                });
                expect(mapInstance.setLayoutProperty).toHaveBeenCalled();
            }
            unmount();
        });

        it('обрабатывает microGrid при зуме <= 8.5 с нулевой начальной прозрачностью', () => {
            render(
                <MapComponent
                    lat="55.75"
                    lon="37.61"
                    microGrid={{
                        points: [{ lat: 55.7, lon: 37.6, eaqi: 30 }],
                        bbox: [37.5, 55.6, 37.8, 55.9],
                        time: ['2026-10-01T00:00']
                    }}
                    viewMode="color"
                />
            );
            const mapInstance = mockInstances[mockInstances.length - 1];
            mapInstance.getZoom = vi.fn().mockReturnValue(8.0);
            const moveStartHandler = eventHandlers['movestart']?.[eventHandlers['movestart'].length - 1];
            if (moveStartHandler) {
                act(() => { moveStartHandler(); });
            }
        });

        it('безопасно обрабатывает updateLodOpacity когда map.getZoom не является функцией', () => {
            render(
                <MapComponent
                    lat="55.75"
                    lon="37.61"
                    viewMode="color"
                />
            );
            const mapInstance = mockInstances[mockInstances.length - 1];
            mapInstance.getZoom = undefined;
            const zoomHandler = eventHandlers['zoom']?.[eventHandlers['zoom'].length - 1];
            if (zoomHandler) {
                act(() => { zoomHandler(); });
            }
        });

        it('обрабатывает moveend на расстоянии > 20 км когда onViewportMove опущен', () => {
            render(
                <MapComponent
                    lat="55.75"
                    lon="37.61"
                    microGrid={{
                        points: [{ lat: 55.75, lon: 37.61, eaqi: 20 }],
                        center: { lat: 55.75, lon: 37.61 }
                    }}
                />
            );
            const mapInstance = mockInstances[mockInstances.length - 1];
            mapInstance.getCenter.mockReturnValue({ lat: 56.50, lng: 38.50 });
            const moveEndHandler = eventHandlers['moveend']?.[eventHandlers['moveend'].length - 1];
            if (moveEndHandler) {
                act(() => {
                    moveEndHandler();
                    vi.advanceTimersByTime(500);
                });
            }
        });

        it('безопасно обрабатывает moveend без getCenter и movestart с неопределенным getZoom', () => {
            render(
                <MapComponent
                    lat="55.75"
                    lon="37.61"
                    viewMode="combo"
                />
            );
            const mapInstance = mockInstances[mockInstances.length - 1];
            mapInstance.getCenter = undefined;
            mapInstance.getZoom = undefined;

            const moveStartHandler = eventHandlers['movestart']?.[eventHandlers['movestart'].length - 1];
            if (moveStartHandler) {
                act(() => { moveStartHandler(); });
            }

            const moveEndHandler = eventHandlers['moveend']?.[eventHandlers['moveend'].length - 1];
            if (moveEndHandler) {
                act(() => {
                    moveEndHandler();
                    vi.advanceTimersByTime(500);
                });
            }
        });

        it('безопасно обрабатывает movestart и moveend при размонтированной карте (map.current равен null)', () => {
            const { unmount } = render(
                <MapComponent
                    lat="55.75"
                    lon="37.61"
                    viewMode="combo"
                />
            );
            const moveStartHandler = eventHandlers['movestart']?.[eventHandlers['movestart'].length - 1];
            const moveEndHandler = eventHandlers['moveend']?.[eventHandlers['moveend'].length - 1];

            unmount();

            if (moveStartHandler) {
                act(() => { moveStartHandler(); });
            }
            if (moveEndHandler) {
                act(() => {
                    moveEndHandler();
                    vi.advanceTimersByTime(500);
                });
            }
        });

        it('безопасно обрабатывает отсутствие функций setMaxZoom и setLayoutProperty у карты', () => {
            const { rerender } = render(
                <MapComponent
                    lat="55.75"
                    lon="37.61"
                    activeBaseLayer="osm"
                />
            );
            const mapInstance = mockInstances[mockInstances.length - 1];
            mapInstance.setMaxZoom = undefined;
            mapInstance.setLayoutProperty = undefined;

            rerender(
                <MapComponent
                    lat="55.75"
                    lon="37.61"
                    activeBaseLayer="satellite"
                />
            );
        });

        it('досрочно завершает работу в applyMacroLayer и applyMicroLayer когда координаты не могут быть вычислены', () => {
            render(
                <MapComponent
                    lat="55.75"
                    lon="37.61"
                    macroGrid={{ bbox: null, points: [] }}
                    microGrid={{ bbox: null, points: [] }}
                />
            );
        });
    });
});
