// tests/components/MapComponent.test.jsx — TDD-тесты для управления камерой и отрисовки маркеров качества воздуха

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { getAqiInfo } from '../../src/types';

// Подготовка hoisted моков для Vitest
const {
    MockMap,
    MockMarker,
    MockNavigationControl,
    mockFlyTo,
    mockRemove,
    mockAddControl,
    mockMarkerSetLngLat,
    mockMarkerAddTo,
    mockMarkerRemove,
    getCreatedMarkers,
    clearCreatedMarkers
} = vi.hoisted(() => {
    const mockFlyTo = vi.fn();
    const mockRemove = vi.fn();
    const mockAddControl = vi.fn();
    const mockMarkerSetLngLat = vi.fn().mockReturnThis();
    const mockMarkerAddTo = vi.fn().mockReturnThis();
    const mockMarkerRemove = vi.fn().mockReturnThis();

    let createdMarkers = [];

    const MockMap = vi.fn().mockImplementation(function (options) {
        this.options = options;
        this.flyTo = mockFlyTo;
        this.remove = mockRemove;
        this.addControl = mockAddControl;
        this.addSource = vi.fn();
        this.removeSource = vi.fn();
        this.getSource = vi.fn();
        this.addLayer = vi.fn();
        this.removeLayer = vi.fn();
        this.getLayer = vi.fn();
        this.on = vi.fn();
        this.off = vi.fn();
        return this;
    });

    const MockNavigationControl = vi.fn();

    const MockMarker = vi.fn().mockImplementation(function (options = {}) {
        const el = options?.element || document.createElement('div');
        this.element = el;
        this.options = options;
        this.setLngLat = vi.fn().mockImplementation((coords) => {
            this.coords = coords;
            mockMarkerSetLngLat(coords);
            return this;
        });
        this.addTo = vi.fn().mockImplementation((mapInstance) => {
            this.map = mapInstance;
            mockMarkerAddTo(mapInstance);
            return this;
        });
        this.remove = vi.fn().mockImplementation(() => {
            mockMarkerRemove();
            return this;
        });
        this.getElement = vi.fn().mockImplementation(() => {
            return this.element;
        });

        createdMarkers.push(this);
        return this;
    });

    return {
        MockMap,
        MockMarker,
        MockNavigationControl,
        mockFlyTo,
        mockRemove,
        mockAddControl,
        mockMarkerSetLngLat,
        mockMarkerAddTo,
        mockMarkerRemove,
        getCreatedMarkers: () => createdMarkers,
        clearCreatedMarkers: () => { createdMarkers = []; }
    };
});

// Мокирование MapLibre GL JS
vi.mock('maplibre-gl', () => {
    return {
        default: {
            Map: MockMap,
            Marker: MockMarker,
            NavigationControl: MockNavigationControl,
        },
        Map: MockMap,
        Marker: MockMarker,
        NavigationControl: MockNavigationControl,
    };
});

// Импортируем тестируемый компонент
import MapComponent from '../../src/components/MapComponent';

describe('MapComponent (TDD — динамическое управление камерой)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearCreatedMarkers();
    });

    afterEach(() => {
        cleanup();
    });

    it('1. Инициализирует карту MapLibre с контейнером и элементом управления навигацией при монтировании', () => {
        const { container } = render(<MapComponent />);

        expect(MockMap).toHaveBeenCalledTimes(1);
        const mapOptions = MockMap.mock.calls[0][0];
        expect(mapOptions.container).toBe(container.firstChild);
        expect(mapOptions.zoom).toBe(11);
        expect(mockAddControl).toHaveBeenCalledTimes(1);
    });

    it('2. Вызывает map.current.flyTo при изменении координат lat и lon', () => {
        const { rerender } = render(<MapComponent lat={53.7596} lon={87.1467} />);

        // Пользователь выбрал новый город (например, Москва: lat 55.7558, lon 37.6173)
        rerender(<MapComponent lat={55.7558} lon={37.6173} />);

        expect(mockFlyTo).toHaveBeenCalledTimes(1);
        expect(mockFlyTo).toHaveBeenCalledWith({
            center: [37.6173, 55.7558],
            zoom: 11
        });
    });

    it('3. Передает координаты в center строго в порядке [долгота (lon), широта (lat)]', () => {
        const testLat = 59.9343; // Санкт-Петербург широта
        const testLon = 30.3351; // Санкт-Петербург долгота

        const { rerender } = render(<MapComponent lat={53.7596} lon={87.1467} />);

        rerender(<MapComponent lat={testLat} lon={testLon} />);

        expect(mockFlyTo).toHaveBeenCalledWith(
            expect.objectContaining({
                center: [testLon, testLat] // GeoJSON / MapLibre формат: [lon, lat]
            })
        );
    });

    it('4. Плавно перемещает камеру к координатам каждого последующего выбранного города', () => {
        const { rerender } = render(<MapComponent lat={53.7596} lon={87.1467} />);

        // Выбор первого города: Казань
        rerender(<MapComponent lat={55.7961} lon={49.1064} />);
        expect(mockFlyTo).toHaveBeenLastCalledWith({
            center: [49.1064, 55.7961],
            zoom: 11
        });

        // Выбор второго города: Екатеринбург
        rerender(<MapComponent lat={56.8389} lon={60.6057} />);
        expect(mockFlyTo).toHaveBeenLastCalledWith({
            center: [60.6057, 56.8389],
            zoom: 11
        });

        expect(mockFlyTo).toHaveBeenCalledTimes(2);
    });

    it('5. Не вызывает flyTo, если lat или lon равны null или undefined', () => {
        const { rerender } = render(<MapComponent lat={null} lon={null} />);

        expect(mockFlyTo).not.toHaveBeenCalled();

        rerender(<MapComponent lat={undefined} lon={undefined} />);
        expect(mockFlyTo).not.toHaveBeenCalled();

        // Частичные координаты
        rerender(<MapComponent lat={55.7558} lon={null} />);
        expect(mockFlyTo).not.toHaveBeenCalled();
    });

    it('6. Очищает ресурсы карты (map.current.remove()) при размонтировании компонента', () => {
        const { unmount } = render(<MapComponent lat={53.7596} lon={87.1467} />);

        unmount();

        expect(mockRemove).toHaveBeenCalledTimes(1);
    });
});

describe('MapComponent (TDD — отрисовка маркеров качества воздуха)', () => {
    const mockAirData = {
        latitude: 53.7596,
        longitude: 87.1467,
        hourly: {
            time: [
                '2026-09-28T00:00',
                '2026-09-28T03:00',
                '2026-09-28T06:00',
                '2026-09-28T09:00'
            ],
            european_aqi: [
                15, // отлично (<= 20, hex: #4CAF50, cssClass: aqi-excellent)
                35, // хорошо (21..40, hex: #8BC34A, cssClass: aqi-good)
                75, // плохо (61..80, hex: #FF9800, cssClass: aqi-poor)
                110 // опасно (> 100, hex: #D50000, cssClass: aqi-hazardous)
            ]
        }
    };

    // Вспомогательная проверка наличия цветового класса или стиля уровня AQI в элементе
    function hasAqiColorOrClass(element, aqiInfo) {
        if (!element) return false;
        const html = element.outerHTML.toLowerCase();
        const hasClass = html.includes(aqiInfo.cssClass.toLowerCase());
        const hasHex = html.includes(aqiInfo.hex.toLowerCase());
        const hasStyle = element.style && (element.style.backgroundColor !== '' || element.style.borderColor !== '');
        return hasClass || hasHex || hasStyle;
    }

    // Вспомогательная проверка наличия числового значения EAQI в элементе
    function hasAqiNumber(element, number) {
        if (!element) return false;
        return element.textContent.includes(String(number));
    }

    beforeEach(() => {
        vi.clearAllMocks();
        clearCreatedMarkers();
    });

    afterEach(() => {
        cleanup();
    });

    it('1. Извлекает EAQI по selectedTimeIndex и создает маркер в центре карты через maplibregl.Marker', () => {
        render(
            <MapComponent
                airData={mockAirData}
                selectedTimeIndex={0} // aqi = 15
                viewMode="combo"
            />
        );

        expect(MockMarker).toHaveBeenCalledTimes(1);

        const markerInstance = getCreatedMarkers().at(-1);
        expect(markerInstance).toBeDefined();

        // Проверяем привязку координат [lon, lat]
        expect(mockMarkerSetLngLat).toHaveBeenCalledWith([87.1467, 53.7596]);
        // Проверяем добавление маркера на карту
        expect(mockMarkerAddTo).toHaveBeenCalledTimes(1);
    });

    it('2. В режиме "Цветовой" (viewMode="color") отрисовывает цветной круг/маркер без числового значения', () => {
        render(
            <MapComponent
                airData={mockAirData}
                selectedTimeIndex={0} // aqi = 15
                viewMode="color"
            />
        );

        const markerInstance = getCreatedMarkers().at(-1);
        expect(markerInstance).toBeDefined();

        const el = markerInstance.getElement();
        const expectedInfo = getAqiInfo(15);

        // Цветовое оформление должно присутствовать
        expect(hasAqiColorOrClass(el, expectedInfo)).toBe(true);

        // Числовое значение в цветовом режиме не отображается
        expect(hasAqiNumber(el, 15)).toBe(false);
    });

    it('3. В режиме "Цифровой" (viewMode="numeric") отрисовывает маркер с числовым значением EAQI', () => {
        render(
            <MapComponent
                airData={mockAirData}
                selectedTimeIndex={1} // aqi = 35
                viewMode="numeric"
            />
        );

        const markerInstance = getCreatedMarkers().at(-1);
        expect(markerInstance).toBeDefined();

        const el = markerInstance.getElement();
        // В цифровом режиме число 35 обязательно отображается
        expect(hasAqiNumber(el, 35)).toBe(true);
    });

    it('4. В режиме "Комбо" (viewMode="combo") отрисовывает одновременно числовое значение и цветовую индикацию', () => {
        render(
            <MapComponent
                airData={mockAirData}
                selectedTimeIndex={2} // aqi = 75 (плохо: #FF9800 / aqi-poor)
                viewMode="combo"
            />
        );

        const markerInstance = getCreatedMarkers().at(-1);
        expect(markerInstance).toBeDefined();

        const el = markerInstance.getElement();
        const expectedInfo = getAqiInfo(75);

        // И число, и цвет присутствуют одновременно
        expect(hasAqiNumber(el, 75)).toBe(true);
        expect(hasAqiColorOrClass(el, expectedInfo)).toBe(true);
    });

    it('5. Маркер мгновенно меняет цвет и цифру при переключении часа (selectedTimeIndex)', () => {
        const { rerender } = render(
            <MapComponent
                airData={mockAirData}
                selectedTimeIndex={0} // aqi = 15 (отлично, #4CAF50)
                viewMode="combo"
            />
        );

        let markerInstance = getCreatedMarkers().at(-1);
        expect(markerInstance).toBeDefined();
        let el = markerInstance.getElement();
        expect(hasAqiNumber(el, 15)).toBe(true);
        expect(hasAqiColorOrClass(el, getAqiInfo(15))).toBe(true);

        // Пользователь переключает час в сайдбаре на selectedTimeIndex = 2 (aqi = 75, плохо, #FF9800)
        rerender(
            <MapComponent
                airData={mockAirData}
                selectedTimeIndex={2}
                viewMode="combo"
            />
        );

        markerInstance = getCreatedMarkers().at(-1);
        el = markerInstance.getElement();

        // Цифра и цвет мгновенно обновились
        expect(hasAqiNumber(el, 75)).toBe(true);
        expect(hasAqiColorOrClass(el, getAqiInfo(75))).toBe(true);
    });

    it('6. При переключении viewMode визуализация маркера меняется налету', () => {
        const { rerender } = render(
            <MapComponent
                airData={mockAirData}
                selectedTimeIndex={0} // aqi = 15
                viewMode="color"
            />
        );

        let markerInstance = getCreatedMarkers().at(-1);
        let el = markerInstance.getElement();
        // В color режиме цифры нет
        expect(hasAqiNumber(el, 15)).toBe(false);

        // Переключаем на numeric
        rerender(
            <MapComponent
                airData={mockAirData}
                selectedTimeIndex={0}
                viewMode="numeric"
            />
        );

        markerInstance = getCreatedMarkers().at(-1);
        el = markerInstance.getElement();
        expect(hasAqiNumber(el, 15)).toBe(true);

        // Переключаем на combo
        rerender(
            <MapComponent
                airData={mockAirData}
                selectedTimeIndex={0}
                viewMode="combo"
            />
        );

        markerInstance = getCreatedMarkers().at(-1);
        el = markerInstance.getElement();
        expect(hasAqiNumber(el, 15)).toBe(true);
        expect(hasAqiColorOrClass(el, getAqiInfo(15))).toBe(true);
    });

    it('7. Не создает маркер или удаляет существующий, если airData или selectedTimeIndex равны null', () => {
        const { rerender } = render(
            <MapComponent
                airData={null}
                selectedTimeIndex={null}
                viewMode="combo"
            />
        );

        // Маркер не должен создаваться при отсутствии данных
        expect(MockMarker).not.toHaveBeenCalled();

        // Если данные появились, а затем сбросились в null
        rerender(
            <MapComponent
                airData={mockAirData}
                selectedTimeIndex={0}
                viewMode="combo"
            />
        );
        expect(MockMarker).toHaveBeenCalledTimes(1);

        rerender(
            <MapComponent
                airData={null}
                selectedTimeIndex={null}
                viewMode="combo"
            />
        );

        // При сбросе данных маркер удаляется
        expect(mockMarkerRemove).toHaveBeenCalled();
    });

    it('8. Очищает маркер при размонтировании компонента', () => {
        const { unmount } = render(
            <MapComponent
                airData={mockAirData}
                selectedTimeIndex={0}
                viewMode="combo"
            />
        );

        unmount();

        expect(mockMarkerRemove).toHaveBeenCalled();
    });
});
