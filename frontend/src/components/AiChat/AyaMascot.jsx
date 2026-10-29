import { useState, useEffect, useMemo } from 'react';
import idleWebm from '../../assets/AI/idle.webm';
import { AYA_DEFAULT_PHRASES, AYA_CHAT_DOCK_PHRASES } from '../../utils/ayaPhrases';
import '../../styles/AyaMascot.css';

// Интерактивный анимированный маскот Ая (WebM Loop)
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

  const activeEmotion = useMemo(() => {
    const valid = ['idle', 'think', 'happy', 'alert'];
    const norm = String(emotion || '').toLowerCase().trim();
    return valid.includes(norm) ? norm : 'idle';
  }, [emotion]);

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

    // Случайная фраза раз в 15 секунд в спокойном режиме (сбрасывается при смене bubbleText)
    const timeout = setTimeout(() => {
      setBubbleText((prev) => {
        const others = pool.filter((p) => p !== prev);
        return others[Math.floor(Math.random() * others.length)] || pool[0];
      });
    }, size === 'chat-docked' ? 12000 : 15000);

    return () => clearTimeout(timeout);
  }, [customBubbleText, activeEmotion, pool, size, bubbleText]);

  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
    } else {
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
        {showBubble && (size === 'sidebar' || size === 'chat-docked') && (
            <div className="aya-bubble" key={bubbleText} aria-live="polite">
          <span className="aya-bubble__text">
            {(isHovered && size === 'sidebar') ? 'Тыкай, поболтаем! 💬' : bubbleText}
          </span>
              <span className="aya-bubble__arrow" aria-hidden="true" />
            </div>
        )}

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