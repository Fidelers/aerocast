// frontend/tests/components/SettingsModal.test.jsx
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import SettingsModal from '../../src/components/SettingsModal';

describe('SettingsModal component (окно настроек темы и цветовой доступности)', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.removeAttribute('data-colorblind');
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('1. Не рендерит окно в DOM, если isOpen=false', () => {
        const { container } = render(<SettingsModal isOpen={false} onClose={vi.fn()} />);
        expect(container.firstChild).toBeNull();
    });

    it('2. Рендерит заголовок "Настройки" и роль dialog при isOpen=true', () => {
        render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

        expect(screen.getByRole('dialog')).toBeTruthy();
        expect(screen.getByRole('heading', { name: /настройки/i })).toBeTruthy();
        expect(screen.getByText(/параметры отображения сайта/i)).toBeTruthy();
    });

    it('3. Содержит свитчер смены темы с тёмной на светлую и наоборот', () => {
        const handleThemeChange = vi.fn();
        render(
            <SettingsModal
                isOpen={true}
                onClose={vi.fn()}
                theme="light"
                onThemeChange={handleThemeChange}
            />
        );

        const themeSwitch = screen.getByRole('switch', { name: /переключить тему оформления/i });
        expect(themeSwitch).toBeTruthy();
        expect(themeSwitch.getAttribute('aria-checked')).toBe('false');
        expect(screen.getByText(/светлая тема/i)).toBeTruthy();

        // Клик по свитчеру вызывает onThemeChange с 'dark'
        fireEvent.click(themeSwitch);
        expect(handleThemeChange).toHaveBeenCalledWith('dark');
    });

    it('4. Отображает активное состояние для тёмной темы', () => {
        const handleThemeChange = vi.fn();
        render(
            <SettingsModal
                isOpen={true}
                onClose={vi.fn()}
                theme="dark"
                onThemeChange={handleThemeChange}
            />
        );

        const themeSwitch = screen.getByRole('switch', { name: /переключить тему оформления/i });
        expect(themeSwitch.getAttribute('aria-checked')).toBe('true');
        expect(screen.getByText(/тёмная тема/i)).toBeTruthy();

        // Клик переключает на светлую тему
        fireEvent.click(themeSwitch);
        expect(handleThemeChange).toHaveBeenCalledWith('light');
    });

    it('5. Содержит свитчер режима для цветовой слепоты (дальтоников)', () => {
        const handleColorBlindChange = vi.fn();
        render(
            <SettingsModal
                isOpen={true}
                onClose={vi.fn()}
                isColorBlind={false}
                onColorBlindChange={handleColorBlindChange}
            />
        );

        const cbSwitch = screen.getByRole('switch', { name: /переключить режим для дальтоников/i });
        expect(cbSwitch).toBeTruthy();
        expect(cbSwitch.getAttribute('aria-checked')).toBe('false');
        expect(screen.getByText(/режим для дальтоников/i)).toBeTruthy();

        // Клик переключает режим в true
        fireEvent.click(cbSwitch);
        expect(handleColorBlindChange).toHaveBeenCalledWith(true);
    });

    it('6. Интерактивная палитра предпросмотра адаптируется под активный режим дальтонизма', () => {
        const { rerender } = render(
            <SettingsModal
                isOpen={true}
                onClose={vi.fn()}
                isColorBlind={false}
            />
        );

        expect(screen.getByText(/стандартная/i)).toBeTruthy();
        const palette = screen.getByTestId('settings-preview-palette');
        // Стандартный цвет для 0-20 — зеленый #4CAF50
        const firstChipStandard = palette.children[0];
        expect(firstChipStandard.textContent).toContain('0–20');
        expect(firstChipStandard.style.backgroundColor).toBe('rgb(76, 175, 80)'); // #4CAF50

        // Переключаем в режим дальтоников
        rerender(
            <SettingsModal
                isOpen={true}
                onClose={vi.fn()}
                isColorBlind={true}
            />
        );

        expect(screen.getByText(/режим доступности/i)).toBeTruthy();
        // В режиме доступности 0-20 становится синим #0072B2 -> rgb(0, 114, 178)
        const firstChipColorblind = palette.children[0];
        expect(firstChipColorblind.style.backgroundColor).toBe('rgb(0, 114, 178)');
    });

    it('7. Вызывает onClose при нажатии на кнопку закрытия (крестик)', () => {
        const handleClose = vi.fn();
        render(<SettingsModal isOpen={true} onClose={handleClose} />);

        const closeBtn = screen.getByRole('button', { name: /закрыть настройки/i });
        fireEvent.click(closeBtn);

        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('8. Вызывает onClose при клике по фоновой подложке (overlay)', () => {
        const handleClose = vi.fn();
        const { container } = render(<SettingsModal isOpen={true} onClose={handleClose} />);

        const overlay = container.querySelector('.settings-modal-overlay') || screen.getByTestId('settings-modal-overlay');
        fireEvent.click(overlay);

        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('9. НЕ закрывается при клике внутри содержимого модального окна', () => {
        const handleClose = vi.fn();
        render(<SettingsModal isOpen={true} onClose={handleClose} />);

        const modalDialog = screen.getByRole('dialog');
        fireEvent.click(modalDialog);

        expect(handleClose).not.toHaveBeenCalled();
    });

    it('10. Закрывается по клавише Escape', () => {
        const handleClose = vi.fn();
        render(<SettingsModal isOpen={true} onClose={handleClose} />);

        fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('11. В автономном режиме (без внешних пропсов-коллбэков) самостоятельно обновляет localStorage и data-атрибуты', () => {
        render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

        const themeSwitch = screen.getByRole('switch', { name: /переключить тему оформления/i });
        fireEvent.click(themeSwitch);

        expect(localStorage.getItem('aerocast_theme')).toBeTruthy();
        expect(document.documentElement.getAttribute('data-theme')).toBeTruthy();

        const cbSwitch = screen.getByRole('switch', { name: /переключить режим для дальтоников/i });
        fireEvent.click(cbSwitch);

        expect(localStorage.getItem('aerocast_colorblind')).toBe('true');
        expect(document.documentElement.getAttribute('data-colorblind')).toBe('true');
    });
});
