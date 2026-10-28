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
});
