import { useState, useEffect, useRef } from 'react';

export default function CitySearch({ onLocationSelect, onCitySelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const containerRef = useRef(null);
  const isSelectingRef = useRef(false);

  // Закрытие выпадающего списка при клике вне компонента (mousedown)
  useEffect(() => {
    const handleMouseDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // Debounce запроса к /api/search на 500 мс
  useEffect(() => {
    if (isSelectingRef.current) {
      isSelectingRef.current = false;
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setIsOpen(false);
      setHasSearched(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const response = await fetch(`${apiBase}/api/search?q=${encodeURIComponent(trimmed)}`);
        if (cancelled) return;
        if (!response.ok) {
          setResults([]);
          setHasSearched(true);
          setIsOpen(true);
          return;
        }
        const data = await response.json();
        if (cancelled) return;
        setResults(Array.isArray(data) ? data : []);
        setHasSearched(true);
        setIsOpen(true);
      } catch (err) {
        if (cancelled) return;
        setResults([]);
        setHasSearched(true);
        setIsOpen(true);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const handleInputChange = (e) => {
    isSelectingRef.current = false;
    setQuery(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleItemClick = (item) => {
    isSelectingRef.current = true;
    const cityName = item.name || item.display_name;
    setQuery(cityName);
    setIsOpen(false);
    setResults([]);
    setHasSearched(false);

    const locationPayload = {
      ...item,
      lat: item.latitude !== undefined ? item.latitude : item.lat,
      lon: item.longitude !== undefined ? item.longitude : item.lon,
      name: item.name || item.display_name
    };

    if (typeof onLocationSelect === 'function') {
      onLocationSelect(locationPayload);
    }
    if (typeof onCitySelect === 'function') {
      onCitySelect(locationPayload);
    }
  };

  return (
    <div className="city-search" ref={containerRef}>
      <h2 className="city-search__title">Поиск города</h2>
      <label htmlFor="city-search" className="city-search__label">
        Поиск города
      </label>
      <input
        id="city-search"
        className="city-search__input"
        type="search"
        placeholder="Город"
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {isOpen && (
        <div className="city-search__dropdown">
          {results.length > 0 ? (
            <ul className="city-search__list">
              {results.map((item) => (
                <li
                  key={item.id ?? `${item.latitude}-${item.longitude}`}
                  className="city-search__item"
                >
                  <button
                    type="button"
                    className="city-search__item-btn"
                    onClick={() => handleItemClick(item)}
                  >
                    {item.display_name}
                  </button>
                </li>
              ))}
            </ul>
          ) : hasSearched ? (
            <div className="city-search__empty">Город не найден</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
