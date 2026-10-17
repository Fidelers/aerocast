import { useState, useEffect, useRef, useCallback } from 'react';
import { POLLUTANTS_METADATA, getPollutantAssessment } from '../utils/pollutantsInfo';
import { getAqiInfo, getAqiRecommendation } from '../types';
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
  { range: '0–20', min: 0, max: 20, level: 'excellent' },
  { range: '21–40', min: 21, max: 40, level: 'good' },
  { range: '41–60', min: 41, max: 60, level: 'fair' },
  { range: '61–80', min: 61, max: 80, level: 'poor' },
  { range: '81–100', min: 81, max: 100, level: 'very-poor' },
  { range: '100+', min: 101, max: Infinity, level: 'hazardous' },
];

export default function RightAirPanel({ airData, selectedTimeIndex = 0, isOpen = false, onClose, isColorBlind = false }) {
  const [selectedKey, setSelectedKey] = useState('pm2_5');

  const panelRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartXRef = useRef(0);
  const currentTranslateYRef = useRef(0);
  const dragStartTimeRef = useRef(0);
  const isClosingRef = useRef(false);
  const isTouchActiveRef = useRef(false);
  const didDragRef = useRef(false);
  const dragPointerTypeRef = useRef('');

  // Сброс стилей анимации при открытии панели
  useEffect(() => {
    if (isOpen) {
      isClosingRef.current = false;
      if (panelRef.current) {
        panelRef.current.style.transform = '';
        panelRef.current.style.transition = '';
        panelRef.current.style.opacity = '';
        panelRef.current.style.animation = '';
        panelRef.current.classList.remove('right-air-panel--dragging');
        panelRef.current.classList.remove('right-air-panel--closing');
      }
    }
  }, [isOpen]);

  // Не-пассивный слушатель touchmove для отмены нативного скролла при перетаскивании панели
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const onNativeTouchMove = (e) => {
      if (isDraggingRef.current && e.cancelable) {
        e.preventDefault();
      }
    };

    panel.addEventListener('touchmove', onNativeTouchMove, { passive: false });
    return () => {
      panel.removeEventListener('touchmove', onNativeTouchMove);
    };
  }, [isOpen]);

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

  // Обработка жеста утягивания панели вниз (как шторки / комментариев в TikTok)
  const startDrag = useCallback((clientX, clientY, target, pointerType = '') => {
    if (isClosingRef.current) return;
    const isCloseBtn = target?.closest?.('.panel-header__close-btn');
    if (isCloseBtn) return;

    // С мыши / тачпада на ноутбуках перетаскивание разрешено ТОЛЬКО при целенаправленном захвате хэндла
    if (pointerType === 'mouse' && !target?.closest?.('.panel-drag-handle')) {
      return;
    }

    const isHandle = !!target?.closest?.('.panel-drag-handle');
    const isHeader = !!target?.closest?.('.panel-header');
    const isMeta = !!target?.closest?.('.panel-meta');

    dragStartYRef.current = clientY;
    dragStartXRef.current = clientX;
    dragStartTimeRef.current = Date.now();
    currentTranslateYRef.current = 0;
    didDragRef.current = false;
    dragPointerTypeRef.current = pointerType;

    // Снимаем блокировку CSS-анимацией, чтобы inline transform беспрепятственно управлял панелью
    if (panelRef.current) {
      panelRef.current.style.animation = 'none';
    }

    if (isHandle || isHeader || isMeta) {
      isDraggingRef.current = true;
      if (panelRef.current) {
        panelRef.current.classList.add('right-air-panel--dragging');
        panelRef.current.style.transition = 'none';
      }
    } else {
      isDraggingRef.current = false;
    }
  }, []);

  const moveDrag = useCallback((clientX, clientY, e) => {
    if (isClosingRef.current) return;
    const deltaY = clientY - dragStartYRef.current;
    const deltaX = clientX - dragStartXRef.current;

    if (!isDraggingRef.current) {
      // Для указателя мыши/тачпада запрещаем автозахват из контента
      if (dragPointerTypeRef.current === 'mouse') {
        return;
      }
      const panel = panelRef.current;
      const isAtTop = panel ? panel.scrollTop <= 0 : true;
      if (isAtTop && deltaY > 4 && Math.abs(deltaY) > Math.abs(deltaX)) {
        isDraggingRef.current = true;
        dragStartYRef.current = clientY;
        if (panel) {
          panel.style.animation = 'none';
          panel.classList.add('right-air-panel--dragging');
          panel.style.transition = 'none';
        }
      } else {
        return;
      }
    }

    if (isDraggingRef.current) {
      if (e?.cancelable && deltaY > 0) {
        e.preventDefault?.();
      }
      didDragRef.current = true;
      const panel = panelRef.current;
      if (!panel) return;

      let translateY = 0;
      if (deltaY > 0) {
        translateY = deltaY;
      } else {
        // Резиновое сопротивление при попытке тянуть вверх
        translateY = deltaY * 0.15;
      }

      currentTranslateYRef.current = translateY;
      panel.style.animation = 'none';
      panel.style.transform = `translateY(${translateY}px)`;
    }
  }, []);

  const endDrag = useCallback(() => {
    if (!isDraggingRef.current) {
      isDraggingRef.current = false;
      return;
    }
    isDraggingRef.current = false;

    const panel = panelRef.current;
    if (!panel) return;

    panel.classList.remove('right-air-panel--dragging');

    const deltaY = currentTranslateYRef.current;
    const elapsed = Math.max(1, Date.now() - dragStartTimeRef.current);
    const velocityY = deltaY / elapsed;
    const panelHeight = panel.offsetHeight || 380;
    const threshold = Math.min(100, Math.max(50, panelHeight * 0.22));

    const shouldClose = deltaY > threshold || (velocityY > 0.35 && deltaY > 20);
    const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
    const closeDelay = isTest ? 30 : 250;

    if (shouldClose) {
      isClosingRef.current = true;
      panel.classList.add('right-air-panel--closing');
      panel.style.animation = 'none';
      panel.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease-out';
      panel.style.transform = 'translateY(100%)';
      panel.style.opacity = '0';

      const timerId = setTimeout(() => {
        if (typeof onClose === 'function') {
          onClose();
        }
        if (panel) {
          panel.classList.remove('right-air-panel--closing');
          panel.style.transition = '';
          panel.style.transform = '';
          panel.style.opacity = '';
          panel.style.animation = '';
        }
        isClosingRef.current = false;
      }, closeDelay);
      return () => clearTimeout(timerId);
    } else {
      panel.style.animation = 'none';
      panel.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
      panel.style.transform = 'translateY(0)';
      const resetTimer = setTimeout(() => {
        if (panel && !isClosingRef.current) {
          panel.style.transition = '';
          panel.style.transform = 'translateY(0)';
          // Не сбрасываем animation в пустую строку, чтобы CSS не перезапускал анимацию появления
        }
      }, 200);
      return () => clearTimeout(resetTimer);
    }
  }, [onClose]);

  const onTouchStart = (e) => {
    isTouchActiveRef.current = true;
    const touch = e.touches?.[0];
    if (touch) {
      startDrag(touch.clientX, touch.clientY, e.target);
    }
  };

  const onTouchMove = (e) => {
    const touch = e.touches?.[0];
    if (touch) {
      moveDrag(touch.clientX, touch.clientY, e);
    }
  };

  const onTouchEnd = () => {
    setTimeout(() => {
      isTouchActiveRef.current = false;
    }, 100);
    endDrag();
  };

  const onTouchCancel = () => {
    setTimeout(() => {
      isTouchActiveRef.current = false;
    }, 100);
    endDrag();
  };

  const onPointerDown = (e) => {
    if (isTouchActiveRef.current) return;
    if (e.button !== undefined && e.button !== 0) return;

    // С мыши / тачпада на ноутбуке перетаскивание работает ТОЛЬКО за специальный хэндл
    if (e.pointerType === 'mouse' && !e.target?.closest?.('.panel-drag-handle')) {
      return;
    }

    if (e.target && typeof e.target.setPointerCapture === 'function') {
      try { e.target.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    startDrag(e.clientX, e.clientY, e.target, e.pointerType);
  };

  const onPointerMove = (e) => {
    if (isTouchActiveRef.current) return;
    if (e.pointerType === 'mouse' && !isDraggingRef.current) return;
    moveDrag(e.clientX, e.clientY, e);
  };

  const onPointerUp = (e) => {
    if (isTouchActiveRef.current) return;
    if (e.target && typeof e.target.releasePointerCapture === 'function') {
      try { e.target.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    endDrag();
  };

  const onPointerCancel = (e) => {
    if (isTouchActiveRef.current) return;
    if (e.target && typeof e.target.releasePointerCapture === 'function') {
      try { e.target.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    endDrag();
  };

  const onClickCapture = (e) => {
    if (didDragRef.current) {
      e.stopPropagation();
      e.preventDefault();
      didDragRef.current = false;
    }
  };

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
  const aqiInfo = getAqiInfo(aqi, { colorBlind: isColorBlind });
  const aqiRecommendationText = getAqiRecommendation(aqi);

  const currentMeta = POLLUTANTS_METADATA[selectedKey] || POLLUTANTS_METADATA.pm2_5;

  return (
    <aside
      ref={panelRef}
      className="right-air-panel"
      aria-label="Детальная информация о качестве воздуха"
      onAnimationEnd={() => {
        if (panelRef.current) {
          panelRef.current.style.animation = 'none';
        }
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClickCapture={onClickCapture}
    >
      {/* Декоративный хэндл для мобильного Bottom Sheet */}
      <div
        className="panel-drag-handle"
        aria-hidden="true"
        data-testid="panel-drag-handle"
      />
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

      {/* Показатель AQI: цветовой индикатор, оценка и рекомендация */}
      <div className="aqi-summary">
        <div className="aqi-indicator" data-level={aqiInfo.level} style={{ backgroundColor: aqiInfo.hex }}>
          <span className="aqi-indicator__number">{aqi !== null ? aqi : '—'}</span>
          <span className="aqi-indicator__label">{aqiInfo.label}</span>
        </div>
        {aqiRecommendationText && (
          <div className="aqi-recommendation">{aqiRecommendationText}</div>
        )}
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
                data-level={item.level}
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
          const assessment = getPollutantAssessment(item.key, rawVal, { colorBlind: isColorBlind });
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