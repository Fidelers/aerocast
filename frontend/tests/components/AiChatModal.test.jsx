// frontend/tests/components/AiChatModal.test.jsx

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AiChatModal from '../../src/components/AiChat/AiChatModal';

describe('AiChatModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('не рендерится, если isOpen === false', () => {
    const { container } = render(<AiChatModal isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('рендерит начальное приветствие и имя Ая при открытии', () => {
    render(<AiChatModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getAllByText(/(?:Ая|Ани)/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Ну привет\. Я (?:Ая|Ани)\./i)).toBeDefined();
    expect(screen.getByPlaceholderText('Спроси что-нибудь...')).toBeDefined();
  });

  it('вызывает onClose при клике на крестик', async () => {
    const handleClose = vi.fn();
    render(<AiChatModal isOpen={true} onClose={handleClose} />);

    const closeBtn = screen.getByLabelText('Закрыть чат');
    await userEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('вызывает onClose при нажатии клавиши Escape', () => {
    const handleClose = vi.fn();
    render(<AiChatModal isOpen={true} onClose={handleClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('переключает состояние звука и сохраняет в localStorage', async () => {
    render(<AiChatModal isOpen={true} onClose={vi.fn()} />);

    const soundBtn = screen.getByRole('button', { name: /звук/i });
    expect(soundBtn).toBeDefined();

    await userEvent.click(soundBtn);
    expect(localStorage.getItem('aerocast_sound_enabled')).toBe('false');

    await userEvent.click(soundBtn);
    expect(localStorage.getItem('aerocast_sound_enabled')).toBe('true');
  });

  it('отправляет сообщение пользователя и отображает ответ от AnyModel API', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reply: 'Ответ от AnyModel: всё супер!',
        emotion: 'happy'
      })
    });

    render(<AiChatModal isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText('Спроси что-нибудь...');
    const sendBtn = screen.getByRole('button', { name: 'Отправить сообщение' });

    await userEvent.type(input, 'Привет, как дела?');
    expect(input.value).toBe('Привет, как дела?');

    await userEvent.click(sendBtn);

    // Инпут должен очиститься
    expect(input.value).toBe('');

    // Ждем появления ответа
    await waitFor(() => {
      expect(screen.getByText('Ответ от AnyModel: всё супер!')).toBeDefined();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/ai/chat',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('Привет, как дела?')
      })
    );
  });

  it('корректно отображает ошибку при сбое сетевого запроса', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network disconnected'));

    render(<AiChatModal isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText('Спроси что-нибудь...');
    const sendBtn = screen.getByRole('button', { name: 'Отправить сообщение' });

    await userEvent.type(input, 'Тестовый запрос');
    await userEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText(/Ошибка соединения: Network disconnected/i)).toBeDefined();
    });
  });

  it('при клике на маскота в открытом чате сменяет реплику', async () => {
    const { container } = render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        embedded={true}
        mascotUnderChat={true}
      />
    );

    const mascot = container.querySelector('.ai-chat-mascot-docked .aya-mascot');
    const bubble = container.querySelector('.ai-chat-mascot-docked .aya-bubble__text');
    expect(mascot).toBeTruthy();

    await userEvent.click(mascot);

    const secondPhrase = bubble.textContent;
    expect(secondPhrase).not.toBe('All systems go!');
    expect(secondPhrase.length).toBeGreaterThan(0);
  });

  it('сбрасывает таймер автосмены при клике на маскота', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    const { container } = render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        embedded={true}
        mascotUnderChat={true}
      />
    );

    const mascot = container.querySelector('.ai-chat-mascot-docked .aya-mascot');
    const bubble = container.querySelector('.ai-chat-mascot-docked .aya-bubble__text');
    expect(mascot).toBeTruthy();

    const initialPhrase = bubble.textContent;

    // Прошло 11 секунд (таймер 12 сек почти истек)
    vi.advanceTimersByTime(11000);
    expect(bubble.textContent).toBe(initialPhrase);

    // Пользователь кликает на маскота
    fireEvent.click(mascot);

    const clickedPhrase = bubble.textContent;
    expect(clickedPhrase.length).toBeGreaterThan(0);

    // Проходит еще 2 секунды (если бы таймер не сбросился, 11с + 2с = 13с > 12с и фраза сразу сменилась бы)
    vi.advanceTimersByTime(2000);
    expect(bubble.textContent).toBe(clickedPhrase);

    // Проходит оставшееся время до 12 секунд после клика (еще 10100 мс)
    vi.advanceTimersByTime(10100);
    expect(bubble.textContent.length).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  it('прокручивает контейнер сообщений локально и не дергает внешние элементы при ответе', async () => {
    const mockReply = 'Это ответ нейросети.';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: mockReply, emotion: 'idle' })
    });

    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    render(<AiChatModal isOpen={true} onClose={vi.fn()} embedded={true} />);

    const input = screen.getByPlaceholderText('Спроси что-нибудь...');
    const sendBtn = screen.getByRole('button', { name: 'Отправить сообщение' });

    await userEvent.type(input, 'Вопрос');
    await userEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText(mockReply)).toBeDefined();
    });

    // scrollIntoView не должен вызываться на элементах, чтобы верстка не прыгала наверх
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it('позволяет отправить несколько сообщений подряд и отвечает по порядку', async () => {
    let resolveFirst;
    const firstResponse = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    global.fetch = vi
      .fn()
      .mockImplementationOnce(() => firstResponse)
      .mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({ reply: 'Ответ 2', emotion: 'idle' })
      }));

    render(<AiChatModal isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText('Спроси что-нибудь...');
    await userEvent.type(input, 'Первое сообщение');
    await userEvent.keyboard('{Enter}');

    // Пока Ая отвечает, поле ввода остается доступным
    expect(input.disabled).toBe(false);

    await userEvent.type(input, 'Второе сообщение');
    await userEvent.keyboard('{Enter}');

    expect(screen.getByText('Первое сообщение')).toBeDefined();
    expect(screen.getByText('Второе сообщение')).toBeDefined();
    // Второй запрос еще не ушел, пока не получен первый ответ
    expect(global.fetch).toHaveBeenCalledTimes(1);

    resolveFirst({
      ok: true,
      json: async () => ({ reply: 'Ответ 1', emotion: 'idle' })
    });

    await waitFor(() => {
      expect(screen.getByText('Ответ 1')).toBeDefined();
    });
    await waitFor(() => {
      expect(screen.getByText('Ответ 2')).toBeDefined();
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('не добавляет ответ в чат после начала нового диалога', async () => {
    let resolveFirst;
    const firstResponse = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    global.fetch = vi.fn().mockImplementationOnce(() => firstResponse);

    render(<AiChatModal isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText('Спроси что-нибудь...');
    await userEvent.type(input, 'Старое сообщение');
    await userEvent.keyboard('{Enter}');

    await userEvent.click(screen.getByLabelText('Начать новый диалог'));
    expect(screen.queryByText('Старое сообщение')).toBeNull();

    resolveFirst({
      ok: true,
      json: async () => ({ reply: 'Старый ответ', emotion: 'idle' })
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByText('Старый ответ')).toBeNull();
  });

  it('вызывает onBaseLayerChange("satellite") при получении action от AI', async () => {
    const handleBaseLayerChange = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reply: 'Переключаю на спутник, ня! ✨',
        emotion: 'happy',
        action: { type: 'set_base_layer', layer: 'satellite' }
      })
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        activeBaseLayer="osm"
        onBaseLayerChange={handleBaseLayerChange}
      />
    );

    const input = screen.getByPlaceholderText('Спроси что-нибудь...');
    await userEvent.type(input, 'Включи спутник');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Переключаю на спутник, ня! ✨')).toBeDefined();
    });

    expect(handleBaseLayerChange).toHaveBeenCalledWith('satellite');
  });

  it('вызывает onBaseLayerChange("osm") при получении команды возврата на схему', async () => {
    const handleBaseLayerChange = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reply: 'Возвращаю схему OpenStreetMap, ня! ✨',
        emotion: 'happy',
        action: { type: 'set_base_layer', layer: 'osm' }
      })
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        activeBaseLayer="satellite"
        onBaseLayerChange={handleBaseLayerChange}
      />
    );

    const input = screen.getByPlaceholderText('Спроси что-нибудь...');
    await userEvent.type(input, 'Верни обычную карту');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Возвращаю схему OpenStreetMap, ня! ✨')).toBeDefined();
    });

    expect(handleBaseLayerChange).toHaveBeenCalledWith('osm');
  });

  it('переключает карту через клиентский fallback при недоступности сервера', async () => {
    const handleBaseLayerChange = vi.fn();
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        activeBaseLayer="osm"
        onBaseLayerChange={handleBaseLayerChange}
      />
    );

    const input = screen.getByPlaceholderText('Спроси что-нибудь...');
    await userEvent.type(input, 'Переключи на спутник');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(handleBaseLayerChange).toHaveBeenCalledWith('satellite');
      expect(screen.getByText(/Переключаю карту на спутниковые снимки ESRI/i)).toBeDefined();
    });
  });

  it('вызывает onColorBlindChange(true) и onColorBlindTypeChange("okabe") при включении дальтонизма по умолчанию', async () => {
    const handleColorBlindChange = vi.fn();
    const handleColorBlindTypeChange = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reply: 'Включаю палитру Окабе, ня! ✨',
        emotion: 'happy',
        action: { type: 'set_colorblind', enabled: true, colorBlindType: 'okabe' }
      })
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        isColorBlind={false}
        onColorBlindChange={handleColorBlindChange}
        colorBlindType="okabe"
        onColorBlindTypeChange={handleColorBlindTypeChange}
      />
    );

    const input = screen.getByPlaceholderText('Спроси что-нибудь...');
    await userEvent.type(input, 'Включи дальтонизм');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Включаю палитру Окабе, ня! ✨')).toBeDefined();
    });

    expect(handleColorBlindChange).toHaveBeenCalledWith(true);
    expect(handleColorBlindTypeChange).toHaveBeenCalledWith('okabe');
  });

  it('вызывает onColorBlindTypeChange("deuteranopia") при переключении на дейтеранопию', async () => {
    const handleColorBlindChange = vi.fn();
    const handleColorBlindTypeChange = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reply: 'Переключаю на Дейтеранопию, ня! ✨',
        emotion: 'happy',
        action: { type: 'set_colorblind', enabled: true, colorBlindType: 'deuteranopia' }
      })
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        isColorBlind={true}
        onColorBlindChange={handleColorBlindChange}
        colorBlindType="okabe"
        onColorBlindTypeChange={handleColorBlindTypeChange}
      />
    );

    const input = screen.getByPlaceholderText('Спроси что-нибудь...');
    await userEvent.type(input, 'Включи дейтеранопию');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Переключаю на Дейтеранопию, ня! ✨')).toBeDefined();
    });

    expect(handleColorBlindChange).toHaveBeenCalledWith(true);
    expect(handleColorBlindTypeChange).toHaveBeenCalledWith('deuteranopia');
  });

  it('вызывает onColorBlindChange(false) при выключении дальтонизма', async () => {
    const handleColorBlindChange = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reply: 'Возвращаю стандартные цвета, ня! ✨',
        emotion: 'happy',
        action: { type: 'set_colorblind', enabled: false }
      })
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        isColorBlind={true}
        onColorBlindChange={handleColorBlindChange}
      />
    );

    const input = screen.getByPlaceholderText('Спроси что-нибудь...');
    await userEvent.type(input, 'Выключи дальтонизм');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Возвращаю стандартные цвета, ня! ✨')).toBeDefined();
    });

    expect(handleColorBlindChange).toHaveBeenCalledWith(false);
  });

  it('клиентский fallback для нереализованного дальтонизма сообщает об ошибке', async () => {
    const handleColorBlindChange = vi.fn();
    const handleColorBlindTypeChange = vi.fn();
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        onColorBlindChange={handleColorBlindChange}
        onColorBlindTypeChange={handleColorBlindTypeChange}
      />
    );

    const input = screen.getByPlaceholderText('Спроси что-нибудь...');
    await userEvent.type(input, 'Включи ахроматопсию');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/Такого режима дальтонизма у нас нет/i)).toBeDefined();
    });

    expect(handleColorBlindChange).not.toHaveBeenCalled();
    expect(handleColorBlindTypeChange).not.toHaveBeenCalled();
  });

  it('вызывает onThemeChange("dark") при получении команды смены темы на тёмную', async () => {
    const handleThemeChange = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reply: 'Включаю тёмную тему, ня! ✨',
        emotion: 'happy',
        action: { type: 'set_theme', theme: 'dark' }
      })
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        theme="light"
        onThemeChange={handleThemeChange}
      />
    );

    const input = screen.getByPlaceholderText('Спроси что-нибудь...');
    await userEvent.type(input, 'Включи темную тему');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Включаю тёмную тему, ня! ✨')).toBeDefined();
    });

    expect(handleThemeChange).toHaveBeenCalledWith('dark');
  });

  it('вызывает onThemeChange("light") при получении команды смены темы на светлую', async () => {
    const handleThemeChange = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reply: 'Включаю светлую тему, ня! ✨',
        emotion: 'happy',
        action: { type: 'set_theme', theme: 'light' }
      })
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        theme="dark"
        onThemeChange={handleThemeChange}
      />
    );

    const input = screen.getByPlaceholderText('Спроси что-нибудь...');
    await userEvent.type(input, 'Включи светлую тему');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Включаю светлую тему, ня! ✨')).toBeDefined();
    });

    expect(handleThemeChange).toHaveBeenCalledWith('light');
  });

  it('переключает тему через клиентский fallback при недоступности сервера', async () => {
    const handleThemeChange = vi.fn();
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        theme="light"
        onThemeChange={handleThemeChange}
      />
    );

    const input = screen.getByPlaceholderText('Спроси что-нибудь...');
    await userEvent.type(input, 'Включи темную тему');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(handleThemeChange).toHaveBeenCalledWith('dark');
      expect(screen.getByText(/Переключаю интерфейс на уютную тёмную тему/i)).toBeDefined();
    });
  });

  it('выключает дальтонизм при вежливой фразе "выключи пожалуйста режим дальтонизма" через fallback', async () => {
    const handleColorBlindChange = vi.fn();
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        isColorBlind={true}
        onColorBlindChange={handleColorBlindChange}
      />
    );

    const input = screen.getByPlaceholderText('Спроси что-нибудь...');
    await userEvent.type(input, 'выключи пожалуйста режим дальтонизма');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(handleColorBlindChange).toHaveBeenCalledWith(false);
      expect(screen.getByText(/Возвращаю стандартную цветовую гамму/i)).toBeDefined();
    });
  });

  it('выключает дальтонизм при запросе с местоимением "можешь пожалуйста выключить его"', async () => {
    const handleColorBlindChange = vi.fn();
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        isColorBlind={true}
        onColorBlindChange={handleColorBlindChange}
      />
    );

    const input = screen.getByPlaceholderText('Спроси что-нибудь...');
    await userEvent.type(input, 'можешь пожалуйста выключить его');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(handleColorBlindChange).toHaveBeenCalledWith(false);
      expect(screen.getByText(/Возвращаю стандартную цветовую гамму/i)).toBeDefined();
    });
  });

  it('вызывает onLocationSelect при получении действия set_location с координатами', async () => {
    const handleLocationSelect = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reply: 'Перемещаемся в Москву, ня! ✨',
        emotion: 'happy',
        action: {
          type: 'set_location',
          lat: 55.75204,
          lon: 37.61781,
          cityName: 'Москва, Россия'
        }
      })
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        onLocationSelect={handleLocationSelect}
      />
    );

    const input = screen.getByPlaceholderText('Спроси что-нибудь...');
    await userEvent.type(input, 'Перейди в Москву');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(handleLocationSelect).toHaveBeenCalledWith({
        lat: 55.75204,
        lon: 37.61781,
        display_name: 'Москва, Россия'
      });
      expect(screen.getByText(/Перемещаемся в Москву/i)).toBeDefined();
    });
  });

  it('перемещается к городу через клиентский fallback при недоступности сервера', async () => {
    const handleLocationSelect = vi.fn();
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        onLocationSelect={handleLocationSelect}
      />
    );

    const input = screen.getByPlaceholderText('Спроси что-нибудь...');
    await userEvent.type(input, 'Перейди в Казань');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(handleLocationSelect).toHaveBeenCalled();
      const calledArg = handleLocationSelect.mock.calls[0][0];
      expect(calledArg.lat).toBeCloseTo(55.78, 1);
      expect(calledArg.lon).toBeCloseTo(49.12, 1);
      expect(screen.getByText(/Перемещаемся в Казань/i)).toBeDefined();
    });
  });

  it('перемещается к Екатеринбургу по реплике Аи, если сервер вернул ответ без action', async () => {
    const handleLocationSelect = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reply: 'Секундочку! Перемещаюсь в Екатеринбург, смотрю показатели качества воздуха, ня! ✨',
        emotion: 'happy',
        action: null // модель не приложила тег
      })
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        onLocationSelect={handleLocationSelect}
      />
    );

    const input = screen.getByPlaceholderText('Спроси что-нибудь...');
    await userEvent.type(input, 'переместить в Екатеринбург');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(handleLocationSelect).toHaveBeenCalled();
      const calledArg = handleLocationSelect.mock.calls[0][0];
      expect(calledArg.lat).toBeCloseTo(56.85, 1);
      expect(calledArg.lon).toBeCloseTo(60.61, 1);
      expect(screen.getByText(/Перемещаюсь в Екатеринбург/i)).toBeDefined();
    });
  });

  it('отображает кнопку быстрой аналитики и передает pointAnalytics на бэкенд', async () => {
    const mockAirData = {
      latitude: 55.75,
      longitude: 37.61,
      hourly: {
        time: ['2026-10-29T14:00'],
        european_aqi: [25],
        pm2_5: [12.4],
        pm10: [20.1],
        nitrogen_dioxide: [18.2]
      }
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reply: 'В Москве сейчас индекс EAQI 25, воздух чистый, ня! ✨',
        emotion: 'happy'
      })
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        airData={mockAirData}
        selectedTimeIndex={0}
        coords={{ lat: 55.75, lon: 37.61 }}
        locationName="Москва, Россия"
      />
    );

    // Кнопка быстрой аналитики должна появиться в шапке слева от настроек без текста
    const quickBtn = screen.getByTestId('ai-chat-quick-analytics-btn');
    expect(quickBtn).toBeDefined();
    expect(quickBtn.getAttribute('title')).toContain('Москва, Россия');
    expect(quickBtn.getAttribute('title')).toContain('AQI 25');
    expect(quickBtn.textContent.trim()).toBe('');

    // Кликаем по быстрой аналитике
    await userEvent.click(quickBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/ai/chat',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Москва, Россия')
        })
      );
    });

    const bodySent = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(bodySent.pointAnalytics).toBeDefined();
    expect(bodySent.pointAnalytics.locationName).toBe('Москва, Россия');
    expect(bodySent.pointAnalytics.aqi).toBe(25);
    expect(bodySent.pointAnalytics.pm2_5).toBe(12.4);

    await waitFor(() => {
      expect(screen.getByText(/В Москве сейчас индекс EAQI 25/i)).toBeDefined();
    });
  });

  it('при запросе качества воздуха в городе выполняет двухэтапный сценарий: перемещение и затем аналитика', async () => {
    const handleLocationSelect = vi.fn();

    global.fetch = vi.fn().mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/api/air-quality')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            hourly: {
              time: ['2026-10-29T12:00:00Z'],
              european_aqi: [22],
              pm2_5: [10.5],
              pm10: [18.0]
            }
          })
        });
      }

      if (typeof url === 'string' && url.includes('/api/ai/chat')) {
        // Проверяем вызовы к чату
        const callCount = global.fetch.mock.calls.filter(c => c[0].includes('/api/ai/chat')).length;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              reply: 'Секундочку! Перемещаемся в Москву, смотрю свежие замеры воздуха, ня! ✨',
              emotion: 'happy',
              action: {
                type: 'set_location',
                lat: 55.75204,
                lon: 37.61781,
                cityName: 'Москва, Россия',
                followUpAnalytics: true
              }
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            reply: 'Смотри, в Москве сейчас прекрасный воздух! Индекс EAQI равен 22 (Хорошо). PM2.5 в норме, ня! ✨',
            emotion: 'happy'
          })
        });
      }

      return Promise.reject(new Error('Unknown url'));
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        onLocationSelect={handleLocationSelect}
      />
    );

    const input = screen.getByPlaceholderText('Спроси что-нибудь...');
    await userEvent.type(input, 'можешь пожалуйста сказать что сейчас по воздуху в Москве');
    await userEvent.keyboard('{Enter}');

    // 1. Шаг 1: перемещение к Москве и первое сообщение
    await waitFor(() => {
      expect(handleLocationSelect).toHaveBeenCalledWith(expect.objectContaining({
        lat: 55.75204,
        lon: 37.61781,
        display_name: 'Москва, Россия'
      }));
      expect(screen.getByText('Секундочку! Перемещаемся в Москву, смотрю свежие замеры воздуха, ня! ✨')).toBeDefined();
    });

    // 2. Шаг 2: автоматическая подгрузка аналитики и второе сообщение
    await waitFor(() => {
      expect(screen.getByText('Смотри, в Москве сейчас прекрасный воздух! Индекс EAQI равен 22 (Хорошо). PM2.5 в норме, ня! ✨')).toBeDefined();
    });

    const chatCalls = global.fetch.mock.calls.filter(c => c[0].includes('/api/ai/chat'));
    expect(chatCalls).toHaveLength(2);
    const step2Payload = JSON.parse(chatCalls[1][1].body);
    expect(step2Payload.isFollowUpAnalytics).toBe(true);
    expect(step2Payload.pointAnalytics).toBeDefined();
    expect(step2Payload.pointAnalytics.forecast3Days).toBeDefined();
  });

  it('не путает фразы прогноза на 3 дня с названиями городов и включает forecast3Days в pointAnalytics', async () => {
    const handleLocationSelect = vi.fn();
    const mockAirData = {
      latitude: 55.75,
      longitude: 37.61,
      hourly: {
        time: ['2026-10-29T12:00:00Z', '2026-10-30T12:00:00Z', '2026-10-31T12:00:00Z'],
        european_aqi: [25, 30, 20],
        pm2_5: [12, 14, 9],
        pm10: [18, 20, 15]
      }
    };

    global.fetch = vi.fn().mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/api/ai/chat')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            reply: 'По прогнозу на 3 дня средний индекс EAQI будет около 25, ня! ✨',
            emotion: 'happy'
          })
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
        onLocationSelect={handleLocationSelect}
        airData={mockAirData}
      />
    );

    const input = screen.getByPlaceholderText('Спроси что-нибудь...');
    await userEvent.type(input, 'Скажи на ближайшие 3 дня какая будет тут погода и сам воздух');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('По прогнозу на 3 дня средний индекс EAQI будет около 25, ня! ✨')).toBeDefined();
    });

    // Убеждаемся, что не было ошибочного перемещения карты
    expect(handleLocationSelect).not.toHaveBeenCalled();

    const chatCalls = global.fetch.mock.calls.filter(c => c[0].includes('/api/ai/chat'));
    expect(chatCalls).toHaveLength(1);
    const reqBody = JSON.parse(chatCalls[0][1].body);
    expect(reqBody.pointAnalytics).toBeDefined();
    expect(reqBody.pointAnalytics.forecast3Days).toBeDefined();
    expect(reqBody.pointAnalytics.forecast3Days.days).toHaveLength(3);
  });
});
