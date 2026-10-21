import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import MapComponent from './components/MapComponent';
import AboutModal from './components/AboutModal';
import SettingsModal from './components/SettingsModal';
import RightAirPanel from './components/RightAirPanel';
import LayerSwitcher from './components/LayerSwitcher';
import { findDefaultTimeIndex, parseIsoTimeString, formatDateKey, isForecastTime } from './utils/timeUtils';
import useAirGrid from './hooks/useAirGrid';

const DEFAULT_COORDS = {
    lat: 53.7596,
    lon: 87.1467
};

const API_BASE = import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : '';

function App({ referenceDate } = {}) {
    const [airData, setAirData] = useState(null);
    const [selectedTimeIndex, setSelectedTimeIndex] = useState(null);
    const [viewMode, setViewMode] = useState('combo');
    const [coords, setCoords] = useState(DEFAULT_COORDS);
    const [recenterTrigger, setRecenterTrigger] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [isAboutOpen, setIsAboutOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    // Управление темой сайта (тёмная / светлая)
    const [theme, setTheme] = useState(() => {
        if (typeof window === 'undefined') return 'light';
        const saved = localStorage.getItem('aerocast_theme');
        if (saved === 'dark' || saved === 'light') return saved;
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
    });

    // Режим для людей с цветовой слепотой (дальтоников)
    const [isColorBlind, setIsColorBlind] = useState(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('aerocast_colorblind') === 'true';
    });

    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('aerocast_theme', theme);
        }
    }, [theme]);

    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-colorblind', isColorBlind ? 'true' : 'false');
            localStorage.setItem('aerocast_colorblind', isColorBlind ? 'true' : 'false');
        }
    }, [isColorBlind]);

    // подключаем сетку качества воздуха (высокоточная макросетка на 500 точек)
    const { macroGrid } = useAirGrid({ baseUrl: API_BASE });

    // точная ISO-метка времени для синхронизации
    const selectedIsoTime =
        selectedTimeIndex !== null && selectedTimeIndex !== undefined && airData?.hourly?.time?.[selectedTimeIndex]
            ? airData.hourly.time[selectedTimeIndex]
            : undefined;

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

        fetch(`${API_BASE}/api/air-quality?lat=${coords.lat}&lon=${coords.lon}`)
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
        setIsMobileSidebarOpen(false);
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

    // Определение: выбран ли прогноз (будущий день или будущий час сегодняшнего дня)
    const isForecast = useMemo(() => {
        if (!selectedIsoTime) return false;
        return isForecastTime(selectedIsoTime, referenceDate || new Date());
    }, [selectedIsoTime, referenceDate]);

    return (
        <div className="layout">
            <Sidebar
                referenceDate={referenceDate}
                airData={airData}
                selectedTimeIndex={selectedTimeIndex}
                onSelectTime={handleSelectTime}
                onLocationSelect={handleLocationSelect}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                onOpenAbout={() => {
                    setIsMobileSidebarOpen(false);
                    setIsAboutOpen(true);
                }}
                onOpenSettings={() => {
                    setIsMobileSidebarOpen(false);
                    setIsSettingsOpen(true);
                }}
                isLoading={isLoading}
                loadError={loadError}
                isOpen={isMobileSidebarOpen}
                onClose={() => setIsMobileSidebarOpen(false)}
            />
            <div
                className={`sidebar-backdrop ${isMobileSidebarOpen ? 'sidebar-backdrop--visible' : ''}`}
                onClick={() => setIsMobileSidebarOpen(false)}
                aria-hidden="true"
            />
            <div className="map-container" style={{ position: 'relative', overflow: 'hidden' }}>
                <button
                    type="button"
                    className="mobile-menu-toggle"
                    onClick={() => setIsMobileSidebarOpen(true)}
                    aria-label="Открыть меню и поиск"
                    data-testid="mobile-menu-toggle"
                >
                    <svg className="mobile-menu-toggle__icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                    <span className="mobile-menu-toggle__title">Aerocast</span>
                    <span className="mobile-menu-toggle__divider" aria-hidden="true"></span>
                    <span className="mobile-menu-toggle__search-hint">
                        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        Поиск
                    </span>
                </button>
                {isForecast && (
                    <div
                        className="forecast-badge"
                        data-testid="forecast-badge"
                        role="status"
                        title="Отображаются прогнозные данные качества воздуха"
                    >
                        <span className="forecast-badge__dot" aria-hidden="true" />
                        <span className="forecast-badge__label">Прогноз</span>
                    </div>
                )}
                <MapComponent
                    lat={coords.lat}
                    lon={coords.lon}
                    airData={airData}
                    selectedTimeIndex={selectedTimeIndex}
                    selectedIsoTime={selectedIsoTime}
                    macroGrid={macroGrid}
                    viewMode={viewMode}
                    onMapClick={handleLocationSelect}
                    onMarkerClick={() => setIsRightPanelOpen(true)}
                    activeBaseLayer={activeBaseLayer}
                    recenterTrigger={recenterTrigger}
                    isColorBlind={isColorBlind}
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
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                theme={theme}
                onThemeChange={setTheme}
                isColorBlind={isColorBlind}
                onColorBlindChange={setIsColorBlind}
            />
            <RightAirPanel
                airData={airData}
                selectedTimeIndex={selectedTimeIndex}
                isOpen={isRightPanelOpen}
                onClose={() => setIsRightPanelOpen(false)}
                onOpen={() => setIsRightPanelOpen(true)}
                isColorBlind={isColorBlind}
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