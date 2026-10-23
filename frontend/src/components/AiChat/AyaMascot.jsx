// frontend/src/components/AiChat/AyaMascot.jsx
import { useState, useEffect, useMemo } from 'react';
import idleWebp from '../../assets/AI/idle.webp';
import thinkWebp from '../../assets/AI/think.webp';
import happyWebp from '../../assets/AI/happy.webp';
import alertWebp from '../../assets/AI/alert.webp';
import '../../styles/AyaMascot.css';

const DEFAULT_PHRASES = [
  'Ну привет! Я Ая.',
  'Подсказать по качеству воздуха?',
  'Я тут, если что...',
  'All systems go! 🌿',
  'Спроси меня что-нибудь!'
];

/**
 * Интерактивный анимированный маскот Ая
 * 
 * @param {string} emotion - Текущая эмоция: 'idle' | 'think' | 'happy' | 'alert'
 * @param {string} size - Размер: 'sidebar' | 'header' | 'compact'
 * @param {function} onClick - Обработчик клика
 * @param {boolean} showBubble - Отображать ли речевой баббл
 * @param {string} customBubbleText - Пользовательский текст баббла
 */
export default function AyaMascot({
  emotion = 'idle',
  size = 'sidebar',
  onClick,
  showBubble = true,
  customBubbleText = null
}) {
  const [bubbleText, setBubbleText] = useState(customBubbleText || DEFAULT_PHRASES[0]);
  const [isHovered, setIsHovered] = useState(false);

  // Валидация эмоции (фоллбек на idle)
  const activeEmotion = useMemo(() => {
    const valid = ['idle', 'think', 'happy', 'alert'];
    const norm = String(emotion || '').toLowerCase().trim();
    return valid.includes(norm) ? norm : 'idle';
  }, [emotion]);

  // Периодическая смена реплик в баббле (только если не задан кастомный текст)
  useEffect(() => {
    if (customBubbleText) {
      setBubbleText(customBubbleText);
      return;
    }

    if (activeEmotion === 'think') {
      setBubbleText('Хм-м-м, дай подумать...');
      return;
    }
    if (activeEmotion === 'alert') {
      setBubbleText('Б-бака! Чего ты натворил?! 💢');
      return;
    }
    if (activeEmotion === 'happy') {
      setBubbleText('Ура! Получилось отлично! ✨');
      return;
    }

    // Случайная фраза раз в 15 секунд в idle
    const interval = setInterval(() => {
      setBubbleText((prev) => {
        const others = DEFAULT_PHRASES.filter((p) => p !== prev);
        return others[Math.floor(Math.random() * others.length)] || DEFAULT_PHRASES[0];
      });
    }, 15000);

    return () => clearInterval(interval);
  }, [customBubbleText, activeEmotion]);

  return (
    <div
      className={`aya-mascot aya-mascot--${size} aya-mascot--${activeEmotion} ${
        isHovered ? 'aya-mascot--hover' : ''
      }`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      aria-label="Маскот Ая — открыть чат"
      title="Нажми, чтобы поболтать с Аей"
    >
      {/* Речевой баббл над маскотом (для сайдбара и docked-режима) */}
      {showBubble && (size === 'sidebar' || size === 'chat-docked') && (
        <div className="aya-bubble" aria-live="polite">
          <span className="aya-bubble__text">
            {isHovered ? 'Тыкай, поболтаем! 💬' : bubbleText}
          </span>
          <span className="aya-bubble__arrow" aria-hidden="true" />
        </div>
      )}

      {/* Контейнер персонажа с плавным кроссфейдом позов */}
      <div className="aya-character">
        <div className="aya-character__glow" aria-hidden="true" />

        {/* Слой IDLE */}
        <img
          src={idleWebp}
          alt="Ая спокойная"
          className={`aya-pose aya-pose--idle ${activeEmotion === 'idle' ? 'aya-pose--active' : ''}`}
          draggable="false"
        />

        {/* Слой THINK */}
        <img
          src={thinkWebp}
          alt="Ая думает"
          className={`aya-pose aya-pose--think ${activeEmotion === 'think' ? 'aya-pose--active' : ''}`}
          draggable="false"
        />

        {/* Слой HAPPY */}
        <img
          src={happyWebp}
          alt="Ая радуется"
          className={`aya-pose aya-pose--happy ${activeEmotion === 'happy' ? 'aya-pose--active' : ''}`}
          draggable="false"
        />

        {/* Слой ALERT */}
        <img
          src={alertWebp}
          alt="Ая возмущена"
          className={`aya-pose aya-pose--alert ${activeEmotion === 'alert' ? 'aya-pose--active' : ''}`}
          draggable="false"
        />

        {/* Бейдж статуса онлайн внизу */}
        {size === 'sidebar' && (
          <div className="aya-status-pill">
            <span className="aya-status-pill__dot" aria-hidden="true" />
            <span className="aya-status-pill__name">Ая</span>
            <span className="aya-status-pill__badge">AI</span>
          </div>
        )}
      </div>
    </div>
  );
}
