// MapComponent.jsx - карта и отрисовка данных
import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { osmStyle } from '../styles/mapStyle';

export default function MapComponent({ lat, lon, airData, selectedTimeIndex, viewMode }) {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const isFirstMount = useRef(true);

    useEffect(() => {
        if (map.current) return;

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: osmStyle, // Передаем вынесенный объект сюда
            center: [87.1467, 53.7596], // Новокузнецк
            zoom: 11,
        });

        map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

        return () => {
            if (map.current) {
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

        if (!map.current) return;
        if (lat == null || lon == null) return;

        map.current.flyTo({
            center: [lon, lat],
            zoom: 11
        });
    }, [lat, lon]);

    return (
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    );
}