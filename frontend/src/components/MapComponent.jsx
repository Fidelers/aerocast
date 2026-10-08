// MapComponent.jsx - карта и отрисовка данных
import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// import '../styles/Popup.css'; // POPUP DISABLED — используется RightAirPanel

import { osmStyle, SATELLITE_MAX_ZOOM, OSM_MAX_ZOOM } from '../styles/mapStyle';
import { getAqiInfo /*, getAqiRecommendation */ } from '../types'; // getAqiRecommendation — POPUP DISABLED
// import { parseIsoTimeString } from '../utils/timeUtils'; // POPUP DISABLED

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

export default function MapComponent({ lat, lon, airData, selectedTimeIndex, viewMode, onLocationSelect, onMapClick, onMarkerClick, activeBaseLayer = 'osm' }) {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const isFirstMount = useRef(true);
    const isMapClick = useRef(false);
    const markerRef = useRef(null);
    // const popupRef = useRef(null); // POPUP DISABLED — используется RightAirPanel
    const markerElementRef = useRef(null);
    const onLocationSelectRef = useRef(onLocationSelect);
    const onMapClickRef = useRef(onMapClick);
    const onMarkerClickRef = useRef(onMarkerClick);

    useEffect(() => {
        onMarkerClickRef.current = onMarkerClick;
    }, [onMarkerClick]);
    useEffect(() => {
        onLocationSelectRef.current = onLocationSelect;
    }, [onLocationSelect]);

    useEffect(() => {
        onMapClickRef.current = onMapClick;
    }, [onMapClick]);

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
            if (markerRef.current) {
                markerRef.current.setLngLat([lng, clickLat]);
            }
            isMapClick.current = true;
            if (onMapClickRef.current) {
                onMapClickRef.current(clickLat, lng);
            }
            if (onLocationSelectRef.current) {
                onLocationSelectRef.current({ lat: clickLat, lon: lng });
            }
        };

        map.current.on('click', handleMapClick);

        return () => {
            if (markerRef.current) {
                markerRef.current.remove();
                markerRef.current = null;
                markerElementRef.current = null;
            }
            map.current.off('click', handleMapClick);
            map.current.remove();
            map.current = null;
        };
    }, []);

    // Динамическое перемещение камеры при смене координат lat и lon
    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }

        if (isMapClick.current) {
            isMapClick.current = false;
            return;
        }

        if (lat == null || lon == null) return;

        map.current.flyTo({
            center: [lon, lat],
            zoom: 11,
            essential: true,
            speed: 1.2,
            curve: 1.42
        });
    }, [lat, lon]);
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

        const aqiInfo = getAqiInfo(aqi);

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
        if (mode === 'color') {
            el.textContent = '';
            el.className = `map-marker map-marker--color ${aqiInfo.cssClass}`;
            el.style.backgroundColor = aqiInfo.hex;
            el.style.color = '#ffffff';
        } else if (mode === 'numeric') {
            el.textContent = String(aqi);
            el.className = 'map-marker map-marker--numeric';
            el.style.backgroundColor = '#ffffff';
            el.style.color = '#1f2937';
        } else {
            // combo
            el.textContent = String(aqi);
            el.className = `map-marker map-marker--combo ${aqiInfo.cssClass}`;
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
    }, [airData, selectedTimeIndex, viewMode, lat, lon]);

    return (
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    );
}