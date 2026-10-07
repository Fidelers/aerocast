import React, { useState, useEffect, useRef } from 'react';
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

  // текст на кнопке в зависимости от текущего слоя
  const currentLabel = activeLayer === 'satellite' ? 'Спутник' : 'Карта';

  return (
    <div className="layer-switcher" ref={containerRef}>
      {/* Кнопка переключения меню */}
      <button
        type="button"
        className="layer-switcher__toggle"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {currentLabel}
      </button>

      {/* Выпадающее меню с двумя вариантами */}
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
          Схема OpenStreetMap
        </button>

        <button
          type="button"
          className={`layer-switcher__item ${
            activeLayer === 'satellite' ? 'layer-switcher__item--active' : ''
          }`}
          onClick={() => handleSelectLayer('satellite')}
        >
          Снимки ESRI World Imagery
        </button>
      </div>
    </div>
  );
}