import { useState, useEffect, useRef } from 'react';
import MapIcon from '../assets/icons/map.svg';
import SatelliteIcon from '../assets/icons/satellite.svg';
import '../styles/LayerSwitcher.css';

export default function LayerSwitcher({ activeLayer = 'osm', onLayerChange }) {
  const [isOpen, setIsOpen] = useState(false);

  // ссылка на контейнер компонента для проверки клика мимо
  const containerRef = useRef(null);

  // закрытие меню по клику мимо и по Esc
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleMouseDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isOpen]);

  // обработка выбора слоя
  const handleSelectLayer = (layerKey) => {
    // если кликнуть на другой слой, то уведомляем родительский компонент
    if (layerKey !== activeLayer && onLayerChange) {
      onLayerChange(layerKey);
    }
    setIsOpen(false);
  };

  const isSatellite = activeLayer === 'satellite';
  // текст на кнопке в зависимости от текущего слоя
  const currentLabel = isSatellite ? 'Спутник' : 'Карта';

  return (
    <div className="layer-switcher" ref={containerRef}>
      {/* Кнопка переключения меню с минималистичным значком */}
      <button
        type="button"
        className="layer-switcher__toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        title={`Слой: ${currentLabel}`}
        aria-label={currentLabel}
        aria-expanded={isOpen}
      >
        <img
          src={isSatellite ? SatelliteIcon : MapIcon}
          className="layer-switcher__icon"
          alt=""
          aria-hidden="true"
        />
        <span className="layer-switcher__label">{currentLabel}</span>
      </button>

      {/* Выпадающее меню с вариантами слоев */}
      <div
        className={`layer-switcher__menu ${
          isOpen ? 'layer-switcher__menu--visible' : ''
        }`}
      >
        <button
          type="button"
          className={`layer-switcher__item ${
            activeLayer === 'osm' ? 'layer-switcher__item--active' : ''
          }`}
          onClick={() => handleSelectLayer('osm')}
        >
          <img
            src={MapIcon}
            className="layer-switcher__icon"
            alt=""
            aria-hidden="true"
          />
          <span>Схема OpenStreetMap</span>
        </button>

        <button
          type="button"
          className={`layer-switcher__item ${
            activeLayer === 'satellite' ? 'layer-switcher__item--active' : ''
          }`}
          onClick={() => handleSelectLayer('satellite')}
        >
          <img
            src={SatelliteIcon}
            className="layer-switcher__icon"
            alt=""
            aria-hidden="true"
          />
          <span>Снимки ESRI World Imagery</span>
        </button>
      </div>
    </div>
  );
}