// frontend/tests/components/AyaMascot.test.jsx

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

    // Находим маскота в сайдбаре
    const mascotTrigger = screen.getByRole('button', { name: /маскот ая/i });
    expect(mascotTrigger).toBeDefined();

    // Кликаем по маскоту
    await userEvent.click(mascotTrigger);

    // Должен появиться контейнер встроенного чата
    expect(screen.getByTestId('sidebar-chat-active-container')).toBeDefined();

    // Внутри него должен быть маскот, расположенный под чатом
    expect(screen.getByTestId('ai-chat-mascot-docked')).toBeDefined();

    // КРИТИЧНО: Кнопка «Выбрать текущее время» ОБЯЗАНА оставаться видимой при открытом чате!
    const selectCurrentTimeBtn = screen.getByTestId('select-current-time-btn');
    expect(selectCurrentTimeBtn).toBeDefined();
    expect(screen.getByText('Выбрать текущее время')).toBeDefined();

    // И кнопка закрытия чата
    const closeBtn = screen.getByLabelText('Закрыть чат');
    await userEvent.click(closeBtn);

    // После закрытия возвращаемся к исходному сайдбару
    expect(screen.queryByTestId('sidebar-chat-active-container')).toBeNull();
    expect(screen.getByTestId('sidebar-mascot-container')).toBeDefined();
    expect(screen.getByTestId('select-current-time-btn')).toBeDefined();
  });
});
