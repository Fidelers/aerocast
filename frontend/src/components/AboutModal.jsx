// frontend/src/components/AboutModal.jsx — модальное окно информации о проекте и методологии EAQI
import { useEffect } from 'react';
import Logo from '../assets/icons/logo.svg';
import '../styles/AboutModal.css';

export default function AboutModal({ isOpen, onClose }) {
  // Закрытие модального окна по клавише Escape
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

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      data-testid="modal-overlay"
      onClick={onClose}
    >
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header__brand">
            <img src={Logo} alt="AeroCast" className="modal-header__logo" />
            <div>
              <h2 id="about-modal-title" className="modal-header__title">
                О проекте Aerocast
              </h2>
              <p className="modal-header__subtitle">
                Мониторинг химического состава атмосферы и прогноз качества воздуха
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            aria-label="Закрыть"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* Описание проекта */}
        <section className="modal-section">
          <h3 className="modal-section__title">Назначение сервиса</h3>
          <p className="modal-section__text">
            <strong>Aerocast</strong> — это веб-приложение для оценки экологической обстановки
            в режиме реального времени и подробный <strong>прогноз</strong> качества воздуха
            на ближайшие 3 дня. Сервис помогает планировать прогулки, занятия спортом на открытом
            воздухе и оценивать риски для здоровья.
          </p>
        </section>

        {/* Методология EAQI и 6 загрязнителей */}
        <section className="modal-section">
          <h3 className="modal-section__title">
            Европейский индекс качества воздуха (EAQI)
          </h3>
          <p className="modal-section__text">
            Индекс рассчитывается по европейской шкале EAQI (European Air Quality Index)
            на основе анализа 6 ключевых загрязнителей атмосферы:
          </p>
          <div className="pollutants-grid">
            <div className="pollutant-card">
              <span className="pollutant-card__name">PM2.5</span>
              <span className="pollutant-card__desc">
                Мелкодисперсные частицы до 2.5 мкм (сажа, пыль, токсичные соединения). Проникают глубоко в легкие.
              </span>
            </div>
            <div className="pollutant-card">
              <span className="pollutant-card__name">PM10</span>
              <span className="pollutant-card__desc">
                Взвешенные частицы до 10 мкм (дорожная пыль, пыльца, продукты механического истирания).
              </span>
            </div>
            <div className="pollutant-card">
              <span className="pollutant-card__name">NO2</span>
              <span className="pollutant-card__desc">
                Диоксид азота — продукт горения топлива в двигателях автотранспорта и на ТЭЦ.
              </span>
            </div>
            <div className="pollutant-card">
              <span className="pollutant-card__name">O3</span>
              <span className="pollutant-card__desc">
                Приземный озон — фотохимический окислитель, образующийся при солнечном свете.
              </span>
            </div>
            <div className="pollutant-card">
              <span className="pollutant-card__name">SO2</span>
              <span className="pollutant-card__desc">
                Диоксид серы — выбросы при сжигании серосодержащего угля, мазута и руд.
              </span>
            </div>
            <div className="pollutant-card">
              <span className="pollutant-card__name">CO</span>
              <span className="pollutant-card__desc">
                Оксид углерода (угарный газ) — продукт неполного сгорания углеводородного топлива.
              </span>
            </div>
          </div>
        </section>

        {/* Шкала EAQI */}
        <section className="modal-section">
          <h3 className="modal-section__title">Шкала оценки и рекомендации</h3>
          <ul className="aqi-modal-list">
            <li className="aqi-modal-item" style={{ borderLeftColor: '#4CAF50' }}>
              <div className="aqi-modal-item__left">
                <span className="aqi-modal-item__badge" style={{ backgroundColor: '#4CAF50' }}>0–20</span>
                <span className="aqi-modal-item__label">Отлично</span>
              </div>
              <span className="aqi-modal-item__advice">Воздух чистый, идеальные условия для прогулок и спорта.</span>
            </li>
            <li className="aqi-modal-item" style={{ borderLeftColor: '#8BC34A' }}>
              <div className="aqi-modal-item__left">
                <span className="aqi-modal-item__badge" style={{ backgroundColor: '#8BC34A' }}>21–40</span>
                <span className="aqi-modal-item__label">Хорошо</span>
              </div>
              <span className="aqi-modal-item__advice">Качество воздуха приемлемое. Загрязнение минимально.</span>
            </li>
            <li className="aqi-modal-item" style={{ borderLeftColor: '#F7F21A' }}>
              <div className="aqi-modal-item__left">
                <span className="aqi-modal-item__badge" style={{ backgroundColor: '#F7F21A', color: '#000' }}>41–60</span>
                <span className="aqi-modal-item__label">Удовлетворительно</span>
              </div>
              <span className="aqi-modal-item__advice">Умеренное загрязнение. Чувствительным людям стоит быть осторожнее.</span>
            </li>
            <li className="aqi-modal-item" style={{ borderLeftColor: '#FFA500' }}>
              <div className="aqi-modal-item__left">
                <span className="aqi-modal-item__badge" style={{ backgroundColor: '#FFA500' }}>61–80</span>
                <span className="aqi-modal-item__label">Плохо</span>
              </div>
              <span className="aqi-modal-item__advice">Неблагоприятные условия. Ограничьте физические нагрузки на улице.</span>
            </li>
            <li className="aqi-modal-item" style={{ borderLeftColor: '#FF0000' }}>
              <div className="aqi-modal-item__left">
                <span className="aqi-modal-item__badge" style={{ backgroundColor: '#FF0000' }}>81–100</span>
                <span className="aqi-modal-item__label">Очень плохо</span>
              </div>
              <span className="aqi-modal-item__advice">Высокое загрязнение. Рекомендуется оставаться в помещении.</span>
            </li>
            <li className="aqi-modal-item" style={{ borderLeftColor: '#C20000' }}>
              <div className="aqi-modal-item__left">
                <span className="aqi-modal-item__badge" style={{ backgroundColor: '#C20000' }}>100+</span>
                <span className="aqi-modal-item__label">Опасно</span>
              </div>
              <span className="aqi-modal-item__advice">Опасный уровень! Закройте окна, используйте очистители воздуха.</span>
            </li>
          </ul>
        </section>

        {/* Источники данных */}
        <section className="modal-section">
          <h3 className="modal-section__title">Источники данных</h3>
          <p className="modal-section__text">
            Для обеспечения максимальной достоверности и доступности сервис агрегирует
            информацию из двух независимых метеорологических провайдеров:
          </p>
          <div className="sources-list">
            <div className="source-badge">
              <strong>Open-Meteo</strong> — основной источник численного моделирования атмосферы
            </div>
            <div className="source-badge">
              <strong>OpenWeatherMap</strong> — резервный источник станционных замеров
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
