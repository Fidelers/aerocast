// MapComponent.jsx - карта и отрисовка данных
import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { osmStyle } from '../styles/mapStyle';

export default function MapComponent() {
    const mapContainer = useRef(null);
    const map = useRef(null);

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

    return (
        // <div
        //     ref={mapContainer}
        //     style={{ width: '100%', height: '100vh', minHeight: '500px' }} // Временно абсолютные размеры сделал для проверки
        // />
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} /> // Размеры согласно родительскому контейнеру
    );
}