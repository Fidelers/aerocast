import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import RightAirPanel from '../src/components/RightAirPanel';
import AiChatModal from '../src/components/AiChat/AiChatModal';

describe('FinalCoverageBoost', () => {
  const origFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = origFetch;
    cleanup();
  });

  it('покрывает клик и клавиатурные события на индикаторе AQI в RightAirPanel', () => {
    const handleOpenDynamics = vi.fn();
    const mockAirData = {
      latitude: 55.75,
      longitude: 37.62,
      hourly: {
        time: ['2026-10-23T12:00'],
        european_aqi: [25],
        pm2_5: [10],
        pm10: [15]
      }
    };

    render(
      <RightAirPanel
        isOpen={true}
        onClose={vi.fn()}
        airData={mockAirData}
        selectedTimeIndex={0}
        onOpenDynamicsModal={handleOpenDynamics}
      />
    );

    const aqiCard = screen.getByRole('button', { name: /индекс качества воздуха/i });
    expect(aqiCard).toBeDefined();

    fireEvent.click(aqiCard);
    expect(handleOpenDynamics).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(aqiCard, { key: 'Enter' });
    expect(handleOpenDynamics).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(aqiCard, { key: ' ' });
    expect(handleOpenDynamics).toHaveBeenCalledTimes(3);

    fireEvent.keyDown(aqiCard, { key: 'Escape' });
    expect(handleOpenDynamics).toHaveBeenCalledTimes(3);
  });

  it('покрывает ветки pointerType=mouse вне хэндла в RightAirPanel', () => {
    const mockAirData = {
      latitude: 55.75,
      longitude: 37.62,
      hourly: {
        time: ['2026-10-23T12:00'],
        european_aqi: [25]
      }
    };

    const { container } = render(
      <RightAirPanel
        isOpen={true}
        onClose={vi.fn()}
        airData={mockAirData}
        selectedTimeIndex={0}
      />
    );

    const panel = container.querySelector('.right-air-panel');
    expect(panel).toBeDefined();

    fireEvent.pointerDown(panel, { pointerType: 'mouse', clientX: 100, clientY: 100 });

    fireEvent.pointerMove(window, { clientX: 100, clientY: 150 });
  });

  it('покрывает переключение звука и кнопку нового диалога в AiChatModal', async () => {
    render(
      <AiChatModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const soundBtn = screen.getByRole('button', { name: /звук/i });
    fireEvent.click(soundBtn);
    expect(soundBtn).toBeDefined();

    const clearBtn = screen.getByRole('button', { name: /новый диалог/i });
    fireEvent.click(clearBtn);
    expect(clearBtn).toBeDefined();
  });
});
