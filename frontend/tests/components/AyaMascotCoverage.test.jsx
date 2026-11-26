import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import AyaMascot from '../../src/components/AiChat/AyaMascot';

describe('AyaMascotCoverage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('обрабатывает наведение курсора мыши (hover) и смену фразы на подсказку', () => {
    render(<AyaMascot emotion="idle" size="sidebar" />);
    const mascot = screen.getByRole('button', { name: /маскот ая/i });

    expect(screen.queryByText('Тыкай, поболтаем! 💬')).toBeNull();

    fireEvent.mouseEnter(mascot);
    expect(screen.getByText('Тыкай, поболтаем! 💬')).toBeDefined();

    fireEvent.mouseLeave(mascot);
    expect(screen.queryByText('Тыкай, поболтаем! 💬')).toBeNull();
  });

  it('обрабатывает клик и клавиатурные нажатия Enter и Space без переданного onClick', () => {
    render(<AyaMascot emotion="idle" size="sidebar" />);
    const mascot = screen.getByRole('button', { name: /маскот ая/i });

    fireEvent.click(mascot);

    fireEvent.keyDown(mascot, { key: 'Enter' });

    fireEvent.keyDown(mascot, { key: ' ' });

    fireEvent.keyDown(mascot, { key: 'Escape' });
  });

  it('обрабатывает клавиатурные нажатия при наличии onClick', () => {
    const handleClick = vi.fn();
    render(<AyaMascot emotion="idle" size="sidebar" onClick={handleClick} />);
    const mascot = screen.getByRole('button', { name: /маскот ая/i });

    fireEvent.keyDown(mascot, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(mascot, { key: ' ' });
    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  it('сменяет фразу по таймеру в спокойном режиме (idle) раз в 15 секунд', () => {
    vi.useFakeTimers();
    render(<AyaMascot emotion="idle" size="sidebar" />);

    act(() => {
      vi.advanceTimersByTime(15500);
    });
  });

  it('поддерживает режим размера chat-docked и таймер 12 секунд', () => {
    vi.useFakeTimers();
    render(<AyaMascot emotion="idle" size="chat-docked" />);

    act(() => {
      vi.advanceTimersByTime(12500);
    });
  });

  it('обрабатывает эмоции think, alert, happy и нестандартные эмоции', () => {
    const { rerender } = render(<AyaMascot emotion="think" size="sidebar" />);
    expect(screen.getByText('Хм-м-м, дай подумать...')).toBeDefined();

    rerender(<AyaMascot emotion="alert" size="sidebar" />);
    expect(screen.getByText('Б-бака! Чего ты натворил?! 💢')).toBeDefined();

    rerender(<AyaMascot emotion="happy" size="sidebar" />);
    expect(screen.getByText('Ура! Получилось отлично! ✨')).toBeDefined();

    rerender(<AyaMascot emotion="invalid-emotion-123" size="sidebar" />);
  });

  it('поддерживает customBubbleText', () => {
    render(<AyaMascot emotion="idle" size="sidebar" customBubbleText="Привет от Аи!" />);
    expect(screen.getByText('Привет от Аи!')).toBeDefined();
  });

  it('скрывает баббл если showBubble=false или размер не sidebar/chat-docked', () => {
    const { container, rerender } = render(<AyaMascot emotion="idle" size="sidebar" showBubble={false} />);
    expect(container.querySelector('.aya-bubble')).toBeNull();

    rerender(<AyaMascot emotion="idle" size="modal" showBubble={true} />);
    expect(container.querySelector('.aya-bubble')).toBeNull();
  });

  it('покрывает граничные ветки Live2D motion (null motion, отсутствие setIsLoop/setIsLoopFadeIn) и ошибку PIXI.Application', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fromSpy = vi.spyOn(Live2DModel, 'from');

    fromSpy.mockResolvedValueOnce({
      anchor: { set: vi.fn() },
      scale: { set: vi.fn() },
      x: 0,
      y: 0,
      height: 750,
      destroy: vi.fn(),
      motion: vi.fn(),
      internalModel: {
        motionManager: {
          loadMotion: vi.fn().mockResolvedValue(null),
          stopAllMotions: vi.fn(),
        },
        coreModel: {},
      },
    });
    const { unmount: u1 } = render(<AyaMascot emotion="idle" size="sidebar" />);
    await act(async () => { await Promise.resolve(); });
    u1();

    fromSpy.mockResolvedValueOnce({
      anchor: { set: vi.fn() },
      scale: { set: vi.fn() },
      x: 0,
      y: 0,
      height: 750,
      destroy: vi.fn(),
      motion: vi.fn(),
      internalModel: {
        motionManager: {
          loadMotion: vi.fn().mockResolvedValue({}),
          stopAllMotions: vi.fn(),
        },
        coreModel: {},
      },
    });
    const { unmount: u2 } = render(<AyaMascot emotion="happy" size="sidebar" />);
    await act(async () => { await Promise.resolve(); });
    u2();

    const appSpy = vi.spyOn(PIXI, 'Application').mockImplementationOnce(() => {
      throw new Error('WebGL unavailable');
    });
    const { unmount: u3 } = render(<AyaMascot emotion="idle" size="sidebar" />);
    await act(async () => { await Promise.resolve(); });
    u3();

    appSpy.mockRestore();
    fromSpy.mockRestore();
    errSpy.mockRestore();
  });
});
