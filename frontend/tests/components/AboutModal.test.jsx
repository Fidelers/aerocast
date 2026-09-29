// tests/components/AboutModal.test.jsx — TDD-тесты модального окна информации о проекте и шкале EAQI
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import AboutModal from '../../src/components/AboutModal';

describe('AboutModal component (TDD — модальное окно информации и методологии)', () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('1. Не рендерит модальное окно в DOM, если isOpen=false', () => {
        const { container } = render(<AboutModal isOpen={false} onClose={vi.fn()} />);
        expect(container.firstChild).toBeNull();
    });

    it('2. Рендерит заголовок "О проекте Aerocast" и описание сервиса, когда isOpen=true', () => {
        render(<AboutModal isOpen={true} onClose={vi.fn()} />);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/aerocast/i)).toBeInTheDocument();
        expect(screen.getByText(/о проекте/i)).toBeInTheDocument();
        expect(screen.getByText(/прогноз/i)).toBeInTheDocument();
    });

    it('3. Отображает информацию о 6 загрязнителях европейского индекса EAQI (PM2.5, PM10, NO2, O3, SO2, CO)', () => {
        render(<AboutModal isOpen={true} onClose={vi.fn()} />);

        expect(screen.getByText(/pm2\.?5/i)).toBeInTheDocument();
        expect(screen.getByText(/pm10/i)).toBeInTheDocument();
        expect(screen.getByText(/no2/i)).toBeInTheDocument();
        expect(screen.getByText(/o3/i)).toBeInTheDocument();
        expect(screen.getByText(/so2/i)).toBeInTheDocument();
        expect(screen.getByText(/co/i)).toBeInTheDocument();
    });

    it('4. Отображает используемые источники данных (Open-Meteo и OpenWeatherMap)', () => {
        render(<AboutModal isOpen={true} onClose={vi.fn()} />);

        expect(screen.getByText(/open-meteo/i)).toBeInTheDocument();
        expect(screen.getByText(/openweathermap/i)).toBeInTheDocument();
    });

    it('5. Вызывает onClose при клике на кнопку закрытия (крестик)', () => {
        const handleClose = vi.fn();
        render(<AboutModal isOpen={true} onClose={handleClose} />);

        const closeBtn = screen.getByRole('button', { name: /закрыть/i });
        fireEvent.click(closeBtn);

        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('6. Вызывает onClose при клике на подложку (overlay/backdrop)', () => {
        const handleClose = vi.fn();
        const { container } = render(<AboutModal isOpen={true} onClose={handleClose} />);

        const overlay = container.querySelector('.modal-overlay') || screen.getByTestId('modal-overlay');
        fireEvent.click(overlay);

        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('7. Не вызывает onClose при клике внутри содержимого модального окна', () => {
        const handleClose = vi.fn();
        const { container } = render(<AboutModal isOpen={true} onClose={handleClose} />);

        const modalContent = container.querySelector('.modal-content') || screen.getByRole('dialog');
        fireEvent.click(modalContent);

        expect(handleClose).not.toHaveBeenCalled();
    });

    it('8. Вызывает onClose при нажатии клавиши Escape', () => {
        const handleClose = vi.fn();
        render(<AboutModal isOpen={true} onClose={handleClose} />);

        fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

        expect(handleClose).toHaveBeenCalledTimes(1);
    });
});
