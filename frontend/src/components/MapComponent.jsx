import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// import '../styles/Popup.css'; // POPUP DISABLED — используется RightAirPanel

import { osmStyle, SATELLITE_MAX_ZOOM, OSM_MAX_ZOOM } from '../styles/mapStyle';
import { getAqiInfo /*, getAqiRecommendation */ } from '../types'; // getAqiRecommendation — POPUP DISABLED
import { createFieldCanvas, renderFieldToCanvas } from '../utils/canvasFieldRenderer';
import { parseIsoTimeString } from '../utils/timeUtils';
import russiaBoundaries from '../utils/russiaBoundary2026.js';

/* POPUP DISABLED — используется RightAirPanel
const POLLUTANTS = [
    { key: 'pm2_5', label: 'PM2.5' },
    { key: 'pm10', label: 'PM10' },
    { key: 'ozone', label: 'O3' },
    { key: 'nitrogen_dioxide', label: 'NO2' },
    { key: 'sulphur_dioxide', label: 'SO2' },
    { key: 'carbon_monoxide', label: 'CO' },
];

//Создание попапчика
function buildPopup(airData, selectedTimeIndex, lat, lon) {
    const hourly = airData?.hourly;

    const rows = POLLUTANTS.map(({ key, label }) => {
        const arr = hourly?.[key];
        const value = arr?.[selectedTimeIndex];
        const display = value != null && !Number.isNaN(value) ? `${value} μg/m³` : '—';
        return `<div class="map-popup__row"><span class="map-popup__label">${label}</span><span class="map-popup__value">${display}</span></div>`;
    }).join('');

    //Заполняем информацию про AQI для вывода
    const aqiList = hourly?.european_aqi || airData?.european_aqi;
    const aqiValue = aqiList?.[selectedTimeIndex];
    let aqiNumber = '—';
    let aqiLabel = '';
    let aqiColor = '#9ca3af';
    let recommendation = '';
    if (aqiValue != null && !Number.isNaN(aqiValue)) {
        const info = getAqiInfo(aqiValue);
        aqiNumber = String(aqiValue);
        aqiLabel = info.label;
        aqiColor = info.hex;

        const recommendationText = getAqiRecommendation(aqiValue);
        recommendation = `
            <div class="map-popup__recommendation">
                ${recommendationText}
            </div>
        `;
    }

    const source = airData?.used_source || 'open-meteo';

    const displayLat = lat != null ? Number(lat).toFixed(4) : (airData?.latitude != null ? Number(airData.latitude).toFixed(4) : '—');
    const displayLon = lon != null ? Number(lon).toFixed(4) : (airData?.longitude != null ? Number(airData.longitude).toFixed(4) : '—');

    const timeRaw = hourly?.time?.[selectedTimeIndex];
    let timeHtml = '';
    if (timeRaw) {
        const parsedTime = parseIsoTimeString(timeRaw);
        if (parsedTime) {
            timeHtml = `<p class="map-popup__time">Время: ${parsedTime.dateStr} ${parsedTime.timeLabel}</p>`;
        }
    }

    return `
        <div class="map-popup">
            <h3 class="map-popup__title">Качество воздуха</h3>
            <p class="map-popup__coords">Широта: ${displayLat}, Долгота: ${displayLon}</p>
            ${timeHtml}
            <p class="map-popup__source">Источник: ${source}</p>
            <div class="map-popup__aqi-block" style="background-color: ${aqiColor};">
                <div class="map-popup__aqi-title">
                    <span class="map-popup__aqi-label">AQI<br>(Европа)</span>
                </div>
                <div class="map-popup__aqi-info">
                    <span class="map-popup__aqi-number">${aqiNumber}</span>
                    <span class="map-popup__aqi-text">${aqiLabel}</span>
                </div>
            </div>
            <div class="map-popup__pollutants">
                ${rows}
            </div>

            ${recommendation}
        </div>
    `;

}
*/

const MACRO_SOURCE_ID = 'air-grid-macro-source';
const MACRO_LAYER_ID = 'air-grid-macro-layer';
const MACRO_POLLUTION_SOURCE_ID = 'air-grid-macro-pollution-source';
const MACRO_POLLUTION_LAYER_ID = 'air-grid-macro-pollution-layer';
const MICRO_SOURCE_ID = 'air-grid-micro-source';
const MICRO_LAYER_ID = 'air-grid-micro-layer';
const MICRO_POLLUTION_SOURCE_ID = 'air-grid-micro-pollution-source';
const MICRO_POLLUTION_LAYER_ID = 'air-grid-micro-pollution-layer';

// Преобразование bbox [minLon, minLat, maxLon, maxLat] в 4 координаты углов MapLibre image source
export function bboxToImageCoordinates(bbox) {
    if (!bbox || bbox.length !== 4) return null;
    const [minLon, minLat, maxLon, maxLat] = bbox;
    return [
        [minLon, maxLat], // Top-Left
        [maxLon, maxLat], // Top-Right
        [maxLon, minLat], // Bottom-Right
        [minLon, minLat]  // Bottom-Left
    ];
}

// Фиксированный bbox макро-слоя: покрывает ВСЮ территорию РФ
export const RUSSIA_MACRO_BBOX = [19.5, 41.0, 190.5, 82.0];
export const MACRO_GRID_CANVAS_SIZE = 600;

// Нормализация долгот маски государственной границы: Чукотка к востоку
export function normalizeBoundaryLongitudes(polygons) {
    if (!Array.isArray(polygons)) return polygons;
    return polygons.map((ring) => {
        if (!Array.isArray(ring)) return ring;
        return ring.map((pt) => (
            Array.isArray(pt) && typeof pt[0] === 'number' && pt[0] < 0
                ? [pt[0] + 360, pt[1]]
                : pt
        ));
    });
}

// Маска границы РФ с нормализованными долготами (вычисляется один раз на модуль)
const RUSSIA_BOUNDARIES_NORMALIZED = normalizeBoundaryLongitudes(russiaBoundaries);

// Расчет приближенного расстояния в километрах между двумя географическими координатами
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Радиус Земли в км
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Сопоставление временного среза сетки с выбранной меткой времени
export function resolveGridTimeIndex(grid, selectedIsoTime, fallbackIndex) {
    if (grid && Array.isArray(grid.time) && selectedIsoTime) {
        const exactIndex = grid.time.indexOf(selectedIsoTime);
        if (exactIndex !== -1) return exactIndex;

        const targetParsed = parseIsoTimeString(selectedIsoTime);
        if (targetParsed) {
            const dateHourIndex = grid.time.findIndex((t) => {
                const p = parseIsoTimeString(t);
                return p && p.dateStr === targetParsed.dateStr && p.hour === targetParsed.hour;
            });
            if (dateHourIndex !== -1) return dateHourIndex;
        }
    }
    return fallbackIndex ?? 0;
}

// Надежное ожидание готовности стиля MapLibre с поддержкой styledata
export function runWhenStyleReady(mapInstance, callback) {
    if (!mapInstance) return;
    if ((mapInstance.style && typeof mapInstance.getStyle === 'function' && mapInstance.getStyle()) ||
        (typeof mapInstance.isStyleLoaded === 'function' && mapInstance.isStyleLoaded())) {
        callback();
    } else if (typeof mapInstance.once === 'function') {
        const onReady = () => {
            if (mapInstance.style || (typeof mapInstance.isStyleLoaded === 'function' && mapInstance.isStyleLoaded())) {
                callback();
            } else {
                mapInstance.once('styledata', onReady);
            }
        };
        mapInstance.once('load', onReady);
        mapInstance.once('styledata', onReady);
    } else {
        callback();
    }
}

export default function MapComponent({
    lat,
    lon,
    airData,
    selectedTimeIndex,
    selectedIsoTime,
    viewMode,
    onLocationSelect,
    onMapClick,
    onMarkerClick,
    activeBaseLayer = 'osm',
    recenterTrigger,
    macroGrid = null,
    microGrid = null,
    onViewportMove = null,
    isColorBlind = false
}) {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const isFirstMount = useRef(true);
    const isMapClick = useRef(false);
    const clickedCoordsRef = useRef(null);
    const markerRef = useRef(null);
    // const popupRef = useRef(null); // POPUP DISABLED — используется RightAirPanel
    const markerElementRef = useRef(null);
    const onLocationSelectRef = useRef(onLocationSelect);
    const onMapClickRef = useRef(onMapClick);
    const onMarkerClickRef = useRef(onMarkerClick);
    const onViewportMoveRef = useRef(onViewportMove);

    const macroCanvasRef = useRef(null);
    const macroPollutionCanvasRef = useRef(null);
    const microCanvasRef = useRef(null);
    const microPollutionCanvasRef = useRef(null);
    const moveDebounceTimerRef = useRef(null);
    const activeMicroCenterRef = useRef(null);
    const macroGridRef = useRef(macroGrid);
    const microGridRef = useRef(microGrid);
    const selectedTimeIndexRef = useRef(selectedTimeIndex);
    const viewModeRef = useRef(viewMode);
    const updateLodOpacityRef = useRef(null);

    useEffect(() => {
        onMarkerClickRef.current = onMarkerClick;
    }, [onMarkerClick]);
    useEffect(() => {
        onLocationSelectRef.current = onLocationSelect;
    }, [onLocationSelect]);
    useEffect(() => {
        onMapClickRef.current = onMapClick;
    }, [onMapClick]);
    useEffect(() => {
        onViewportMoveRef.current = onViewportMove;
    }, [onViewportMove]);

    useEffect(() => {
        macroGridRef.current = macroGrid;
    }, [macroGrid]);
    useEffect(() => {
        microGridRef.current = microGrid;
        if (microGrid?.center) {
            activeMicroCenterRef.current = microGrid.center;
        } else if (microGrid?.bbox) {
            activeMicroCenterRef.current = {
                lat: (microGrid.bbox[1] + microGrid.bbox[3]) / 2,
                lon: (microGrid.bbox[0] + microGrid.bbox[2]) / 2
            };
        }
    }, [microGrid]);
    useEffect(() => {
        selectedTimeIndexRef.current = selectedTimeIndex;
    }, [selectedTimeIndex]);
    useEffect(() => {
        viewModeRef.current = viewMode;
        if (!map.current) return;
        const mapInstance = map.current;
        runWhenStyleReady(mapInstance, () => {
            if (updateLodOpacityRef.current) {
                updateLodOpacityRef.current();
            }
        });
    }, [viewMode]);

    // Инициализация карты MapLibre
    useEffect(() => {
        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: osmStyle,
            center: [87.1467, 53.7596], // Новокузнецк
            zoom: 11,
            maxZoom: activeBaseLayer === 'satellite' ? SATELLITE_MAX_ZOOM : OSM_MAX_ZOOM,
            attributionControl: false,
        });

        if (typeof window !== 'undefined') {
            window.__aerocastMap = map.current;
        }

        map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

        const handleMapClick = (e) => {
            if (!e || !e.lngLat) return;

            // Игнорируем клики по самому маркеру, попапу или элементам управления карты,
            // чтобы открытие попапа с прогнозом/историей не сбрасывало координаты и время
            const target = e.originalEvent?.target;
            const element = target instanceof Element ? target : target?.parentElement;
            if (
                element &&
                (
                    Boolean(element.closest && element.closest('.map-marker')) ||
                    Boolean(element.closest && element.closest('.maplibregl-marker')) ||
                    Boolean(element.closest && element.closest('.maplibregl-popup')) ||
                    Boolean(element.closest && element.closest('.maplibregl-ctrl')) ||
                    markerElementRef.current?.contains(element)
                )
            ) {
                return;
            }

            const { lng, lat: clickLat } = e.lngLat;
            clickedCoordsRef.current = { lat: clickLat, lon: lng };
            isMapClick.current = true;
            if (markerRef.current) {
                markerRef.current.setLngLat([lng, clickLat]);
            }
            if (onMapClickRef.current) {
                onMapClickRef.current(clickLat, lng);
            }
            if (onLocationSelectRef.current && onLocationSelectRef.current !== onMapClickRef.current) {
                onLocationSelectRef.current({ lat: clickLat, lon: lng });
            }
        };

        // Функция расчета и применения прозрачности слоев (LOD crossfade)
        const updateLodOpacity = () => {
            if (!map.current || typeof map.current.getZoom !== 'function') return;

            // В цифровом режиме растровые слои качества воздуха скрываются
            if (viewModeRef.current === 'numeric') {
                if (map.current.getLayer && map.current.getLayer(MACRO_LAYER_ID) && typeof map.current.setLayoutProperty === 'function') {
                    map.current.setLayoutProperty(MACRO_LAYER_ID, 'visibility', 'none');
                }
                if (map.current.getLayer && map.current.getLayer(MACRO_POLLUTION_LAYER_ID) && typeof map.current.setLayoutProperty === 'function') {
                    map.current.setLayoutProperty(MACRO_POLLUTION_LAYER_ID, 'visibility', 'none');
                }
                if (map.current.getLayer && map.current.getLayer(MICRO_LAYER_ID) && typeof map.current.setLayoutProperty === 'function') {
                    map.current.setLayoutProperty(MICRO_LAYER_ID, 'visibility', 'none');
                }
                if (map.current.getLayer && map.current.getLayer(MICRO_POLLUTION_LAYER_ID) && typeof map.current.setLayoutProperty === 'function') {
                    map.current.setLayoutProperty(MICRO_POLLUTION_LAYER_ID, 'visibility', 'none');
                }
                return;
            }

            // В цветовом и комбо режимах включаем видимость
            if (map.current.getLayer && map.current.getLayer(MACRO_LAYER_ID) && typeof map.current.setLayoutProperty === 'function') {
                map.current.setLayoutProperty(MACRO_LAYER_ID, 'visibility', 'visible');
            }
            if (map.current.getLayer && map.current.getLayer(MACRO_POLLUTION_LAYER_ID) && typeof map.current.setLayoutProperty === 'function') {
                map.current.setLayoutProperty(MACRO_POLLUTION_LAYER_ID, 'visibility', 'visible');
            }
            if (map.current.getLayer && map.current.getLayer(MICRO_LAYER_ID) && typeof map.current.setLayoutProperty === 'function') {
                map.current.setLayoutProperty(MICRO_LAYER_ID, 'visibility', 'visible');
            }
            if (map.current.getLayer && map.current.getLayer(MICRO_POLLUTION_LAYER_ID) && typeof map.current.setLayoutProperty === 'function') {
                map.current.setLayoutProperty(MICRO_POLLUTION_LAYER_ID, 'visibility', 'visible');
            }

            const currentZoom = map.current.getZoom();

            let macroOpacity;
            let microOpacity;

            if (currentZoom <= 8.5) {
                macroOpacity = 0.70;
                microOpacity = 0.0;
            } else if (currentZoom >= 9.0) {
                // Макросетка всегда видна при близком приближении
                macroOpacity = 0.70;
                microOpacity = microGridRef.current ? 0.70 : 0.0;
            } else {
                const t = (currentZoom - 8.5) / (9.0 - 8.5);
                macroOpacity = 0.70;
                microOpacity = microGridRef.current ? 0.70 * t : 0.0;
            }

            if (map.current.getLayer && map.current.getLayer(MACRO_LAYER_ID) && typeof map.current.setPaintProperty === 'function') {
                map.current.setPaintProperty(MACRO_LAYER_ID, 'raster-opacity', macroOpacity);
            }
            if (map.current.getLayer && map.current.getLayer(MICRO_LAYER_ID) && typeof map.current.setPaintProperty === 'function') {
                map.current.setPaintProperty(MICRO_LAYER_ID, 'raster-opacity', microOpacity);
            }
        };

        updateLodOpacityRef.current = updateLodOpacity;

        const handleMoveStart = () => {
            // Очищаем активный дебаунс-таймер перемещения
            if (moveDebounceTimerRef.current) {
                clearTimeout(moveDebounceTimerRef.current);
                moveDebounceTimerRef.current = null;
            }

            if (!map.current) return;
            const currentZoom = typeof map.current.getZoom === 'function' ? map.current.getZoom() : 11;

            // При zoom > 9 фоном отображается макро-слой (только в цветовом и комбо режимах)
            if (viewModeRef.current !== 'numeric' && currentZoom > 9 && map.current.getLayer && map.current.getLayer(MACRO_LAYER_ID) && typeof map.current.setPaintProperty === 'function') {
                map.current.setPaintProperty(MACRO_LAYER_ID, 'raster-opacity', microGridRef.current ? 0.50 : 0.70);
            }
        };

        const handleMoveEnd = () => {
            if (moveDebounceTimerRef.current) {
                clearTimeout(moveDebounceTimerRef.current);
            }

            // Возвращаем штатные значения LOD opacity после перемещения
            updateLodOpacity();

            // Дебаунс 500 мс перед расчетом смещения и возможным сетевым запросом
            moveDebounceTimerRef.current = setTimeout(() => {
                if (!map.current || typeof map.current.getCenter !== 'function') return;

                const center = map.current.getCenter();
                if (!center) return;

                const centerLng = center.lng != null ? center.lng : center[0];
                const centerLat = center.lat != null ? center.lat : center[1];

                const activeCenter = activeMicroCenterRef.current;
                if (!activeCenter) {
                    if (onViewportMoveRef.current) {
                        onViewportMoveRef.current({ lat: centerLat, lon: centerLng });
                    }
                    return;
                }

                // Расчет смещения от центра активной микро-сетки (~40 км диаметр / ~20 км радиус)
                // Смещение более 50% радиуса сетки (> 10-20 км)
                const distanceKm = calculateDistanceKm(activeCenter.lat, activeCenter.lon, centerLat, centerLng);
                const RADIUS_THRESHOLD_KM = 20;

                if (distanceKm > RADIUS_THRESHOLD_KM) {
                    if (onViewportMoveRef.current) {
                        onViewportMoveRef.current({ lat: centerLat, lon: centerLng });
                    }
                }
            }, 500);
        };

        map.current.on('click', handleMapClick);
        map.current.on('zoom', updateLodOpacity);
        map.current.on('movestart', handleMoveStart);
        map.current.on('moveend', handleMoveEnd);

        return () => {
            if (moveDebounceTimerRef.current) {
                clearTimeout(moveDebounceTimerRef.current);
                moveDebounceTimerRef.current = null;
            }
            if (markerRef.current) {
                markerRef.current.remove();
                markerRef.current = null;
                markerElementRef.current = null;
            }
            map.current.off('click', handleMapClick);
            map.current.off('zoom', updateLodOpacity);
            map.current.off('movestart', handleMoveStart);
            map.current.off('moveend', handleMoveEnd);
            map.current.remove();
            map.current = null;
        };
    }, []);

    // Динамическое перемещение камеры при смене координат lat и lon или принудительном recenterTrigger
    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }

        const numLat = Number(lat);
        const numLon = Number(lon);
        if (lat == null || lon == null || Number.isNaN(numLat) || Number.isNaN(numLon) || !map.current) return;

        // Если это клик по карте — не дергаем камеру flyTo, оставляем стабильный фокус
        if (isMapClick.current || (clickedCoordsRef.current && Math.abs(clickedCoordsRef.current.lat - numLat) < 0.0001 && Math.abs(clickedCoordsRef.current.lon - numLon) < 0.0001)) {
            isMapClick.current = false;
            clickedCoordsRef.current = null;
            if (markerRef.current) {
                markerRef.current.setLngLat([numLon, numLat]);
            }
            return;
        }

        map.current.flyTo({
            center: [numLon, numLat],
            zoom: 11,
            essential: true,
            speed: 1.2,
            curve: 1.42
        });

        if (markerRef.current) {
            markerRef.current.setLngLat([numLon, numLat]);
        }
    }, [lat, lon, recenterTrigger]);
    // переключение видимости слоев подложки (схема / спутник) и ограничение maxZoom для спутника
    useEffect(() => {
        if (!map.current) return;
        const isSatellite = activeBaseLayer === 'satellite';
        const targetMaxZoom = isSatellite ? SATELLITE_MAX_ZOOM : OSM_MAX_ZOOM;
        let isCancelled = false;

        // Ограничение максимального приближения только для спутника ESRI (maxZoom=17), сохраняя 19 для OSM
        if (typeof map.current.setMaxZoom === 'function') {
            map.current.setMaxZoom(targetMaxZoom);
        }

        // Если текущий зум превышает допустимый максимум для спутника, понижаем зум до targetMaxZoom
        if (isSatellite && typeof map.current.getZoom === 'function' && typeof map.current.setZoom === 'function') {
            try {
                if (map.current.getZoom() > targetMaxZoom) {
                    map.current.setZoom(targetMaxZoom);
                }
            } catch {
                // защитная обработка
            }
        }

        const updateLayers = () => {
            if (isCancelled || !map.current || typeof map.current.setLayoutProperty !== 'function') return;

            // Если стиль MapLibre еще не загрузился, ожидаем события загрузки стиля
            if (typeof map.current.isStyleLoaded === 'function' && !map.current.isStyleLoaded()) {
                const onLoaded = () => {
                    if (!isCancelled && map.current) {
                        updateLayers();
                    }
                };
                if (typeof map.current.once === 'function') {
                    map.current.once('load', onLoaded);
                    map.current.once('styledata', onLoaded);
                } else if (typeof map.current.on === 'function') {
                    map.current.on('load', onLoaded);
                }
                return;
            }

            try {
                if (!map.current.getLayer || map.current.getLayer('osm-layer')) {
                    map.current.setLayoutProperty('osm-layer', 'visibility', isSatellite ? 'none' : 'visible');
                }
                if (!map.current.getLayer || map.current.getLayer('satellite-layer')) {
                    map.current.setLayoutProperty('satellite-layer', 'visibility', isSatellite ? 'visible' : 'none');
                }
            } catch (err) {
                console.warn('Map style is not ready yet:', err);
            }
        };

        updateLayers();

        return () => {
            isCancelled = true;
        };
    }, [activeBaseLayer]);
    // Отрисовка маркера качества воздуха (EAQI) + привязка попапа
    useEffect(() => {
        if (!airData || selectedTimeIndex === null || selectedTimeIndex === undefined) {
            // POPUP DISABLED
            // if (popupRef.current) {
            //     popupRef.current.remove();
            //     popupRef.current = null;
            // }
            if (markerRef.current) {
                markerRef.current.remove();
                markerRef.current = null;
                markerElementRef.current = null;
            }
            return;
        }

        const aqiList = airData?.hourly?.european_aqi || airData?.european_aqi;
        const aqi = aqiList?.[selectedTimeIndex];

        if (aqi === null || aqi === undefined) {
            // POPUP DISABLED
            // if (popupRef.current) {
            //     popupRef.current.remove();
            //     popupRef.current = null;
            // }
            if (markerRef.current) {
                markerRef.current.remove();
                markerRef.current = null;
                markerElementRef.current = null;
            }
            return;
        }

        const aqiInfo = getAqiInfo(aqi, { colorBlind: isColorBlind });

        // Создаем или обновляем DOM-элемент маркера
        let el = markerElementRef.current;
        if (!el) {
            el = document.createElement('div');
            markerElementRef.current = el;
        }
            el.onclick = (e) => {
                if (onMarkerClickRef.current) {
                    onMarkerClickRef.current(e);
                }
            };
        const mode = viewMode || 'combo';
        const isPolluted = aqi > 40;
        const pulseClass = isPolluted ? 'map-marker--polluted-pulse' : '';
        if (mode === 'color') {
            el.textContent = '';
            el.className = `map-marker map-marker--color ${aqiInfo.cssClass} ${pulseClass}`.trim();
            el.style.backgroundColor = aqiInfo.hex;
            el.style.color = '#ffffff';
        } else if (mode === 'numeric') {
            el.textContent = String(aqi);
            el.className = `map-marker map-marker--numeric ${pulseClass}`.trim();
            el.style.backgroundColor = '#ffffff';
            el.style.color = '#1f2937';
        } else {
            // combo
            el.textContent = String(aqi);
            el.className = `map-marker map-marker--combo ${aqiInfo.cssClass} ${pulseClass}`.trim();
            el.style.backgroundColor = aqiInfo.hex;
            el.style.color = '#000000';
        }

        // Общие стили маркера
        el.style.width = '36px';
        el.style.height = '36px';
        el.style.borderRadius = '50%';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.fontWeight = 'bold';
        el.style.fontSize = '14px';
        el.style.cursor = 'pointer';
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        el.style.border = '2px solid white';

        const markerLon = lon != null ? Number(lon) : Number(airData?.longitude);
        const markerLat = lat != null ? Number(lat) : Number(airData?.latitude);

        if (!markerRef.current) {
            if (!Number.isNaN(markerLon) && !Number.isNaN(markerLat)) {
                // POPUP DISABLED — используется RightAirPanel
                // const popup = new maplibregl.Popup({
                //     closeButton: true,
                //     closeOnClick: false,
                //     className: 'air-quality-popup',
                // }).setHTML(buildPopup(airData, selectedTimeIndex, lat, lon));
                //
                // popupRef.current = popup;

                const marker = new maplibregl.Marker({ element: el })
                    .setLngLat([markerLon, markerLat])
                    // .setPopup(popup) // POPUP DISABLED
                    .addTo(map.current);
                markerRef.current = marker;
            }
        } else {
            if (!Number.isNaN(markerLon) && !Number.isNaN(markerLat)) {
                markerRef.current.setLngLat([markerLon, markerLat]);
            }
            // POPUP DISABLED — обновление попапа без его пересоздания
            // if (popupRef.current) {
            //     popupRef.current.setHTML(buildPopup(airData, selectedTimeIndex, lat, lon));
            // }
        }
    }, [airData, selectedTimeIndex, viewMode, lat, lon, isColorBlind]);

    // Эффект отрисовки и обновления макро-слоя (macroGrid) + пульсирующего слоя загрязнения (41-100+)
    useEffect(() => {
        if (!map.current || !macroGrid || !macroGrid.points) {
            return;
        }

        const mapInstance = map.current;
        // Макро-слой всегда рисуется в фиксированном bbox всей России,
        const gridBbox = RUSSIA_MACRO_BBOX;

        const coords = bboxToImageCoordinates(gridBbox);
        if (!coords) return;

        // 1. Инициализация рабочего Canvas буфера для базовой макро-сетки
        if (!macroCanvasRef.current) {
            macroCanvasRef.current = createFieldCanvas(MACRO_GRID_CANVAS_SIZE, MACRO_GRID_CANVAS_SIZE);
        }

        const canvas = macroCanvasRef.current;
        const timeIndex = resolveGridTimeIndex(macroGrid, selectedIsoTime, selectedTimeIndex);

        // Макро-сетка статична и рассчитывается строго по калиброванным опорным станциям
        const result = renderFieldToCanvas(canvas, macroGrid.points, gridBbox, {
            timeIndex,
            maskPolygons: RUSSIA_BOUNDARIES_NORMALIZED,
            useMercator: true,
            zoneMode: true,
            maxRadius: 10,
            decayRadius: 0.30,
            bgVal: 20,
            colorBlind: isColorBlind
        });
        const dataUrl = result.toDataUrl();
        if (!dataUrl) return;

        // 2. Инициализация и рендер отдельного пульсирующего слоя загрязнения (41-100+)
        if (!macroPollutionCanvasRef.current) {
            macroPollutionCanvasRef.current = createFieldCanvas(MACRO_GRID_CANVAS_SIZE, MACRO_GRID_CANVAS_SIZE);
        }
        const pollutionCanvas = macroPollutionCanvasRef.current;

// --- начало изменений: вычисляем уровень загрязнения и модулируем пульсацию ---
        const getMaxPollution = (grid) => {
            if (!grid) return 0;
            // 2D-массив
            if (Array.isArray(grid) && Array.isArray(grid[0])) {
                let max = 0;
                for (const row of grid) {
                    for (const v of row) {
                        if (typeof v === 'number' && v > max) max = v;
                    }
                }
                return max;
            }
            // плоский массив
            if (Array.isArray(grid)) {
                let max = 0;
                for (const v of grid) {
                    if (typeof v === 'number' && v > max) max = v;
                }
                return max;
            }
            // объект с data
            if (grid.data && Array.isArray(grid.data)) {
                let max = 0;
                for (const v of grid.data) {
                    if (typeof v === 'number' && v > max) max = v;
                }
                return max;
            }
            return 0;
        };

        const maxPollution = getMaxPollution(result.grid);

// Модуляция пульсации:
// <= 40 — пульсации нет (timeIndex = 0)
// 41–60 — плавно замедляем (коэффициент 0..1)
// 61–100 — плавно ускоряем до нормальной
// > 100 — как есть (коэффициент 1)
        let pulseTimeIndex = timeIndex;
        let pulseFadeDuration = 200;

        if (maxPollution <= 40) {
            pulseTimeIndex = 0;          // статичная картинка, без пульсации
            pulseFadeDuration = 0;
        } else if (maxPollution <= 60) {
            const factor = (maxPollution - 40) / 20; // 0..1
            pulseTimeIndex = timeIndex * factor;
            pulseFadeDuration = 200 + (1 - factor) * 800; // 200..1000 мс — чем ближе к 40, тем плавнее
        } else if (maxPollution <= 100) {
            const factor = (maxPollution - 60) / 40; // 0..1
            pulseTimeIndex = timeIndex * (0.3 + 0.7 * factor);
            pulseFadeDuration = 1000 - factor * 800; // 1000..200 мс
        }
// else > 100: pulseTimeIndex = timeIndex, pulseFadeDuration = 200 (без изменений)

        const pollutionResult = renderFieldToCanvas(pollutionCanvas, result.grid, gridBbox, {
            timeIndex: pulseTimeIndex,
            maskPolygons: RUSSIA_BOUNDARIES_NORMALIZED,
            useMercator: true,
            onlyPollution: true,
            colorBlind: isColorBlind
        });
// --- конец изменений ---

        const pollutionDataUrl = (pollutionResult?.hasPollution !== false) ? pollutionResult?.toDataUrl() : null;

        const applyMacroLayer = () => {
            if (!mapInstance || !mapInstance.getSource) return;

            const existingSource = mapInstance.getSource(MACRO_SOURCE_ID);
            const beforeLayerId = (mapInstance.getLayer && mapInstance.getLayer(MICRO_LAYER_ID))
                ? MICRO_LAYER_ID
                : 'map-marker';

            if (existingSource) {
                if (typeof existingSource.updateImage === 'function') {
                    existingSource.updateImage({
                        url: dataUrl,
                        coordinates: coords
                    });
                } else if (mapInstance.removeLayer && mapInstance.removeSource) {
                    if (mapInstance.getLayer && mapInstance.getLayer(MACRO_LAYER_ID)) {
                        mapInstance.removeLayer(MACRO_LAYER_ID);
                    }
                    mapInstance.removeSource(MACRO_SOURCE_ID);
                    mapInstance.addSource(MACRO_SOURCE_ID, {
                        type: 'image',
                        url: dataUrl,
                        coordinates: coords
                    });
                    mapInstance.addLayer({
                        id: MACRO_LAYER_ID,
                        type: 'raster',
                        source: MACRO_SOURCE_ID,
                        layout: {
                            visibility: viewModeRef.current === 'numeric' ? 'none' : 'visible'
                        },
                        paint: {
                            'raster-opacity': 0.70,
                            'raster-fade-duration': 300
                        }
                    }, beforeLayerId);
                }
            } else {
                mapInstance.addSource(MACRO_SOURCE_ID, {
                    type: 'image',
                    url: dataUrl,
                    coordinates: coords
                });

                mapInstance.addLayer({
                    id: MACRO_LAYER_ID,
                    type: 'raster',
                    source: MACRO_SOURCE_ID,
                    layout: {
                        visibility: viewModeRef.current === 'numeric' ? 'none' : 'visible'
                    },
                    paint: {
                        'raster-opacity': 0.70,
                        'raster-fade-duration': 300
                    }
                }, beforeLayerId);
            }

            // Управление пульсирующим слоем загрязнения макро-сетки (41-100+)
            if (pollutionDataUrl) {
                const existingPollutionSource = mapInstance.getSource(MACRO_POLLUTION_SOURCE_ID);
                if (existingPollutionSource) {
                    if (typeof existingPollutionSource.updateImage === 'function') {
                        existingPollutionSource.updateImage({
                            url: pollutionDataUrl,
                            coordinates: coords
                        });
                    } else if (mapInstance.removeLayer && mapInstance.removeSource) {
                        if (mapInstance.getLayer && mapInstance.getLayer(MACRO_POLLUTION_LAYER_ID)) {
                            mapInstance.removeLayer(MACRO_POLLUTION_LAYER_ID);
                        }
                        mapInstance.removeSource(MACRO_POLLUTION_SOURCE_ID);
                        mapInstance.addSource(MACRO_POLLUTION_SOURCE_ID, {
                            type: 'image',
                            url: pollutionDataUrl,
                            coordinates: coords
                        });
                        mapInstance.addLayer({
                            id: MACRO_POLLUTION_LAYER_ID,
                            type: 'raster',
                            source: MACRO_POLLUTION_SOURCE_ID,
                            layout: {
                                visibility: viewModeRef.current === 'numeric' ? 'none' : 'visible'
                            },
                            paint: {
                                'raster-opacity': 0.70,
                                'raster-fade-duration': pulseFadeDuration   // изменено
                            }
                        }, beforeLayerId);
                    }
                } else {
                    mapInstance.addSource(MACRO_POLLUTION_SOURCE_ID, {
                        type: 'image',
                        url: pollutionDataUrl,
                        coordinates: coords
                    });
                    mapInstance.addLayer({
                        id: MACRO_POLLUTION_LAYER_ID,
                        type: 'raster',
                        source: MACRO_POLLUTION_SOURCE_ID,
                        layout: {
                            visibility: viewModeRef.current === 'numeric' ? 'none' : 'visible'
                        },
                        paint: {
                            'raster-opacity': 0.70,
                            'raster-fade-duration': pulseFadeDuration   // изменено
                        }
                    }, beforeLayerId);
                }
            } else if (mapInstance.getLayer && mapInstance.getLayer(MACRO_POLLUTION_LAYER_ID) && typeof mapInstance.setLayoutProperty === 'function') {
                mapInstance.setLayoutProperty(MACRO_POLLUTION_LAYER_ID, 'visibility', 'none');
            }
        };

        runWhenStyleReady(mapInstance, () => {
            applyMacroLayer();
            if (updateLodOpacityRef.current) updateLodOpacityRef.current();
        });
    }, [macroGrid, selectedTimeIndex, selectedIsoTime, isColorBlind]);

    // Эффект отрисовки и обновления микро-слоя (microGrid)
    useEffect(() => {
        if (!map.current || !microGrid || !microGrid.points) {
            return;
        }

        const mapInstance = map.current;
        const baseBbox = microGrid.bbox || (
            microGrid.points.length ? [
                Math.min(...microGrid.points.map(p => p.lon)),
                Math.min(...microGrid.points.map(p => p.lat)),
                Math.max(...microGrid.points.map(p => p.lon)),
                Math.max(...microGrid.points.map(p => p.lat))
            ] : null
        );
        if (!baseBbox) return;

        let gridBbox = baseBbox;
        // Расширяем границы микро-слоя (если явно не выключено expandBbox: false),
        // чтобы до перехода зума на макро (зум 8.5–9.0) микро-градиент заполнял весь экран
        if (microGrid.expandBbox !== false) {
            const centerLon = microGrid.center?.lon ?? ((baseBbox[0] + baseBbox[2]) / 2);
            const centerLat = microGrid.center?.lat ?? ((baseBbox[1] + baseBbox[3]) / 2);
            const EXPAND_HALF_LON = 4.0;
            const EXPAND_HALF_LAT = 2.5;
            gridBbox = [
                Math.max(-180, Number((centerLon - EXPAND_HALF_LON).toFixed(4))),
                Math.max(-85, Number((centerLat - EXPAND_HALF_LAT).toFixed(4))),
                Math.min(180, Number((centerLon + EXPAND_HALF_LON).toFixed(4))),
                Math.min(85, Number((centerLat + EXPAND_HALF_LAT).toFixed(4)))
            ];
        }

        const coords = bboxToImageCoordinates(gridBbox);
        if (!coords) return;

        // 1. Инициализация рабочего Canvas буфера для микро-сетки
        if (!microCanvasRef.current) {
            microCanvasRef.current = createFieldCanvas(250, 250);
        }

        const canvas = microCanvasRef.current;
        const timeIndex = resolveGridTimeIndex(microGrid, selectedIsoTime, selectedTimeIndex);
        const result = renderFieldToCanvas(canvas, microGrid.points, gridBbox, {
            timeIndex,
            useMercator: true,
            zoneMode: true,
            colorBlind: isColorBlind
        });
        const dataUrl = result.toDataUrl();
        if (!dataUrl) return;

        // 2. Инициализация и рендер отдельного пульсирующего слоя загрязнения микро-сетки (41-100+)
        if (!microPollutionCanvasRef.current) {
            microPollutionCanvasRef.current = createFieldCanvas(250, 250);
        }
        const microPollutionCanvas = microPollutionCanvasRef.current;
        const microPollutionResult = renderFieldToCanvas(microPollutionCanvas, microGrid.points, gridBbox, {
            timeIndex,
            useMercator: true,
            onlyPollution: true,
            colorBlind: isColorBlind
        });
        const microPollutionDataUrl = (microPollutionResult?.hasPollution !== false) ? microPollutionResult?.toDataUrl() : null;

        const applyMicroLayer = () => {
            if (!mapInstance || !mapInstance.getSource) return;

            const existingSource = mapInstance.getSource(MICRO_SOURCE_ID);
            if (existingSource) {
                if (typeof existingSource.updateImage === 'function') {
                    existingSource.updateImage({
                        url: dataUrl,
                        coordinates: coords
                    });
                } else if (mapInstance.removeLayer && mapInstance.removeSource) {
                    if (mapInstance.getLayer && mapInstance.getLayer(MICRO_LAYER_ID)) {
                        mapInstance.removeLayer(MICRO_LAYER_ID);
                    }
                    mapInstance.removeSource(MICRO_SOURCE_ID);
                    mapInstance.addSource(MICRO_SOURCE_ID, {
                        type: 'image',
                        url: dataUrl,
                        coordinates: coords
                    });
                    mapInstance.addLayer({
                        id: MICRO_LAYER_ID,
                        type: 'raster',
                        source: MICRO_SOURCE_ID,
                        layout: {
                            visibility: viewModeRef.current === 'numeric' ? 'none' : 'visible'
                        },
                        paint: {
                            'raster-opacity': 0.70,
                            'raster-fade-duration': 300
                        }
                    }, 'map-marker');
                }
            } else {
                mapInstance.addSource(MICRO_SOURCE_ID, {
                    type: 'image',
                    url: dataUrl,
                    coordinates: coords
                });

                const currentZoom = typeof mapInstance.getZoom === 'function' ? mapInstance.getZoom() : 11;
                let initialOpacity = 0.0;
                if (currentZoom >= 9.0) {
                    initialOpacity = 0.70;
                } else if (currentZoom > 8.5) {
                    const t = (currentZoom - 8.5) / 0.5;
                    initialOpacity = 0.70 * t;
                }

                mapInstance.addLayer({
                    id: MICRO_LAYER_ID,
                    type: 'raster',
                    source: MICRO_SOURCE_ID,
                    layout: {
                        visibility: viewModeRef.current === 'numeric' ? 'none' : 'visible'
                    },
                    paint: {
                        'raster-opacity': initialOpacity,
                        'raster-fade-duration': 300
                    }
                }, 'map-marker');
            }

            // Управление пульсирующим слоем загрязнения микро-сетки (41-100+)
            if (microPollutionDataUrl) {
                const existingMicroPollutionSource = mapInstance.getSource(MICRO_POLLUTION_SOURCE_ID);
                if (existingMicroPollutionSource) {
                    if (typeof existingMicroPollutionSource.updateImage === 'function') {
                        existingMicroPollutionSource.updateImage({
                            url: microPollutionDataUrl,
                            coordinates: coords
                        });
                    } else if (mapInstance.removeLayer && mapInstance.removeSource) {
                        if (mapInstance.getLayer && mapInstance.getLayer(MICRO_POLLUTION_LAYER_ID)) {
                            mapInstance.removeLayer(MICRO_POLLUTION_LAYER_ID);
                        }
                        mapInstance.removeSource(MICRO_POLLUTION_SOURCE_ID);
                        mapInstance.addSource(MICRO_POLLUTION_SOURCE_ID, {
                            type: 'image',
                            url: microPollutionDataUrl,
                            coordinates: coords
                        });
                        mapInstance.addLayer({
                            id: MICRO_POLLUTION_LAYER_ID,
                            type: 'raster',
                            source: MICRO_POLLUTION_SOURCE_ID,
                            layout: {
                                visibility: viewModeRef.current === 'numeric' ? 'none' : 'visible'
                            },
                            paint: {
                                'raster-opacity': 0.70,
                                'raster-fade-duration': 200
                            }
                        }, 'map-marker');
                    }
                } else {
                    mapInstance.addSource(MICRO_POLLUTION_SOURCE_ID, {
                        type: 'image',
                        url: microPollutionDataUrl,
                        coordinates: coords
                    });
                    mapInstance.addLayer({
                        id: MICRO_POLLUTION_LAYER_ID,
                        type: 'raster',
                        source: MICRO_POLLUTION_SOURCE_ID,
                        layout: {
                            visibility: viewModeRef.current === 'numeric' ? 'none' : 'visible'
                        },
                        paint: {
                            'raster-opacity': 0.70,
                            'raster-fade-duration': 200
                        }
                    }, 'map-marker');
                }
            } else if (mapInstance.getLayer && mapInstance.getLayer(MICRO_POLLUTION_LAYER_ID) && typeof mapInstance.setLayoutProperty === 'function') {
                mapInstance.setLayoutProperty(MICRO_POLLUTION_LAYER_ID, 'visibility', 'none');
            }

            // Гарантируем, что макро-слой всегда располагается СТРОГО ПОД микро-слоем
            if (mapInstance.getLayer && mapInstance.getLayer(MACRO_LAYER_ID) && mapInstance.getLayer(MICRO_LAYER_ID) && typeof mapInstance.moveLayer === 'function') {
                try {
                    mapInstance.moveLayer(MACRO_LAYER_ID, MICRO_LAYER_ID);
                } catch {
                    // защитная обработка
                }
            }
        };

        runWhenStyleReady(mapInstance, () => {
            applyMicroLayer();
            if (updateLodOpacityRef.current) updateLodOpacityRef.current();
        });
    }, [microGrid, selectedTimeIndex, selectedIsoTime, isColorBlind]);

    // Анимация пульсирования загрязненных зон (41-100+) на карте синхронно с маркером
    useEffect(() => {
        let animId = null;

        const animate = (time) => {
            if (map.current) {
                // Пульсирование с периодом 2.2 секунды
                const phase = (time % 2200) / 2200;
                const sinVal = (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2;
                // Плавное мягкое дыхание загрязненных областей от 0.25 до 0.85 непрозрачности
                const pulseOpacity = 0.25 + 0.60 * sinVal;

                if (viewModeRef.current !== 'numeric') {
                    if (map.current.getLayer && map.current.getLayer(MACRO_POLLUTION_LAYER_ID) && typeof map.current.setPaintProperty === 'function') {
                        map.current.setPaintProperty(MACRO_POLLUTION_LAYER_ID, 'raster-opacity', pulseOpacity);
                    }
                    if (map.current.getLayer && map.current.getLayer(MICRO_POLLUTION_LAYER_ID) && typeof map.current.setPaintProperty === 'function') {
                        map.current.setPaintProperty(MICRO_POLLUTION_LAYER_ID, 'raster-opacity', pulseOpacity);
                    }
                }
            }
            animId = requestAnimationFrame(animate);
        };

        animId = requestAnimationFrame(animate);

        return () => {
            if (animId) {
                cancelAnimationFrame(animId);
            }
        };
    }, []);

    return (
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    );
}