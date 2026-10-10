import { useState, useEffect, useRef } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import MapComponent from './components/MapComponent';
import AboutModal from './components/AboutModal';
import RightAirPanel from './components/RightAirPanel';
import LayerSwitcher from './components/LayerSwitcher';
import { findDefaultTimeIndex, parseIsoTimeString } from './utils/timeUtils';

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
    const [recenterTrigger, setRecenterTrigger] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [isAboutOpen, setIsAboutOpen] = useState(false);
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

    // Сохранение выбранного слоя в localStorage под ключом aerocast_map_layer
    const [activeBaseLayer, setActiveBaseLayer] = useState(() => {
        return localStorage.getItem('aerocast_map_layer') || 'osm';
    });

    const handleBaseLayerChange = (layer) => {
        setActiveBaseLayer(layer);
        localStorage.setItem('aerocast_map_layer', layer);
    };

    const selectedTimeIndexRef = useRef(selectedTimeIndex);
    const airDataRef = useRef(airData);

    useEffect(() => {
        selectedTimeIndexRef.current = selectedTimeIndex;
    }, [selectedTimeIndex]);

    useEffect(() => {
        airDataRef.current = airData;
    }, [airData]);

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

                // Сохранение выбранного пользователем времени или инициализация дефолтным (текущий час)
                if (data?.hourly?.time?.length) {
                    let targetIndex = null;
                    const prevIndex = selectedTimeIndexRef.current;
                    const prevAirData = airDataRef.current;

                    if (prevIndex !== null && prevIndex !== undefined && prevAirData?.hourly?.time?.[prevIndex]) {
                        const prevTimestamp = prevAirData.hourly.time[prevIndex];
                        // 1. Поиск точного совпадения метки времени (например, 2026-10-01T09:00)
                        const matchedIndex = data.hourly.time.indexOf(prevTimestamp);
                        if (matchedIndex !== -1) {
                            targetIndex = matchedIndex;
                        } else {
                            // 2. Если точной строки нет, сопоставляем по дате и часу
                            const prevParsed = parseIsoTimeString(prevTimestamp);
                            if (prevParsed) {
                                const matchByDateHour = data.hourly.time.findIndex((t) => {
                                    const p = parseIsoTimeString(t);
                                    return p && p.dateStr === prevParsed.dateStr && p.hour === prevParsed.hour;
                                });
                                if (matchByDateHour !== -1) {
                                    targetIndex = matchByDateHour;
                                }
                            }
                            // 3. Если индекс в пределах длины массива
                            if (targetIndex === null && prevIndex < data.hourly.time.length) {
                                targetIndex = prevIndex;
                            }
                        }
                    }

                    if (targetIndex === null) {
                        targetIndex = findDefaultTimeIndex(data.hourly.time);
                    }

                    setSelectedTimeIndex(targetIndex);
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
            if (loc.lat == null || loc.lon == null) {
                setCoords({ lat: null, lon: null });
                return;
            }
            const lat = Number(loc.lat);
            const lon = Number(loc.lon);
            if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
                setCoords({ lat, lon });
                setRecenterTrigger((prev) => prev + 1);
            }
        } else if (loc !== undefined && maybeLon !== undefined) {
            if (loc == null || maybeLon == null) {
                setCoords({ lat: null, lon: null });
                return;
            }
            const lat = Number(loc);
            const lon = Number(maybeLon);
            if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
                setCoords({ lat, lon });
                setRecenterTrigger((prev) => prev + 1);
            }
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
                onOpenAbout={() => setIsAboutOpen(true)}
                isLoading={isLoading}
                loadError={loadError}
            />
            <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, position: 'relative', overflow: 'hidden' }}>
                <MapComponent
                    lat={coords.lat}
                    lon={coords.lon}
                    airData={airData}
                    selectedTimeIndex={selectedTimeIndex}
                    viewMode={viewMode}
                    onMapClick={handleLocationSelect}
                    onLocationSelect={handleLocationSelect}
                    onMarkerClick={() => setIsRightPanelOpen(true)}
                    activeBaseLayer={activeBaseLayer}
                    recenterTrigger={recenterTrigger}
                />
                <LayerSwitcher
                    activeLayer={activeBaseLayer}
                    onLayerChange={handleBaseLayerChange}
                />
            </div>
            <AboutModal
                isOpen={isAboutOpen}
                onClose={() => setIsAboutOpen(false)}
            />
            <RightAirPanel
                airData={airData}
                selectedTimeIndex={selectedTimeIndex}
                isOpen={isRightPanelOpen}
                onClose={() => setIsRightPanelOpen(false)}
                onOpen={() => setIsRightPanelOpen(true)}
            />
            {!isRightPanelOpen && (
                <button
                    type="button"
                    className="fab-open-panel"
                    data-testid="fab-open-panel"
                    onClick={() => setIsRightPanelOpen(true)}
                >
                    Показатели
                </button>
            )}
        </div>
    );
}

export default App;