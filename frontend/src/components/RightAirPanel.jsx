import { useState, useEffect } from 'react';
import { POLLUTANTS_METADATA, getPollutantAssessment, getAqiRecommendation } from '../utils/pollutantsInfo';
import { parseIsoTimeString } from '../utils/timeUtils';
import '../styles/RightAirPanel.css';

// 6 основных загрязнителей
const POLLUTANTS_LIST = [
  { key: 'pm2_5', label: 'PM₂.₅', apiKey: 'pm2_5' },
  { key: 'pm10', label: 'PM₁₀', apiKey: 'pm10' },
  { key: 'nitrogen_dioxide', label: 'NO₂', apiKey: 'nitrogen_dioxide' },
  { key: 'sulphur_dioxide', label: 'SO₂', apiKey: 'sulphur_dioxide' },
  { key: 'ozone', label: 'O₃', apiKey: 'ozone' },
  { key: 'carbon_monoxide', label: 'CO', apiKey: 'carbon_monoxide' },
];

// Шкала уровней AQI
const SCALE_RANGES = [
  { range: '0–20', min: 0, max: 20 },
  { range: '21–40', min: 21, max: 40 },
  { range: '41–60', min: 41, max: 60 },
  { range: '61–80', min: 61, max: 80 },
  { range: '81–100', min: 81, max: 100 },
  { range: '100+', min: 101, max: Infinity },
];

export default function RightAirPanel({ airData, selectedTimeIndex = 0, isOpen = false, onClose }) {
  const [selectedKey, setSelectedKey] = useState('pm2_5');

  // Закрытие по кнопке Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && typeof onClose === 'function') {
        const isModalOpen = document.querySelector('[role="dialog"]') || document.querySelector('.modal-overlay');
        if (isModalOpen) return;
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !airData) return null;

  // Координаты, время, источник и общий AQI
  const latNum = Number(airData.latitude);
  const lonNum = Number(airData.longitude);
  const lat = !isNaN(latNum) ? latNum.toFixed(4) : '—';
  const lon = !isNaN(lonNum) ? lonNum.toFixed(4) : '—';
  const time = airData.hourly?.time?.[selectedTimeIndex];
  const source = airData.used_source || 'open-meteo';
  const aqiRaw = airData.hourly?.european_aqi?.[selectedTimeIndex];
  const aqi = aqiRaw !== undefined && aqiRaw !== null && !isNaN(Number(aqiRaw)) ? Number(aqiRaw) : null;

  const currentMeta = POLLUTANTS_METADATA[selectedKey] || POLLUTANTS_METADATA.pm2_5;

  return (
    <aside className="right-air-panel" aria-label="Детальная информация о качестве воздуха">
      {/* Шапка с крестиком закрытия */}
      <div className="panel-header">
        <h3 className="panel-header__title">Качество воздуха</h3>
        <button
          type="button"
          data-testid="right-panel-close-btn"
          className="panel-header__close-btn"
          onClick={onClose}
          aria-label="Закрыть панель"
        >
          &times;
        </button>
      </div>

      {/* Мета-информация: координаты, время, источник */}
      <div className="panel-meta">
        <div className="panel-meta__item"><strong>Координаты:</strong> {lat}, {lon}</div>
        <div className="panel-meta__item"><strong>Время:</strong>{' '}
        {(() => {
          const parsed = parseIsoTimeString(time);
          return parsed ? `${parsed.dateStr} ${parsed.timeLabel}` : '—';
        })()}
        </div>
        <div className="panel-meta__item"><strong>Источник:</strong> {source}</div>
      </div>

      {/* Показатель AQI и рекомендация */}
      <div className="aqi-summary">
        <div className="aqi-value">{aqi !== null ? aqi : '—'}</div>
        <div className="aqi-recommendation">{getAqiRecommendation(aqi)}</div>
      </div>

      {/* Шкала уровней AQI */}
      <div className="scale-section">
        <h4 className="scale-section__title">Шкала уровней AQI</h4>
        <div className="scale-bar">
          {SCALE_RANGES.map((item) => {
            const isActive = aqi !== null && aqi >= item.min && aqi <= item.max;
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

      {/* Список 6 загрязнителей */}
      <div className="pollutants-list">
        {POLLUTANTS_LIST.map((item) => {
          const rawVal = airData.hourly?.[item.apiKey]?.[selectedTimeIndex];
          const assessment = getPollutantAssessment(item.key, rawVal);
          const hasVal = rawVal !== undefined && rawVal !== null && rawVal !== '' && !isNaN(Number(rawVal));

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

      {/* Карточка "Общ инф" выбранного вещества */}
      <div className="general-info-card fade-in" key={selectedKey}>
        <h4 className="general-info-card__heading">Общая информация</h4>
        <div className="info-title">{currentMeta.name}</div>
        <p className="info-description">{currentMeta.description}</p>
        <div className="info-sources">
          <strong>Источники:</strong> {currentMeta.sources}
        </div>
        <div className="info-impact">
          <strong>Влияние на здоровье:</strong> {currentMeta.healthImpact}
        </div>
      </div>
    </aside>
  );
}