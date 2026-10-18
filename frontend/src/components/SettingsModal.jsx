// frontend/src/components/SettingsModal.jsx — компактное окно настроек оформления и доступности
import { useEffect, useState } from 'react';
import '../styles/SettingsModal.css';

// Стандартные цвета шкалы EAQI
const STANDARD_PALETTE = [
  { range: '0–20', color: '#4CAF50', label: 'Отлично', textColor: '#ffffff' },
  { range: '21–40', color: '#8BC34A', label: 'Хорошо', textColor: '#000000' },
  { range: '41–60', color: '#FFEB3B', label: 'Удовл.', textColor: '#000000' },
  { range: '61–80', color: '#FF9800', label: 'Плохо', textColor: '#ffffff' },
  { range: '81–100', color: '#F44336', label: 'Очень плохо', textColor: '#ffffff' },
  { range: '100+', color: '#D50000', label: 'Опасно', textColor: '#ffffff' }
];

// Доступная палитра для людей с цветовой слепотой (Okabe-Ito / ColorBrewer)
const COLORBLIND_PALETTE = [
  { range: '0–20', color: '#0072B2', label: 'Отлично', textColor: '#ffffff' },
  { range: '21–40', color: '#56B4E9', label: 'Хорошо', textColor: '#000000' },
  { range: '41–60', color: '#F0E442', label: 'Удовл.', textColor: '#000000' },
  { range: '61–80', color: '#E69F00', label: 'Плохо', textColor: '#000000' },
  { range: '81–100', color: '#D55E00', label: 'Очень плохо', textColor: '#ffffff' },
  { range: '100+', color: '#7B3294', label: 'Опасно', textColor: '#ffffff' }
];

export default function SettingsModal({
  isOpen,
  onClose,
  theme,
  onThemeChange,
  isColorBlind,
  onColorBlindChange
}) {
  // Локальные состояния на случай использования компонента в автономном режиме
  const [localTheme, setLocalTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem('aerocast_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  const [localColorBlind, setLocalColorBlind] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('aerocast_colorblind') === 'true';
  });

  const currentTheme = theme !== undefined ? theme : localTheme;
  const currentColorBlind = isColorBlind !== undefined ? isColorBlind : localColorBlind;

  // Закрытие окна по клавише Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleToggleTheme = () => {
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    if (onThemeChange) {
      onThemeChange(nextTheme);
    } else {
      setLocalTheme(nextTheme);
      if (typeof window !== 'undefined') {
        document.documentElement.setAttribute('data-theme', nextTheme);
        localStorage.setItem('aerocast_theme', nextTheme);
      }
    }
  };

  const handleToggleColorBlind = () => {
    const nextCB = !currentColorBlind;
    if (onColorBlindChange) {
      onColorBlindChange(nextCB);
    } else {
      setLocalColorBlind(nextCB);
      if (typeof window !== 'undefined') {
        document.documentElement.setAttribute('data-colorblind', nextCB ? 'true' : 'false');
        localStorage.setItem('aerocast_colorblind', nextCB ? 'true' : 'false');
      }
    }
  };

  if (!isOpen) return null;

  const activePalette = currentColorBlind ? COLORBLIND_PALETTE : STANDARD_PALETTE;

  return (
    <div
      className="settings-modal-overlay modal-overlay"
      data-testid="settings-modal-overlay"
      onClick={onClose}
    >
      <div
        className="settings-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-modal__header">
          <div className="settings-modal__brand">
            <div className="settings-modal__icon-badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </div>
            <div className="settings-modal__title-wrap">
              <h2 id="settings-modal-title" className="settings-modal__title">Настройки</h2>
              <span className="settings-modal__subtitle">Параметры отображения сайта</span>
            </div>
          </div>
          <button
            type="button"
            className="settings-modal__close-btn"
            aria-label="Закрыть настройки"
            data-testid="settings-modal-close-btn"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        <div className="settings-modal__body">
          {/* Свитчер смены темы (тёмная / светлая) */}
          <div className="settings-item">
            <div className="settings-item__info">
              <div className="settings-item__label-row">
                <span className="settings-item__icon" aria-hidden="true">
                  {currentTheme === 'dark' ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="5"></circle>
                      <line x1="12" y1="1" x2="12" y2="3"></line>
                      <line x1="12" y1="21" x2="12" y2="23"></line>
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                      <line x1="1" y1="12" x2="3" y2="12"></line>
                      <line x1="21" y1="12" x2="23" y2="12"></line>
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                    </svg>
                  )}
                </span>
                <span className="settings-item__title">
                  {currentTheme === 'dark' ? 'Тёмная тема' : 'Светлая тема'}
                </span>
              </div>
              <span className="settings-item__desc">
                Смена режима сайта с тёмного на светлый и наоборот
              </span>
            </div>

            <button
              type="button"
              id="settings-theme-switch"
              role="switch"
              aria-checked={currentTheme === 'dark'}
              aria-label="Переключить тему оформления"
              data-testid="settings-theme-switch"
              className={`settings-switch ${currentTheme === 'dark' ? 'settings-switch--active' : ''}`}
              onClick={handleToggleTheme}
            >
              <span className="settings-switch__thumb" aria-hidden="true">
                {currentTheme === 'dark' ? '🌙' : '☀️'}
              </span>
            </button>
          </div>

          {/* Свитчер режима для цветовой слепоты (дальтонизм) */}
          <div className="settings-item">
            <div className="settings-item__info">
              <div className="settings-item__label-row">
                <span className="settings-item__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor"></path>
                  </svg>
                </span>
                <span className="settings-item__title">Режим для дальтоников</span>
              </div>
              <span className="settings-item__desc">
                Высококонтрастная шкала для людей с нарушением цветовосприятия
              </span>
            </div>

            <button
              type="button"
              id="settings-colorblind-switch"
              role="switch"
              aria-checked={currentColorBlind}
              aria-label="Переключить режим для дальтоников"
              data-testid="settings-colorblind-switch"
              className={`settings-switch ${currentColorBlind ? 'settings-switch--active' : ''}`}
              onClick={handleToggleColorBlind}
            >
              <span className="settings-switch__thumb" aria-hidden="true">
                {currentColorBlind ? '✓' : ''}
              </span>
            </button>
          </div>

          {/* Интерактивный предпросмотр активной палитры */}
          <div className="settings-preview">
            <div className="settings-preview__title">
              <span>Палитра шкалы воздуха</span>
              <span className="settings-preview__badge">
                {currentColorBlind ? 'Режим доступности' : 'Стандартная'}
              </span>
            </div>
            <div className="settings-preview__palette" data-testid="settings-preview-palette">
              {activePalette.map((item) => (
                <div
                  key={item.range}
                  className="settings-preview__color-chip"
                  style={{ backgroundColor: item.color, color: item.textColor }}
                  title={`${item.range}: ${item.label}`}
                >
                  {item.range}
                </div>
              ))}
            </div>
            <div className="settings-preview__legend">
              <span>0 (Чистый)</span>
              <span>100+ (Опасный)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
