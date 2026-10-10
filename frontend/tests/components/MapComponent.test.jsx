import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { getAqiInfo } from '../../src/types';
import React from 'react';

// Подготовка hoisted моков для Vitest
const {
    MockMap,
    MockMarker,
    MockPopup,
    MockNavigationControl,
    mockFlyTo,
    mockRemove,
    mockAddControl,
    mockMarkerSetLngLat,
    mockMarkerAddTo,
    mockMarkerRemove,
    mockMapOn,
    mockMapOff,
    mockSetLayoutProperty,
    mockSetMaxZoom,
    getCreatedMarkers,
    clearCreatedMarkers,
    getCreatedPopups,
    clearCreatedPopups
} = vi.hoisted(() => {
    const mockFlyTo = vi.fn();
    const mockRemove = vi.fn();
    const mockAddControl = vi.fn();
    const mockMarkerSetLngLat = vi.fn().mockReturnThis();
    const mockMarkerAddTo = vi.fn().mockReturnThis();
    const mockMarkerRemove = vi.fn().mockReturnThis();
    const mockMapOn = vi.fn();
    const mockMapOff = vi.fn();
    const mockSetLayoutProperty = vi.fn();
    const mockSetMaxZoom = vi.fn();

    let createdMarkers = [];
    let createdPopups = [];

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
        this.getLayer = vi.fn().mockImplementation((id) => (id === 'osm-layer' || id === 'satellite-layer' ? { id } : null));
        this.setLayoutProperty = mockSetLayoutProperty;
        this.setMaxZoom = mockSetMaxZoom;
        this.getZoom = vi.fn().mockReturnValue(11);
        this.setZoom = vi.fn();
        this.on = mockMapOn;
        this.off = mockMapOff;
        return this;
    });

    const MockNavigationControl = vi.fn();

    const MockPopup = vi.fn().mockImplementation(function (options = {}) {
        this.options = options;
        this._isOpen = false;
        this._html = '';
        this._dom = null;
        this.setLngLat = vi.fn().mockImplementation((coords) => {
            this.coords = coords;
            return this;
        });
        this.setHTML = vi.fn().mockImplementation((html) => {
            this._html = html;
            return this;
        });
        this.setDOMContent = vi.fn().mockImplementation((dom) => {
            this._dom = dom;
            return this;
        });
        this.addTo = vi.fn().mockImplementation((mapInstance) => {
            this.map = mapInstance;
            this._isOpen = true;
            return this;
        });
        this.remove = vi.fn().mockImplementation(() => {
            this._isOpen = false;
            return this;
        });
        this.isOpen = vi.fn().mockImplementation(() => this._isOpen);

        createdPopups.push(this);
        return this;
    });

    const MockMarker = vi.fn().mockImplementation(function (options = {}) {
        const el = options?.element || document.createElement('div');
        this.element = el;
        this.options = options;
        this.popup = null;
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
        this.setPopup = vi.fn().mockImplementation((popupInstance) => {
            this.popup = popupInstance;
            this.element.addEventListener('click', () => {
                if (this.popup) {
                    if (this.popup.isOpen()) {
                        this.popup.remove();
                    } else if (this.map) {
                        this.popup.addTo(this.map);
                    }
                }
            });
            return this;
        });
        this.getPopup = vi.fn().mockImplementation(() => this.popup);
        this.togglePopup = vi.fn().mockImplementation(() => {
            if (this.popup) {
                if (this.popup.isOpen()) {
                    this.popup.remove();
                } else if (this.map) {
                    this.popup.addTo(this.map);
                }
            }
            return this;
        });

        createdMarkers.push(this);
        return this;
    });

    return {
        MockMap,
        MockMarker,
        MockPopup,
        MockNavigationControl,
        mockFlyTo,
        mockRemove,
        mockAddControl,
        mockMarkerSetLngLat,
        mockMarkerAddTo,
        mockMarkerRemove,
        mockMapOn,
        mockMapOff,
        mockSetLayoutProperty,
        mockSetMaxZoom,
        getCreatedMarkers: () => createdMarkers,
        clearCreatedMarkers: () => { createdMarkers = []; },
        getCreatedPopups: () => createdPopups,
        clearCreatedPopups: () => { createdPopups = []; }
    };
});

// Мокирование MapLibre GL JS
vi.mock('maplibre-gl', () => {
    return {
        default: {
            Map: MockMap,
            Marker: MockMarker,
            Popup: MockPopup,
            NavigationControl: MockNavigationControl,
        },
        Map: MockMap,
        Marker: MockMarker,
        Popup: MockPopup,
        NavigationControl: MockNavigationControl,
    };
});

// Импортируем тестируемый компонент
import MapComponent from '../../src/components/MapComponent';

describe('MapComponent (динамическое управление камерой)', () => {
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
        expect(mockFlyTo).toHaveBeenCalledWith(
            expect.objectContaining({
                center: [37.6173, 55.7558],
                zoom: 11
            })
        );
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
        expect(mockFlyTo).toHaveBeenLastCalledWith(
            expect.objectContaining({
                center: [49.1064, 55.7961],
                zoom: 11
            })
        );

        // Выбор второго города: Екатеринбург
        rerender(<MapComponent lat={56.8389} lon={60.6057} />);
        expect(mockFlyTo).toHaveBeenLastCalledWith(
            expect.objectContaining({
                center: [60.6057, 56.8389],
                zoom: 11
            })
        );

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

describe('MapComponent (отрисовка маркеров качества воздуха)', () => {
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

describe('MapComponent (интерактивный выбор точки кликом по карте)', () => {
    it('1. Подписывается на событие клика карты ("click") при инициализации', () => {
        const handleMapClick = vi.fn();
        render(<MapComponent onMapClick={handleMapClick} />);

        expect(mockMapOn).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('2. При клике по карте вызывает onMapClick с числовыми координатами (lat, lon)', () => {
        const handleMapClick = vi.fn();
        render(<MapComponent onMapClick={handleMapClick} />);

        const clickCall = mockMapOn.mock.calls.find((call) => call[0] === 'click');
        expect(clickCall).toBeDefined();

        const clickHandler = clickCall[1];
        // MapLibre передает e.lngLat с полями lng и lat
        clickHandler({
            lngLat: { lng: 37.6173, lat: 55.7558 }
        });

        expect(handleMapClick).toHaveBeenCalledTimes(1);
        expect(handleMapClick).toHaveBeenCalledWith(55.7558, 37.6173);
    });

    it('3. Безопасно отрабатывает клик, если коллбэк onMapClick не передан в пропсы', () => {
        render(<MapComponent />);

        const clickCall = mockMapOn.mock.calls.find((call) => call[0] === 'click');
        if (clickCall) {
            const clickHandler = clickCall[1];
            expect(() => {
                clickHandler({ lngLat: { lng: 37.6173, lat: 55.7558 } });
            }).not.toThrow();
        }
    });

    it('4. Отписывается от события "click" при размонтировании компонента', () => {
        const handleMapClick = vi.fn();
        const { unmount } = render(<MapComponent onMapClick={handleMapClick} />);

        unmount();

        expect(mockMapOff).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('5. Обновляет позицию маркера при клике по карте и вызывает onLocationSelect', () => {
        const handleLocationSelect = vi.fn();
        const mockData = {
            latitude: 53.7596,
            longitude: 87.1467,
            hourly: { european_aqi: [25] }
        };

        render(
            <MapComponent
                airData={mockData}
                selectedTimeIndex={0}
                onLocationSelect={handleLocationSelect}
            />
        );

        const clickCall = mockMapOn.mock.calls.find((call) => call[0] === 'click');
        const clickHandler = clickCall[1];

        // Кликаем по карте в новых координатах
        clickHandler({
            lngLat: { lng: 30.3351, lat: 59.9343 }
        });

        expect(handleLocationSelect).toHaveBeenCalledWith({ lat: 59.9343, lon: 30.3351 });
        expect(mockMarkerSetLngLat).toHaveBeenCalledWith([30.3351, 59.9343]);
    });

    it('6. Подавляет flyTo сразу после клика по карте (флаг isMapClick)', () => {
        const { rerender } = render(<MapComponent lat={53.7596} lon={87.1467} />);

        const clickCall = mockMapOn.mock.calls.find((call) => call[0] === 'click');
        const clickHandler = clickCall[1];

        // Симулируем клик пользователя по карте
        clickHandler({
            lngLat: { lng: 37.6173, lat: 55.7558 }
        });

        // Родитель обновил lat и lon на те же координаты клика
        rerender(<MapComponent lat={55.7558} lon={37.6173} />);

        // flyTo не должен вызываться для клика пользователя
        expect(mockFlyTo).not.toHaveBeenCalled();
    });

    it('7. Удаляет маркер, если значение AQI в массиве равно null', () => {
        const dataWithNullAqi = {
            latitude: 53.7596,
            longitude: 87.1467,
            hourly: { european_aqi: [15, null] }
        };

        const { rerender } = render(
            <MapComponent
                airData={dataWithNullAqi}
                selectedTimeIndex={0}
            />
        );

        expect(mockMarkerAddTo).toHaveBeenCalledTimes(1);

        // Переключаем на час, где aqi равен null
        rerender(
            <MapComponent
                airData={dataWithNullAqi}
                selectedTimeIndex={1}
            />
        );

        expect(mockMarkerRemove).toHaveBeenCalled();
    });

    it('8. Игнорирует некорректный клик по карте (null или без lngLat)', () => {
        render(<MapComponent />);

        const clickCall = mockMapOn.mock.calls.find((call) => call[0] === 'click');
        const clickHandler = clickCall[1];

        // Клик без аргументов или без lngLat
        clickHandler(null);
        clickHandler({});
        expect(mockFlyTo).not.toHaveBeenCalled();
    });

    it('9. Корректно кликает по карте, если маркер еще не создан и коллбэки не переданы', () => {
        render(<MapComponent />);

        const clickCall = mockMapOn.mock.calls.find((call) => call[0] === 'click');
        const clickHandler = clickCall[1];

        clickHandler({ lngLat: { lng: 30.3351, lat: 59.9343 } });
    });

    it('10. Удаляет маркер при демонтировании компонента', () => {
        const mockData = {
            latitude: 53.7596,
            longitude: 87.1467,
            hourly: { european_aqi: [25] }
        };

        const { unmount } = render(
            <MapComponent airData={mockData} selectedTimeIndex={0} />
        );

        unmount();
        expect(mockMarkerRemove).toHaveBeenCalled();
        expect(mockRemove).toHaveBeenCalled();
    });

    it('11. Игнорирует перемещение камеры, если новые lat или lon равны null или undefined', () => {
        const { rerender } = render(<MapComponent lat={53.7596} lon={87.1467} />);

        mockFlyTo.mockClear();

        // Смена координат, но lat равен null
        rerender(<MapComponent lat={null} lon={87.1467} />);
        expect(mockFlyTo).not.toHaveBeenCalled();

        // lon равен null
        rerender(<MapComponent lat={53.7596} lon={null} />);
        expect(mockFlyTo).not.toHaveBeenCalled();
    });

    it('12. Поддерживает альтернативный формат airData.european_aqi (бэкап формат)', () => {
        const backupAirData = {
            latitude: 53.7596,
            longitude: 87.1467,
            european_aqi: [35]
        };

        render(<MapComponent airData={backupAirData} selectedTimeIndex={0} />);
        expect(mockMarkerAddTo).toHaveBeenCalled();
    });

    it('13. Удаляет маркер, если airData становится null или selectedTimeIndex сбрасывается', () => {
        const mockData = {
            latitude: 53.7596,
            longitude: 87.1467,
            hourly: { european_aqi: [25] }
        };

        const { rerender } = render(
            <MapComponent airData={mockData} selectedTimeIndex={0} />
        );

        mockMarkerRemove.mockClear();

        // airData становится null
        rerender(<MapComponent airData={null} selectedTimeIndex={0} />);
        expect(mockMarkerRemove).toHaveBeenCalled();

        // Возвращаем данные
        rerender(<MapComponent airData={mockData} selectedTimeIndex={0} />);

        // selectedTimeIndex становится undefined
        rerender(<MapComponent airData={mockData} selectedTimeIndex={undefined} />);
        expect(mockMarkerRemove).toHaveBeenCalled();
    });

    it('14. Стилизует маркер в режимах color, numeric и combo', () => {
        const mockData = {
            latitude: 53.7596,
            longitude: 87.1467,
            hourly: { european_aqi: [45] }
        };

        // Режим color
        const { rerender } = render(
            <MapComponent airData={mockData} selectedTimeIndex={0} viewMode="color" />
        );
        let markers = getCreatedMarkers();
        let markerEl = markers[markers.length - 1].element;
        expect(markerEl.className).toContain('map-marker--color');
        expect(markerEl.textContent).toBe('');

        // Режим numeric
        rerender(<MapComponent airData={mockData} selectedTimeIndex={0} viewMode="numeric" />);
        markerEl = markers[markers.length - 1].element;
        expect(markerEl.className).toContain('map-marker--numeric');
        expect(markerEl.textContent).toBe('45');

        // Режим combo
        rerender(<MapComponent airData={mockData} selectedTimeIndex={0} viewMode="combo" />);
        markerEl = markers[markers.length - 1].element;
        expect(markerEl.className).toContain('map-marker--combo');
        expect(markerEl.textContent).toBe('45');

        // Без указания режима (дефолт combo)
        rerender(<MapComponent airData={mockData} selectedTimeIndex={0} />);
        markerEl = markers[markers.length - 1].element;
        expect(markerEl.className).toContain('map-marker--combo');
    });

    it('15. Обновляет координаты уже созданного маркера при изменении lat и lon', () => {
        const mockData = {
            latitude: 53.7596,
            longitude: 87.1467,
            hourly: { european_aqi: [25] }
        };

        const { rerender } = render(
            <MapComponent lat={53.7596} lon={87.1467} airData={mockData} selectedTimeIndex={0} />
        );

        mockMarkerSetLngLat.mockClear();

        // Обновляем координаты
        rerender(
            <MapComponent lat={55.7558} lon={37.6173} airData={mockData} selectedTimeIndex={0} />
        );

        expect(mockMarkerSetLngLat).toHaveBeenCalledWith([37.6173, 55.7558]);
    });

    it('16. Не создает и не обновляет маркер, если координаты равны NaN', () => {
        const mockData = {
            hourly: { european_aqi: [25] }
        };

        // Передаем нечисловые координаты при первом рендере
        const { rerender } = render(
            <MapComponent lat="invalid" lon="invalid" airData={mockData} selectedTimeIndex={0} />
        );

        clearCreatedMarkers();

        // С валидными координатами маркер создается
        rerender(
            <MapComponent lat={55.7558} lon={37.6173} airData={mockData} selectedTimeIndex={0} />
        );

        mockMarkerSetLngLat.mockClear();

        // При смене на NaN setLngLat не вызывается
        rerender(
            <MapComponent lat="invalid" lon="invalid" airData={mockData} selectedTimeIndex={0} />
        );
        expect(mockMarkerSetLngLat).not.toHaveBeenCalled();
    });

    it('18. Не создает маркер, если на первом рендере aqi равен null', () => {
        const dataNullAqi = {
            latitude: 53.7596,
            longitude: 87.1467,
            hourly: { european_aqi: [null] }
        };

        render(<MapComponent airData={dataNullAqi} selectedTimeIndex={0} />);
        expect(mockMarkerAddTo).not.toHaveBeenCalled();
    });

    describe('19. Интерактивная обработка клика по карте (handleMapClick)', () => {
        it('игнорирует клик, если объект события пуст или отсутствует lngLat', () => {
            const onMapClick = vi.fn();
            render(<MapComponent onMapClick={onMapClick} />);
            const clickCall = mockMapOn.mock.calls.find(([event]) => event === 'click');
            expect(clickCall).toBeDefined();
            const clickHandler = clickCall[1];

            clickHandler(null);
            clickHandler({});
            expect(onMapClick).not.toHaveBeenCalled();
        });

        it('игнорирует клики по маркеру или контролам карты', () => {
            const onMapClick = vi.fn();
            const onLocationSelect = vi.fn();
            render(<MapComponent onMapClick={onMapClick} onLocationSelect={onLocationSelect} />);
            const clickCall = mockMapOn.mock.calls.find(([event]) => event === 'click');
            const clickHandler = clickCall[1];

            // 1. target с классом .map-marker
            const markerTarget = document.createElement('div');
            markerTarget.className = 'map-marker';
            clickHandler({
                lngLat: { lng: 30.5, lat: 60.1 },
                originalEvent: { target: markerTarget }
            });
            expect(onMapClick).not.toHaveBeenCalled();

            // 2. target внутри .maplibregl-popup
            const popupParent = document.createElement('div');
            popupParent.className = 'maplibregl-popup';
            const popupChild = document.createElement('span');
            popupParent.appendChild(popupChild);
            clickHandler({
                lngLat: { lng: 30.5, lat: 60.1 },
                originalEvent: { target: popupChild }
            });
            expect(onMapClick).not.toHaveBeenCalled();

            // 3. target внутри .maplibregl-ctrl
            const ctrlParent = document.createElement('div');
            ctrlParent.className = 'maplibregl-ctrl';
            const ctrlChild = document.createElement('button');
            ctrlParent.appendChild(ctrlChild);
            clickHandler({
                lngLat: { lng: 30.5, lat: 60.1 },
                originalEvent: { target: ctrlChild }
            });
            expect(onMapClick).not.toHaveBeenCalled();

            // 4. target внутри .maplibregl-marker
            const markerParent = document.createElement('div');
            markerParent.className = 'maplibregl-marker';
            const markerChild = document.createElement('div');
            markerParent.appendChild(markerChild);
            clickHandler({
                lngLat: { lng: 30.5, lat: 60.1 },
                originalEvent: { target: markerChild }
            });
            expect(onMapClick).not.toHaveBeenCalled();
        });

        it('игнорирует клик, если target содержится в markerElementRef', () => {
            const onMapClick = vi.fn();
            const mockData = {
                latitude: 53.7596,
                longitude: 87.1467,
                hourly: { european_aqi: [30] }
            };
            render(
                <MapComponent
                    lat={53.7596}
                    lon={87.1467}
                    airData={mockData}
                    selectedTimeIndex={0}
                    onMapClick={onMapClick}
                />
            );
            const clickCall = mockMapOn.mock.calls.find(([event]) => event === 'click');
            const clickHandler = clickCall[1];

            const markers = getCreatedMarkers();
            const markerEl = markers[markers.length - 1].element;
            const innerSpan = document.createElement('span');
            markerEl.appendChild(innerSpan);

            clickHandler({
                lngLat: { lng: 30.5, lat: 60.1 },
                originalEvent: { target: innerSpan }
            });
            expect(onMapClick).not.toHaveBeenCalled();
        });

        it('обновляет маркер и вызывает коллбэки при клике на свободную область карты', () => {
            const onMapClick = vi.fn();
            const onLocationSelect = vi.fn();
            const mockData = {
                latitude: 53.7596,
                longitude: 87.1467,
                hourly: { european_aqi: [30] }
            };
            const { rerender } = render(
                <MapComponent
                    lat={53.7596}
                    lon={87.1467}
                    airData={mockData}
                    selectedTimeIndex={0}
                    onMapClick={onMapClick}
                    onLocationSelect={onLocationSelect}
                />
            );

            mockFlyTo.mockClear();
            mockMarkerSetLngLat.mockClear();

            const clickCall = mockMapOn.mock.calls.find(([event]) => event === 'click');
            const clickHandler = clickCall[1];

            const canvas = document.createElement('canvas');
            clickHandler({
                lngLat: { lng: 37.61, lat: 55.75 },
                originalEvent: { target: canvas }
            });

            expect(mockMarkerSetLngLat).toHaveBeenCalledWith([37.61, 55.75]);
            expect(onMapClick).toHaveBeenCalledWith(55.75, 37.61);
            expect(onLocationSelect).toHaveBeenCalledWith({ lat: 55.75, lon: 37.61 });

            // Проверяем, что флаг isMapClick предотвращает flyTo при последующем обновлении lat/lon
            rerender(
                <MapComponent
                    lat={55.75}
                    lon={37.61}
                    airData={mockData}
                    selectedTimeIndex={0}
                    onMapClick={onMapClick}
                    onLocationSelect={onLocationSelect}
                />
            );
            expect(mockFlyTo).not.toHaveBeenCalled();
        });

        it('корректно очищает слушатели и маркер при размонтировании', () => {
            const mockData = {
                latitude: 53.7596,
                longitude: 87.1467,
                hourly: { european_aqi: [30] }
            };
            const { unmount } = render(
                <MapComponent
                    lat={53.7596}
                    lon={87.1467}
                    airData={mockData}
                    selectedTimeIndex={0}
                />
            );

            unmount();
            expect(mockMapOff).toHaveBeenCalledWith('click', expect.any(Function));
            expect(mockRemove).toHaveBeenCalled();
            expect(mockMarkerRemove).toHaveBeenCalled();
        });

        it('корректно обрабатывает обновление координат в null на втором рендере без вызова flyTo', () => {
            const { rerender } = render(<MapComponent lat={55.75} lon={37.61} />);
            mockFlyTo.mockClear();

            // Смена на null
            rerender(<MapComponent lat={null} lon={null} />);
            expect(mockFlyTo).not.toHaveBeenCalled();
        });
    });
});

describe('Переключение базовых растровых слоев и клик по маркеру', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearCreatedMarkers();
    });

    afterEach(() => {
        cleanup();
    });

    it('переключает видимость слоев при изменении activeBaseLayer="satellite"', () => {
        const { rerender } = render(<MapComponent lat={55.75} lon={37.61} activeBaseLayer="osm" />);
        expect(mockSetLayoutProperty).toHaveBeenCalledWith('osm-layer', 'visibility', 'visible');
        expect(mockSetLayoutProperty).toHaveBeenCalledWith('satellite-layer', 'visibility', 'none');

        mockSetLayoutProperty.mockClear();
        rerender(<MapComponent lat={55.75} lon={37.61} activeBaseLayer="satellite" />);
        expect(mockSetLayoutProperty).toHaveBeenCalledWith('osm-layer', 'visibility', 'none');
        expect(mockSetLayoutProperty).toHaveBeenCalledWith('satellite-layer', 'visibility', 'visible');
    });

    it('ограничивает максимальный зум только для спутника ESRI (maxZoom=17), сохраняя maxZoom=19 для OSM', () => {
        const { rerender } = render(<MapComponent lat={55.75} lon={37.61} activeBaseLayer="osm" />);
        expect(mockSetMaxZoom).toHaveBeenCalledWith(19);

        mockSetMaxZoom.mockClear();
        rerender(<MapComponent lat={55.75} lon={37.61} activeBaseLayer="satellite" />);
        expect(mockSetMaxZoom).toHaveBeenCalledWith(17);

        mockSetMaxZoom.mockClear();
        rerender(<MapComponent lat={55.75} lon={37.61} activeBaseLayer="osm" />);
        expect(mockSetMaxZoom).toHaveBeenCalledWith(19);
    });

    it('вызывает onMarkerClick при клике на маркер качества воздуха', () => {
        const mockOnMarkerClick = vi.fn();
        render(
            <MapComponent
                lat={55.75}
                lon={37.61}
                airData={{ latitude: 55.75, longitude: 37.61, hourly: { european_aqi: [30] } }}
                selectedTimeIndex={0}
                onMarkerClick={mockOnMarkerClick}
            />
        );
        const markers = getCreatedMarkers();
        expect(markers.length).toBeGreaterThan(0);
        const markerEl = markers[markers.length - 1].element;
        fireEvent.click(markerEl);
        expect(mockOnMarkerClick).toHaveBeenCalledTimes(1);
    });
});

describe('Повторное центрирование карты и маркера по recenterTrigger', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearCreatedMarkers();
    });

    afterEach(() => {
        cleanup();
    });

    it('выполняет flyTo и обновляет маркер при изменении recenterTrigger даже с неизменными lat/lon', () => {
        const mockData = {
            latitude: 55.75,
            longitude: 37.61,
            hourly: { european_aqi: [30] }
        };

        const { rerender } = render(
            <MapComponent
                lat={55.75}
                lon={37.61}
                airData={mockData}
                selectedTimeIndex={0}
                recenterTrigger={0}
            />
        );

        mockFlyTo.mockClear();
        mockMarkerSetLngLat.mockClear();

        // Пользователь нажал Enter в поиске для того же города, recenterTrigger инкрементировался
        rerender(
            <MapComponent
                lat={55.75}
                lon={37.61}
                airData={mockData}
                selectedTimeIndex={0}
                recenterTrigger={1}
            />
        );

        expect(mockFlyTo).toHaveBeenCalledTimes(1);
        expect(mockFlyTo).toHaveBeenCalledWith(expect.objectContaining({
            center: [37.61, 55.75],
            zoom: 11
        }));
        expect(mockMarkerSetLngLat).toHaveBeenCalledWith([37.61, 55.75]);
    });

    it('не вызывает flyTo при recenterTrigger, если координаты невалидны (NaN или null)', () => {
        const { rerender } = render(
            <MapComponent
                lat="invalid"
                lon="invalid"
                recenterTrigger={0}
            />
        );

        mockFlyTo.mockClear();
        rerender(
            <MapComponent
                lat="invalid"
                lon="invalid"
                recenterTrigger={1}
            />
        );

        expect(mockFlyTo).not.toHaveBeenCalled();
    });
});



