// Заглушка компонента для TDD (логика пока не реализована)

export default function CitySearch({ onLocationSelect, onCitySelect }) {
  return (
    <div className="city-search">
      <label htmlFor="city-search" className="city-search__label">
        Поиск города
      </label>
      <input
        id="city-search"
        className="city-search__input"
        type="search"
        placeholder="Город"
      />
    </div>
  );
}
