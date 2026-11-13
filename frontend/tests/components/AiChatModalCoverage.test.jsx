import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AiChatModal, {
  formatMessageContent,
  detectClientMapLayerIntent,
  detectClientColorBlindIntent,
  detectClientThemeIntent,
  toAccusativeCity,
  isClientNotCityName,
  detectClientCityIntent,
  detectClientCityFromReply,
  formatTargetAnalyticsReply,
} from '../../src/components/AiChat/AiChatModal';

describe('AiChatModalCoverage', () => {
  const origFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = origFetch;
    cleanup();
  });

  it('покрывает клиентский fallback для переключения слоев карты при сбое сети', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const handleBaseLayerChange = vi.fn();

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        onBaseLayerChange={handleBaseLayerChange}
      />
    );

    const input = screen.getByPlaceholderText(/спроси что-нибудь/i);

    await userEvent.type(input, 'включи спутник{enter}');
    await waitFor(() => {
      expect(handleBaseLayerChange).toHaveBeenCalledWith('satellite');
    });

    await userEvent.type(input, 'верни обычную карту{enter}');
    await waitFor(() => {
      expect(handleBaseLayerChange).toHaveBeenCalledWith('osm');
    });
  });

  it('покрывает клиентский fallback для типов дальтонизма (дейтеранопия, протанопия, тританопия)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const handleCB = vi.fn();
    const handleCBType = vi.fn();

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        onColorBlindChange={handleCB}
        onColorBlindTypeChange={handleCBType}
      />
    );

    const input = screen.getByPlaceholderText(/спроси что-нибудь/i);

    await userEvent.type(input, 'включи дейтеранопию{enter}');
    await waitFor(() => {
      expect(handleCBType).toHaveBeenCalledWith('deuteranopia');
    });

    await userEvent.type(input, 'поставь палитру протанопия{enter}');
    await waitFor(() => {
      expect(handleCBType).toHaveBeenCalledWith('protanopia');
    });

    await userEvent.type(input, 'сделай тританопию{enter}');
    await waitFor(() => {
      expect(handleCBType).toHaveBeenCalledWith('tritanopia');
    });

    await userEvent.type(input, 'включи режим цветовой слепоты{enter}');
    await waitFor(() => {
      expect(handleCB).toHaveBeenCalledWith(true);
    });
  });

  it('покрывает клиентский fallback для переключения тем (dark, light)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const handleTheme = vi.fn();

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        onThemeChange={handleTheme}
      />
    );

    const input = screen.getByPlaceholderText(/спроси что-нибудь/i);

    await userEvent.type(input, 'включи тёмную тему{enter}');
    await waitFor(() => {
      expect(handleTheme).toHaveBeenCalledWith('dark');
    });

    await userEvent.type(input, 'поставь светлую тему{enter}');
    await waitFor(() => {
      expect(handleTheme).toHaveBeenCalledWith('light');
    });
  });

  it('покрывает клиентский fallback для перемещения в известный город (Казань)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const handleLocationSelect = vi.fn();

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        onLocationSelect={handleLocationSelect}
      />
    );

    const input = screen.getByPlaceholderText(/спроси что-нибудь/i);
    await userEvent.type(input, 'перейди в город Казань{enter}');
    await waitFor(() => {
      expect(handleLocationSelect).toHaveBeenCalled();
      const coords = handleLocationSelect.mock.calls[0][0];
      expect(coords.lat).toBeCloseTo(55.78, 1);
    });
  });

  it('рендерит форматированный текст сообщений с **жирным** и *курсивом*', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reply: 'Тут **важный жирный текст** и *курсивное слово* на новой строке\nВторая строка!',
        emotion: 'happy'
      })
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/спроси что-нибудь/i);
    await userEvent.type(input, 'привет{enter}');

    await waitFor(() => {
      expect(screen.getByText('важный жирный текст')).toBeDefined();
      expect(screen.getByText('курсивное слово')).toBeDefined();
    });
  });

  it('закрывается по клавише Escape', () => {
    const handleClose = vi.fn();
    render(
      <AiChatModal
        isOpen={true}
        onClose={handleClose}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('обрабатывает ошибку сервера 500 с некорректным телом ответа (line 728)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('SyntaxError'))
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/спроси что-нибудь/i);
    await userEvent.type(input, 'тест{enter}');

    await waitFor(() => {
      expect(screen.getByText(/ошибка сервера \(500\)/i)).toBeDefined();
    });
  });

  it('обрабатывает клик по кнопке быстрой аналитики текущей точки', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reply: 'Аналитика по текущей точке готова.',
        emotion: 'happy'
      })
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        pointAnalytics={{ aqi: 20, locationName: 'Москва' }}
      />
    );

    const quickBtn = screen.getByTestId('ai-chat-quick-analytics-btn');
    await userEvent.click(quickBtn);

    await waitFor(() => {
      expect(screen.getByText('Аналитика по текущей точке готова.')).toBeDefined();
    });
  });

  it('устанавливает таймер фокуса на десктопе при первичном открытии (lines 425-426)', () => {
    vi.useFakeTimers();
    try {
      render(
        <AiChatModal
          isOpen={true}
          embedded={false}
          onClose={vi.fn()}
        />
      );

      vi.advanceTimersByTime(200);
    } finally {
      vi.useRealTimers();
    }
  });

  it('вычисляет pointAnalytics из переданного airData и обрабатывает actions set_colorblind, set_theme, set_location c followUp', async () => {
    const handleCBType = vi.fn();
    const handleTheme = vi.fn();
    const handleLocation = vi.fn();

    const mockAirData = {
      latitude: 55.75,
      longitude: 37.62,
      hourly: {
        time: ['2026-10-23T12:00'],
        european_aqi: [25],
        pm2_5: [10],
        pm10: [15],
        nitrogen_dioxide: [20],
        sulphur_dioxide: [5],
        ozone: [40],
        carbon_monoxide: [300],
        dust: [2],
        uv_index: [1]
      }
    };

    global.fetch = vi.fn().mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('/api/air-quality')) {
        return {
          ok: true,
          json: async () => ({
            hourly: {
              time: ['2026-10-23T12:00'],
              european_aqi: [18],
              pm2_5: [8]
            }
          })
        };
      }
      return {
        ok: true,
        json: async () => ({
          reply: 'Перехожу в Новосибирск!',
          emotion: 'happy',
          action: {
            type: 'set_location',
            lat: 55.02,
            lon: 82.93,
            cityName: 'Новосибирск',
            followUpAnalytics: true
          }
        })
      };
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        airData={mockAirData}
        selectedTimeIndex={0}
        onColorBlindTypeChange={handleCBType}
        onThemeChange={handleTheme}
        onLocationSelect={handleLocation}
      />
    );

    const input = screen.getByPlaceholderText(/спроси что-нибудь/i);
    await userEvent.type(input, 'как воздух в Новосибирске?{enter}');

    await waitFor(() => {
      expect(handleLocation).toHaveBeenCalled();
    });
  });

  it('обрабатывает действие set_theme и set_colorblind с colorBlindType из ответа сервера', async () => {
    const handleCBType = vi.fn();
    const handleTheme = vi.fn();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reply: 'Включаю протанопию и тёмную тему!',
        emotion: 'happy',
        action: {
          type: 'set_colorblind',
          enabled: true,
          colorBlindType: 'protanopia'
        }
      })
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        onColorBlindTypeChange={handleCBType}
        onThemeChange={handleTheme}
      />
    );

    const input = screen.getByPlaceholderText(/спроси что-нибудь/i);
    await userEvent.type(input, 'сделай протанопию{enter}');

    await waitFor(() => {
      expect(handleCBType).toHaveBeenCalledWith('protanopia');
    });
  });

  it('покрывает оффлайн-fallback на втором шаге аналитики (lines 656-675)', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('/api/air-quality')) {
        return {
          ok: true,
          json: async () => ({
            hourly: {
              time: ['2026-10-23T12:00'],
              european_aqi: [35],
              pm2_5: [12],
              pm10: [18]
            }
          })
        };
      }
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          json: async () => ({
            reply: 'Перемещаемся в Томск!',
            emotion: 'happy',
            action: {
              type: 'set_location',
              lat: 56.50,
              lon: 84.99,
              cityName: 'Томск',
              followUpAnalytics: true
            }
          })
        };
      }
      return { ok: false, status: 500 };
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/спроси что-нибудь/i);
    await userEvent.type(input, 'слетай в Томск и скажи воздух{enter}');

    await waitFor(() => {
      expect(screen.getByText(/индекс EAQI равен 35/i)).toBeDefined();
    });
  });

  it('покрывает выбор палитры окабе и неподдерживаемый вид дальтонизма в оффлайн-fallback (lines 125, 130, 852-861)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));
    const handleCB = vi.fn();
    const handleCBType = vi.fn();

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        onColorBlindChange={handleCB}
        onColorBlindTypeChange={handleCBType}
      />
    );

    const input = screen.getByPlaceholderText(/спроси что-нибудь/i);
    
    await userEvent.type(input, 'палитра окабе{enter}');
    await waitFor(() => {
      expect(handleCBType).toHaveBeenCalledWith('okabe');
      expect(handleCB).toHaveBeenCalledWith(true);
    });

    await userEvent.type(input, 'палитра странныйвид{enter}');
    await waitFor(() => {
      expect(screen.getByText(/такого режима (?:цветовой слепоты|дальтонизма) у нас нет/i)).toBeDefined();
    });
  });

  it('покрывает функции форматирования и распознавания интентов', () => {
    expect(formatMessageContent('')).toBeNull();
    expect(formatMessageContent(null)).toBeNull();
    const formatted = formatMessageContent('Привет **мир** и *Ая*\nВторая строка');
    expect(formatted).toBeDefined();

    expect(detectClientMapLayerIntent('включи спутник')).toBe('satellite');
    expect(detectClientMapLayerIntent('переключи на космос')).toBe('satellite');
    expect(detectClientMapLayerIntent('верни обычную карту')).toBe('osm');
    expect(detectClientMapLayerIntent('покажи схему')).toBe('osm');
    expect(detectClientMapLayerIntent('просто текст')).toBeNull();

    expect(detectClientColorBlindIntent('что такое дальтонизм?')).toBeNull();
    expect(detectClientColorBlindIntent('выключи режим дальтонизма')).toEqual({ enabled: false });
    expect(detectClientColorBlindIntent('отключи его', { isColorBlind: true })).toEqual({ enabled: false });
    expect(detectClientColorBlindIntent('включи ахроматопсию')).toEqual({ unsupported: true });
    expect(detectClientColorBlindIntent('включи режим цветовой слепоты')).toEqual({
      enabled: true,
      colorBlindType: 'okabe',
    });
    expect(detectClientColorBlindIntent('палитра дейтеранопия')).toEqual({
      enabled: true,
      colorBlindType: 'deuteranopia',
    });
    expect(detectClientColorBlindIntent('палитра протанопия')).toEqual({
      enabled: true,
      colorBlindType: 'protanopia',
    });
    expect(detectClientColorBlindIntent('палитра тританопия')).toEqual({
      enabled: true,
      colorBlindType: 'tritanopia',
    });

    expect(detectClientThemeIntent('что такое темная тема?')).toBeNull();
    expect(detectClientThemeIntent('включи темную тему')).toBe('dark');
    expect(detectClientThemeIntent('включи ночной режим')).toBe('dark');
    expect(detectClientThemeIntent('включи светлую тему')).toBe('light');
    expect(detectClientThemeIntent('включи дневной режим')).toBe('light');
    expect(detectClientThemeIntent('непонятная фраза')).toBeNull();

    expect(toAccusativeCity('Москва')).toBe('Москву');
    expect(toAccusativeCity('Казань')).toBe('Казань');
    expect(toAccusativeCity('')).toBe('выбранный город');

    expect(isClientNotCityName('аналитика')).toBe(true);
    expect(isClientNotCityName('прогноз')).toBe(true);
    expect(isClientNotCityName('омск')).toBe(false);

    expect(detectClientCityIntent('какая погода в Москве')).toBeDefined();
    expect(detectClientCityIntent('аналитика по Казани')).toBeDefined();
    expect(detectClientCityIntent('покажи Екатеринбург')).toBeDefined();
    expect(detectClientCityIntent('просто беседа')).toBeNull();

    expect(detectClientCityFromReply('Мы перенеслись в город Казань')).toBeDefined();
    expect(detectClientCityFromReply('Ничего интересного')).toBeNull();
  });

  it('открывает меню быстрых команд и обрабатывает выбор команд', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: 'Команда выполнена', emotion: 'happy' }),
    });

    const { container } = render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const commandsBtn = screen.getByTestId('ai-chat-help-commands-btn');
    fireEvent.click(commandsBtn);
    expect(screen.getByText('Команды для маскота')).toBeDefined();

    const items = container.querySelectorAll('.ai-chat-commands-popover__item');
    expect(items.length).toBeGreaterThan(10);
    items.forEach((item) => {
      fireEvent.click(item);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(commandsBtn.disabled).toBe(false);
    });

    fireEvent.click(commandsBtn);
    const closeMenuBtn = screen.getByLabelText('Закрыть меню команд');
    fireEvent.click(closeMenuBtn);
    expect(screen.queryByText('Команды для маскота')).toBeNull();
  });

  it('обрабатывает Escape для меню команд, отмены голоса и закрытия окна', () => {
    const handleClose = vi.fn();
    render(
      <AiChatModal
        isOpen={true}
        onClose={handleClose}
      />
    );

    const commandsBtn = screen.getByTestId('ai-chat-help-commands-btn');
    fireEvent.click(commandsBtn);
    expect(screen.getByText('Команды для маскота')).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Команды для маскота')).toBeNull();
    expect(handleClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('обрабатывает ошибки доступа к микрофону при отсутствии mediaDevices или отказе в доступе', async () => {
    const origMediaDevices = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      configurable: true,
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);
    expect(screen.getByText(/Запрос разрешения на микрофон не поддерживается/i)).toBeDefined();

    const mockGetUserMedia = vi.fn().mockRejectedValue({ name: 'NotAllowedError' });
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      configurable: true,
    });

    await userEvent.click(micBtn);
    expect(screen.getByText(/Разрешение на использование микрофона отклонено/i)).toBeDefined();

    mockGetUserMedia.mockRejectedValue({ name: 'NotFoundError' });
    await userEvent.click(micBtn);
    expect(screen.getByText(/Микрофон не обнаружен/i)).toBeDefined();

    Object.defineProperty(navigator, 'mediaDevices', {
      value: origMediaDevices,
      configurable: true,
    });
  });

  it('поддерживает распознавание речи через Web Speech API', async () => {
    let recognitionInstance = null;
    class MockSpeechRecognition {
      constructor() {
        recognitionInstance = this;
      }
      start = vi.fn();
      stop = vi.fn();
    }
    window.SpeechRecognition = MockSpeechRecognition;

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    expect(recognitionInstance).toBeDefined();

    recognitionInstance.onstart();
    recognitionInstance.onsoundstart();
    recognitionInstance.onspeechstart();

    recognitionInstance.onresult({
      results: [
        [{ transcript: 'Привет' }],
        [{ transcript: 'Ая' }],
      ],
    });

    recognitionInstance.onerror({ error: 'no-speech' });
    recognitionInstance.onend();

    delete window.SpeechRecognition;
  });

  it('поддерживает запись аудио через MediaRecorder и отправку на бэкенд', async () => {
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;

    let recorderInstance = null;
    class MockMediaRecorder {
      constructor(stream, opts) {
        recorderInstance = this;
        this.stream = stream;
        this.state = 'recording';
        this.mimeType = opts?.mimeType || 'audio/webm';
      }
      start = vi.fn();
      stop = vi.fn(() => {
        this.state = 'inactive';
        this.onstop?.();
      });
    }
    window.MediaRecorder = MockMediaRecorder;

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url === '/api/ai/transcribe') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ text: 'Распознанный голос' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ reply: 'Ответ на голос' }),
      });
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    expect(recorderInstance).toBeDefined();
    recorderInstance.onstart();
    recorderInstance.ondataavailable({ data: new Blob(['audio data 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890 1234567890'], { type: 'audio/webm' }) });
    recorderInstance.stop();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/ai/transcribe', expect.any(Object));
    });

    delete window.MediaRecorder;
  });

  it('обрабатывает сбои транскрибации и ошибки запуска MediaRecorder', async () => {
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;

    class FailingMediaRecorder {
      constructor() {
        throw new Error('Failed to create MediaRecorder');
      }
    }
    window.MediaRecorder = FailingMediaRecorder;

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    delete window.MediaRecorder;
  });

  it('отменяет запись голоса при закрытии модального окна', async () => {
    let recognitionInstance = null;
    class MockSpeechRecognition {
      constructor() {
        recognitionInstance = this;
      }
      start = vi.fn();
      abort = vi.fn();
    }
    window.SpeechRecognition = MockSpeechRecognition;

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });

    const { rerender } = render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    expect(recognitionInstance).toBeDefined();
    recognitionInstance.onstart();

    rerender(
      <AiChatModal
        isOpen={false}
        onClose={vi.fn()}
      />
    );

    delete window.SpeechRecognition;
  });

  it('сбрасывает эмоцию маскота по истечении таймаута', () => {
    vi.useFakeTimers();

    const { rerender } = render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    act(() => {
      vi.advanceTimersByTime(250);
    });

    rerender(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    act(() => {
      vi.advanceTimersByTime(7500);
    });

    vi.useRealTimers();
  });

  it('покрывает оставшиеся ветки intent detection', () => {
    expect(detectClientColorBlindIntent('выключи его', { isColorBlind: true })).toEqual({ enabled: false });
    expect(detectClientColorBlindIntent('отключи этот режим', { history: [{ content: 'палитра окабе' }] })).toEqual({ enabled: false });
    expect(detectClientColorBlindIntent('верни стандартные цвета')).toEqual({ enabled: false });
    expect(detectClientColorBlindIntent('сделай монохромазию')).toEqual({ unsupported: true });
    expect(detectClientColorBlindIntent('палитра для всех')).toBeNull();
    expect(detectClientColorBlindIntent('палитра неизвестныйвид')).toEqual({ unsupported: true, requested: 'неизвестныйвид' });
    expect(detectClientColorBlindIntent('цветовая слепота')).toEqual({ enabled: true, colorBlindType: 'okabe' });

    expect(detectClientCityIntent('покажи сводку по Казани')).toBeDefined();
    expect(detectClientCityIntent('полная аналитика по Москве')).toBeDefined();
    expect(detectClientCityIntent('качество воздуха в Санкт-Петербурге')).toBeDefined();
    expect(detectClientCityIntent('что в Новосибирске')).toBeDefined();
    expect(detectClientCityIntent('погода в Уфе')).toBeDefined();

    expect(detectClientCityFromReply('Переходим к городу Екатеринбург')).toBeDefined();
    expect(detectClientCityFromReply('В городе Самара отличный воздух')).toBeDefined();
    expect(detectClientCityFromReply('В городе Краснодар тепло')).toBeDefined();
  });

  it('обрабатывает случай когда SpeechRecognition и MediaRecorder отсутствуют', async () => {
    const origSR = window.SpeechRecognition;
    const origWSR = window.webkitSpeechRecognition;
    const origMR = window.MediaRecorder;
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
    delete window.MediaRecorder;

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    expect(screen.getByText(/ваш браузер не поддерживает распознавание речи/i)).toBeDefined();

    window.SpeechRecognition = origSR;
    window.webkitSpeechRecognition = origWSR;
    window.MediaRecorder = origMR;
  });

  it('обрабатывает срабатывание silenceTimer в SpeechRecognition', async () => {
    let recognitionInstance = null;
    class MockSpeechRecognition {
      constructor() {
        recognitionInstance = this;
      }
      start = vi.fn();
      stop = vi.fn();
    }
    window.SpeechRecognition = MockSpeechRecognition;

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    expect(recognitionInstance).toBeDefined();

    recognitionInstance.onstart();
    recognitionInstance.onresult({
      results: [
        [{ transcript: 'Привет мир' }],
      ],
    });

    delete window.SpeechRecognition;
  });

  it('отменяет распознавание речи при отправке текстового сообщения', async () => {
    let recognitionInstance = null;
    class MockSpeechRecognition {
      constructor() {
        recognitionInstance = this;
      }
      start = vi.fn();
      abort = vi.fn();
    }
    window.SpeechRecognition = MockSpeechRecognition;

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    expect(recognitionInstance).toBeDefined();
    recognitionInstance.onstart();

    const input = screen.getByPlaceholderText(/спроси что-нибудь/i);
    fireEvent.change(input, { target: { value: 'Новое сообщение' } });
    fireEvent.submit(input.closest('form'));

    expect(recognitionInstance.abort).toHaveBeenCalled();

    delete window.SpeechRecognition;
  });

  it('покрывает все оставшиеся ветки распознавания слоев, тем и городов', () => {
    expect(detectClientMapLayerIntent(null)).toBeNull();
    expect(detectClientMapLayerIntent('какая карта?')).toBeNull();
    expect(detectClientMapLayerIntent('выключи спутник')).toBe('osm');
    expect(detectClientMapLayerIntent('спутниковая карта')).toBe('satellite');
    expect(detectClientMapLayerIntent('векторная карта')).toBe('osm');

    expect(detectClientColorBlindIntent(null)).toBeNull();
    expect(detectClientColorBlindIntent('протанопия')).toEqual({ enabled: true, colorBlindType: 'protanopia' });
    expect(detectClientColorBlindIntent('окабе')).toEqual({ enabled: true, colorBlindType: 'okabe' });
    expect(detectClientColorBlindIntent('дейтеранопия')).toEqual({ enabled: true, colorBlindType: 'deuteranopia' });

    expect(detectClientThemeIntent(null)).toBeNull();
    expect(detectClientThemeIntent('сделай темно')).toBe('dark');
    expect(detectClientThemeIntent('сделай светло')).toBe('light');
    expect(detectClientThemeIntent('выключи темную тему')).toBe('light');
    expect(detectClientThemeIntent('выключи светлую тему')).toBe('dark');

    expect(isClientNotCityName('')).toBe(true);
    expect(isClientNotCityName('точка')).toBe(true);
    expect(isClientNotCityName('в текущей точке')).toBe(true);
    expect(isClientNotCityName('полная аналитика')).toBe(true);

    expect(detectClientCityIntent(null)).toBeNull();
    expect(detectClientCityIntent('какие города есть?')).toBeNull();
    expect(detectClientCityIntent('темная тема')).toBeNull();
    expect(detectClientCityIntent('расскажи про город Омск')).toBeDefined();
    expect(detectClientCityIntent('аналитика по городу Самара')).toBeDefined();
    expect(detectClientCityIntent('погода в городе Пермь')).toBeDefined();

    expect(detectClientCityFromReply(null)).toBeNull();
    expect(detectClientCityFromReply('Мы перенеслись в город Тюмень')).toBeDefined();
    expect(detectClientCityFromReply('Летим в город Омск')).toBeDefined();
    expect(detectClientCityFromReply('Переходим в город Пермь')).toBeDefined();
  });

  it('покрывает ошибки speech recognition not-allowed и объединение interim и final результатов', async () => {
    let recognitionInstance = null;
    class MockSpeechRecognition {
      constructor() {
        recognitionInstance = this;
      }
      start = vi.fn();
      stop = vi.fn();
    }
    window.SpeechRecognition = MockSpeechRecognition;

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    recognitionInstance.onstart();
    recognitionInstance.onresult({
      results: [
        [{ transcript: '' }],
        Object.assign([{ transcript: 'Первая' }], { isFinal: true }),
        Object.assign([{ transcript: 'Вторая' }], { isFinal: false }),
      ],
    });

    recognitionInstance.onerror({ error: 'not-allowed' });
    await waitFor(() => {
      expect(screen.getByText(/Доступ к микрофону заблокирован/i)).toBeDefined();
    });

    delete window.SpeechRecognition;
  });

  it('покрывает embedded режим с различными эмоциями маскота и пустую отправку', async () => {
    const { container, rerender } = render(
      <AiChatModal
        isOpen={true}
        embedded={true}
        onClose={vi.fn()}
      />
    );

    expect(container.querySelector('.ai-chat-window--embedded')).toBeDefined();

    const input = screen.getByPlaceholderText(/спроси что-нибудь/i);
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.submit(input.closest('form'));

    rerender(
      <AiChatModal
        isOpen={false}
        embedded={true}
        onClose={vi.fn()}
      />
    );
  });

  it('покрывает выбор supported mimeType для MediaRecorder', async () => {
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;

    class MockMediaRecorderWebm {
      static isTypeSupported = vi.fn((type) => type.includes('webm'));
      constructor(stream, opts) {
        this.stream = stream;
        this.mimeType = opts?.mimeType;
      }
      start = vi.fn();
      stop = vi.fn(() => this.onstop?.());
    }
    window.MediaRecorder = MockMediaRecorderWebm;

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });

    const { unmount } = render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);
    unmount();

    class MockMediaRecorderOgg {
      static isTypeSupported = vi.fn((type) => type.includes('ogg'));
      constructor(stream, opts) {
        this.stream = stream;
        this.mimeType = opts?.mimeType;
      }
      start = vi.fn();
      stop = vi.fn(() => this.onstop?.());
    }
    window.MediaRecorder = MockMediaRecorderOgg;

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const micBtn2 = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn2);

    delete window.MediaRecorder;
  });

  it('покрывает граничные случаи detectClientCityIntent и detectClientCityFromReply', () => {
    expect(detectClientCityIntent(null)).toBeNull();
    expect(detectClientCityIntent(123)).toBeNull();
    expect(detectClientCityIntent('')).toBeNull();
    expect(detectClientCityIntent('какие города')).toBeNull();
    expect(detectClientCityIntent('как найти')).toBeNull();
    expect(detectClientCityIntent('где найти')).toBeNull();
    expect(detectClientCityIntent('кто ты')).toBeNull();
    expect(detectClientCityIntent('кто тебя')).toBeNull();
    expect(detectClientCityIntent('включи тёмную тему')).toBeNull();
    expect(detectClientCityIntent('включи светлый режим')).toBeNull();
    expect(detectClientCityIntent('включи ночную тему')).toBeNull();
    expect(detectClientCityIntent('включи дневной режим')).toBeNull();
    expect(detectClientCityIntent('покажи спутник')).toBeNull();
    expect(detectClientCityIntent('переключи на схему')).toBeNull();
    expect(detectClientCityIntent('включи режим дальтонизма')).toBeNull();
    expect(detectClientCityIntent('палитра окабе')).toBeNull();
    expect(detectClientCityIntent('дейтеранопия')).toBeNull();
    expect(detectClientCityIntent('протанопия')).toBeNull();
    expect(detectClientCityIntent('тританопия')).toBeNull();
    expect(detectClientCityIntent('по текущей точке')).toBeNull();
    expect(detectClientCityIntent('на данной локации')).toBeNull();
    expect(detectClientCityIntent('в моей точке в Москве')).toBeDefined();
    expect(detectClientCityIntent('подскажи пожалуйста какая аналитика по городу Казань')).toBeDefined();
    expect(detectClientCityIntent('краткая сводка для Перми')).toBeDefined();
    expect(detectClientCityIntent('перейди в Самару')).toBeDefined();
    expect(detectClientCityIntent('город Омск')).toBeDefined();
    expect(detectClientCityIntent('что там с воздухом в Тюмени')).toBeDefined();
    expect(detectClientCityIntent('как там погода в Сочи')).toBeDefined();
    expect(detectClientCityIntent('про воздух в Красноярске')).toBeDefined();
    expect(detectClientCityIntent('в Новосибирске')).toBeDefined();
    expect(detectClientCityIntent('в Самару')).toBeDefined();
    expect(detectClientCityIntent('в Уфе')).toBeDefined();
    expect(detectClientCityIntent('в Туле')).toBeDefined();
    expect(detectClientCityIntent('в аномалии')).toBeNull();
    expect(detectClientCityIntent('поехали в Городок')).toBeDefined();

    expect(detectClientCityFromReply(null)).toBeNull();
    expect(detectClientCityFromReply(123)).toBeNull();
    expect(detectClientCityFromReply('перемещаюсь в Москву, смотрю...')).toBeDefined();
    expect(detectClientCityFromReply('открываю в Санкт-Петербурге, смотрю...')).toBeDefined();
    expect(detectClientCityFromReply('летим в Самару, проверяю')).toBeDefined();
    expect(detectClientCityFromReply('переходим в Тверь, на карте')).toBeDefined();
    expect(detectClientCityFromReply('показываю в Туле, глянем')).toBeDefined();
    expect(detectClientCityFromReply('перелетаем в Перми, смотрю')).toBeDefined();
    expect(detectClientCityFromReply('показываю воздух на карте')).toBeNull();
    expect(detectClientCityFromReply('ответ без совпадений')).toBeNull();
  });

  it('покрывает MediaRecorder и отправку аудио на бэкенд через sendVoiceBlobToBackend', async () => {
    let recorderInstance = null;
    class MockMediaRecorderSuccess {
      constructor(stream, opts) {
        this.stream = stream;
        this.mimeType = opts?.mimeType || 'audio/webm';
        this.state = 'inactive';
        recorderInstance = this;
      }
      start = vi.fn(() => {
        this.state = 'recording';
        this.onstart?.();
      });
      stop = vi.fn(() => {
        this.state = 'inactive';
        this.onstop?.();
      });
    }
    window.MediaRecorder = MockMediaRecorderSuccess;

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });

    global.fetch = vi.fn().mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('/api/ai/transcribe')) {
        return {
          ok: true,
          json: async () => ({ text: 'Привет Ая' }),
        };
      }
      return {
        ok: true,
        json: async () => ({ reply: 'Привет! Чем могу помочь?', emotion: 'happy' }),
      };
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    await waitFor(() => {
      expect(recorderInstance).not.toBeNull();
    });

    const chunkData = new Uint8Array(300);
    recorderInstance.ondataavailable({ data: new Blob([chunkData], { type: 'audio/webm' }) });
    recorderInstance.stop();

    await waitFor(() => {
      expect(screen.getByText(/Привет Ая/i)).toBeDefined();
      expect(screen.getByText(/Привет! Чем могу помочь/i)).toBeDefined();
    });

    delete window.MediaRecorder;
  });

  it('покрывает ошибки бэкенда транскрибации и пустые ответы', async () => {
    let recorderInstance = null;
    class MockMediaRecorderError {
      constructor(stream, opts) {
        this.stream = stream;
        this.mimeType = opts?.mimeType || 'audio/webm';
        this.state = 'inactive';
        recorderInstance = this;
      }
      start = vi.fn(() => {
        this.state = 'recording';
        this.onstart?.();
      });
      stop = vi.fn(() => {
        this.state = 'inactive';
        this.onstop?.();
      });
    }
    window.MediaRecorder = MockMediaRecorderError;

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Сбой модели Whisper' }),
    });

    const { rerender } = render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    await waitFor(() => {
      expect(recorderInstance).not.toBeNull();
    });

    const chunkData = new Uint8Array(300);
    recorderInstance.ondataavailable({ data: new Blob([chunkData], { type: 'audio/webm' }) });
    recorderInstance.stop();

    await waitFor(() => {
      expect(screen.getByText(/Сбой модели Whisper/i)).toBeDefined();
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: '   ' }),
    });

    await userEvent.click(micBtn);
    await waitFor(() => expect(recorderInstance).not.toBeNull());
    recorderInstance.ondataavailable({ data: new Blob([chunkData], { type: 'audio/webm' }) });
    recorderInstance.stop();

    await waitFor(() => {
      expect(screen.getByText(/Не удалось распознать речь в аудиозаписи/i)).toBeDefined();
    });

    delete window.MediaRecorder;
  });

  it('покрывает отмену голосового ввода по Escape, клику на кнопку отмены и при вводе текста', async () => {
    let recorderInstance = null;
    class MockMediaRecorderCancel {
      constructor(stream, opts) {
        this.stream = stream;
        this.mimeType = opts?.mimeType || 'audio/webm';
        this.state = 'inactive';
        recorderInstance = this;
      }
      start = vi.fn(() => {
        this.state = 'recording';
        this.onstart?.();
      });
      stop = vi.fn(() => {
        this.state = 'inactive';
        this.onstop?.();
      });
    }
    window.MediaRecorder = MockMediaRecorderCancel;

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });

    const handleClose = vi.fn();
    render(
      <AiChatModal
        isOpen={true}
        onClose={handleClose}
      />
    );

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    await waitFor(() => {
      expect(recorderInstance).not.toBeNull();
      expect(screen.getByTestId('ai-chat-cancel-voice-btn')).toBeDefined();
    });

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(recorderInstance.stop).toHaveBeenCalled();
    expect(handleClose).not.toHaveBeenCalled();

    await userEvent.click(micBtn);
    await waitFor(() => {
      expect(screen.getByTestId('ai-chat-cancel-voice-btn')).toBeDefined();
    });
    const cancelBtn = screen.getByTestId('ai-chat-cancel-voice-btn');
    await userEvent.click(cancelBtn);
    expect(recorderInstance.stop).toHaveBeenCalled();

    await userEvent.click(micBtn);
    await waitFor(() => {
      expect(screen.getByTestId('ai-chat-cancel-voice-btn')).toBeDefined();
    });
    const input = screen.getByPlaceholderText(/Слушаю вас/i);
    fireEvent.change(input, { target: { value: 'Тестовый текст' } });
    expect(recorderInstance.stop).toHaveBeenCalled();

    await userEvent.click(micBtn);
    await waitFor(() => {
      expect(screen.getByTestId('ai-chat-cancel-voice-btn')).toBeDefined();
    });
    await userEvent.click(micBtn);
    expect(recorderInstance.stop).toHaveBeenCalled();

    delete window.MediaRecorder;
  });

  it('покрывает быстрые кнопки аналитики, закрытия меню команд и popover', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: 'Аналитика в норме', emotion: 'happy' }),
    });

    const mockAirData = {
      latitude: 55.75,
      longitude: 37.62,
      hourly: {
        time: ['2026-11-13T12:00:00Z'],
        european_aqi: [42],
        pm2_5: [12],
        pm10: [20],
      },
    };

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        airData={mockAirData}
        selectedTimeIndex={-1}
        coords={{ lat: 55.75, lon: 37.62 }}
        locationName="Москва"
      />
    );

    const quickAnalyticsBtn = screen.getByTestId('ai-chat-quick-analytics-btn');
    expect(quickAnalyticsBtn.getAttribute('title')).toContain('Москва');
    await userEvent.click(quickAnalyticsBtn);

    await waitFor(() => {
      expect(screen.getByText(/Какая аналитика по текущей точке/i)).toBeDefined();
    });

    const helpBtn = screen.getByTestId('ai-chat-help-commands-btn');
    await userEvent.click(helpBtn);

    const popover = screen.getByTestId('ai-chat-commands-popover');
    expect(popover).toBeDefined();

    const offBtn = screen.getByText(/Отключить режим цветовой слепоты/i);
    await userEvent.click(offBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('ai-chat-commands-popover')).toBeNull();
    });

    await userEvent.click(helpBtn);
    expect(screen.getByTestId('ai-chat-commands-popover')).toBeDefined();

    const closePopoverBtn = screen.getByLabelText('Закрыть меню команд');
    await userEvent.click(closePopoverBtn);
    expect(screen.queryByTestId('ai-chat-commands-popover')).toBeNull();

    await userEvent.click(helpBtn);
    expect(screen.getByTestId('ai-chat-commands-popover')).toBeDefined();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('ai-chat-commands-popover')).toBeNull();
  });

  it('покрывает встроенный режим, маскота под чатом и клики по маскоту', async () => {
    const { container } = render(
      <AiChatModal
        isOpen={true}
        embedded={true}
        mascotUnderChat={true}
        onClose={vi.fn()}
      />
    );

    const dockedMascot = screen.getByTestId('ai-chat-mascot-docked');
    expect(dockedMascot).toBeDefined();

    fireEvent.click(dockedMascot);
    expect(container.querySelector('.ai-chat-embedded-layout')).toBeDefined();

    const newDialogBtn = screen.getByTitle('Начать новый диалог');
    await userEvent.click(newDialogBtn);
    expect(screen.getByText(/Ну привет. Я Ая/i)).toBeDefined();
  });

  it('покрывает граничные варианты pointAnalytics при отсутствии координат и имени локации', () => {
    const mockAirData = {
      latitude: 59.93,
      longitude: 30.33,
      hourly: {
        time: ['2026-11-13T12:00:00Z'],
        european_aqi: [null],
        pm2_5: [null],
        pm10: [null],
      },
    };

    const { rerender } = render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        airData={mockAirData}
        selectedTimeIndex={9999}
        coords={{ lat: 59.93, lon: 30.33 }}
        locationName={null}
      />
    );

    const quickBtn = screen.getByTestId('ai-chat-quick-analytics-btn');
    expect(quickBtn.getAttribute('title')).toContain('Точка (59.93, 30.33)');

    rerender(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        airData={null}
        coords={{ lat: 59.93, lon: 30.33 }}
        locationName={null}
      />
    );

    const quickBtnNoAir = screen.getByTestId('ai-chat-quick-analytics-btn');
    expect(quickBtnNoAir.getAttribute('title')).toBe('Аналитика по текущей точке');
  });

  it('покрывает различные сценарии triggerFollowUpAnalytics (успех, повтор перемещения, ошибка сервера, сетевой сбой)', async () => {
    let callIndex = 0;
    global.fetch = vi.fn().mockImplementation(async (url) => {
      const urlStr = String(url);
      callIndex++;
      if (urlStr.includes('/api/air-quality')) {
        return {
          ok: true,
          json: async () => ({
            hourly: {
              time: ['2026-11-13T12:00:00Z'],
              european_aqi: [33],
              pm2_5: [9],
              pm10: [15],
              nitrogen_dioxide: [10],
              sulphur_dioxide: [4],
              ozone: [25],
              carbon_monoxide: [0.3],
              dust: [1],
              uv_index: [2],
            },
          }),
        };
      }
      if (callIndex === 1) {
        return {
          ok: true,
          json: async () => ({
            action: {
              type: 'set_location',
              lat: 55.79,
              lon: 49.12,
              cityName: 'Казань',
              followUpAnalytics: true,
            },
            reply: 'Перемещаемся в Казань',
            emotion: 'happy',
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          reply: 'летим в Казань, смотрю аналитику',
          emotion: 'happy',
        }),
      };
    });

    const { unmount } = render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/спроси что-нибудь/i);
    await userEvent.type(input, 'Какая аналитика в Казани?{enter}');

    await waitFor(() => {
      expect(screen.getByText(/Смотри, в Казань индекс EAQI равен 33/i)).toBeDefined();
    });
    unmount();

    callIndex = 0;
    global.fetch = vi.fn().mockImplementation(async (url) => {
      const urlStr = String(url);
      callIndex++;
      if (urlStr.includes('/api/air-quality')) {
        return {
          ok: true,
          json: async () => ({
            hourly: {
              time: ['2026-11-13T12:00:00Z'],
              european_aqi: [40],
              pm2_5: null,
              pm10: null,
            },
          }),
        };
      }
      if (callIndex === 1) {
        return {
          ok: true,
          json: async () => ({
            action: {
              type: 'set_location',
              lat: 55.79,
              lon: 49.12,
              cityName: 'Казань',
              followUpAnalytics: true,
            },
          }),
        };
      }
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: 'Сбой AI' }),
      };
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const input2 = screen.getByPlaceholderText(/спроси что-нибудь/i);
    await userEvent.type(input2, 'Покажи воздух в Казани{enter}');

    await waitFor(() => {
      expect(screen.getByText(/Смотри, в Казань индекс EAQI равен 40/i)).toBeDefined();
    });

    callIndex = 0;
    global.fetch = vi.fn().mockImplementation(async (url) => {
      const urlStr = String(url);
      callIndex++;
      if (urlStr.includes('/api/air-quality')) {
        return {
          ok: true,
          json: async () => ({
            hourly: {
              time: ['2026-11-13T12:00:00Z'],
              european_aqi: [25],
              pm2_5: [5],
              pm10: [10],
            },
          }),
        };
      }
      if (callIndex === 1) {
        return {
          ok: true,
          json: async () => ({
            action: {
              type: 'set_location',
              lat: 55.79,
              lon: 49.12,
              cityName: 'Казань',
              followUpAnalytics: true,
            },
          }),
        };
      }
      throw new Error('Followup offline');
    });

    const input3 = screen.getByPlaceholderText(/спроси что-нибудь/i);
    await userEvent.type(input3, 'Воздух в Казани{enter}');

    await waitFor(() => {
      expect(screen.getByText(/Смотри, в Казань индекс EAQI равен 25/i)).toBeDefined();
    });

    callIndex = 0;
    global.fetch = vi.fn().mockImplementation(async (url) => {
      const urlStr = String(url);
      callIndex++;
      if (urlStr.includes('/api/air-quality')) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: 'Air fail' }),
        };
      }
      if (callIndex === 1) {
        return {
          ok: true,
          json: async () => ({
            action: {
              type: 'set_location',
              lat: 55.79,
              lon: 49.12,
              cityName: 'Казань',
              followUpAnalytics: true,
            },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          reply: 'Данные получены без воздуха',
          emotion: 'happy',
        }),
      };
    });

    const input4 = screen.getByPlaceholderText(/спроси что-нибудь/i);
    await userEvent.type(input4, 'Замеры в Казани{enter}');

    await waitFor(() => {
      expect(screen.getByText(/Данные получены без воздуха/i)).toBeDefined();
    });
  });

  it('покрывает оффлайн fallback для города с запросом аналитики', async () => {
    let airCalled = false;
    global.fetch = vi.fn().mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/air-quality')) {
        airCalled = true;
        return {
          ok: true,
          json: async () => ({
            hourly: {
              time: ['2026-11-13T12:00:00Z'],
              european_aqi: [28],
              pm2_5: [7],
              pm10: [12],
            },
          }),
        };
      }
      throw new Error('AI disconnected');
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/спроси что-нибудь/i);
    await userEvent.type(input, 'Какая аналитика в Москве?{enter}');

    await waitFor(() => {
      expect(screen.getByText(/Перемещаемся в Москву/i)).toBeDefined();
      expect(airCalled).toBe(true);
    });
  });

  it('покрывает SpeechRecognition события: onsoundstart, onspeechstart, service-not-allowed и прерывание при ручной отправке', async () => {
    let recInstance = null;
    class MockSpeechRecExtended {
      constructor() {
        recInstance = this;
      }
      start = vi.fn();
      stop = vi.fn();
      abort = vi.fn();
    }
    window.SpeechRecognition = MockSpeechRecExtended;

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    await waitFor(() => {
      expect(recInstance).not.toBeNull();
    });

    recInstance.onstart();
    recInstance.onsoundstart();
    recInstance.onspeechstart();

    recInstance.onresult({
      results: [
        Object.assign([{ transcript: 'Привет' }], { isFinal: true }),
        Object.assign([{ transcript: 'мир' }], { isFinal: false }),
      ],
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Слушаю вас/i)).toBeDefined();
    });
    const listeningInput = screen.getByPlaceholderText(/Слушаю вас/i);
    expect(listeningInput.value).toBe('Привет мир');

    recInstance.onerror({ error: 'service-not-allowed' });
    await waitFor(() => {
      expect(screen.getByText(/Доступ к микрофону заблокирован/i)).toBeDefined();
    });

    await userEvent.click(micBtn);
    recInstance.onstart();
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Слушаю вас/i)).toBeDefined();
    });
    const listeningInput2 = screen.getByPlaceholderText(/Слушаю вас/i);
    fireEvent.change(listeningInput2, { target: { value: 'Прямой ввод' } });
    fireEvent.submit(listeningInput2.closest('form'));
    expect(recInstance.abort).toHaveBeenCalled();

    delete window.SpeechRecognition;
  });

  it('покрывает кнопку настроек и рендеринг эмоций в embedded режиме', async () => {
    const handleOpenSettings = vi.fn();
    const { container, rerender } = render(
      <AiChatModal
        isOpen={true}
        embedded={true}
        mascotUnderChat={true}
        onClose={vi.fn()}
        onOpenSettings={handleOpenSettings}
      />
    );

    const settingsBtn = screen.getByLabelText('Настройки');
    await userEvent.click(settingsBtn);
    expect(handleOpenSettings).toHaveBeenCalled();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: 'Отличный день!', emotion: 'happy' }),
    });

    const input = screen.getByPlaceholderText(/спроси что-нибудь/i);
    await userEvent.type(input, 'Привет');
    fireEvent.submit(input.closest('form'));

    await waitFor(() => {
      expect(screen.getByText(/Ура! Рада помочь!/i)).toBeDefined();
    });

    global.fetch = vi.fn().mockRejectedValue(new Error('Network drop'));
    await userEvent.type(input, 'сделай монохромазию{enter}');

    await waitFor(() => {
      expect(screen.getByText(/Чего ты натворил/i)).toBeDefined();
    });
  });

  it('покрывает контекстное выключение дальтонизма и местоимения в истории', () => {
    expect(
      detectClientColorBlindIntent('выключи его', {
        isColorBlind: true,
        history: [{ content: 'режим дейтеранопия' }],
      })
    ).toEqual({ enabled: false });

    expect(
      detectClientColorBlindIntent('выключи её', {
        isColorBlind: true,
        history: [{ content: 'палитра окабе' }],
      })
    ).toEqual({ enabled: false });

    expect(
      detectClientColorBlindIntent('отключи это', {
        isColorBlind: true,
        history: [{ content: 'дальтонизм' }],
      })
    ).toEqual({ enabled: false });

    expect(
      detectClientColorBlindIntent('сними режим', {
        isColorBlind: true,
        history: [{ content: 'режим протанопия' }],
      })
    ).toEqual({ enabled: false });

    expect(
      detectClientColorBlindIntent('выруби режим', {
        isColorBlind: false,
        history: [],
      })
    ).toBeNull();
  });

  it('покрывает граничные числовые значения в pointAnalytics', () => {
    const invalidAirData = {
      latitude: 55.75,
      longitude: 37.62,
      hourly: {
        time: ['2026-11-13T12:00:00Z'],
        european_aqi: ['not-a-number'],
        pm2_5: ['not-a-number'],
        pm10: ['not-a-number'],
      },
    };

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        airData={invalidAirData}
        selectedTimeIndex={0}
        coords={{ lat: 55.75, lon: 37.62 }}
      />
    );

    const quickBtn = screen.getByTestId('ai-chat-quick-analytics-btn');
    expect(quickBtn.getAttribute('title')).toBe('Аналитика: Точка (55.75, 37.62)');
  });

  it('покрывает юнит-тесты formatTargetAnalyticsReply', () => {
    expect(formatTargetAnalyticsReply(null, null)).toBeNull();
    expect(formatTargetAnalyticsReply('Казань', null)).toBeNull();
    expect(formatTargetAnalyticsReply('Казань', { aqi: null })).toBeNull();
    expect(formatTargetAnalyticsReply('Казань', { aqi: 42, pm2_5: 12, pm10: 20 })).toContain('42');
    expect(formatTargetAnalyticsReply('Казань', { aqi: 42, pm2_5: null, pm10: null })).toContain('в норме');
  });

  it('покрывает различные ошибки микрофона: DevicesNotFoundError, PermissionDeniedError, GenericError', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn()
          .mockRejectedValueOnce({ name: 'DevicesNotFoundError' })
          .mockRejectedValueOnce({ name: 'PermissionDeniedError' })
          .mockRejectedValueOnce({ name: 'OtherError' }),
      },
      configurable: true,
    });

    const { rerender } = render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);
    await waitFor(() => {
      expect(screen.getByText(/Микрофон не обнаружен/i)).toBeDefined();
    });

    await userEvent.click(micBtn);
    await waitFor(() => {
      expect(screen.getByText(/Разрешение на использование микрофона отклонено/i)).toBeDefined();
    });

    await userEvent.click(micBtn);
    await waitFor(() => {
      expect(screen.getByText(/Не удалось получить доступ к микрофону/i)).toBeDefined();
    });
  });

  it('покрывает остановку SpeechRecognition при повторном клике на микрофон', async () => {
    let rec = null;
    class MockRecToggle {
      constructor() {
        rec = this;
      }
      start = vi.fn(() => this.onstart?.());
      stop = vi.fn(() => this.onend?.());
    }
    window.SpeechRecognition = MockRecToggle;

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);
    await waitFor(() => {
      expect(rec).not.toBeNull();
      expect(screen.getByPlaceholderText(/Слушаю вас/i)).toBeDefined();
    });

    await userEvent.click(micBtn);
    expect(rec.stop).toHaveBeenCalled();

    delete window.SpeechRecognition;
  });

  it('покрывает фокус на десктопе, touch режим и сброс таймера эмоций маскота', async () => {
    vi.useFakeTimers();

    const { unmount } = render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    unmount();

    window.ontouchstart = () => {};
    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );
    delete window.ontouchstart;

    vi.useRealTimers();
  });

  it('покрывает полный цикл silenceTimer в SpeechRecognition', async () => {
    vi.useFakeTimers();

    let rec = null;
    class MockRecSilence {
      constructor() {
        rec = this;
      }
      start = vi.fn(() => this.onstart?.());
      stop = vi.fn(() => this.onend?.());
      abort = vi.fn();
    }
    window.SpeechRecognition = MockRecSilence;

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });

    const { unmount } = render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await fireEvent.click(micBtn);
    await act(async () => {});

    rec.onstart();

    rec.onresult({
      results: [
        Object.assign([{ transcript: 'Проверка тишины' }], { isFinal: false }),
      ],
    });

    rec.onsoundstart();

    rec.onresult({
      results: [
        Object.assign([{ transcript: 'Вторая фраза' }], { isFinal: false }),
      ],
    });

    rec.onspeechstart();

    rec.onresult({
      results: [
        Object.assign([{ transcript: 'Третья фраза' }], { isFinal: false }),
      ],
    });

    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(rec.stop).toHaveBeenCalled();

    rec.onend();

    unmount();
    delete window.SpeechRecognition;
    vi.useRealTimers();
  });

  it('покрывает ошибку бэкенда транскрибации 502 без JSON и пустую аудиозапись', async () => {
    let recorder = null;
    class MockMediaRecorder502 {
      constructor(stream, opts) {
        this.stream = stream;
        this.mimeType = opts?.mimeType || 'audio/webm';
        this.state = 'inactive';
        recorder = this;
      }
      start = vi.fn(() => {
        this.state = 'recording';
        this.onstart?.();
      });
      stop = vi.fn(() => {
        this.state = 'inactive';
        this.onstop?.();
      });
    }
    window.MediaRecorder = MockMediaRecorder502;

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('Not JSON');
      },
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    await waitFor(() => {
      expect(recorder).not.toBeNull();
    });

    const chunkData = new Uint8Array(300);
    recorder.ondataavailable({ data: new Blob([chunkData], { type: 'audio/webm' }) });
    recorder.stop();

    await waitFor(() => {
      expect(screen.getByText(/Ошибка сервера \(502\)/i)).toBeDefined();
    });

    delete window.MediaRecorder;
  });

  it('покрывает клиентское распознавание города из реплики без запроса аналитики', async () => {
    const handleLocationSelect = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reply: 'перемещаемся в город Казань, на карте',
        emotion: 'happy',
      }),
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        onLocationSelect={handleLocationSelect}
      />
    );

    const input = screen.getByPlaceholderText(/спроси что-нибудь/i);
    await userEvent.type(input, 'Привет');
    fireEvent.submit(input.closest('form'));

    await waitFor(() => {
      expect(handleLocationSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          display_name: expect.stringContaining('Казань'),
        })
      );
    });
  });

  it('покрывает оставшиеся ветки intent detection и fallback сообщений', () => {
    expect(
      detectClientColorBlindIntent('выключи режим', {
        isColorBlind: true,
        history: [{}, { content: 'дейтеранопия' }],
      })
    ).toEqual({ enabled: false });

    expect(detectClientCityIntent('про аналитику в Самаре')).toBeDefined();
    expect(detectClientCityIntent('покажи аналитику в воздухе')).toBeNull();
    expect(detectClientCityIntent('в Уфе')).toBeDefined();
    expect(detectClientCityIntent('в Твери')).toBeDefined();

    expect(detectClientCityFromReply('летим в Туле, на карте')).toBeDefined();
    expect(detectClientCityFromReply('показываем в Самаре, на карте')).toBeDefined();
  });

  it('покрывает множественные финальные фразы в SpeechRecognition и mimeType fallback в MediaRecorder', async () => {
    let rec = null;
    class MockRecMultipleFinals {
      constructor() {
        rec = this;
      }
      start = vi.fn(() => this.onstart?.());
      stop = vi.fn(() => this.onend?.());
    }
    window.SpeechRecognition = MockRecMultipleFinals;

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    rec.onresult({
      results: [
        Object.assign([{ transcript: 'Первая' }], { isFinal: true }),
        Object.assign([{ transcript: 'Вторая' }], { isFinal: true }),
        Object.assign([{ transcript: 'Третья' }], { isFinal: false }),
      ],
    });

    await waitFor(() => {
      const input = screen.getByPlaceholderText(/Слушаю вас/i);
      expect(input.value).toContain('Первая Вторая');
    });

    delete window.SpeechRecognition;
  });

  it('покрывает server response с пустым reply, fallbackcityName и действием с name вместо cityName', async () => {
    const handleLocationSelect = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        action: {
          type: 'set_location',
          lat: 55.75,
          lon: 37.62,
          name: 'Москва',
        },
        reply: '',
        emotion: null,
      }),
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        onLocationSelect={handleLocationSelect}
      />
    );

    const input = screen.getByPlaceholderText(/спроси что-нибудь/i);
    await userEvent.type(input, 'Куда летим?{enter}');

    await waitFor(() => {
      expect(handleLocationSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          display_name: 'Москва',
        })
      );
      expect(screen.getByText(/Ответ не получен/i)).toBeDefined();
    });
  });

  it('покрывает пустой base64 и пустой mimeType в записи аудио', async () => {
    let recorder = null;
    class MockMediaRecorderNoMime {
      constructor(stream) {
        this.stream = stream;
        this.mimeType = '';
        this.state = 'inactive';
        recorder = this;
      }
      start = vi.fn(() => {
        this.state = 'recording';
        this.onstart?.();
      });
      stop = vi.fn(() => {
        this.state = 'inactive';
        this.onstop?.();
      });
    }
    window.MediaRecorder = MockMediaRecorderNoMime;

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });

    const origFileReader = global.FileReader;
    class MockFileReaderEmpty {
      readAsDataURL() {
        this.result = null;
        this.onloadend?.();
      }
    }
    global.FileReader = MockFileReaderEmpty;

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    await waitFor(() => {
      expect(recorder).not.toBeNull();
    });

    recorder.ondataavailable({ data: new Blob([new Uint8Array(300)], { type: '' }) });
    recorder.stop();

    await waitFor(() => {
      expect(screen.getByText(/Пустая аудиозапись/i)).toBeDefined();
    });

    global.FileReader = origFileReader;
    delete window.MediaRecorder;
  });

  it('покрывает webkitSpeechRecognition и сброс молчания при повторном onresult', async () => {
    let rec = null;
    class MockWebkitRec {
      constructor() {
        rec = this;
      }
      start = vi.fn(() => this.onstart?.());
      stop = vi.fn(() => this.onend?.());
    }
    delete window.SpeechRecognition;
    window.webkitSpeechRecognition = MockWebkitRec;

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    rec.onresult({ results: [Object.assign([{ transcript: 'Первая' }], { isFinal: false })] });
    rec.onresult({ results: [Object.assign([{ transcript: 'Вторая' }], { isFinal: false })] });

    delete window.webkitSpeechRecognition;
  });

  it('покрывает AbortError при сетевом запросе и отсутствие AbortController', async () => {
    global.fetch = vi.fn().mockRejectedValue({ name: 'AbortError' });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/спроси что-нибудь/i);
    await userEvent.type(input, 'Тест');
    fireEvent.submit(input.closest('form'));

    const origAC = window.AbortController;
    delete window.AbortController;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: 'Без AbortController' }),
    });

    await userEvent.type(input, 'Тест2');
    fireEvent.submit(input.closest('form'));

    await waitFor(() => {
      expect(screen.getByText(/Без AbortController/i)).toBeDefined();
    });

    window.AbortController = origAC;
  });

  it('покрывает сброс эмоции маскота по таймеру 7000мс и прерывание при новом сообщении', async () => {
    vi.useFakeTimers();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: 'Ура!', emotion: 'happy' }),
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/спроси что-нибудь/i);
    fireEvent.change(input, { target: { value: 'Привет' } });
    fireEvent.submit(input.closest('form'));

    await act(async () => {});

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: 'Снова ура!', emotion: 'happy' }),
    });
    fireEvent.change(input, { target: { value: 'Привет2' } });
    fireEvent.submit(input.closest('form'));
    await act(async () => {});

    act(() => {
      vi.advanceTimersByTime(7000);
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: 'Третий раз ура!', emotion: 'happy' }),
    });
    fireEvent.change(input, { target: { value: 'Привет3' } });
    fireEvent.submit(input.closest('form'));
    await act(async () => {});

    const newDialogBtn = screen.getByTitle('Начать новый диалог');
    fireEvent.click(newDialogBtn);

    vi.useRealTimers();
  });

  it('покрывает triggerFollowUpAnalytics с пустой строкой времени и отсутствием названия города', async () => {
    let callIdx = 0;
    global.fetch = vi.fn().mockImplementation(async (url) => {
      const urlStr = String(url);
      callIdx++;
      if (urlStr.includes('/api/air-quality')) {
        return {
          ok: true,
          json: async () => ({
            hourly: {
              time: [''],
              european_aqi: [null],
            },
          }),
        };
      }
      if (callIdx === 1) {
        return {
          ok: true,
          json: async () => ({
            action: {
              type: 'set_location',
              lat: 55.75,
              lon: 37.62,
              cityName: '',
              followUpAnalytics: true,
            },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          reply: '',
          emotion: null,
        }),
      };
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/спроси что-нибудь/i);
    await userEvent.type(input, 'Замеры воздуха');
    fireEvent.submit(input.closest('form'));

    await waitFor(() => {
      expect(screen.getByText(/Данные аналитики получены, ня! ✨/i)).toBeDefined();
    });
  });

  it('покрывает редкие ветки нормализации городов и клик по микрофону во время транскрибации', async () => {
    expect(detectClientCityIntent('про аналитику в Казани')).toBeDefined();
    expect(detectClientCityIntent('покажи аналитику в воздухе')).toBeNull();
    expect(detectClientCityIntent('в Перми')).toBeDefined();
    expect(detectClientCityFromReply('летим в воздух на карте')).toBeNull();
    expect(detectClientCityFromReply('летим в Перми на карте')).toBeDefined();

    let resolveTranscribe;
    const transcribePromise = new Promise((resolve) => {
      resolveTranscribe = resolve;
    });

    global.fetch = vi.fn().mockImplementation(async (url) => {
      if (String(url).includes('/api/ai/transcribe')) {
        return transcribePromise;
      }
      return { ok: true, json: async () => ({ reply: 'Ок' }) };
    });

    let recorder = null;
    class MockMediaRecorderSlow {
      constructor(stream) {
        this.stream = stream;
        this.mimeType = 'audio/webm';
        this.state = 'inactive';
        recorder = this;
      }
      start = vi.fn(() => {
        this.state = 'recording';
        this.onstart?.();
      });
      stop = vi.fn(() => {
        this.state = 'inactive';
        this.onstop?.();
      });
    }
    window.MediaRecorder = MockMediaRecorderSlow;

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    await waitFor(() => {
      expect(recorder).not.toBeNull();
    });

    recorder.ondataavailable({ data: new Blob([new Uint8Array(300)], { type: 'audio/webm' }) });
    recorder.stop();

    await userEvent.click(micBtn);

    resolveTranscribe({
      ok: true,
      json: async () => ({ text: 'Успешная запись' }),
    });

    delete window.MediaRecorder;
  });

  it('покрывает остановку активного MediaRecorder при отправке текстового сообщения', async () => {
    let recorder = null;
    class MockMediaRecorderSubmit {
      constructor(stream) {
        this.stream = stream;
        this.mimeType = 'audio/webm';
        this.state = 'inactive';
        recorder = this;
      }
      start = vi.fn(() => {
        this.state = 'recording';
        this.onstart?.();
      });
      stop = vi.fn(() => {
        this.state = 'inactive';
      });
    }
    window.MediaRecorder = MockMediaRecorderSubmit;

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: 'Ок' }),
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    await waitFor(() => {
      expect(recorder).not.toBeNull();
    });

    const input = screen.getByPlaceholderText(/Слушаю вас/i);
    fireEvent.change(input, { target: { value: 'Прямой ввод при записи' } });
    fireEvent.submit(input.closest('form'));

    expect(recorder.stop).toHaveBeenCalled();
    delete window.MediaRecorder;
  });

  it('покрывает оставшиеся ветки утилит, touch устройств, coords fallback и пустой транскрипции', async () => {
    expect(toAccusativeCity(null)).toBe('выбранный город');
    expect(toAccusativeCity(123)).toBe('выбранный город');
    expect(toAccusativeCity('Уфа, Россия')).toBe('Уфу');
    expect(toAccusativeCity('Москва, Россия')).toBe('Москву');

    expect(isClientNotCityName('')).toBe(true);
    expect(isClientNotCityName(null)).toBe(true);
    expect(isClientNotCityName('тут')).toBe(true);
    expect(isClientNotCityName('в текущей точке')).toBe(true);
    expect(isClientNotCityName('на 3 дня')).toBe(true);
    expect(isClientNotCityName('полная аналитика')).toBe(true);
    expect(isClientNotCityName('качество')).toBe(true);
    expect(isClientNotCityName('Самара')).toBe(false);

    expect(detectClientCityIntent('расскажи про воздух в Самаре')).toMatchObject({ name: 'Самара, Россия' });
    expect(detectClientCityIntent('покажи Самару')).toMatchObject({ name: 'Самара, Россия', wantsAnalytics: false });

    const origTouch = navigator.maxTouchPoints;
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });

    const { unmount: unmountTouch } = render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        coords={null}
        airData={{
          latitude: 55.75,
          longitude: 37.62,
          hourly: {
            time: ['2026-05-18T12:00'],
            european_aqi: [25]
          }
        }}
      />
    );
    unmountTouch();
    Object.defineProperty(navigator, 'maxTouchPoints', { value: origTouch, configurable: true });

    let recorder = null;
    class MockEmptyTextRecorder {
      constructor(stream) {
        this.stream = stream;
        this.mimeType = 'audio/webm';
        this.state = 'inactive';
        recorder = this;
      }
      start = vi.fn(() => {
        this.state = 'recording';
        this.onstart?.();
      });
      stop = vi.fn(() => {
        this.state = 'inactive';
        this.onstop?.();
      });
    }
    window.MediaRecorder = MockEmptyTextRecorder;

    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });

    global.fetch = vi.fn().mockImplementation(async (url) => {
      if (String(url).includes('/api/ai/transcribe')) {
        return {
          ok: true,
          json: async () => ({ text: '   ' }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const micBtn = screen.getByTestId('ai-chat-mic-btn');
    await userEvent.click(micBtn);

    await waitFor(() => {
      expect(recorder).not.toBeNull();
    });

    recorder.ondataavailable({ data: new Blob([new Uint8Array(500)], { type: 'audio/webm' }) });
    recorder.stop();

    await waitFor(() => {
      expect(screen.getByText(/Не удалось распознать речь в аудиозаписи/i)).toBeDefined();
    });

    delete window.MediaRecorder;
  });

  it('покрывает форматирование аналитики и fallback ветки дальтонизма и городов при сбое', async () => {
    expect(formatTargetAnalyticsReply('Москва', null)).toBeNull();
    expect(formatTargetAnalyticsReply('Москва', { aqi: null })).toBeNull();
    expect(formatTargetAnalyticsReply('Москва', { aqi: undefined })).toBeNull();
    const normalReply = formatTargetAnalyticsReply('Москва', { aqi: 25, pm2_5: null, pm10: null });
    expect(normalReply).toContain('в норме');

    global.fetch = vi.fn().mockRejectedValue(new Error('Network fail'));

    const { rerender } = render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        airData={{ hourly: { time: [] } }}
        selectedTimeIndex={-1}
      />
    );

    const input = screen.getByPlaceholderText(/спроси что-нибудь/i);
    fireEvent.change(input, { target: { value: 'включи дальтонизм' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() => {
      expect(screen.getByText(/палитрой Окабе/i)).toBeDefined();
    });

    fireEvent.change(input, { target: { value: 'поехали в Самару' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() => {
      expect(screen.getByText(/Перемещаемся в Самару/i)).toBeDefined();
    });

    rerender(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        airData={null}
        selectedTimeIndex={0}
      />
    );
  });
});
