import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import { AYA_DEFAULT_PHRASES, AYA_CHAT_DOCK_PHRASES } from '../../utils/ayaPhrases';
import '../../styles/AyaMascot.css';

Live2DModel.registerTicker(PIXI.Ticker);

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

  const canvasRef = useRef(null);
  const appRef = useRef(null);
  const modelRef = useRef(null);

  const activeEmotion = useMemo(() => {
    const valid = ['idle', 'think', 'happy', 'alert'];
    const norm = String(emotion || '').toLowerCase().trim();
    return valid.includes(norm) ? norm : 'idle';
  }, [emotion]);

  const currentMotionEmotionRef = useRef('idle');

  const playEmotion = useCallback(async (emotionName) => {
    currentMotionEmotionRef.current = emotionName;
    const model = modelRef.current;
    if (!model) return;
    const internalModel = model.internalModel;
    const mm = internalModel?.motionManager;
    const coreModel = internalModel?.coreModel;
    if (!mm) return;

    try {
      // 1. Полностью останавливаем все предыдущие движения
      mm.stopAllMotions();

      // 2. Сбрасываем параметры модели к дефолтным (чтобы наклон головы, сердитые глаза и брови не застывали)
      if (coreModel && typeof coreModel.getParameterCount === 'function') {
        const paramCount = coreModel.getParameterCount();
        for (let i = 0; i < paramCount; i++) {
          coreModel.setParameterValueByIndex(i, coreModel.getParameterDefaultValue(i), 1);
        }
        if (typeof coreModel.saveParameters === 'function') {
          coreModel.saveParameters();
        }
      }

      if (mm.groups) {
        mm.groups.idle = 'idle';
      }

      const motion = await mm.loadMotion(emotionName, 0);

      // Если за время асинхронной загрузки эмоция успела поменяться — отменяем
      if (currentMotionEmotionRef.current !== emotionName) {
        return;
      }

      if (motion) {
        if (typeof motion.setIsLoop === 'function') motion.setIsLoop(true);
        if (typeof motion.setIsLoopFadeIn === 'function') motion.setIsLoopFadeIn(false);
      }

      // Дополнительно останавливаем очередь перед запуском новой анимации
      mm.stopAllMotions();

      await model.motion(emotionName, 0, 3);
    } catch (err) {
      console.warn(`Live2D: ошибка воспроизведения ${emotionName}`, err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initPixi = async () => {
      if (!canvasRef.current) return;

      // Широкий буфер 1000x750 дает запас по бокам для волос при наклонах головы
      const app = new PIXI.Application({
        view: canvasRef.current,
        width: 1000,
        height: 750,
        backgroundAlpha: 0,
        resolution: 1,
        autoDensity: false,
        clearBeforeRender: true,
      });
      appRef.current = app;

      try {
        const model = await Live2DModel.from('/live2d/mascot/mascot.model3.json', {
          autoInteract: false,
        });

        if (!isMounted) {
          model.destroy();
          return;
        }

        model.anchor.set(0.5, 1);

        let scaleMult = 1.05;
        let yOffset = 10;

        if (size === 'chat-docked') {
          scaleMult = 1.55;
          yOffset = 220;
        } else if (size === 'sidebar') {
          scaleMult = 1.65;
          yOffset = 300;
        }

        model.scale.set((750 / model.height) * scaleMult);
        model.x = 500; // Центр широкого буфера (1000 / 2)
        model.y = 750 + yOffset;

        app.stage.addChild(model);
        modelRef.current = model;

        playEmotion(activeEmotion);
      } catch (err) {
        console.error('Ошибка загрузки Live2D модели Аи:', err);
      }
    };

    initPixi();

    return () => {
      isMounted = false;
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true, baseTexture: true });
        appRef.current = null;
        modelRef.current = null;
      }
    };
  }, [size]);

  useEffect(() => {
    if (modelRef.current) {
      playEmotion(activeEmotion);
    }
  }, [activeEmotion, playEmotion]);

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
          className={`aya-mascot aya-mascot--${size}`}
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
          aria-label="Маскот Ая"
      >
        {showBubble && (size === 'sidebar' || size === 'chat-docked') && (
            <div className={`aya-bubble ${isHovered ? 'aya-bubble--hovered' : ''}`} key={bubbleText} aria-live="polite">
          <span className="aya-bubble__text">
            {isHovered && size === 'sidebar' ? 'Тыкай, поболтаем! 💬' : bubbleText}
          </span>
              <span className="aya-bubble__arrow" aria-hidden="true" />
            </div>
        )}

        <div className="aya-character">
          <div className={`aya-character__glow ${isHovered ? 'aya-character__glow--hovered' : ''}`} aria-hidden="true" />

          <canvas
              ref={canvasRef}
              className="aya-canvas"
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