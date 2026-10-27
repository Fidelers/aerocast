import React, { useEffect } from 'react';
import DynamicsChart from './DynamicsChart';
import '../styles/RightAirPanel.css';
//измеряемые загрязнители
const POLLUTANTS_CONFIG = [
  { key: 'pm2_5', label: 'PM2.5', color: '#3b82f6' },
  { key: 'pm10', label: 'PM10', color: '#10b981' },
  { key: 'nitrogen_dioxide', label: 'NO2', color: '#f59e0b' },
  { key: 'sulphur_dioxide', label: 'SO2', color: '#8b5cf6' },
  { key: 'ozone', label: 'O3', color: '#ec4899' },
  { key: 'carbon_monoxide', label: 'CO', color: '#6366f1' },
];

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
  const selectedDateStr = currentIso.split('T')[0] || '';

  // фильтруем ровно 24 часа за выбранные сутки
  const dayData = [];
  let activeHourInDay = 0;

  airData.hourly.time.forEach((t, idx) => {
    if (typeof t === 'string' && t.startsWith(selectedDateStr)) {
      if (idx === safeIdx) {
        activeHourInDay = dayData.length;
      }
      const hourLabel = t.split('T')[1]?.slice(0, 5) || '00:00';
      dayData.push({
        time: t,
        hourLabel,
        aqi: airData.hourly.european_aqi?.[idx] ?? null,
        european_aqi: airData.hourly.european_aqi?.[idx] ?? null,
        pm2_5: airData.hourly.pm2_5?.[idx] ?? null,
        pm10: airData.hourly.pm10?.[idx] ?? null,
        nitrogen_dioxide: airData.hourly.nitrogen_dioxide?.[idx] ?? null,
        sulphur_dioxide: airData.hourly.sulphur_dioxide?.[idx] ?? null,
        ozone: airData.hourly.ozone?.[idx] ?? null,
        carbon_monoxide: airData.hourly.carbon_monoxide?.[idx] ?? null,
      });
    }
  });

  const finalDayData = dayData.length > 0 ? dayData : airData.hourly.time.slice(0, 24).map((t, idx) => ({
    time: t,
    hourLabel: t.split('T')[1]?.slice(0, 5) || '00:00',
    aqi: airData.hourly.european_aqi?.[idx] ?? null,
    european_aqi: airData.hourly.european_aqi?.[idx] ?? null,
    pm2_5: airData.hourly.pm2_5?.[idx] ?? null,
    pm10: airData.hourly.pm10?.[idx] ?? null,
    nitrogen_dioxide: airData.hourly.nitrogen_dioxide?.[idx] ?? null,
    sulphur_dioxide: airData.hourly.sulphur_dioxide?.[idx] ?? null,
    ozone: airData.hourly.ozone?.[idx] ?? null,
    carbon_monoxide: airData.hourly.carbon_monoxide?.[idx] ?? null,
  }));

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
          <h2>Суточная динамика качества воздуха</h2>
          <div className="dynamics-modal-meta">
            <span>Дата: {selectedDateStr}</span>
            {latStr && lonStr && <span>Координаты: {latStr}, {lonStr}</span>}
          </div>
          <button
            type="button"
            className="dynamics-modal-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

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

            return (
              <div
                key={p.key}
                className="pollutant-chart-card"
                data-testid={`pollutant-card-${p.key}`}
              >
                <div className="pollutant-card-header">
                  <strong>{p.label}</strong>
                  <span className="pollutant-card-unit">мкг/м³</span>
                </div>
                <div className="pollutant-card-stats">
                  <span>мин: {min}</span>
                  <span>макс: {max}</span>
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
  );
}