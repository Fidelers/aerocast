import React, { useEffect } from 'react';
import DynamicsChart from './DynamicsChart';
import { parseIsoTimeString } from '../utils/timeUtils';
import '../styles/PollutionDynamicsModal.css';

//измеряемые загрязнители
const POLLUTANTS_CONFIG = [
  { key: 'pm2_5', label: 'PM2.5', color: '#3b82f6' },
  { key: 'pm10', label: 'PM10', color: '#10b981' },
  { key: 'nitrogen_dioxide', label: 'NO2', color: '#f59e0b' },
  { key: 'sulphur_dioxide', label: 'SO2', color: '#8b5cf6' },
  { key: 'ozone', label: 'O3', color: '#ec4899' },
  { key: 'carbon_monoxide', label: 'CO', color: '#6366f1' },
];


// форматирование даты в нужный формат
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(`${dateStr}`);
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      weekday: 'short',
    }).format(date);
  } catch {
    return dateStr;
  }
};


const buildHourRecord = (isoTime, idx, hourlyData, isCurrent) => {
  const parsed = parseIsoTimeString(isoTime);
  return {
    time: isoTime,
    hourLabel: parsed?.timeStr || isoTime.split('T')[1]?.slice(0, 5) || '00:00',
    isCurrent,
    aqi: hourlyData.european_aqi?.[idx] ?? null,
    european_aqi: hourlyData.european_aqi?.[idx] ?? null,
    pm2_5: hourlyData.pm2_5?.[idx] ?? null,
    pm10: hourlyData.pm10?.[idx] ?? null,
    nitrogen_dioxide: hourlyData.nitrogen_dioxide?.[idx] ?? null,
    sulphur_dioxide: hourlyData.sulphur_dioxide?.[idx] ?? null,
    ozone: hourlyData.ozone?.[idx] ?? null,
    carbon_monoxide: hourlyData.carbon_monoxide?.[idx] ?? null,
  };
};


export default function PollutionDynamicsModal({
  isOpen = false,
  onClose,
  airData,
  selectedTimeIndex = 0,
  coords,
  isColorBlind = false,
  colorBlindType = 'okabe',
}) {

  // закрыть чтоб на ескейп
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);


  //блокировка прокрутки фона страницы при открытом окне
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // защита чтоб если окно закрыто оно не рендерилось 
  if (!isOpen || !airData || !airData.hourly || !Array.isArray(airData.hourly.time) || airData.hourly.time.length === 0) {
    return null;
  }

  // безопасный индекс времени
  const totalHours = airData.hourly.time.length;
  const safeIdx = (selectedTimeIndex !== null && selectedTimeIndex !== undefined && selectedTimeIndex >= 0 && selectedTimeIndex < totalHours)
    ? selectedTimeIndex
    : 0;

  // определяем выбранный день
  const currentIso = airData.hourly.time[safeIdx] || '';
  const parsedCurrent = parseIsoTimeString(currentIso);
  const selectedDateStr = parsedCurrent?.dateStr || currentIso.split('T')[0] || '';

  // фильтруем ровно 24 часа за выбранные сутки
  const dayData = [];
  let activeHourInDay = 0;

  airData.hourly.time.forEach((t, idx) => {
    const parsed = parseIsoTimeString(t);
    if (parsed && parsed.dateStr === selectedDateStr) {
      const isCurrent = idx === safeIdx;
      if (isCurrent) {
        activeHourInDay = dayData.length;
      }
      dayData.push(buildHourRecord(t, idx, airData.hourly, isCurrent));
    }
  });

  // Если фильтрация не дала результатов, берём первые 24 часа
  const finalDayData =
    dayData.length > 0
      ? dayData
      : airData.hourly.time.slice(0, 24).map((t, idx) =>
          buildHourRecord(t, idx, airData.hourly, idx === safeIdx)
        );

  // координаты для шапки
  const latVal = coords?.lat ?? airData?.latitude;
  const lonVal = coords?.lon ?? airData?.longitude;
  const latStr = latVal != null ? Number(latVal).toFixed(4) : '';
  const lonStr = lonVal != null ? Number(lonVal).toFixed(4) : '';

  return (
    <div
      className="dynamics-modal-overlay"
      data-testid="dynamics-modal-overlay"
      onClick={onClose}
    >
      <div
        className="dynamics-modal-content"
        role="dialog"
        aria-modal="true"
        data-colorblind={isColorBlind ? 'true' : 'false'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dynamics-modal-header">
          <div className="dynamics-modal-header-content">
          <h2>Суточная динамика качества воздуха</h2>
          <div className="dynamics-modal-meta">
            <span>Дата: {formatDate(selectedDateStr)}</span>
            {latStr && lonStr && <span>Координаты: {latStr}, {lonStr}</span>}
          </div>
        </div>
        <button
          type="button"
          className="dynamics-modal-close"
          onClick={onClose}
          aria-label="Закрыть окно"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div className="dynamics-modal-scroll-area">
        <div className="dynamics-modal-main-chart" data-testid="dynamics-modal-main-chart">
          <h3>Общий индекс качества воздуха (EAQI)</h3>
          <DynamicsChart
            mode="aqi"
            data={finalDayData}
            valueKey="aqi"
            unit="EAQI"
            activeIndex={activeHourInDay}
            isColorBlind={isColorBlind}
            colorBlindType={colorBlindType}
            height={220}
          />
        </div>

        <div className="dynamics-modal-pollutants-grid">
          {POLLUTANTS_CONFIG.map((p) => {
            const vals = finalDayData
              .map((d) => d[p.key])
              .filter((v) => v !== null && v !== undefined && !Number.isNaN(Number(v)));
              
              const min = vals.length > 0 ? Math.min(...vals) : 0;
              const max = vals.length > 0 ? Math.max(...vals) : 0;


              // текущая концентрация для акцентирования
              const currentVal = finalDayData[activeHourInDay]?.[p.key];
              const displayCurrent =
                currentVal !== null && currentVal !== undefined && !Number.isNaN(Number(currentVal))
                  ? Number(currentVal).toFixed(1)
                  : '—';

              return (
                <div
                  key={p.key}
                  className="pollutant-chart-card"
                  data-testid={`pollutant-card-${p.key}`}
                >
                  <div className="pollutant-card-header">
                    <strong>{p.label}</strong>
                    <span className="pollutant-card-unit">{displayCurrent} мкг/м³</span>
                  </div>
                  <div className="pollutant-card-stats">
                    <span>Минимум: {min !== null ? min.toFixed(1) : '—'}</span>
                    <span>Максимум: {max !== null ? max.toFixed(1) : '—'}</span>
                  </div>
                  <DynamicsChart
                    mode="pollutant"
                    data={finalDayData}
                    valueKey={p.key}
                    unit="мкг/м³"
                    color={p.color}
                    activeIndex={activeHourInDay}
                    isColorBlind={isColorBlind}
                    colorBlindType={colorBlindType}
                    height={90}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}