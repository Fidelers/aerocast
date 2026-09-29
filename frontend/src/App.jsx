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
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);

    // Загрузка данных качества воздуха при монтировании (кэшируются в памяти приложения)
    useEffect(() => {
        let isMounted = true;
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';

        fetch(`${apiBase}/api/air-quality?lat=${DEFAULT_COORDS.lat}&lon=${DEFAULT_COORDS.lon}`)
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
    }, []);

    // Обработчик выбора конкретного часа (переключение времени не вызывает сетевых запросов)
    const handleSelectTime = (newIndex) => {
        setSelectedTimeIndex(newIndex);
    };

    const handleViewModeChange = (mode) => {
        setViewMode(mode);
    };

    return (
        <div className="layout">
            <Sidebar
                airData={airData}
                selectedTimeIndex={selectedTimeIndex}
                onSelectTime={handleSelectTime}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                isLoading={isLoading}
                loadError={loadError}
            />
            <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}>
                <MapComponent
                    airData={airData}
                    selectedTimeIndex={selectedTimeIndex}
                    viewMode={viewMode}
                />
            </div>
        </div>
    );
}

export default App;