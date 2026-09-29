// MapComponent.jsx - карта и отрисовка данных
import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { osmStyle } from '../styles/mapStyle';
import { getAqiInfo } from '../types';

export default function MapComponent({ lat, lon, airData, selectedTimeIndex, viewMode, onLocationSelect, onMapClick }) {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const isFirstMount = useRef(true);
    const isMapClick = useRef(false);
    const markerRef = useRef(null);
    const markerElementRef = useRef(null);
    const onLocationSelectRef = useRef(onLocationSelect);
    const onMapClickRef = useRef(onMapClick);

    useEffect(() => {
        onLocationSelectRef.current = onLocationSelect;
    }, [onLocationSelect]);

    useEffect(() => {
        onMapClickRef.current = onMapClick;
    }, [onMapClick]);

    // Инициализация карты MapLibre
    useEffect(() => {
        if (map.current) return;

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: osmStyle,
            center: [87.1467, 53.7596], // Новокузнецк
            zoom: 11,
            maxZoom: 19,
        });

        map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

        const handleMapClick = (e) => {
            if (!e || !e.lngLat) return;
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
            if (map.current) {
                map.current.off('click', handleMapClick);
                map.current.remove();
                map.current = null;
            }
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

        if (!map.current) return;
        if (lat == null || lon == null) return;

        map.current.flyTo({
            center: [lon, lat],
            zoom: 11,
            essential: true,
            speed: 1.2,
            curve: 1.42
        });
    }, [lat, lon]);

    // Отрисовка маркера качества воздуха (EAQI)
    useEffect(() => {
        if (!airData || selectedTimeIndex === null || selectedTimeIndex === undefined) {
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

        if (!markerRef.current && map.current) {
            if (!Number.isNaN(markerLon) && !Number.isNaN(markerLat)) {
                const marker = new maplibregl.Marker({ element: el })
                    .setLngLat([markerLon, markerLat])
                    .addTo(map.current);
                markerRef.current = marker;
            }
        } else if (markerRef.current) {
            if (!Number.isNaN(markerLon) && !Number.isNaN(markerLat)) {
                markerRef.current.setLngLat([markerLon, markerLat]);
            }
        }
    }, [airData, selectedTimeIndex, viewMode, lat, lon]);

    return (
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    );
}