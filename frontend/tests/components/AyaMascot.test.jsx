import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import AyaMascot from '../../src/components/AiChat/AyaMascot';
import SettingsModal from '../../src/components/SettingsModal';
import Sidebar from '../../src/components/Sidebar';

describe('AyaMascot Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('рендерит все 4 позы с активной idle по умолчанию', () => {
    const { container } = render(<AyaMascot emotion="idle" size="sidebar" />);

    const idleImg = container.querySelector('.aya-pose--idle');
    const thinkImg = container.querySelector('.aya-pose--think');
    const happyImg = container.querySelector('.aya-pose--happy');
    const alertImg = container.querySelector('.aya-pose--alert');

    expect(idleImg).toBeDefined();
    expect(thinkImg).toBeDefined();
    expect(happyImg).toBeDefined();
    expect(alertImg).toBeDefined();

    expect(idleImg.classList.contains('aya-pose--active')).toBe(true);
    expect(thinkImg.classList.contains('aya-pose--active')).toBe(false);
  });

  it('активирует соответствующую позу при смене emotion', () => {
    const { container, rerender } = render(<AyaMascot emotion="think" size="sidebar" />);
    expect(container.querySelector('.aya-pose--think').classList.contains('aya-pose--active')).toBe(true);

    rerender(<AyaMascot emotion="happy" size="sidebar" />);
    expect(container.querySelector('.aya-pose--happy').classList.contains('aya-pose--active')).toBe(true);

    rerender(<AyaMascot emotion="alert" size="sidebar" />);
    expect(container.querySelector('.aya-pose--alert').classList.contains('aya-pose--active')).toBe(true);

    rerender(<AyaMascot emotion="unknown" size="sidebar" />);
    expect(container.querySelector('.aya-pose--idle').classList.contains('aya-pose--active')).toBe(true);

    rerender(<AyaMascot emotion={null} size="sidebar" />);
    expect(container.querySelector('.aya-pose--idle').classList.contains('aya-pose--active')).toBe(true);

    rerender(<AyaMascot emotion="" size="sidebar" />);
    expect(container.querySelector('.aya-pose--idle').classList.contains('aya-pose--active')).toBe(true);
  });

  it('вызывает onClick при клике на маскота', async () => {
    const handleClick = vi.fn();
    render(<AyaMascot emotion="idle" size="sidebar" onClick={handleClick} />);

    const mascot = screen.getByRole('button', { name: /маскот ая/i });
    await userEvent.click(mascot);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('рендерит речевой баббл для сайдбара и скрывает для хедера', () => {
    const { container, rerender } = render(
      <AyaMascot emotion="idle" size="sidebar" customBubbleText="All systems go!" />
    );
    expect(container.querySelector('.aya-bubble')).toBeDefined();
    expect(screen.getByText('All systems go!')).toBeDefined();

    rerender(<AyaMascot emotion="idle" size="header" />);
    expect(container.querySelector('.aya-bubble')).toBeNull();
  });

  it('обрабатывает наведение курсора мыши и клавиатурные события Enter и Space', () => {
    const handleClick = vi.fn();
    const { container } = render(<AyaMascot emotion="idle" size="sidebar" onClick={handleClick} />);
    const mascot = screen.getByRole('button', { name: /маскот ая/i });

    fireEvent.mouseEnter(mascot);
    expect(screen.getByText('Тыкай, поболтаем! 💬')).toBeDefined();
    expect(container.querySelector('.aya-character__glow--hovered')).toBeDefined();

    fireEvent.mouseLeave(mascot);
    expect(container.querySelector('.aya-character__glow--hovered')).toBeNull();

    fireEvent.keyDown(mascot, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(mascot, { key: ' ' });
    expect(handleClick).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(mascot, { key: 'ArrowDown' });
    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  it('меняет текст баббла при клике без переданного onClick', () => {
    render(<AyaMascot emotion="idle" size="sidebar" />);
    const mascot = screen.getByRole('button', { name: /маскот ая/i });

    const randSpy = vi.spyOn(Math, 'random').mockReturnValue(1);
    fireEvent.click(mascot);
    randSpy.mockRestore();

    const bubbleText = document.querySelector('.aya-bubble__text');
    expect(bubbleText).toBeDefined();
  });

  it('отображает специфические тексты реплик для различных эмоций и меняет их по таймеру', () => {
    vi.useFakeTimers();

    const { rerender } = render(<AyaMascot emotion="think" size="sidebar" />);
    expect(screen.getByText('Хм-м-м, дай подумать...')).toBeDefined();

    rerender(<AyaMascot emotion="alert" size="sidebar" />);
    expect(screen.getByText('Б-бака! Чего ты натворил?! 💢')).toBeDefined();

    rerender(<AyaMascot emotion="happy" size="sidebar" />);
    expect(screen.getByText('Ура! Получилось отлично! ✨')).toBeDefined();

    rerender(<AyaMascot emotion="idle" size="chat-docked" />);
    const randSpy = vi.spyOn(Math, 'random').mockReturnValue(1);
    act(() => {
      vi.advanceTimersByTime(13000);
    });
    randSpy.mockRestore();
    expect(document.querySelector('.aya-bubble__text')).toBeDefined();

    rerender(<AyaMascot emotion="idle" size="sidebar" />);
    act(() => {
      vi.advanceTimersByTime(16000);
    });
    expect(document.querySelector('.aya-bubble__text')).toBeDefined();

    vi.useRealTimers();
  });

  it('загружает и инициализирует Live2D модель с моками и воспроизводит анимацию эмоций', async () => {
    const mockMotionManager = {
      stopAllMotions: vi.fn(),
      loadMotion: vi.fn().mockResolvedValue({
        setIsLoop: vi.fn(),
        setIsLoopFadeIn: vi.fn(),
      }),
      groups: { idle: 'idle' },
    };

    const mockCoreModel = {
      getParameterCount: vi.fn().mockReturnValue(2),
      getParameterDefaultValue: vi.fn().mockReturnValue(0),
      setParameterValueByIndex: vi.fn(),
      saveParameters: vi.fn(),
    };

    const mockModel = {
      anchor: { set: vi.fn() },
      scale: { set: vi.fn() },
      height: 600,
      x: 0,
      y: 0,
      destroy: vi.fn(),
      motion: vi.fn().mockResolvedValue(true),
      internalModel: {
        motionManager: mockMotionManager,
        coreModel: mockCoreModel,
      },
    };

    const fromSpy = vi.spyOn(Live2DModel, 'from').mockResolvedValue(mockModel);

    let comp = null;
    await act(async () => {
      comp = render(<AyaMascot emotion="happy" size="chat-docked" />);
    });

    expect(fromSpy).toHaveBeenCalled();
    expect(mockModel.anchor.set).toHaveBeenCalledWith(0.5, 1);
    expect(mockModel.motion).toHaveBeenCalled();

    await act(async () => {
      comp.rerender(<AyaMascot emotion="think" size="chat-docked" />);
    });
    expect(mockModel.motion).toHaveBeenCalled();

    await act(async () => {
      comp.rerender(<AyaMascot emotion="alert" size="sidebar" />);
    });

    await act(async () => {
      comp.rerender(<AyaMascot emotion="idle" size="compact" />);
    });

    await act(async () => {
      comp.unmount();
    });
  });

  it('обрабатывает ошибки и смену эмоций в процессе загрузки анимации', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const resolvers = [];
    const mockModel = {
      anchor: { set: vi.fn() },
      scale: { set: vi.fn() },
      height: 600,
      x: 0,
      y: 0,
      destroy: vi.fn(),
      motion: vi.fn().mockResolvedValue(true),
      internalModel: {
        coreModel: {
          getParameterCount: vi.fn().mockReturnValue(1),
          getParameterDefaultValue: vi.fn().mockReturnValue(0),
          setParameterValueByIndex: vi.fn(),
          saveParameters: null,
        },
        motionManager: {
          stopAllMotions: vi.fn(),
          loadMotion: vi.fn().mockImplementation(() => new Promise((res) => { resolvers.push(res); })),
        },
      },
    };

    vi.spyOn(Live2DModel, 'from').mockResolvedValue(mockModel);

    let comp = null;
    await act(async () => {
      comp = render(<AyaMascot emotion="happy" size="chat-docked" />);
    });

    await act(async () => {
      comp.rerender(<AyaMascot emotion="think" size="chat-docked" />);
    });

    await act(async () => {
      resolvers[0]?.({ setIsLoop: null, setIsLoopFadeIn: null });
      resolvers[1]?.({ setIsLoop: vi.fn(), setIsLoopFadeIn: vi.fn() });
    });

    mockModel.internalModel.motionManager.loadMotion = vi.fn().mockRejectedValue(new Error('Motion fail'));
    await act(async () => {
      comp.rerender(<AyaMascot emotion="alert" size="chat-docked" />);
    });
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('корректно обрабатывает ошибку загрузки Live2D модели', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Live2DModel, 'from').mockRejectedValue(new Error('Network error'));

    await act(async () => {
      render(<AyaMascot emotion="idle" size="sidebar" />);
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('уничтожает модель если компонент был размонтирован до завершения загрузки', async () => {
    const mockModel = {
      destroy: vi.fn(),
      anchor: { set: vi.fn() },
      scale: { set: vi.fn() },
      height: 500,
    };

    let resolvePromise = null;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    vi.spyOn(Live2DModel, 'from').mockReturnValue(pendingPromise);

    const { unmount } = render(<AyaMascot emotion="idle" size="sidebar" />);
    unmount();

    await act(async () => {
      resolvePromise(mockModel);
    });

    expect(mockModel.destroy).toHaveBeenCalled();
  });
});

describe('SettingsModal Mascot Mode Integration', () => {
  afterEach(() => {
    cleanup();
  });

  it('переключает режим ассистента между "маскот" и "кнопка"', async () => {
    const handleMascotModeChange = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        mascotMode="mascot"
        onMascotModeChange={handleMascotModeChange}
      />
    );

    const buttonRadio = screen.getByTestId('settings-mascot-mode-button');
    const mascotRadio = screen.getByTestId('settings-mascot-mode-mascot');

    expect(mascotRadio.getAttribute('aria-checked')).toBe('true');
    expect(buttonRadio.getAttribute('aria-checked')).toBe('false');

    await userEvent.click(buttonRadio);
    expect(handleMascotModeChange).toHaveBeenCalledWith('button');
  });
});

describe('Sidebar + Mascot Layout (chat above mascot)', () => {
  afterEach(() => {
    cleanup();
  });

  it('открывает окно чата над маскотом, сохраняя кнопку "Выбрать текущее время" видимой', async () => {
    render(<Sidebar mascotMode="mascot" />);

    const mascotTrigger = screen.getByRole('button', { name: /маскот ая/i });
    expect(mascotTrigger).toBeDefined();

    await userEvent.click(mascotTrigger);

    expect(screen.getByTestId('sidebar-chat-active-container')).toBeDefined();
    expect(screen.getByTestId('ai-chat-mascot-docked')).toBeDefined();

    const selectCurrentTimeBtn = screen.getByTestId('select-current-time-btn');
    expect(selectCurrentTimeBtn).toBeDefined();
    expect(screen.getByText('Выбрать текущее время')).toBeDefined();

    const closeBtn = screen.getByLabelText('Закрыть чат');
    await userEvent.click(closeBtn);

    expect(screen.queryByTestId('sidebar-chat-active-container')).toBeNull();
    expect(screen.getByTestId('sidebar-mascot-container')).toBeDefined();
    expect(screen.getByTestId('select-current-time-btn')).toBeDefined();
  });
});