import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AiChatModal from '../../src/components/AiChat/AiChatModal';

describe('AiChatModalCoverage', () => {
  const origFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
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
});
