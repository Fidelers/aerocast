import React, { useState, useEffect } from 'react';
import { POLLUTANTS_METADATA, getPollutantAssessment } from '../utils/pollutantsInfo';
import '../styles/RightAirPanel.css';

// 6 загрязнителей
const POLLUTANTS_LIST = [
  { key: 'pm2_5', label: 'PM₂.₅', name: 'Мелкодисперсные частицы (PM2.5)', apiKey: 'pm2_5' },
  { key: 'pm10', label: 'PM₁₀', name: 'Крупные твердые частицы (PM10)', apiKey: 'pm10' },
  { key: 'nitrogen_dioxide', label: 'NO₂', name: 'Диоксид азота (NO2)', apiKey: 'nitrogen_dioxide', desc: 'Токсичный едкий газ красно-бурого цвета.', src: 'Высокотемпературное горение топлива.' },
  { key: 'sulphur_dioxide', label: 'SO₂', name: 'Диоксид серы (SO2)', apiKey: 'sulphur_dioxide' },
  { key: 'ozone', label: 'O₃', name: 'Приземный озон (O3)', apiKey: 'ozone' },
  { key: 'carbon_monoxide', label: 'CO', name: 'Угарный газ (CO)', apiKey: 'carbon_monoxide' },
];

// шкала уровней AQI
const SCALE_RANGES = [
  { range: '0–20', min: 0, max: 20 },
  { range: '21–40', min: 21, max: 40 },
  { range: '41–60', min: 41, max: 60 },
  { range: '61–80', min: 61, max: 80 },
  { range: '81–100', min: 81, max: 100 },
  { range: '100+', min: 101, max: Infinity },
];

export default function RightAirPanel({ airData, selectedTimeIndex = 0, isOpen = false, onClose }) {
  if (!isOpen || !airData) return null;

  const [selectedKey, setSelectedKey] = useState('pm2_5');

  // закрытие по кнопке Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // достаем координаты, время, источник и общий AQI
  const lat = Number(airData.latitude).toFixed(4);
  const lon = Number(airData.longitude).toFixed(4);
  const time = airData.hourly?.time?.[selectedTimeIndex] || '';
  const source = airData.used_source || 'open-meteo';
  const aqi = airData.hourly?.european_aqi?.[selectedTimeIndex] ?? 0;

  const currentItem = POLLUTANTS_LIST.find((p) => p.key === selectedKey) || POLLUTANTS_LIST[0];
  const meta = POLLUTANTS_METADATA[selectedKey] || {};

  // шапка с крестиком закрытия
  const headerBlock = (
    <div className="panel-header">
      <h3>Качество воздуха</h3>
      <button
        data-testid="right-panel-close-btn"
        className="close-button"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );

  //координаты, время и источник данных
  const metaBlock = (
    <div className="panel-meta">
      <div>Координаты: {lat}, {lon}</div>
      <div>Время: {time}</div>
      <div>Источник: {source}</div>
    </div>
  );

  //Показатель AQI и рекомендация
  const aqiBlock = (
    <div className="aqi-summary">
      <div className="aqi-value">{aqi}</div>
      <div className="aqi-recommendation">хорошо</div>
    </div>
  );

  //шала уровней AQI с активным диапазоном
  const scaleBlock = (
    <div className="scale-section">
      <h4>Шкала уровней AQI</h4>
      <div className="scale-bar">
        {SCALE_RANGES.map((item) => {
          const isActive = aqi >= item.min && aqi <= item.max;
          return (
            <div
              key={item.range}
              className={'scale-item' + (isActive ? ' scale-item--active' : '')}
            >
              {item.range}
            </div>
          );
        })}
      </div>
    </div>
  );

  //список 6 загрязнителей (смена по клику и hover)
  const pollutantsBlock = (
    <div className="pollutants-list">
      {POLLUTANTS_LIST.map((item) => {
        const rawVal = airData.hourly?.[item.apiKey]?.[selectedTimeIndex];
        const assessment = getPollutantAssessment(item.key, rawVal);
        const hasVal = rawVal !== undefined && rawVal !== null && !isNaN(rawVal);

        return (
          <button
            key={item.key}
            type="button"
            className={'pollutant-row' + (selectedKey === item.key ? ' pollutant-row--selected' : '')}
            onClick={() => setSelectedKey(item.key)}
            onMouseEnter={() => setSelectedKey(item.key)}
          >
            <span className="pollutant-formula">{item.label}</span>
            <span className="pollutant-value">{hasVal ? `${rawVal} \u03BCg/m\u00B3` : '—'}</span>
            <span
              className="pollutant-badge"
              style={{ backgroundColor: assessment.color }}
            >
              {assessment.label}
            </span>
          </button>
        );
      })}
    </div>
  );

  // карточка "Общ инф" выбранного вещества
  const infoCardBlock = (
    <div className="general-info-card fade-in" key={selectedKey}>
      <h4>Общ инф</h4>
      <div className="info-title">{currentItem.name}</div>
      <p className="info-description">{currentItem.desc || meta.description}</p>
      <div className="info-sources">
        <strong>Источники:</strong> {currentItem.src || meta.sources}
      </div>
      <div className="info-impact">
        <strong>Влияние на здоровье:</strong> {meta.healthImpact}
      </div>
    </div>
  );

  // всё вместе на экран
  return (
    <div className="right-air-panel">
      {headerBlock}
      {metaBlock}
      {aqiBlock}
      {scaleBlock}
      {pollutantsBlock}
      {infoCardBlock}
    </div>
  );
}