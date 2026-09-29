import { useState, useEffect } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import MapComponent from './components/MapComponent';
import { findDefaultTimeIndex } from './utils/timeUtils';

// Координаты по умолчанию: Новокузнецк
const DEFAULT_COORDS = {
    lat: 53.7596,
    lon: 87.1467
};

function App() {
    const [airData, setAirData] = useState(null);
    const [selectedTimeIndex, setSelectedTimeIndex] = useState(null);
    const [viewMode, setViewMode] = useState('combo');
    const [coords, setCoords] = useState(DEFAULT_COORDS);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);

    // Загрузка данных качества воздуха при монтировании и смене координат
    useEffect(() => {
        if (coords.lat == null || coords.lon == null) return;

        let isMounted = true;
        setIsLoading(true);
        setLoadError(null);
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';

        fetch(`${apiBase}/api/air-quality?lat=${coords.lat}&lon=${coords.lon}`)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Ошибка сервера: ${response.status}`);
                }
                return response.json();
            })
            .then((data) => {
                if (!isMounted) return;
                setAirData(data);
                setIsLoading(false);

                // Инициализация индекса времени (текущий час сегодня или ближайший)
                if (data?.hourly?.time?.length) {
                    const defaultIndex = findDefaultTimeIndex(data.hourly.time);
                    setSelectedTimeIndex(defaultIndex);
                }
            })
            .catch((error) => {
                if (!isMounted) return;
                console.error('Не удалось загрузить данные качества воздуха:', error);
                setLoadError(error.message);
                setIsLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [coords.lat, coords.lon]);

    // Обработчик выбора конкретного часа (переключение времени не вызывает сетевых запросов)
    const handleSelectTime = (newIndex) => {
        setSelectedTimeIndex(newIndex);
    };

    const handleViewModeChange = (mode) => {
        setViewMode(mode);
    };

    const handleLocationSelect = (loc, maybeLon) => {
        if (typeof loc === 'object' && loc !== null) {
            setCoords({ lat: Number(loc.lat), lon: Number(loc.lon) });
        } else if (loc !== undefined && maybeLon !== undefined) {
            setCoords({ lat: Number(loc), lon: Number(maybeLon) });
        }
    };

    return (
        <div className="layout">
            <Sidebar
                airData={airData}
                selectedTimeIndex={selectedTimeIndex}
                onSelectTime={handleSelectTime}
                onLocationSelect={handleLocationSelect}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                isLoading={isLoading}
                loadError={loadError}
            />
            <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}>
                <MapComponent
                    lat={coords.lat}
                    lon={coords.lon}
                    airData={airData}
                    selectedTimeIndex={selectedTimeIndex}
                    viewMode={viewMode}
                    onMapClick={handleLocationSelect}
                    onLocationSelect={handleLocationSelect}
                />
            </div>
        </div>
    );
}

export default App;