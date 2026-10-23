// frontend/src/components/AiChat/AiChatModal.jsx

import { useState, useRef, useEffect, useCallback } from 'react';
import '../../styles/AiChatModal.css';

const INITIAL_GREETING = {
  id: 'init-1',
  role: 'assistant',
  content: 'Ну привет. Я Ая. Могу поболтать, могу подсказать по Aerocast.',
  timestamp: Date.now()
};

/**
 * Безопасное форматирование текста: **жирный**, *курсив* и переносы строк
 */
function formatMessageContent(text) {
  if (!text) return null;
  const lines = String(text).split('\n');

  return lines.map((line, lineIdx) => {
    const parts = [];
    const regex = /(\*\*.*?\*\*|\*.*?\*)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.substring(lastIndex, match.index));
      }

      const matchStr = match[0];
      if (matchStr.startsWith('**') && matchStr.endsWith('**')) {
        parts.push(
          <strong key={`${lineIdx}-${match.index}`}>
            {matchStr.slice(2, -2)}
          </strong>
        );
      } else if (matchStr.startsWith('*') && matchStr.endsWith('*')) {
        parts.push(
          <em key={`${lineIdx}-${match.index}`}>
            {matchStr.slice(1, -1)}
          </em>
        );
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < line.length) {
      parts.push(line.substring(lastIndex));
    }

    return (
      <span key={lineIdx} className="ai-chat-msg__line">
        {parts}
        {lineIdx < lines.length - 1 && <br />}
      </span>
    );
  });
}

export default function AiChatModal({ isOpen, onClose }) {
  const [messages, setMessages] = useState([INITIAL_GREETING]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem('aerocast_sound_enabled') !== 'false';
    } catch {
      return true;
    }
  });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Скролл вниз при добавлении сообщений
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages, scrollToBottom]);

  // Закрытие по клавише Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const toggleSound = () => {
    setIsSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('aerocast_sound_enabled', String(next));
      } catch (err) {
        console.warn('Could not save sound pref:', err);
      }
      return next;
    });
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault?.();
    const trimmed = inputMessage.trim();
    if (!trimmed || isLoading) return;

    const userMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Собираем последние реплики для контекста (ровно до 4 реплик: 2 пары вопрос-ответ)
      const historyPayload = messages
        .filter((m) => m.id !== 'init-1' && !m.isError)
        .slice(-4)
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: historyPayload
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Ошибка сервера (${response.status})`);
      }

      const data = await response.json();
      const assistantMsg = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'Ответ не получен.',
        emotion: data.emotion || 'idle',
        timestamp: Date.now()
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('AI chat error:', err);
      const errorMsg = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        isError: true,
        content: `Ошибка соединения: ${err.message}. Проверьте сервер и настройки AnyModel.`,
        timestamp: Date.now()
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ai-chat-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="ai-chat-window" onClick={(e) => e.stopPropagation()}>
        {/* Шапка чата */}
        <header className="ai-chat-header">
          <div className="ai-chat-header__info">
            <span className="ai-chat-header__status-dot" aria-hidden="true" />
            <span className="ai-chat-header__name">Ая</span>
            <span className="ai-chat-header__status-text">на связи</span>
            <span className="ai-chat-header__badge">am/free</span>
          </div>

          <div className="ai-chat-header__actions">
            <button
              type="button"
              className="ai-chat-header__btn"
              onClick={toggleSound}
              title={isSoundEnabled ? 'Звук включен' : 'Без звука'}
              aria-label={isSoundEnabled ? 'Выключить звук' : 'Включить звук'}
            >
              {isSoundEnabled ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              )}
            </button>

            <button
              type="button"
              className="ai-chat-header__btn"
              onClick={() => setMessages([INITIAL_GREETING])}
              title="Начать новый диалог"
              aria-label="Начать новый диалог"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </button>

            <button
              type="button"
              className="ai-chat-header__btn ai-chat-header__close"
              onClick={onClose}
              title="Закрыть чат"
              aria-label="Закрыть чат"
            >
              &times;
            </button>
          </div>
        </header>

        {/* Список сообщений */}
        <div className="ai-chat-messages">
          {messages.map((msg) => {
            const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            });

            const msgClass = [
              'ai-chat-msg',
              msg.role === 'assistant' ? 'ai-chat-msg--assistant' : 'ai-chat-msg--user',
              msg.isError ? 'ai-chat-msg--error' : ''
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <div key={msg.id} className={msgClass}>
                <div className="ai-chat-msg__bubble">
                  {formatMessageContent(msg.content)}
                </div>
                <span className="ai-chat-msg__time">{timeStr}</span>
              </div>
            );
          })}

          {isLoading && (
            <div className="ai-chat-typing" aria-label="Ая печатает ответ">
              <span className="ai-chat-typing__dot" />
              <span className="ai-chat-typing__dot" />
              <span className="ai-chat-typing__dot" />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Форма ввода */}
        <footer className="ai-chat-footer">
          <form className="ai-chat-input-form" onSubmit={handleSendMessage}>
            <input
              ref={inputRef}
              type="text"
              className="ai-chat-input"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Спроси что-нибудь..."
              disabled={isLoading}
              maxLength={600}
            />
            <button
              type="submit"
              className="ai-chat-send-btn"
              disabled={!inputMessage.trim() || isLoading}
              title="Отправить (Enter)"
              aria-label="Отправить сообщение"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
}
