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
import { isPointInCoverage } from './utils/russiaBoundary2026';
import PollutionDynamicsModal from './components/PollutionDynamicsModal';

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
    const [locationName, setLocationName] = useState('Новокузнецк, Россия');
    const [recenterTrigger, setRecenterTrigger] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [isAboutOpen, setIsAboutOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isDynamicsModalOpen, setIsDynamicsModalOpen] = useState(false);
    const handleOpenDynamicsModal = () => setIsDynamicsModalOpen(true);
    const handleCloseDynamicsModal = () => setIsDynamicsModalOpen(false);

    // Реактивное текущее время: авто-синхронизация при смене минут/часов и возврате на вкладку
    const [currentTime, setCurrentTime] = useState(() => referenceDate || new Date());

    useEffect(() => {
        if (referenceDate) {
            setCurrentTime(referenceDate);
            return;
        }

        const updateClock = () => {
            setCurrentTime(new Date());
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                updateClock();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', updateClock);

        const intervalId = setInterval(updateClock, 30000);

        // Точный таймер на границу следующей минуты (xx:xx:00)
        const nowMs = Date.now();
        const delayToNextMinute = Math.max(500, 60000 - (nowMs % 60000));
        const timeoutId = setTimeout(updateClock, delayToNextMinute);

        return () => {
            clearInterval(intervalId);
            clearTimeout(timeoutId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', updateClock);
        };
    }, [referenceDate]);

    const activeReferenceDate = referenceDate || currentTime;

    const [coverageWarning, setCoverageWarning] = useState(null);
    const [isCoverageWarningVisible, setIsCoverageWarningVisible] = useState(false);
    const warningTimerRef = useRef(null);
    const warningFadeTimerRef = useRef(null);

    const hideCoverageWarning = useCallback(() => {
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        if (warningFadeTimerRef.current) clearTimeout(warningFadeTimerRef.current);
        setIsCoverageWarningVisible(false);
        setCoverageWarning(null);
    }, []);

    const showCoverageWarning = useCallback((message) => {
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        if (warningFadeTimerRef.current) clearTimeout(warningFadeTimerRef.current);

        setCoverageWarning(message);
        setIsCoverageWarningVisible(true);

        warningTimerRef.current = setTimeout(() => {
            setIsCoverageWarningVisible(false);
            warningFadeTimerRef.current = setTimeout(() => {
                setCoverageWarning(null);
            }, 300);
        }, 5000);
    }, []);

    useEffect(() => {
        return () => {
            if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
            if (warningFadeTimerRef.current) clearTimeout(warningFadeTimerRef.current);
        };
    }, []);

    const [theme, setTheme] = useState(() => {
        if (typeof window === 'undefined') return 'light';
        const saved = localStorage.getItem('aerocast_theme');
        if (saved === 'dark' || saved === 'light') return saved;
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
    });

    const [isColorBlind, setIsColorBlind] = useState(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('aerocast_colorblind') === 'true';
    });

    const [colorBlindType, setColorBlindType] = useState(() => {
        if (typeof window === 'undefined') return 'okabe';
        return localStorage.getItem('aerocast_colorblind_type') || 'okabe';
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
            document.documentElement.setAttribute('data-colorblind-type', colorBlindType);
            localStorage.setItem('aerocast_colorblind', isColorBlind ? 'true' : 'false');
            localStorage.setItem('aerocast_colorblind_type', colorBlindType);
        }
    }, [isColorBlind, colorBlindType]);

    const [mascotMode, setMascotMode] = useState(() => {
        if (typeof window === 'undefined') return 'mascot';
        return localStorage.getItem('aerocast_mascot_mode') || 'mascot';
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('aerocast_mascot_mode', mascotMode);
        }
    }, [mascotMode]);

    // Высокоточная макросетка качества воздуха (500 точек)
    const { macroGrid } = useAirGrid({ baseUrl: API_BASE });

    const selectedIsoTime =
        selectedTimeIndex !== null && selectedTimeIndex !== undefined && airData?.hourly?.time?.[selectedTimeIndex]
            ? airData.hourly.time[selectedTimeIndex]
            : undefined;

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

                // Восстановление выбранного пользователем времени или инициализация текущим часом
                if (data?.hourly?.time?.length) {
                    let targetIndex = null;
                    const prevIndex = selectedTimeIndexRef.current;
                    const prevAirData = airDataRef.current;

                    if (prevIndex !== null && prevIndex !== undefined && prevAirData?.hourly?.time?.[prevIndex]) {
                        const prevTimestamp = prevAirData.hourly.time[prevIndex];
                        const matchedIndex = data.hourly.time.indexOf(prevTimestamp);
                        if (matchedIndex !== -1) {
                            targetIndex = matchedIndex;
                        } else {
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
                            if (targetIndex === null && prevIndex < data.hourly.time.length) {
                                targetIndex = prevIndex;
                            }
                        }
                    }

                    if (targetIndex === null) {
                        targetIndex = findDefaultTimeIndex(data.hourly.time, activeReferenceDate);
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

    // Переключение времени работает со срезом в памяти и не вызывает сетевых запросов
    const handleSelectTime = (newIndex) => {
        setSelectedTimeIndex(newIndex);
    };

    const handleViewModeChange = (mode) => {
        setViewMode(mode);
    };

    const handleLocationSelect = (loc, maybeLon, maybeName) => {
        setIsMobileSidebarOpen(false);
        let targetLat = null;
        let targetLon = null;
        let targetName = null;
        if (typeof loc === 'object' && loc !== null) {
            targetName = loc.name || loc.cityName || loc.display_name || null;
            if (loc.lat == null || loc.lon == null) {
                setCoords({ lat: null, lon: null });
                return;
            }
            const lat = Number(loc.lat);
            const lon = Number(loc.lon);
            if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
                targetLat = lat;
                targetLon = lon;
                setCoords({ lat, lon });
                if (targetName) setLocationName(targetName);
                else setLocationName(`Точка (${lat.toFixed(2)}, ${lon.toFixed(2)})`);
                setRecenterTrigger((prev) => prev + 1);
            }
        } else if (loc !== undefined && maybeLon !== undefined) {
            targetName = typeof maybeName === 'string' && maybeName.trim() ? maybeName.trim() : null;
            if (loc == null || maybeLon == null) {
                setCoords({ lat: null, lon: null });
                return;
            }
            const lat = Number(loc);
            const lon = Number(maybeLon);
            if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
                targetLat = lat;
                targetLon = lon;
                setCoords({ lat, lon });
                if (targetName) setLocationName(targetName);
                else setLocationName(`Точка (${lat.toFixed(2)}, ${lon.toFixed(2)})`);
                setRecenterTrigger((prev) => prev + 1);
            }
        }

        if (targetLat !== null && targetLon !== null) {
            if (!isPointInCoverage(targetLat, targetLon)) {
                showCoverageWarning('Эта территория не находится в пределах покрытия цветовым отображением');
            } else {
                hideCoverageWarning();
            }
        }
    };

    const isForecast = useMemo(() => {
        if (!selectedIsoTime) return false;
        return isForecastTime(selectedIsoTime, activeReferenceDate);
    }, [selectedIsoTime, activeReferenceDate]);

    return (
        <div className="layout">
            <Sidebar
                referenceDate={activeReferenceDate}
                airData={airData}
                selectedTimeIndex={selectedTimeIndex}
                coords={coords}
                locationName={locationName}
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
                mascotMode={mascotMode}
                activeBaseLayer={activeBaseLayer}
                onBaseLayerChange={handleBaseLayerChange}
                isColorBlind={isColorBlind}
                onColorBlindChange={setIsColorBlind}
                colorBlindType={colorBlindType}
                onColorBlindTypeChange={setColorBlindType}
                theme={theme}
                onThemeChange={setTheme}
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
                {coverageWarning && (
                    <div
                        className={`coverage-notification ${isCoverageWarningVisible ? 'coverage-notification--visible' : 'coverage-notification--hiding'}`}
                        role="alert"
                        data-testid="coverage-notification"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <svg
                            className="coverage-notification__icon"
                            viewBox="0 0 24 24"
                            width="18"
                            height="18"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <span className="coverage-notification__text">
                            {coverageWarning}
                        </span>
                        <button
                            type="button"
                            className="coverage-notification__close"
                            onClick={(e) => {
                                e.stopPropagation();
                                hideCoverageWarning();
                            }}
                            aria-label="Закрыть уведомление"
                            data-testid="coverage-notification-close"
                        >
                            &times;
                        </button>
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
                    colorBlindType={colorBlindType}
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
                colorBlindType={colorBlindType}
                onColorBlindTypeChange={setColorBlindType}
                mascotMode={mascotMode}
                onMascotModeChange={setMascotMode}
            />
            <RightAirPanel
                airData={airData}
                selectedTimeIndex={selectedTimeIndex}
                isOpen={isRightPanelOpen}
                onClose={() => setIsRightPanelOpen(false)}
                onOpen={() => setIsRightPanelOpen(true)}
                isColorBlind={isColorBlind}
                colorBlindType={colorBlindType}
                onOpenDynamicsModal={handleOpenDynamicsModal}
            />
            <PollutionDynamicsModal
                isOpen={isDynamicsModalOpen}
                onClose={handleCloseDynamicsModal}
                airData={airData}
                selectedTimeIndex={selectedTimeIndex}
                coords={coords}
                isColorBlind={isColorBlind}
                colorBlindType={colorBlindType}
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
