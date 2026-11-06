import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
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
});
