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

  it('рендерит начальное приветствие и шапку с бейджем am/free при открытии', () => {
    render(<AiChatModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getAllByText(/(?:Ая|Ани)/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('на связи')).toBeDefined();
    expect(screen.getByText('am/free')).toBeDefined();
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
});
