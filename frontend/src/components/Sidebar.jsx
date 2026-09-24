// Sidebar.jsx - боковая панель: поиск, переключатели,
import Logo from '../assets/icons/logo.svg'
import InfoIcon from '../assets/icons/info.svg'
import '../styles/Sidebar.css'

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <div className="sidebar__brand">
            <img src={Logo} alt="AeroCast" className="sidebar__logo" />
            <div className="sidebar__title">Aerocast</div>
        </div>
        <a href="#" className="sidebar__info-btn">
            <img src={InfoIcon} className="sidebar__info-icon" />
        </a>
        
      </div>

      <section className="city-search">
        <h2 className="city-search__title">Поиск города</h2>
        <label htmlFor="city-search" className="city-search__label">
          Поиск города
        </label>
        <input
          id="city-search"
          className="city-search__input"
          type="search"
          placeholder="Город"
        />
      </section>

      <section className="display-mode">
        <h2 className="display-mode__title">Режим отображения</h2>
        <div className="segmented">
          <button type="button" className="segmented__btn">
            Цветовой
          </button>
          <button type="button" className="segmented__btn">
            Цифровой
          </button>
          <button type="button" className="segmented__btn segmented__btn--active">
            Комбо
          </button>
        </div>
      </section>


      <section className="geo-nav">
        <h2 className="geo-nav__title">Навигация</h2>
        <button type="button" className="geo-nav__location-btn">Моё местоположение</button>
      </section>

      <section className="date-nav">
        <h2 className="date-nav__title">Навигация по времени</h2>
        <div className="days">
          <button className="day-card" type="button">
            <span className="day-card__label">ЧТ</span>
            <span className="day-card__num">10</span>
          </button>
          <button className="day-card" type="button">
            <span className="day-card__label">ПТ</span>
            <span className="day-card__num">11</span>
          </button>
          <button className="day-card" type="button">
            <span className="day-card__label">СБ</span>
            <span className="day-card__num">12</span>
          </button>
          <button className="day-card day-card--active" type="button">
            <span className="day-card__label">ВС</span>
            <span className="day-card__num">13</span>
            <span className="day-card__extra">сег</span>
          </button>
          <button className="day-card day-card--forecast" type="button">
            <span className="day-card__label">ПН</span>
            <span className="day-card__num">14</span>
            <span className="day-card__extra">прог</span>
          </button>
          <button className="day-card day-card--forecast" type="button">
            <span className="day-card__label">ВТ</span>
            <span className="day-card__num">15</span>
            <span className="day-card__extra">прог</span>
          </button>
          <button className="day-card day-card--forecast" type="button">
            <span className="day-card__label">СР</span>
            <span className="day-card__num">16</span>
            <span className="day-card__extra">прог</span>
          </button>
        </div>
      </section>

      <section className="time-nav">
        <h2 className="time-nav__title">Время суток</h2>
        <div className="times">
          <button className="time" type="button">00:00</button>
          <button className="time" type="button">03:00</button>
          <button className="time" type="button">06:00</button>
          <button className="time" type="button">09:00</button>
          <button className="time" type="button">12:00</button>
          <button className="time" type="button">15:00</button>
          <button className="time time--active" type="button">18:00</button>
          <button className="time" type="button">21:00</button>
        </div>
      </section>

      <section className="aqi-scale">
        <h2 className="aqi-scale__title">Шкала AQI</h2>
        <ul className="aqi-scale__list">
          <li className="aqi-row">
            <span className="aqi-row__dot" style={{ backgroundColor: '#00cc00' }} />
            <span className="aqi-row__range">0-20</span>
            <span className="aqi-row__label">Отлично</span>
          </li>
          <li className="aqi-row">
            <span className="aqi-row__dot" style={{ backgroundColor: '#66ff66' }} />
            <span className="aqi-row__range">21-40</span>
            <span className="aqi-row__label">Хорошо</span>
          </li>
          <li className="aqi-row">
            <span className="aqi-row__dot" style={{ backgroundColor: '#f7f21a' }} />
            <span className="aqi-row__range">41-60</span>
            <span className="aqi-row__label">Удовлетворительно</span>
          </li>
          <li className="aqi-row">
            <span className="aqi-row__dot" style={{ backgroundColor: '#ffa500' }}/>
            <span className="aqi-row__range">61-80</span>
            <span className="aqi-row__label">Плохо</span>
          </li>
          <li className="aqi-row">
            <span className="aqi-row__dot" style={{ backgroundColor: '#ff0000' }}  />
            <span className="aqi-row__range">80-100</span>
            <span className="aqi-row__label">Очень плохо</span>
          </li>
          <li className="aqi-row">
            <span className="aqi-row__dot" style={{ backgroundColor: '#c20000' }}  />
            <span className="aqi-row__range">100+</span>
            <span className="aqi-row__label">Опасно</span>
          </li>
        </ul>
      </section>
    </aside>
  );
}

export default Sidebar;

