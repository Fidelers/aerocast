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

    expect(screen.getByText('Ани')).toBeDefined();
    expect(screen.getByText('на связи')).toBeDefined();
    expect(screen.getByText('am/free')).toBeDefined();
    expect(screen.getByText(/Ну привет. Я Ани./i)).toBeDefined();
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

    const soundBtn = screen.getByLabelText('Выключить звук');
    await userEvent.click(soundBtn);

    expect(localStorage.getItem('aerocast_sound_enabled')).toBe('false');
    expect(screen.getByLabelText('Включить звук')).toBeDefined();

    await userEvent.click(screen.getByLabelText('Включить звук'));
    expect(localStorage.getItem('aerocast_sound_enabled')).toBe('true');
  });

  it('отправляет сообщение пользователя и отображает ответ от AnyModel API', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        reply: 'Конечно! В Москве сегодня умеренный уровень загрязнения.',
        emotion: 'happy'
      })
    });

    render(<AiChatModal isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText('Спроси что-нибудь...');
    const sendBtn = screen.getByLabelText('Отправить сообщение');

    await userEvent.type(input, 'Как дела в Москве?');
    expect(sendBtn.disabled).toBe(false);

    await userEvent.click(sendBtn);

    // Сообщение пользователя появилось
    expect(screen.getByText('Как дела в Москве?')).toBeDefined();

    // Ждем ответ от AnyModel
    await waitFor(() => {
      expect(screen.getByText('Конечно! В Москве сегодня умеренный уровень загрязнения.')).toBeDefined();
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/ai/chat', expect.objectContaining({
      method: 'POST'
    }));
  });

  it('корректно отображает ошибку при сбое сетевого запроса', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network disconnected'));

    render(<AiChatModal isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText('Спроси что-нибудь...');
    await userEvent.type(input, 'Привет');
    await userEvent.click(screen.getByLabelText('Отправить сообщение'));

    await waitFor(() => {
      expect(screen.getByText(/Ошибка соединения: Network disconnected/i)).toBeDefined();
    });
  });
});
