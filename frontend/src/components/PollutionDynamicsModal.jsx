import React, { useState, useEffect, useRef } from 'react';
import DynamicsChart from './DynamicsChart';
import AnalyticsExportModal from './AnalyticsExportModal';
import { parseIsoTimeString } from '../utils/timeUtils';
import '../styles/PollutionDynamicsModal.css';

const POLLUTANTS_CONFIG = [
  { key: 'pm2_5', label: 'PM2.5', color: '#3b82f6' },
  { key: 'pm10', label: 'PM10', color: '#10b981' },
  { key: 'nitrogen_dioxide', label: 'NO2', color: '#f59e0b' },
  { key: 'sulphur_dioxide', label: 'SO2', color: '#8b5cf6' },
  { key: 'ozone', label: 'O3', color: '#ec4899' },
  { key: 'carbon_monoxide', label: 'CO', color: '#6366f1' },
];

const METRICS_METADATA = {
  aqi: { key: 'aqi', label: 'AQI', title: 'Общий индекс качества воздуха (EAQI)', unit: 'EAQI', color: '#3b82f6' },
  pm2_5: { key: 'pm2_5', label: 'PM2.5', title: 'Суточная динамика PM2.5 (мкг/м³)', unit: 'мкг/м³', color: '#3b82f6' },
  pm10: { key: 'pm10', label: 'PM10', title: 'Суточная динамика PM10 (мкг/м³)', unit: 'мкг/м³', color: '#10b981' },
  nitrogen_dioxide: { key: 'nitrogen_dioxide', label: 'NO2', title: 'Суточная динамика NO2 (мкг/м³)', unit: 'мкг/м³', color: '#f59e0b' },
  sulphur_dioxide: { key: 'sulphur_dioxide', label: 'SO2', title: 'Суточная динамика SO2 (мкг/м³)', unit: 'мкг/м³', color: '#8b5cf6' },
  ozone: { key: 'ozone', label: 'O3', title: 'Суточная динамика O3 (мкг/м³)', unit: 'мкг/м³', color: '#ec4899' },
  carbon_monoxide: { key: 'carbon_monoxide', label: 'CO', title: 'Суточная динамика CO (мкг/м³)', unit: 'мкг/м³', color: '#6366f1' },
};

const STEP_OPTIONS = [1, 2, 3, 4, 6, 8, 12, 24];

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

const formatDateShort = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(`${dateStr}`);
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
    }).format(date);
  } catch {
    return dateStr;
  }
};

const buildHourRecord = (isoTime, idx, hourlyData, isCurrent, hourIndex = 0) => {
  const parsed = parseIsoTimeString(isoTime);
  return {
    time: isoTime,
    globalIndex: idx,
    hourIndex,
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
  locationName = 'Новокузнецк, Россия',
  theme = 'light',
  isColorBlind = false,
  colorBlindType = 'okabe',
  onSelectTime,
}) {
  const [localActiveIndex, setLocalActiveIndex] = useState(selectedTimeIndex);
  const [activeMetricKey, setActiveMetricKey] = useState('aqi');

  const [stepHours, setStepHours] = useState(1);
  const [isAllDays, setIsAllDays] = useState(false);

  const [rangePreset, setRangePreset] = useState('day');
  const [customRange, setCustomRange] = useState(null);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const mainChartContainerRef = useRef(null);

  const isToggleDisabled = stepHours > 12;

  useEffect(() => {
    if (stepHours > 12) {
      setIsAllDays(true);
      if (rangePreset === 'day') {
        setRangePreset('all');
      }
    }
  }, [stepHours, rangePreset]);

  const handleStepHoursChange = (e) => {
    const nextStep = Math.max(1, Math.min(24, Number(e.target.value) || 1));
    setStepHours(nextStep);
    if (nextStep > 12) {
      setIsAllDays(true);
      if (rangePreset === 'day') {
        setRangePreset('all');
      }
    }
  };

  useEffect(() => {
    setLocalActiveIndex(selectedTimeIndex);
  }, [selectedTimeIndex]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isExportModalOpen) return;
        onClose?.();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !airData || !airData.hourly || !Array.isArray(airData.hourly.time) || airData.hourly.time.length === 0) {
    return null;
  }

  const totalHours = airData.hourly.time.length;
  const safeIdx = (selectedTimeIndex !== null && selectedTimeIndex !== undefined && selectedTimeIndex >= 0 && selectedTimeIndex < totalHours)
    ? selectedTimeIndex
    : 0;

  const currentIso = airData.hourly.time[safeIdx] || '';
  const parsedCurrent = parseIsoTimeString(currentIso);
  const selectedDateStr = parsedCurrent?.dateStr || currentIso.split('T')[0] || '';

  const allRecords = airData.hourly.time.map((t, idx) =>
    buildHourRecord(t, idx, airData.hourly, idx === safeIdx, idx % 24)
  );

  let visibleSlice = [];

  if (customRange) {
    const startG = Math.max(0, Math.min(allRecords.length - 1, customRange.startGlobal));
    const endG = Math.max(0, Math.min(allRecords.length - 1, customRange.endGlobal));
    visibleSlice = allRecords.slice(Math.min(startG, endG), Math.max(startG, endG) + 1);
  } else if (!isAllDays && rangePreset === 'day') {
    const dayRecords = [];
    allRecords.forEach((r) => {
      const parsed = parseIsoTimeString(r.time);
      if (parsed && parsed.dateStr === selectedDateStr) {
        dayRecords.push(r);
      }
    });

    if (dayRecords.length > 0) {
      visibleSlice = dayRecords;
    } else {
      visibleSlice = allRecords.slice(0, Math.min(24, allRecords.length));
    }
  } else if (rangePreset === '3days') {
    const centerIdx = safeIdx >= 0 ? safeIdx : 0;
    const startG = Math.max(0, centerIdx - 24);
    const endG = Math.min(allRecords.length - 1, startG + 71);
    visibleSlice = allRecords.slice(startG, endG + 1);
  } else if (rangePreset === 'week') {
    const centerIdx = safeIdx >= 0 ? safeIdx : 0;
    const startG = Math.max(0, centerIdx - 72);
    const endG = Math.min(allRecords.length - 1, startG + 167);
    visibleSlice = allRecords.slice(startG, endG + 1);
  } else {
    visibleSlice = allRecords;
  }

  const finalDayData =
    stepHours > 1
      ? visibleSlice.filter((item, i) => i % stepHours === 0 || item.isCurrent)
      : visibleSlice;

  const latVal = coords?.lat ?? airData?.latitude;
  const lonVal = coords?.lon ?? airData?.longitude;
  const latStr = latVal != null ? Number(latVal).toFixed(4) : '';
  const lonStr = lonVal != null ? Number(lonVal).toFixed(4) : '';

  const handleChartPointClick = (localIdx) => {
    const targetRecord = finalDayData[localIdx];
    if (!targetRecord) return;

    const globalIndex = targetRecord.globalIndex !== undefined
      ? targetRecord.globalIndex
      : airData.hourly.time.indexOf(targetRecord.time);
    
    if (globalIndex !== -1) {
      setLocalActiveIndex(globalIndex);
      onSelectTime?.(globalIndex);
    }
  };

  const handleRangeSelect = (fromLocalIdx, toLocalIdx) => {
    const startRecord = finalDayData[fromLocalIdx];
    const endRecord = finalDayData[toLocalIdx];
    if (!startRecord || !endRecord) return;

    const startG = startRecord.globalIndex;
    const endG = endRecord.globalIndex;
    if (startG !== undefined && endG !== undefined) {
      setCustomRange({
        startGlobal: Math.min(startG, endG),
        endGlobal: Math.max(startG, endG),
      });
      setRangePreset('custom');
      setIsAllDays(true);
    }
  };

  const handleResetToNormal = () => {
    setCustomRange(null);
    setRangePreset('all');
    setIsAllDays(true);
  };

  let activeHour = 0;
  const currentGlobalTime = airData.hourly.time[localActiveIndex];
  const matchInFinal = finalDayData.findIndex((d) => d.time === currentGlobalTime);
  if (matchInFinal !== -1) {
    activeHour = matchInFinal;
  }

  const getStats = (values) => {
    const valid = values.filter((v) => v !== null && v !== undefined && !Number.isNaN(Number(v)));
    if (valid.length === 0) return { min: null, max: null, avg: null };
    
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const avg = valid.reduce((sum, v) => sum + v, 0) / valid.length;
    
    return { min, max, avg };
  };

  const activeMetric = METRICS_METADATA[activeMetricKey] || METRICS_METADATA.aqi;

  const mainMetricValues = finalDayData.map((d) => d[activeMetric.key]);
  const aqiStats = getStats(mainMetricValues);
  const decimals = activeMetricKey === 'aqi' ? 0 : 1;

  const isViewingMultiDays = isAllDays || customRange !== null || rangePreset !== 'day';
  const firstVisibleTime = finalDayData[0]?.time || '';
  const lastVisibleTime = finalDayData[finalDayData.length - 1]?.time || '';
  const firstDateStr = firstVisibleTime.split('T')[0] || '';
  const lastDateStr = lastVisibleTime.split('T')[0] || '';

  const activeIso = airData.hourly.time[localActiveIndex] || airData.hourly.time[safeIdx] || '';
  const parsedActive = parseIsoTimeString(activeIso);
  const activeDateStr = parsedActive?.dateStr || activeIso.split('T')[0] || '';
  const activeHourStr = parsedActive?.timeStr || (activeIso.split('T')[1]?.slice(0, 5)) || '00:00';

  return (
    <div
      className="dynamics-modal-overlay"
      data-testid="dynamics-modal-overlay"
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
            <h2>Динамика качества воздуха</h2>
            <div className="dynamics-modal-meta">
              {isViewingMultiDays && firstDateStr !== lastDateStr ? (
                <>
                  <span className="meta-item">
                    Период: {formatDateShort(firstDateStr)} – {formatDateShort(lastDateStr)}
                  </span>
                  <span className="meta-item meta-item--active">
                    Выбранный день и время: {formatDateShort(activeDateStr)}, {activeHourStr}
                  </span>
                </>
              ) : (
                <>
                  <span className="meta-item">Дата: {formatDate(selectedDateStr)}</span>
                  <span className="meta-item meta-item--active">Время: {activeHourStr}</span>
                </>
              )}
              {latStr && lonStr && (
                <span className="meta-item">Координаты: {latStr}, {lonStr}</span>
              )}
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
          <div className="dynamics-modal-controls" data-testid="dynamics-modal-controls">
            <div className="dynamics-range-presets" role="group" aria-label="Предустановленные диапазоны дат">
              <button
                type="button"
                className={`dynamics-preset-btn ${rangePreset === 'day' && !customRange ? 'dynamics-preset-btn--active' : ''}`}
                onClick={() => {
                  setRangePreset('day');
                  setCustomRange(null);
                  setIsAllDays(false);
                }}
              >
                Сутки
              </button>
              <button
                type="button"
                className={`dynamics-preset-btn ${rangePreset === '3days' && !customRange ? 'dynamics-preset-btn--active' : ''}`}
                onClick={() => {
                  setRangePreset('3days');
                  setCustomRange(null);
                  setIsAllDays(true);
                }}
              >
                3 дня
              </button>
              <button
                type="button"
                className={`dynamics-preset-btn ${rangePreset === 'week' && !customRange ? 'dynamics-preset-btn--active' : ''}`}
                onClick={() => {
                  setRangePreset('week');
                  setCustomRange(null);
                  setIsAllDays(true);
                }}
              >
                Неделя
              </button>
              <button
                type="button"
                className={`dynamics-preset-btn ${rangePreset === 'all' && !customRange ? 'dynamics-preset-btn--active' : ''}`}
                onClick={() => {
                  setRangePreset('all');
                  setCustomRange(null);
                  setIsAllDays(true);
                }}
              >
                Все дни
              </button>
            </div>

            {(customRange !== null || rangePreset === 'custom') && (
              <button
                type="button"
                className="dynamics-modal-reset-range-btn"
                data-testid="reset-range-btn"
                onClick={handleResetToNormal}
                title="Сбросить выбранный диапазон до обычного состояния"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                Сбросить до обычного
              </button>
            )}

            <button
              type="button"
              className="dynamics-export-btn"
              data-testid="dynamics-export-btn"
              onClick={() => setIsExportModalOpen(true)}
              title="Экспортировать данные аналитики (CSV, JSON, PNG)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Экспорт</span>
            </button>

            <label className="dynamics-control-item">
              <span className="dynamics-control-label">Шаг точек:</span>
              <select
                className="dynamics-step-select"
                data-testid="step-hours-select"
                value={stepHours}
                onChange={handleStepHoursChange}
                aria-label="Интервал точек"
              >
                {STEP_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h} ч
                  </option>
                ))}
              </select>
            </label>

            <label
              className={
                'dynamics-toggle-switch' +
                (isToggleDisabled ? ' dynamics-toggle-switch--disabled' : '')
              }
            >
              <input
                type="checkbox"
                role="switch"
                className="dynamics-toggle-input"
                data-testid="all-days-toggle"
                checked={isAllDays}
                disabled={isToggleDisabled}
                aria-disabled={isToggleDisabled ? 'true' : 'false'}
                onChange={(e) => {
                  if (!isToggleDisabled) {
                    setIsAllDays(e.target.checked);
                    setCustomRange(null);
                    setRangePreset(e.target.checked ? 'all' : 'day');
                  }
                }}
              />
              <span className="dynamics-toggle-slider" />
              <span className="dynamics-toggle-text">Все дни</span>
            </label>

            {isToggleDisabled && (
              <span className="dynamics-toggle-hint" data-testid="all-days-hint">
                При шаге более 12 ч отображаются все дни
              </span>
            )}

            <span className="dynamics-drag-hint">
              💡 Зажмите и потяните мышь по графику для выбора диапазона
            </span>
          </div>

          <div className="dynamics-modal-main-chart" data-testid="dynamics-modal-main-chart" ref={mainChartContainerRef}>
            <div className="dynamics-modal-main-chart__header">
              <h3>{activeMetric.title}</h3>
              <div className="dynamics-modal-main-chart__actions">
                {customRange !== null && (
                  <button
                    type="button"
                    className="dynamics-modal-reset-btn dynamics-modal-reset-btn--range"
                    onClick={handleResetToNormal}
                  >
                    Сбросить выбор диапазона ↺
                  </button>
                )}
                {activeMetricKey !== 'aqi' && (
                  <button
                    type="button"
                    className="dynamics-modal-reset-btn"
                    data-testid="reset-to-aqi-btn"
                    onClick={() => setActiveMetricKey('aqi')}
                  >
                    Вернуть общий индекс AQI
                  </button>
                )}
              </div>
            </div>

            <div className="pollutant-card-stats pollutant-card-stats--main">
              <span className="stat-item">
                <span className="stat-label" data-full="Минимум" data-short="Мин">Минимум</span>:&nbsp;
                <span className="stat-value">{aqiStats.min !== null ? aqiStats.min.toFixed(decimals) : '–'}</span>
              </span>
              <span className="stat-item">
                <span className="stat-label" data-full="Среднее" data-short="Ср">Среднее</span>:&nbsp;
                <span className="stat-value">{aqiStats.avg !== null ? aqiStats.avg.toFixed(decimals) : '–'}</span>
              </span>
              <span className="stat-item">
                <span className="stat-label" data-full="Максимум" data-short="Макс">Максимум</span>:&nbsp;
                <span className="stat-value">{aqiStats.max !== null ? aqiStats.max.toFixed(decimals) : '–'}</span>
              </span>
            </div>

            <DynamicsChart
              mode={activeMetricKey === 'aqi' ? 'aqi' : 'pollutant'}
              data={finalDayData}
              valueKey={activeMetric.key}
              unit={activeMetric.unit}
              color={activeMetric.color}
              activeIndex={activeHour}
              isColorBlind={isColorBlind}
              colorBlindType={colorBlindType}
              height={220}
              onPointClick={handleChartPointClick}
              isAllDays={isViewingMultiDays}
              enableRangeSelection={true}
              onRangeSelect={handleRangeSelect}
              isMain={true}
            />
          </div>

          <div className="dynamics-modal-pollutants-grid">
            {POLLUTANTS_CONFIG.map((p) => {
              const vals = finalDayData
                .map((d) => d[p.key])
                .filter((v) => v !== null && v !== undefined && !Number.isNaN(Number(v)));
              
              const stats = getStats(vals);

              const currentVal = finalDayData[activeHour]?.[p.key];
              const displayCurrent =
                currentVal !== null && currentVal !== undefined && !Number.isNaN(Number(currentVal))
                  ? Number(currentVal).toFixed(1)
                  : '–';

              const isCardActive = activeMetricKey === p.key;

              return (
                <div
                  key={p.key}
                  className={
                    'pollutant-chart-card pollutant-chart-card--interactive' +
                    (isCardActive ? ' pollutant-chart-card--active' : '')
                  }
                  style={{ '--metric-color': p.color }}
                  data-testid={`pollutant-card-${p.key}`}
                  role="button"
                  tabIndex={0}
                  title="Показать на главном графике"
                  onClick={() => setActiveMetricKey(p.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveMetricKey(p.key);
                    }
                  }}
                >
                  <div className="pollutant-card-header">
                    <strong>{p.label}</strong>
                    {isCardActive && <span className="pollutant-card-active-badge">Активен</span>}
                    <span className="pollutant-card-unit">{displayCurrent} мкг/м³</span>
                  </div>

                  <div className="pollutant-card-stats">
                    <span className="stat-item">
                      <span className="stat-label" data-full="Минимум" data-short="Мин">Минимум</span>:&nbsp;
                      <span className="stat-value">{stats.min !== null ? stats.min.toFixed(1) : '–'}</span>
                    </span>
                    <span className="stat-item">
                      <span className="stat-label" data-full="Среднее" data-short="Ср">Среднее</span>:&nbsp;
                      <span className="stat-value">{stats.avg !== null ? stats.avg.toFixed(1) : '–'}</span>
                    </span>
                    <span className="stat-item">
                      <span className="stat-label" data-full="Максимум" data-short="Макс">Максимум</span>:&nbsp;
                      <span className="stat-value">{stats.max !== null ? stats.max.toFixed(1) : '–'}</span>
                    </span>
                  </div>

                  <DynamicsChart
                    mode="pollutant"
                    data={finalDayData}
                    valueKey={p.key}
                    unit="мкг/м³"
                    color={p.color}
                    activeIndex={activeHour}
                    isColorBlind={isColorBlind}
                    colorBlindType={colorBlindType}
                    height={90}
                    onPointClick={null}
                    isAllDays={isViewingMultiDays}
                    isMain={false}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <AnalyticsExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          allRecords={allRecords}
          finalDayData={finalDayData}
          customRange={customRange}
          activeMetricKey={activeMetricKey}
          stepHours={stepHours}
          rangePreset={rangePreset}
          selectedDateStr={selectedDateStr}
          locationName={locationName}
          coords={coords}
          chartSvgRef={mainChartContainerRef}
          isColorBlind={isColorBlind}
          colorBlindType={colorBlindType}
          theme={theme}
        />
      </div>
    </div>
  );
}
