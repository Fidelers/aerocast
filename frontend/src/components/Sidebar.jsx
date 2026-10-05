// Sidebar.jsx - боковая панель: поиск, переключатели, навигация по времени
import { useMemo, useState, useRef, useEffect } from 'react';
import Logo from '../assets/icons/logo.svg';
import InfoIcon from '../assets/icons/info.svg';
import CitySearch from './CitySearch';
import AboutModal from './AboutModal';
import { groupTimesByDay } from '../utils/timeUtils';
import '../styles/Sidebar.css';

function Sidebar({
  airData,
  selectedTimeIndex = null,
  referenceDate,
  onSelectTime,
  onTimeSelect,
  viewMode = 'combo',
  onViewModeChange,
  onLocationSelect,
  onCitySelect,
  onOpenAbout,
  onLocateMe
}) {
  const handleSelectTime = onSelectTime || onTimeSelect;
  const [geoError, setGeoError] = useState(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isGeoLoading, setIsGeoLoading] = useState(false);
  const [isGeoErrorVisible, setIsGeoErrorVisible] = useState(false);

  const daysContainerRef = useRef(null);
  const hasInitialScrolledRef = useRef(false);

  const geoErrorTimerRef = useRef(null);
  const geoFadeTimerRef = useRef(null);

  // Очистка всех таймеров ошибки геолокации
  const clearGeoTimers = () => {
    if (geoErrorTimerRef.current) {
      clearTimeout(geoErrorTimerRef.current);
      geoErrorTimerRef.current = null;
    }
    if (geoFadeTimerRef.current) {
      clearTimeout(geoFadeTimerRef.current);
      geoFadeTimerRef.current = null;
    }
  };

  // Очистка таймеров ошибки при размонтировании
  useEffect(() => {
    return () => {
      clearGeoTimers();
    };
  }, []);

  // Установка ошибки с таймером
  const setGeoErrorWithTimeout = (message) => {
    clearGeoTimers();
    setGeoError(message);
    setIsGeoErrorVisible(true);

    geoErrorTimerRef.current = setTimeout(() => {
      setIsGeoErrorVisible(false);
      geoFadeTimerRef.current = setTimeout(() => {
        setGeoError(null);
        geoFadeTimerRef.current = null;
      }, 300);
      geoErrorTimerRef.current = null;
    }, 4700);
  };


  // Извлечение массива меток времени из airData
  const timeArray = useMemo(() => {
    return Array.isArray(airData?.hourly?.time) ? airData.hourly.time : [];
  }, [airData]);

  // Группировка массива time по суткам (отделение дат от часов)
  const days = useMemo(() => {
    return groupTimesByDay(timeArray, referenceDate);
  }, [timeArray, referenceDate]);

  // Выбранный пользователем день (для переключения списка часов)
  const [selectedDayStr, setSelectedDayStr] = useState(null);

  // Внутреннее состояние выбранного часа на случай неконтролируемого использования
  const [internalTimeIndex, setInternalTimeIndex] = useState(null);
  const activeTimeIndex = selectedTimeIndex !== null && selectedTimeIndex !== undefined
    ? selectedTimeIndex
    : internalTimeIndex;

  // Определение текущего отображаемого дня:
  // 1. Если пользователь явно кликнул на день и он есть в списке
  // 2. Иначе, если выбран час activeTimeIndex — день, содержащий этот час
  // 3. Иначе — сегодняшний день (isToday)
  // 4. Иначе — первый доступный день
  const currentDay = useMemo(() => {
    if (days.length === 0) return null;

    if (selectedDayStr) {
      const found = days.find((d) => d.dateStr === selectedDayStr);
      if (found) return found;
    }

    if (activeTimeIndex !== null && activeTimeIndex !== undefined) {
      const foundFromTime = days.find((d) =>
        d.hours.some((h) => h.index === activeTimeIndex)
      );
      if (foundFromTime) return foundFromTime;
    }

    const todayDay = days.find((d) => d.isToday);
    return todayDay || days[0];
  }, [days, selectedDayStr, activeTimeIndex]);

  // Автоматическая прокрутка к сегодняшнему (или активному) дню при начальной загрузке
  useEffect(() => {
    if (days.length === 0) return;
    if (hasInitialScrolledRef.current) return;

    const scrollContainer = () => {
      const container = daysContainerRef.current;
      const targetCard = container?.querySelector('[data-is-current="true"]') ||
                         container?.querySelector('.day-card--active') ||
                         container?.querySelector('[data-is-today="true"]');

      if (targetCard) {
        if (container.clientWidth > 0) {
          container.scrollLeft = targetCard.offsetLeft - (container.clientWidth - targetCard.offsetWidth) / 2;
        } else if (typeof targetCard.scrollIntoView === 'function') {
          try {
            targetCard.scrollIntoView({ inline: 'center', block: 'nearest' });
          } catch {
            // ignore
          }
        }
        hasInitialScrolledRef.current = true;
      }
    };

    scrollContainer();
    const frameId = requestAnimationFrame(scrollContainer);
    return () => cancelAnimationFrame(frameId);
  }, [days, currentDay]);

  // Клик по плитке дня: обновляет доступные часы в блоке .times
  const handleDayClick = (dateStr, e) => {
    setSelectedDayStr(dateStr);
    if (e?.currentTarget && typeof e.currentTarget.scrollIntoView === 'function') {
      try {
        e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
      } catch {
        // ignore
      }
    }
  };

  // Клик по плитке часа: вычисляет глобальный selectedTimeIndex и передает его наверх
  const handleHourClick = (globalIndex) => {
    setInternalTimeIndex(globalIndex);
    if (typeof handleSelectTime === 'function') {
      handleSelectTime(globalIndex);
    }
  };


  // Клик по кнопке местоположения 
  const handleLocationClick = () => {
    // Сброс существующей ошибки и таймеров
    clearGeoTimers();
    setGeoError(null);
    setIsGeoErrorVisible(false);

    if (typeof onLocateMe === 'function') {
      onLocateMe();
    }
    
    if (!navigator.geolocation) {
      setGeoErrorWithTimeout('Геолокация не поддерживается вашим браузером');
      return;
    }
    setIsGeoLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearGeoTimers();
        setGeoError(null);
        setIsGeoErrorVisible(false);
        if (typeof onLocationSelect === "function") {
          onLocationSelect(position.coords.latitude, position.coords.longitude, "");
        }
        setIsGeoLoading(false);
      },
      (err) => {
        let message = 'Не удалось определить местоположение.';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            message += ' Доступ к геолокации запрещён. Разрешите доступ в настройках браузера.';
            break;
          case err.POSITION_UNAVAILABLE:
            message += ' Информация о местоположении недоступна.';
            break;
          case err.TIMEOUT:
            message += ' Превышено время ожидания ответа от GPS.';
            break;
        }
        setGeoErrorWithTimeout(message);
        setIsGeoLoading(false);
      },
      { timeout: 10000, maximumAge: 60000 }
      
    );
  };
  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <div className="sidebar__brand">
          <img src={Logo} alt="AeroCast" className="sidebar__logo" />
          <div className="sidebar__title">Aerocast</div>
        </div>
        <a
          href="#"
          className="sidebar__info-btn"
          aria-label="Информация о проекте"
          onClick={(e) => {
            e.preventDefault();
            if (typeof onOpenAbout === 'function') {
              onOpenAbout();
            } else {
              setIsAboutOpen(true);
            }
          }}
        >
          <img src={InfoIcon} className="sidebar__info-icon" alt="" />
        </a>
      </div>

      <CitySearch
        onLocationSelect={(loc) => {
          if (typeof onLocationSelect === 'function') {
            if (onLocationSelect.length > 1) {
              onLocationSelect(loc.lat, loc.lon, loc.name);
            } else {
              onLocationSelect(loc);
            }
          }
          if (typeof onCitySelect === 'function') {
            onCitySelect(loc);
          }
        }}
        onCitySelect={onCitySelect}
      />

      <section className="display-mode">
        <h2 className="display-mode__title">Режим отображения</h2>
        <div className="segmented">
          <button
            type="button"
            className={`segmented__btn ${viewMode === 'color' ? 'segmented__btn--active' : ''}`}
            onClick={() => onViewModeChange?.('color')}
          >
            Цветовой
          </button>
          <button
            type="button"
            className={`segmented__btn ${viewMode === 'numeric' ? 'segmented__btn--active' : ''}`}
            onClick={() => onViewModeChange?.('numeric')}
          >
            Цифровой
          </button>
          <button
            type="button"
            className={`segmented__btn ${(!viewMode || viewMode === 'combo') ? 'segmented__btn--active' : ''}`}
            onClick={() => onViewModeChange?.('combo')}
          >
            Комбо
          </button>
        </div>
      </section>

      <section className="geo-nav">
        <h2 className="geo-nav__title">Навигация</h2>
        <button type="button" className="geo-nav__location-btn" onClick={handleLocationClick} disabled={isGeoLoading}>
          {isGeoLoading ? 'Определяем...' : 'Моё местоположение'}
        </button>
        {geoError && (
          <div className={`geo-nav__error ${isGeoErrorVisible ? 'geo-nav__error-fadein' : 'geo-nav__error-fadeout'}`}>
            ⚠️ {geoError}
          </div>
        )}
      </section>

      <section className="date-nav">
        <h2 className="date-nav__title">Навигация по времени</h2>
        <div className="days" ref={daysContainerRef}>
          {days.length === 0 ? (
            <span className="time-nav__empty">Нет данных о датах</span>
          ) : (
            days.map((day) => {
              const isDayActive = currentDay?.dateStr === day.dateStr;
              const cardClasses = [
                'day-card',
                day.isForecast ? 'day-card--forecast' : '',
                isDayActive ? 'day-card--active' : ''
              ].filter(Boolean).join(' ');

              return (
                <button
                  key={day.dateStr}
                  className={cardClasses}
                  type="button"
                  onClick={(e) => handleDayClick(day.dateStr, e)}
                  title={day.dateStr}
                  data-is-current={isDayActive ? 'true' : undefined}
                  data-is-today={day.isToday ? 'true' : undefined}
                >
                  <span className="day-card__label">{day.dayOfWeek}</span>
                  <span className="day-card__num">{day.dayOfMonth}</span>
                  {day.isToday && <span className="day-card__extra">сег</span>}
                  {!day.isToday && day.isForecast && (
                    <span className="day-card__extra">прог</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className="time-nav">
        <h2 className="time-nav__title">Время суток</h2>
        <div className="times">
          {!currentDay || currentDay.hours.length === 0 ? (
            <span className="time-nav__empty">Нет доступных часов</span>
          ) : (
            currentDay.hours.map((hourItem) => {
              const isHourActive = hourItem.index === activeTimeIndex;
              const timeClasses = [
                'time',
                isHourActive ? 'time--active' : ''
              ].filter(Boolean).join(' ');

              return (
                <button
                  key={hourItem.timeStr}
                  className={timeClasses}
                  type="button"
                  onClick={() => handleHourClick(hourItem.index)}
                >
                  {hourItem.timeLabel}
                </button>
              );
            })
          )}
        </div>
      </section>

      {!onOpenAbout && (
        <AboutModal
          isOpen={isAboutOpen}
          onClose={() => setIsAboutOpen(false)}
        />
      )}
    </aside>
  );
}

export default Sidebar;
