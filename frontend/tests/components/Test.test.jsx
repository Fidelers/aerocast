import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import Test from '../../src/components/Test';

describe('Test component', () => {
    beforeEach(() => {
        globalThis.fetch = vi.fn();
    });

    it('отображает ответ сервера при успешном fetch', async () => {
        globalThis.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ message: 'pong' })
        });

        render(React.createElement(Test));

        await waitFor(() => {
            expect(screen.getByText('pong')).toBeTruthy();
        });
    });

    it('отображает ошибку подключения при сбое fetch', async () => {
        globalThis.fetch.mockRejectedValueOnce(new Error('Network failure'));

        render(React.createElement(Test));

        await waitFor(() => {
            expect(screen.getByText(/Ошибка подключения/i)).toBeTruthy();
        });
    });
});
