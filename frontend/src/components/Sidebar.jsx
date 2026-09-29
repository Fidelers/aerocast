// Sidebar.jsx - боковая панель: поиск, переключатели, навигация по времени
import { useMemo, useState } from 'react';
import Logo from '../assets/icons/logo.svg';
import InfoIcon from '../assets/icons/info.svg';
import CitySearch from './CitySearch';
import { groupTimesByDay, formatDateKey } from '../utils/timeUtils';
import '../styles/Sidebar.css';

function Sidebar({
  airData,
  selectedTimeIndex = null,
  onSelectTime,
  onTimeSelect,
  viewMode = 'combo',
  onViewModeChange,
  onLocationSelect,
  onCitySelect,
  isLoading,
  loadError
}) {
  const handleSelectTime = onSelectTime || onTimeSelect;
  const [geoError, setGeoError] = useState(null);

  // Извлечение массива меток времени из airData
  const timeArray = useMemo(() => {
    return Array.isArray(airData?.hourly?.time) ? airData.hourly.time : [];
  }, [airData]);

  // Группировка массива time по суткам (отделение дат от часов)
  const days = useMemo(() => {
    return groupTimesByDay(timeArray);
  }, [timeArray]);

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

  // Клик по плитке дня: обновляет доступные часы в блоке .times
  const handleDayClick = (dateStr) => {
    setSelectedDayStr(dateStr);
  };

  // Клик по плитке часа: вычисляет глобальный selectedTimeIndex и передает его наверх
  const handleHourClick = (globalIndex) => {
    setInternalTimeIndex(globalIndex);
    if (typeof handleSelectTime === 'function') {
      handleSelectTime(globalIndex);
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <div className="sidebar__brand">
          <img src={Logo} alt="AeroCast" className="sidebar__logo" />
          <div className="sidebar__title">Aerocast</div>
        </div>
        <a href="#" className="sidebar__info-btn" aria-label="Информация о проекте">
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
        <button type="button" className="geo-nav__location-btn">
          Моё местоположение
        </button>
      </section>

      <section className="date-nav">
        <h2 className="date-nav__title">Навигация по времени</h2>
        <div className="days">
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
                  onClick={() => handleDayClick(day.dateStr)}
                  title={day.dateStr}
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
                  key={hourItem.timeStr || hourItem.index}
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

      <section className="aqi-scale">
        <h2 className="aqi-scale__title">Шкала AQI</h2>
        <ul className="aqi-scale__list">
          <li className="aqi-row">
            <span className="aqi-row__dot aqi-excellent" style={{ backgroundColor: '#00cc00' }} />
            <span className="aqi-row__range">0-20</span>
            <span className="aqi-row__label">Отлично</span>
          </li>
          <li className="aqi-row aqi-good">
            <span className="aqi-row__dot" style={{ backgroundColor: '#66ff66' }} />
            <span className="aqi-row__range">21-40</span>
            <span className="aqi-row__label">Хорошо</span>
          </li>
          <li className="aqi-row aqi-fair">
            <span className="aqi-row__dot aqi-good" style={{ backgroundColor: '#f7f21a' }} />
            <span className="aqi-row__range">41-60</span>
            <span className="aqi-row__label">Удовлетворительно</span>
          </li>
          <li className="aqi-row aqi-poor">
            <span className="aqi-row__dot" style={{ backgroundColor: '#ffa500' }} />
            <span className="aqi-row__range">61-80</span>
            <span className="aqi-row__label">Плохо</span>
          </li>
          <li className="aqi-row aqi-very-poor">
            <span className="aqi-row__dot" style={{ backgroundColor: '#ff0000' }} />
            <span className="aqi-row__range">80-100</span>
            <span className="aqi-row__label">Очень плохо</span>
          </li>
          <li className="aqi-row aqi-hazardous">
            <span className="aqi-row__dot" style={{ backgroundColor: '#c20000' }} />
            <span className="aqi-row__range">100+</span>
            <span className="aqi-row__label">Опасно</span>
          </li>
        </ul>
      </section>
    </aside>
  );
}

export default Sidebar;
