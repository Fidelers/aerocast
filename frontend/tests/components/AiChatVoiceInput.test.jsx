// frontend/tests/components/AiChatVoiceInput.test.jsx

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AiChatModal from '../../src/components/AiChat/AiChatModal';

describe('AiChatModal Voice Input (Голосовой ввод)', () => {
  let mockRecognitionInstance = null;
  let mockStream = null;

  class MockSpeechRecognition {
    constructor() {
      this.lang = '';
      this.continuous = false;
      this.interimResults = false;
      this.maxAlternatives = 1;
      this.onstart = null;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      this.start = vi.fn().mockImplementation(() => {
        if (this.onstart) this.onstart();
      });
      this.stop = vi.fn().mockImplementation(() => {
        if (this.onend) this.onend();
      });
      this.abort = vi.fn().mockImplementation(() => {
        if (this.onend) this.onend();
      });
      mockRecognitionInstance = this;
    }
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    mockRecognitionInstance = null;
    mockStream = {
      getTracks: vi.fn().mockReturnValue([
        { stop: vi.fn() }
      ])
    };

    // Мокаем navigator.mediaDevices.getUserMedia
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream)
      },
      writable: true,
      configurable: true
    });

    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
  });

  it('отображает кнопку микрофона в форме ввода', () => {
    render(<AiChatModal isOpen={true} onClose={vi.fn()} />);

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    expect(micBtn).toBeDefined();
    expect(micBtn.getAttribute('aria-label')).toBe('Включить голосовой ввод');
  });

  it('запрашивает у браузера разрешение на доступ к микрофону через getUserMedia', async () => {
    window.SpeechRecognition = MockSpeechRecognition;

    render(<AiChatModal isOpen={true} onClose={vi.fn()} />);

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(mockRecognitionInstance).not.toBeNull();
    expect(mockRecognitionInstance.start).toHaveBeenCalled();
  });

  it('корректно обрабатывает отказ пользователя в доступе к микрофону (NotAllowedError)', async () => {
    const permError = new Error('Permission denied');
    permError.name = 'NotAllowedError';
    navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(permError);

    render(<AiChatModal isOpen={true} onClose={vi.fn()} />);

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Разрешение на использование микрофона отклонено/i)
      ).toBeDefined();
    });
  });

  it('информирует о необходимости безопасного соединения (HTTPS / localhost), если mediaDevices недоступен', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      writable: true,
      configurable: true
    });

    render(<AiChatModal isOpen={true} onClose={vi.fn()} />);

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Запрос разрешения на микрофон не поддерживается в текущем окружении/i)
      ).toBeDefined();
    });
  });

  it('запускает распознавание речи при клике на микрофон, если API доступен', async () => {
    window.SpeechRecognition = MockSpeechRecognition;

    render(<AiChatModal isOpen={true} onClose={vi.fn()} />);

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    expect(mockRecognitionInstance).not.toBeNull();
    expect(mockRecognitionInstance.start).toHaveBeenCalled();
    expect(mockRecognitionInstance.lang).toBe('ru-RU');
    expect(mockRecognitionInstance.continuous).toBe(true);

    // Кнопка переходит в режим записи
    expect(micBtn.classList.contains('ai-chat-mic-btn--listening')).toBe(true);
    expect(screen.getByPlaceholderText('Слушаю вас, говорите...')).toBeDefined();
    expect(screen.getByTestId('ai-chat-cancel-voice-btn')).toBeDefined();
  });

  it('отображает промежуточный распознанный текст в поле ввода', async () => {
    window.SpeechRecognition = MockSpeechRecognition;

    render(<AiChatModal isOpen={true} onClose={vi.fn()} />);

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    // Симулируем событие onresult с промежуточным текстом
    mockRecognitionInstance.onresult({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'Какая сейчас погода' }], { isFinal: false })
      ]
    });

    const input = screen.getByRole('textbox');
    await waitFor(() => {
      expect(input.value).toBe('Какая сейчас погода');
    });
  });

  it('корректно склеивает несколько последовательных фраз с паузами через пробел', async () => {
    window.SpeechRecognition = MockSpeechRecognition;

    render(<AiChatModal isOpen={true} onClose={vi.fn()} />);

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    // Симулируем несколько последовательных порций речи (паузы между фразами)
    mockRecognitionInstance.onresult({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'Спасибо' }], { isFinal: true }),
        Object.assign([{ transcript: 'можешь переместиться в' }], { isFinal: true }),
        Object.assign([{ transcript: 'Екатеринбург' }], { isFinal: false })
      ]
    });

    const input = screen.getByRole('textbox');
    await waitFor(() => {
      expect(input.value).toBe('Спасибо можешь переместиться в Екатеринбург');
    });
  });

  it('автоматически вызывает stop() по истечении 3 секунд тишины после надиктованного текста', async () => {
    vi.useFakeTimers();
    window.SpeechRecognition = MockSpeechRecognition;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: 'Поняла', emotion: 'idle' })
    });

    render(<AiChatModal isOpen={true} onClose={vi.fn()} />);

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    fireEvent.click(micBtn);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockRecognitionInstance).not.toBeNull();

    mockRecognitionInstance.onresult({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'Покажи карту' }], { isFinal: true })
      ]
    });

    expect(mockRecognitionInstance.stop).not.toHaveBeenCalled();

    // Проматываем 3 секунды тишины
    vi.advanceTimersByTime(3000);

    expect(mockRecognitionInstance.stop).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('после окончания речи автоматически отправляет финальный текст нейросети', async () => {
    window.SpeechRecognition = MockSpeechRecognition;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reply: 'Погода отличная, воздух чистый!',
        emotion: 'happy'
      })
    });

    render(<AiChatModal isOpen={true} onClose={vi.fn()} />);

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    // Симулируем финальный результат распознавания
    mockRecognitionInstance.onresult({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'Покажи качество воздуха' }], { isFinal: true })
      ]
    });

    // Завершение сессии распознавания
    mockRecognitionInstance.onend();

    // Запрос должен быть отправлен с надиктованным текстом
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/ai/chat',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Покажи качество воздуха')
        })
      );
    });

    // Ответ ассистента должен отобразиться
    await waitFor(() => {
      expect(screen.getByText('Погода отличная, воздух чистый!')).toBeDefined();
    });
  });

  it('позволяет отменить голосовой ввод без отправки сообщения', async () => {
    window.SpeechRecognition = MockSpeechRecognition;
    global.fetch = vi.fn();

    render(<AiChatModal isOpen={true} onClose={vi.fn()} />);

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    // Наговариваем текст
    mockRecognitionInstance.onresult({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'Не отправляй это' }], { isFinal: false })
      ]
    });

    // Нажимаем кнопку отмены (крестик)
    const cancelBtn = screen.getByTestId('ai-chat-cancel-voice-btn');
    await userEvent.click(cancelBtn);

    expect(mockRecognitionInstance.abort).toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();

    const input = screen.getByRole('textbox');
    expect(input.value).toBe('');
  });

  it('в браузерах без SpeechRecognition (Firefox) использует MediaRecorder и бэкенд транскрипции', async () => {
    let mockRecorderInstance = null;

    class MockMediaRecorder {
      constructor(stream, options = {}) {
        this.stream = stream;
        this.options = options;
        this.state = 'inactive';
        this.ondataavailable = null;
        this.onstart = null;
        this.onstop = null;
        this.mimeType = 'audio/webm';
        this.start = vi.fn().mockImplementation(() => {
          this.state = 'recording';
          if (this.onstart) this.onstart();
        });
        this.stop = vi.fn().mockImplementation(() => {
          this.state = 'inactive';
          if (this.ondataavailable) {
            this.ondataavailable({ data: new Blob(['mock audio data chunks exceeding 200 bytes threshold........................................................................................................................................................'], { type: 'audio/webm' }) });
          }
          if (this.onstop) this.onstop();
        });
        mockRecorderInstance = this;
      }
    }
    MockMediaRecorder.isTypeSupported = vi.fn().mockReturnValue(true);

    window.MediaRecorder = MockMediaRecorder;

    global.fetch = vi.fn().mockImplementation(async (url) => {
      if (url === '/api/ai/transcribe') {
        return {
          ok: true,
          json: async () => ({ text: 'Уровень загрязнения в городе' })
        };
      }
      if (url === '/api/ai/chat') {
        return {
          ok: true,
          json: async () => ({ reply: 'Уровень загрязнения умеренный.', emotion: 'idle' })
        };
      }
      return { ok: false, status: 404 };
    });

    render(<AiChatModal isOpen={true} onClose={vi.fn()} />);

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    // Запуск записи через MediaRecorder
    await userEvent.click(micBtn);

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(mockRecorderInstance).not.toBeNull();
    expect(mockRecorderInstance.start).toHaveBeenCalled();

    // Остановка записи повторным кликом
    await userEvent.click(micBtn);

    expect(mockRecorderInstance.stop).toHaveBeenCalled();

    // Проверяем, что аудио отправлено на транскрипцию и затем в чат
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/ai/transcribe',
        expect.objectContaining({ method: 'POST' })
      );
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/ai/chat',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Уровень загрязнения в городе')
        })
      );
    });
  });
});
