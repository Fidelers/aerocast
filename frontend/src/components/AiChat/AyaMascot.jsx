// frontend/src/components/AiChat/AyaMascot.jsx
import { useState, useEffect, useMemo } from 'react';
import idleWebm from '../../assets/AI/idle.webm';
import { AYA_DEFAULT_PHRASES, AYA_CHAT_DOCK_PHRASES } from '../../utils/ayaPhrases';
import '../../styles/AyaMascot.css';


/**
 * Интерактивный анимированный маскот Ая (WebM Loop)
 *
 * @param {string} emotion - Текущая эмоция: 'idle' | 'think' | 'happy' | 'alert' (для текста баббла)
 * @param {string} size - Размер: 'sidebar' | 'header' | 'chat-docked'
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
  const pool = size === 'chat-docked' ? AYA_CHAT_DOCK_PHRASES : AYA_DEFAULT_PHRASES;
  const [bubbleText, setBubbleText] = useState(customBubbleText || pool[0]);
  const [isHovered, setIsHovered] = useState(false);

  // Валидация эмоции для контекстных фраз баббла
  const activeEmotion = useMemo(() => {
    const valid = ['idle', 'think', 'happy', 'alert'];
    const norm = String(emotion || '').toLowerCase().trim();
    return valid.includes(norm) ? norm : 'idle';
  }, [emotion]);

  // Периодическая смена реплик в баббле
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

    // Случайная фраза раз в 15 секунд в спокойном режиме
    const interval = setInterval(() => {
      setBubbleText((prev) => {
        const others = pool.filter((p) => p !== prev);
        return others[Math.floor(Math.random() * others.length)] || pool[0];
      });
    }, size === 'chat-docked' ? 12000 : 15000);

    return () => clearInterval(interval);
  }, [customBubbleText, activeEmotion, pool, size]);

  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
    } else if (size === 'chat-docked') {
      setBubbleText((prev) => {
        const others = pool.filter((p) => p !== prev);
        return others[Math.floor(Math.random() * others.length)] || pool[0];
      });
    }
  };

  return (
      <div
          className={`aya-mascot aya-mascot--${size} aya-mascot--${activeEmotion} ${isHovered ? 'aya-mascot--hover' : ''}`}
          onClick={handleClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleClick(e);
            }
          }}
          aria-label="Маскот Ая — открыть чат"
          title="Нажми, чтобы поболтать с Аей"
      >
        {/* Речевой баббл над маскотом */}
        {showBubble && (size === 'sidebar' || size === 'chat-docked') && (
            <div className="aya-bubble" key={bubbleText} aria-live="polite">
          <span className="aya-bubble__text">
            {(isHovered && size === 'sidebar') ? 'Тыкай, поболтаем! 💬' : bubbleText}
          </span>
              <span className="aya-bubble__arrow" aria-hidden="true" />
            </div>
        )}

        {/* Контейнер персонажа с бесшовным видео */}
        <div className="aya-character">
          <div className="aya-character__glow" aria-hidden="true" />
          <span className={`aya-pose aya-pose--idle ${activeEmotion === 'idle' ? 'aya-pose--active' : ''}`} aria-hidden="true" style={{ display: 'none' }} />
          <span className={`aya-pose aya-pose--think ${activeEmotion === 'think' ? 'aya-pose--active' : ''}`} aria-hidden="true" style={{ display: 'none' }} />
          <span className={`aya-pose aya-pose--happy ${activeEmotion === 'happy' ? 'aya-pose--active' : ''}`} aria-hidden="true" style={{ display: 'none' }} />
          <span className={`aya-pose aya-pose--alert ${activeEmotion === 'alert' ? 'aya-pose--active' : ''}`} aria-hidden="true" style={{ display: 'none' }} />

          <video
              src={idleWebm}
              autoPlay
              loop
              muted
              playsInline
              className="aya-video"
              aria-hidden="true"
          />

          {/* Бейдж статуса онлайн в сайдбаре */}
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