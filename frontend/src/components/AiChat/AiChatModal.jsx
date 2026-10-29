// frontend/src/components/AiChat/AiChatModal.jsx

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import AyaMascot from './AyaMascot';
import { AYA_CHAT_DOCK_PHRASES } from '../../utils/ayaPhrases';
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


function detectClientMapLayerIntent(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.toLowerCase().trim();

  // 1. Возврат на схему или отключение спутника
  const TO_OSM_REGEX = /(?:выключи(?:ть)?|отключи(?:ть)?|убери|сними)\s+(?:со\s+)?спутник[а-я]*|(?:переключи(?:сь|ть)?\s+со\s+спутник[а-я]*)|(?:переключи(?:сь|ть)?|верни(?:ть)?|поставь|покажи|включи(?:ть)?|открой|перейди)\s+(?:мне\s+)?(?:на\s+)?(?:обычн(?:ую|ый)|стандартн(?:ую|ый)|схему|карту|osm|улицы|вектор)(?:\s+карту)?|^(?:обычная\s+карта|схема|верни\s+карту|карту|выключи\s+спутник|убери\s+спутник)$/i;
  if (TO_OSM_REGEX.test(clean)) return 'osm';

  // 2. Переключение на спутник
  const TO_SATELLITE_REGEX = /(?:включи(?:ть)?|переключи(?:сь|ть)?|поставь|покажи|открой|сделай|перейди|хочу|вруби|запусти)\s+(?:мне\s+)?(?:на\s+)?(?:спутник(?:овую\s+карту|\s+карту|\s+слой)?|космос|снимок\s+со\s+спутника)|^(?:спутник|со\s+спутника|спутниковая\s+карта|включи\s+спутник)$/i;
  if (TO_SATELLITE_REGEX.test(clean)) return 'satellite';

  return null;
}

/**
 * Распознает команду переключения режима доступности для дальтоников на клиенте:
 * { enabled: false } — выключение
 * { enabled: true, colorBlindType: 'okabe' | 'deuteranopia' | 'protanopia' | 'tritanopia' } — включение
 * { unsupported: true, requested?: string } — запрос нереализованного вида
 */
function detectClientColorBlindIntent(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.toLowerCase().trim();

  // Вопросы о дальтонизме не должны триггерить действие
  const IS_QUESTION_REGEX = /^(?:какие|какой|что\s+такое|расскажи|как\s+включить|как\s+настроить|где\s+настроить|почему|зачем)\b/i;
  if (IS_QUESTION_REGEX.test(clean)) return null;

  // 1. Выключение режима дальтонизма
  const TO_OFF_REGEX = /(?:выключи(?:ть)?|отключи(?:ть)?|убери|сними)\s+(?:мне\s+)?(?:режим\s+)?(?:дальтонизм[а-я]*|дальтоник[а-я]*|для\s+дальтоников|доступност[иь]|цветовую\s+слепоту|дейтеранопи[юеи]|протанопи[юеи]|тританопи[юеи]|окабе)|(?:верни(?:ть)?\s+(?:стандартн[а-я]+|обычн[а-я]+)\s+цвета)|^(?:выключи\s+дальтонизм|отключи\s+дальтонизм)$/i;
  if (TO_OFF_REGEX.test(clean)) return { enabled: false };

  // Известные медицинские термины, не реализованные в приложении
  const KNOWN_UNSUPPORTED = /(?:ахроматопс[а-я]*|монохромаз[а-я]*|дихромаз[а-я]*|тетрахромат[а-я]*|трихромат[а-я]*|блютоп[а-я]*|редтоп[а-я]*)/i;
  if (KNOWN_UNSUPPORTED.test(clean)) {
    return { unsupported: true };
  }

  // Проверяем паттерны вида: "режим дальтонизма <название>", "палитра <название>", "дальтонизм <название>"
  const SPECIFIED_TYPE_REGEX = /(?:режим(?:а)?\s+дальтонизма\s+|дальтонизм(?:а)?\s+|палитр[а-я]\s+|вид(?:а)?\s+дальтонизма\s+)([а-яa-z0-9_-]+)/i;
  const specMatch = clean.match(SPECIFIED_TYPE_REGEX);
  if (specMatch) {
    const word = specMatch[1].toLowerCase();
    if (/^(?:окабе|okabe)$/i.test(word)) return { enabled: true, colorBlindType: 'okabe' };
    if (/^(?:дейтераноп[а-я]*|deuteranop[a-z]*)$/i.test(word)) return { enabled: true, colorBlindType: 'deuteranopia' };
    if (/^(?:протаноп[а-я]*|protanop[a-z]*)$/i.test(word)) return { enabled: true, colorBlindType: 'protanopia' };
    if (/^(?:тританоп[а-я]*|tritanop[a-z]*)$/i.test(word)) return { enabled: true, colorBlindType: 'tritanopia' };
    if (!/^(?:по|для|в|на|онлайн|свой|новый|мне|только|все)$/i.test(word)) {
      return { unsupported: true, requested: word };
    }
  }

  // 2. Явное указание одного из 4 поддерживаемых видов
  if (/(?:дейтераноп[а-я]*|deuteranop[a-z]*)/i.test(clean)) return { enabled: true, colorBlindType: 'deuteranopia' };
  if (/(?:протаноп[а-я]*|protanop[a-z]*)/i.test(clean)) return { enabled: true, colorBlindType: 'protanopia' };
  if (/(?:тританоп[а-я]*|tritanop[a-z]*)/i.test(clean)) return { enabled: true, colorBlindType: 'tritanopia' };
  if (/(?:окабе|okabe)/i.test(clean)) return { enabled: true, colorBlindType: 'okabe' };

  // 3. Запрос на включение дальтонизма без типа -> Окабе по умолчанию
  const GENERAL_ON_REGEX = /(?:включи(?:ть)?|переключи(?:сь|ть)?|поставь|сделай|активируй|открой)\s+(?:мне\s+)?(?:режим\s+)?(?:дальтонизм[а-я]*|дальтоник[а-я]*|для\s+дальтоников|доступност[иь]|цветовую\s+слепоту)|^(?:дальтонизм|режим\s+дальтонизма)$/i;
  if (GENERAL_ON_REGEX.test(clean)) {
    return { enabled: true, colorBlindType: 'okabe' };
  }

  return null;
}

export default function AiChatModal({
  isOpen,
  onClose,
  onOpenSettings,
  embedded = false,
  mascotUnderChat = false,
  activeBaseLayer = 'osm',
  onBaseLayerChange,
  isColorBlind,
  onColorBlindChange,
  colorBlindType,
  onColorBlindTypeChange
}) {
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

  const currentEmotion = useMemo(() => {
    if (isLoading) return 'think';
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    return lastAssistant?.emotion || 'idle';
  }, [isLoading, messages]);

  const [dockedPhrase, setDockedPhrase] = useState(() => {
    return AYA_CHAT_DOCK_PHRASES[Math.floor(Math.random() * AYA_CHAT_DOCK_PHRASES.length)];
  });

  const mascotTimerRef = useRef(null);

  // Перезапуск таймера автосмены реплик на 12 секунд
  const resetMascotTimer = useCallback(() => {
    if (mascotTimerRef.current) {
      clearTimeout(mascotTimerRef.current);
      mascotTimerRef.current = null;
    }

    if (!embedded || !mascotUnderChat || !isOpen || currentEmotion !== 'idle') return;

    mascotTimerRef.current = setTimeout(() => {
      setDockedPhrase((prev) => {
        const others = AYA_CHAT_DOCK_PHRASES.filter((p) => p !== prev);
        return others[Math.floor(Math.random() * others.length)] || AYA_CHAT_DOCK_PHRASES[0];
      });
    }, 12000);
  }, [embedded, mascotUnderChat, isOpen, currentEmotion]);

  // Случайная реплика при клике на маскота с гарантированным сбросом и обновлением таймера
  const handleMascotClick = useCallback(() => {
    setDockedPhrase((prev) => {
      const others = AYA_CHAT_DOCK_PHRASES.filter((p) => p !== prev);
      return others[Math.floor(Math.random() * others.length)] || AYA_CHAT_DOCK_PHRASES[0];
    });
    resetMascotTimer();
  }, [resetMascotTimer]);

  // Периодическая смена реплик каждые 12 секунд (сбрасывается при клике/смене реплики)
  useEffect(() => {
    resetMascotTimer();
    return () => {
      if (mascotTimerRef.current) {
        clearTimeout(mascotTimerRef.current);
        mascotTimerRef.current = null;
      }
    };
  }, [resetMascotTimer, dockedPhrase]);

  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Скролл вниз при добавлении сообщений строго внутри контейнера сообщений (не дергая сайдбар и экран)
  const scrollToBottom = useCallback((smooth = true) => {
    const el = messagesContainerRef.current;
    if (el) {
      if (smooth && typeof el.scrollTo === 'function') {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      } else {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, []);

  // Скролл при появлении сообщений или индикатора набора ответа
  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages, isLoading, scrollToBottom]);

  // Фокус поля ввода ТОЛЬКО при первичном открытии на десктопе (не на мобильных тач-устройствах)
  useEffect(() => {
    if (!isOpen || embedded) return;
    const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    if (!isTouch) {
      const timer = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, embedded]);

  // Состояние и ссылки для голосового ввода (Web Speech API + MediaRecorder fallback)
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const transcriptRef = useRef('');
  const isCancelledRef = useRef(false);
  const messagesRef = useRef(messages);
  const inputMessageRef = useRef(inputMessage);
  const requestQueueRef = useRef([]);
  const isRequestingRef = useRef(false);
  const dialogGenerationRef = useRef(0);
  const abortControllerRef = useRef(null);
  const onBaseLayerChangeRef = useRef(onBaseLayerChange);
  const activeBaseLayerRef = useRef(activeBaseLayer);
  const onColorBlindChangeRef = useRef(onColorBlindChange);
  const onColorBlindTypeChangeRef = useRef(onColorBlindTypeChange);

  useEffect(() => {
    onBaseLayerChangeRef.current = onBaseLayerChange;
  }, [onBaseLayerChange]);

  useEffect(() => {
    activeBaseLayerRef.current = activeBaseLayer;
  }, [activeBaseLayer]);

  useEffect(() => {
    onColorBlindChangeRef.current = onColorBlindChange;
  }, [onColorBlindChange]);

  useEffect(() => {
    onColorBlindTypeChangeRef.current = onColorBlindTypeChange;
  }, [onColorBlindTypeChange]);

  useEffect(() => {
    inputMessageRef.current = inputMessage;
  }, [inputMessage]);

  // Единая точка добавления сообщений: ref обновляется сразу, чтобы история
  // для следующего запроса была актуальной без ожидания рендера.
  const appendMessage = useCallback((message) => {
    messagesRef.current = [...messagesRef.current, message];
    setMessages(messagesRef.current);
  }, []);

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

  // Последовательная обработка очереди: даже если пользователь отправил
  // несколько сообщений подряд, ответы придут в том же порядке.
  const processQueue = useCallback(async () => {
    if (isRequestingRef.current) return;
    isRequestingRef.current = true;

    try {
      while (requestQueueRef.current.length > 0) {
        const job = requestQueueRef.current.shift();

        // Задачи из старого диалога после «Начать новый диалог» игнорируем
        if (job.generation !== dialogGenerationRef.current) continue;

        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        abortControllerRef.current = controller;

        setIsLoading(true);

        try {
          // Собираем последние реплики для контекста (ровно до 4 реплик: 2 пары вопрос-ответ)
          const historyPayload = messagesRef.current
            .filter((m) => m.id !== 'init-1' && !m.isError && m.id !== job.userMessageId)
            .slice(-4)
            .map((m) => ({ role: m.role, content: m.content }));

          const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: job.text,
              history: historyPayload,
              currentLayer: activeBaseLayerRef.current
            }),
            ...(controller ? { signal: controller.signal } : {})
          });

          // Пока ждали ответ, пользователь начал новый диалог — ответ не нужен
          if (job.generation !== dialogGenerationRef.current) continue;

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Ошибка сервера (${response.status})`);
          }

          const data = await response.json();

          if (job.generation !== dialogGenerationRef.current) continue;

          // Интерактивное переключение карты по команде от AI
          if (data?.action?.type === 'set_base_layer' && data.action.layer) {
            if (typeof onBaseLayerChangeRef.current === 'function') {
              onBaseLayerChangeRef.current(data.action.layer);
            }
          }

          // Интерактивное переключение режима дальтонизма
          if (data?.action?.type === 'set_colorblind') {
            if (data.action.enabled) {
              if (typeof onColorBlindChangeRef.current === 'function') {
                onColorBlindChangeRef.current(true);
              }
              if (data.action.colorBlindType && typeof onColorBlindTypeChangeRef.current === 'function') {
                onColorBlindTypeChangeRef.current(data.action.colorBlindType);
              }
            } else {
              if (typeof onColorBlindChangeRef.current === 'function') {
                onColorBlindChangeRef.current(false);
              }
            }
          }

          appendMessage({
            id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            role: 'assistant',
            content: data.reply || 'Ответ не получен.',
            emotion: data.emotion || 'idle',
            timestamp: Date.now()
          });
        } catch (err) {
          if (err?.name === 'AbortError') continue;
          if (job.generation !== dialogGenerationRef.current) continue;

          // Клиентский fallback: переключение карты при сбое сетевого запроса
          const fallbackLayer = detectClientMapLayerIntent(job.text);
          if (fallbackLayer) {
            if (typeof onBaseLayerChangeRef.current === 'function') {
              onBaseLayerChangeRef.current(fallbackLayer);
            }
            appendMessage({
              id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              role: 'assistant',
              content: fallbackLayer === 'satellite'
                ? 'Секундочку! Переключаю карту на спутниковые снимки ESRI, смотри как здорово видно местность из космоса, ня! ✨'
                : 'Как скажешь! Возвращаю привычную схему OpenStreetMap, ня! ✨',
              emotion: 'happy',
              timestamp: Date.now()
            });
            continue;
          }

          // Клиентский fallback: переключение режима дальтонизма при сбое сетевого запроса
          const fallbackCB = detectClientColorBlindIntent(job.text);
          if (fallbackCB) {
            if (fallbackCB.unsupported) {
              appendMessage({
                id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                role: 'assistant',
                content: 'Хмпф! Такого режима дальтонизма у нас нет! 😾 В AeroCast поддерживаются только 4 проверенные палитры: Окабе (по умолчанию), Дейтеранопия, Протанопия и Тританопия. Выбери что-то из них, ня! ✨',
                emotion: 'alert',
                timestamp: Date.now()
              });
              continue;
            }
            if (fallbackCB.enabled === false) {
              if (typeof onColorBlindChangeRef.current === 'function') {
                onColorBlindChangeRef.current(false);
              }
              appendMessage({
                id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                role: 'assistant',
                content: 'Как скажешь! Возвращаю стандартную цветовую гамму, ня! ✨',
                emotion: 'happy',
                timestamp: Date.now()
              });
              continue;
            }
            if (fallbackCB.enabled === true) {
              const cbType = fallbackCB.colorBlindType || 'okabe';
              if (typeof onColorBlindChangeRef.current === 'function') {
                onColorBlindChangeRef.current(true);
              }
              if (typeof onColorBlindTypeChangeRef.current === 'function') {
                onColorBlindTypeChangeRef.current(cbType);
              }
              const typeLabels = { okabe: 'Окабе (по умолчанию)', deuteranopia: 'Дейтеранопию', protanopia: 'Протанопию', tritanopia: 'Тританопию' };
              appendMessage({
                id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                role: 'assistant',
                content: cbType === 'okabe'
                  ? 'Секундочку! Включаю режим доступности для людей с нарушением цветовосприятия с палитрой Окабе по умолчанию, теперь все показатели контрастные и различимые, ня! ✨'
                  : `Без проблем! Переключаю палитру дальтонизма на ${typeLabels[cbType] || 'Окабе'}, ня! ✨`,
                emotion: 'happy',
                timestamp: Date.now()
              });
              continue;
            }
          }

          console.error('AI chat error:', err);
          appendMessage({
            id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            role: 'assistant',
            isError: true,
            content: `Ошибка соединения: ${err.message}. Проверьте сервер и настройки AnyModel.`,
            timestamp: Date.now()
          });
        } finally {
          if (abortControllerRef.current === controller) {
            abortControllerRef.current = null;
          }
        }
      }
    } finally {
      isRequestingRef.current = false;
      setIsLoading(false);
    }
  }, [appendMessage]);

  const handleSendMessage = useCallback((e, directText = null) => {
    e?.preventDefault?.();
    const rawText = typeof directText === 'string' ? directText : inputMessageRef.current;
    const trimmed = rawText.trim();
    if (!trimmed) return;

    const userMsg = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now()
    };

    // Сообщение сразу показываем в чате, а запрос ставим в очередь,
    // чтобы можно было писать следующее, не дожидаясь ответа.
    appendMessage(userMsg);
    setInputMessage('');
    inputMessageRef.current = '';

    requestQueueRef.current.push({
      text: trimmed,
      userMessageId: userMsg.id,
      generation: dialogGenerationRef.current
    });

    void processQueue();
  }, [appendMessage, processQueue]);

  // Новый диалог: сбрасываем очередь и отменяем незавершенный запрос,
  // чтобы его ответ не попал в новый чат.
  const handleNewDialog = useCallback(() => {
    dialogGenerationRef.current += 1;
    requestQueueRef.current = [];

    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch {
        // ignore
      }
      abortControllerRef.current = null;
    }

    messagesRef.current = [INITIAL_GREETING];
    setMessages(messagesRef.current);
    setInputMessage('');
    inputMessageRef.current = '';
  }, []);

  // Конвертация аудио blob в base64
  const blobToBase64 = useCallback((blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result;
        const base64 = typeof dataUrl === 'string' ? dataUrl.split(',')[1] : '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }, []);

  // Отправка аудио на бэкенд для распознавания (fallback для Firefox и браузеров без SpeechRecognition)
  const sendVoiceBlobToBackend = useCallback(async (blob) => {
    setIsTranscribing(true);
    try {
      // Попытка использовать локальный транскриптор, если нативный отсутствует
      if (typeof window !== 'undefined' && !window.SpeechRecognition && !window.webkitSpeechRecognition) {
        try {
          const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/+esm');
          env.allowLocalModels = false;
          const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');
          
          const arrayBuffer = await blob.arrayBuffer();
          const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const result = await transcriber(audioBuffer.getChannelData(0));
          
          if (result && result.text) {
            setInputMessage(result.text);
            await handleSendMessage(null, result.text);
            return;
          }
        } catch (localErr) {
          console.warn('Local WASM transcription failed, falling back:', localErr);
        }
      }

      const base64 = await blobToBase64(blob);
      if (!base64) {
        throw new Error('Пустая аудиозапись');
      }

      const response = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio: base64,
          mimeType: blob.type || 'audio/webm'
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Ошибка сервера (${response.status})`);
      }

      const data = await response.json();
      const transcribedText = (data.text || '').trim();
      if (!transcribedText) {
        throw new Error('Не удалось распознать речь в аудиозаписи');
      }

      setInputMessage(transcribedText);
      await handleSendMessage(null, transcribedText);
    } catch (err) {
      console.warn('Backend audio transcribe error:', err);
      appendMessage({
        id: `err-voice-${Date.now()}`,
        role: 'assistant',
        isError: true,
        content: `Ошибка распознавания аудио: ${err.message}.`,
        timestamp: Date.now()
      });
    } finally {
      setIsTranscribing(false);
    }
  }, [appendMessage, blobToBase64, handleSendMessage]);

  // Отмена голосового ввода без отправки сообщения
  const handleCancelVoice = useCallback(() => {
    isCancelledRef.current = true;
    transcriptRef.current = '';
    audioChunksRef.current = [];

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
      mediaRecorderRef.current = null;
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }
      mediaStreamRef.current = null;
    }

    setIsListening(false);
    setInputMessage('');
    inputMessageRef.current = '';
  }, []);

  // Включение / остановка голосового ввода по клику на микрофон
  const handleToggleVoice = useCallback(async () => {
    if (isTranscribing) return;

    // Пользователь нажал микрофон во время записи -> останавливаем и отправляем надиктованное
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      return;
    }

    // 1. Проверяем доступность API запроса медиаустройств
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const unsupportedMsg = {
        id: `sys-${Date.now()}`,
        role: 'assistant',
        isError: true,
        content:
          'Запрос разрешения на микрофон не поддерживается в текущем окружении. Браузер требует безопасное соединение (HTTPS или http://localhost:5173).',
        timestamp: Date.now()
      };
      appendMessage(unsupportedMsg);
      return;
    }

    // 2. ЯВНО запрашиваем у браузера разрешение на использование микрофона
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.warn('Microphone permission error:', err);
      let errorText = 'Не удалось получить доступ к микрофону.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorText =
          'Разрешение на использование микрофона отклонено. Пожалуйста, разрешите доступ к микрофону в настройках браузера (значок микрофона или замка в адресной строке) и нажмите на микрофон снова.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorText = 'Микрофон не обнаружен. Пожалуйста, подключите микрофон к компьютеру.';
      }
      const deniedMsg = {
        id: `sys-${Date.now()}`,
        role: 'assistant',
        isError: true,
        content: errorText,
        timestamp: Date.now()
      };
      appendMessage(deniedMsg);
      return;
    }

    // Разрешение получено!
    isCancelledRef.current = false;
    transcriptRef.current = '';
    audioChunksRef.current = [];

    const SpeechRecognition =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    // ВАРИАНТ А: Браузер поддерживает Web Speech API (Google Chrome, Microsoft Edge, Яндекс.Браузер, Safari)
    if (SpeechRecognition) {
      // Освобождаем временный поток getUserMedia: SpeechRecognition использует аудиоканал автономно
      try {
        stream.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }

      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'ru-RU';
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event) => {
          let interim = '';
          let final = '';

          for (let i = 0; i < event.results.length; ++i) {
            const item = event.results[i];
            if (item.isFinal) {
              final += item[0].transcript;
            } else {
              interim += item[0].transcript;
            }
          }

          const currentText = final || interim;
          transcriptRef.current = final || currentText;
          setInputMessage(currentText);
        };

        recognition.onerror = (event) => {
          console.warn('SpeechRecognition error:', event.error);
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            const errMsg = {
              id: `err-mic-${Date.now()}`,
              role: 'assistant',
              isError: true,
              content:
                'Доступ к микрофону заблокирован. Разрешите доступ к микрофону в настройках браузера для Aerocast.',
              timestamp: Date.now()
            };
            appendMessage(errMsg);
          }
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
          const textToSend = transcriptRef.current.trim();
          transcriptRef.current = '';

          if (!isCancelledRef.current && textToSend) {
            handleSendMessage(null, textToSend);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
        setIsListening(false);
      }
      return;
    }

    // ВАРИАНТ Б: Браузер НЕ поддерживает Web Speech API (например, Mozilla Firefox),
    // но доступ к микрофону пользователь уже разрешил! Записываем через MediaRecorder и отправляем на бэкенд
    if (typeof MediaRecorder !== 'undefined') {
      try {
        mediaStreamRef.current = stream;
        const mimeType =
          typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
            ? 'audio/ogg;codecs=opus'
            : '';

        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.onstart = () => {
          setIsListening(true);
        };

        recorder.onstop = async () => {
          setIsListening(false);
          try {
            stream.getTracks().forEach((track) => track.stop());
          } catch {
            // ignore
          }
          mediaStreamRef.current = null;

          if (isCancelledRef.current) {
            audioChunksRef.current = [];
            return;
          }

          const recordedBlob = new Blob(audioChunksRef.current, {
            type: recorder.mimeType || 'audio/webm'
          });
          audioChunksRef.current = [];

          if (recordedBlob.size > 200) {
            await sendVoiceBlobToBackend(recordedBlob);
          }
        };

        recorder.start();
      } catch (err) {
        console.error('Failed to start MediaRecorder:', err);
        try {
          stream.getTracks().forEach((track) => track.stop());
        } catch {
          // ignore
        }
        setIsListening(false);
      }
      return;
    }

    // Если ни SpeechRecognition, ни MediaRecorder не поддерживаются в браузере:
    try {
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      // ignore
    }
    const fallbackMsg = {
      id: `sys-${Date.now()}`,
      role: 'assistant',
      isError: true,
      content:
        'Разрешение на микрофон получено, однако ваш браузер не поддерживает распознавание речи (Web Speech API). Для работы голосового ввода рекомендуются Google Chrome, Microsoft Edge или Яндекс.Браузер.',
      timestamp: Date.now()
    };
    appendMessage(fallbackMsg);
  }, [appendMessage, isTranscribing, isListening, handleSendMessage, sendVoiceBlobToBackend]);

  // Остановка записи при закрытии окна
  useEffect(() => {
    if (!isOpen && isListening) {
      handleCancelVoice();
    }
  }, [isOpen, isListening, handleCancelVoice]);

  // Закрытие по клавише Escape (или отмена голосового ввода, если идет запись)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isListening) {
          handleCancelVoice();
        } else {
          onClose?.();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isListening, handleCancelVoice]);

  if (!isOpen) return null;

  const chatWindowNode = (
    <div
      className={`ai-chat-window ${embedded ? 'ai-chat-window--embedded' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Шапка чата */}
      <header className="ai-chat-header">
        <div className="ai-chat-header__info">
          {!embedded && (
            <AyaMascot
              size="header"
              emotion={currentEmotion}
              showBubble={false}
            />
          )}
          <span className="ai-chat-header__status-dot" aria-hidden="true" />
          <span className="ai-chat-header__name">Ая</span>
        </div>

        <div className="ai-chat-header__actions">
          {onOpenSettings && (
            <button
              type="button"
              className="ai-chat-header__btn"
              onClick={onOpenSettings}
              title="Настройки"
              aria-label="Настройки"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
          )}

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
              onClick={handleNewDialog}
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
        <div className="ai-chat-messages" ref={messagesContainerRef}>
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

        {/* Форма ввода с голосовым управлением */}
        <footer className="ai-chat-footer">
          <form className="ai-chat-input-form" onSubmit={handleSendMessage}>
            <input
              ref={inputRef}
              type="text"
              className="ai-chat-input"
              value={inputMessage}
              onChange={(e) => {
                if (isListening) handleCancelVoice();
                inputMessageRef.current = e.target.value;
                setInputMessage(e.target.value);
              }}
              placeholder={
                isTranscribing
                  ? 'Распознавание речи...'
                  : isListening
                  ? 'Слушаю вас, говорите...'
                  : isLoading
                  ? 'Ая отвечает... можно написать ещё'
                  : 'Спроси что-нибудь...'
              }
              disabled={isTranscribing}
              maxLength={600}
            />
            {isListening && (
              <button
                type="button"
                className="ai-chat-cancel-voice-btn"
                onClick={handleCancelVoice}
                title="Отменить запись"
                aria-label="Отменить голосовой ввод"
                data-testid="ai-chat-cancel-voice-btn"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
            <button
              type="button"
              className={`ai-chat-mic-btn ${isListening ? 'ai-chat-mic-btn--listening' : ''}`}
              onClick={handleToggleVoice}
              disabled={isTranscribing}
              title={isListening ? "Остановить запись и отправить" : "Голосовой ввод"}
              aria-label={isListening ? "Остановить запись и отправить" : "Включить голосовой ввод"}
              data-testid="ai-chat-mic-btn"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </button>
            <button
              type="submit"
              className="ai-chat-send-btn"
              disabled={!inputMessage.trim() || isTranscribing}
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
  );

  if (embedded) {
    return (
      <div className="ai-chat-embedded-layout" role="region" aria-label="Чат с Аей">
        {chatWindowNode}
        {mascotUnderChat && (
          <div className="ai-chat-mascot-docked" data-testid="ai-chat-mascot-docked">
            <AyaMascot
              emotion={currentEmotion}
              size="chat-docked"
              showBubble={true}
              onClick={handleMascotClick}
              customBubbleText={
                isLoading
                  ? 'Хм-м-м, дай подумать...'
                  : currentEmotion === 'happy'
                  ? 'Ура! Рада помочь! ✨'
                  : currentEmotion === 'alert'
                  ? 'Б-бака! Чего ты натворил?! 💢'
                  : dockedPhrase
              }
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ai-chat-overlay" onClick={onClose} role="dialog" aria-modal="true">
      {chatWindowNode}
    </div>
  );
}
