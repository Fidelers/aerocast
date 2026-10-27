// frontend/tests/components/SettingsModal.test.jsx
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import SettingsModal, { COLORBLIND_TYPES } from '../../src/components/SettingsModal';

describe('SettingsModal component (окно настроек темы и цветовой доступности)', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.removeAttribute('data-colorblind');
        document.documentElement.removeAttribute('data-colorblind-type');
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

    it('12. Не закрывается при нажатии других клавиш (не Escape)', () => {
        const handleClose = vi.fn();
        render(<SettingsModal isOpen={true} onClose={handleClose} />);
        fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });
        fireEvent.keyDown(window, { key: 'Tab', code: 'Tab' });
        expect(handleClose).not.toHaveBeenCalled();
    });

    it('13. Удаляет слушатель keydown при закрытии', () => {
        const removeSpy = vi.spyOn(window, 'removeEventListener');
        const { rerender } = render(<SettingsModal isOpen={true} onClose={vi.fn()} />);
        rerender(<SettingsModal isOpen={false} onClose={vi.fn()} />);
        expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('14. Использует светлую тему по умолчанию без saved и без matchMedia', () => {
        localStorage.clear();
        const original = window.matchMedia;
        delete window.matchMedia;
        try {
            render(<SettingsModal isOpen={true} onClose={vi.fn()} />);
            const themeSwitch = screen.getByRole('switch', { name: /переключить тему оформления/i });
            expect(themeSwitch.getAttribute('aria-checked')).toBe('false');
        } finally {
            window.matchMedia = original;
        }
    });

    it('15. Переключает тему в автономном режиме с dark на light', () => {
        localStorage.setItem('aerocast_theme', 'dark');
        render(<SettingsModal isOpen={true} onClose={vi.fn()} />);
        const themeSwitch = screen.getByRole('switch', { name: /переключить тему оформления/i });
        expect(themeSwitch.getAttribute('aria-checked')).toBe('true');
        fireEvent.click(themeSwitch);
        expect(localStorage.getItem('aerocast_theme')).toBe('light');
    });

    it('16. Переключает дальтонизм в автономном режиме из true в false', () => {
        localStorage.setItem('aerocast_colorblind', 'true');
    });

    it('17. Инициализирует темную тему через prefers-color-scheme: dark при отсутствии сохраненной темы', () => {
        localStorage.clear();
        const origMatchMedia = window.matchMedia;
        window.matchMedia = vi.fn().mockImplementation(query => ({
            matches: query === '(prefers-color-scheme: dark)',
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));

        try {
            render(<SettingsModal isOpen={true} onClose={vi.fn()} />);
            const themeSwitch = screen.getByRole('switch', { name: /переключить тему оформления/i });
            expect(themeSwitch.getAttribute('aria-checked')).toBe('true');
        } finally {
            window.matchMedia = origMatchMedia;
        }
    });

    it('18. Переключает тему и дальтонизм в автономном режиме с light на dark и с false на true', () => {
        localStorage.clear();
        render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

        const themeSwitch = screen.getByRole('switch', { name: /переключить тему оформления/i });
        fireEvent.click(themeSwitch);
        expect(localStorage.getItem('aerocast_theme')).toBe('dark');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

        const cbSwitch = screen.getByRole('switch', { name: /переключить режим для дальтоников/i });
        fireEvent.click(cbSwitch);
        expect(localStorage.getItem('aerocast_colorblind')).toBe('true');
        expect(document.documentElement.getAttribute('data-colorblind')).toBe('true');

        fireEvent.click(cbSwitch);
        expect(localStorage.getItem('aerocast_colorblind')).toBe('false');
        expect(document.documentElement.getAttribute('data-colorblind')).toBe('false');
    });

    it('19. Не отображает выбор видов дальтонизма, если режим цветовой слепоты выключен', () => {
        render(<SettingsModal isOpen={true} onClose={vi.fn()} isColorBlind={false} />);
        expect(screen.queryByTestId('settings-colorblind-types')).toBeNull();
        expect(screen.queryByText(/вид дальтонизма/i)).toBeNull();
    });

    it('20. Отображает выбор видов дальтонизма только когда режим цветовой слепоты включен', () => {
        render(<SettingsModal isOpen={true} onClose={vi.fn()} isColorBlind={true} colorBlindType="okabe" />);
        expect(screen.getByTestId('settings-colorblind-types')).toBeTruthy();
        expect(screen.getByRole('radio', { name: /окабе/i })).toBeTruthy();
        expect(screen.getByRole('radio', { name: /дейтеранопия/i })).toBeTruthy();
        expect(screen.getByRole('radio', { name: /протанопия/i })).toBeTruthy();
        expect(screen.getByRole('radio', { name: /тританопия/i })).toBeTruthy();
    });

    it('21. Позволяет выбрать только 1 вид дальтонизма (single choice) и вызывает onColorBlindTypeChange', () => {
        const handleTypeChange = vi.fn();
        render(
            <SettingsModal
                isOpen={true}
                onClose={vi.fn()}
                isColorBlind={true}
                colorBlindType="okabe"
                onColorBlindTypeChange={handleTypeChange}
            />
        );

        const okabeBtn = screen.getByRole('radio', { name: /окабе/i });
        const deutBtn = screen.getByRole('radio', { name: /дейтеранопия/i });
        const protBtn = screen.getByRole('radio', { name: /протанопия/i });
        const tritBtn = screen.getByRole('radio', { name: /тританопия/i });

        expect(okabeBtn.getAttribute('aria-checked')).toBe('true');
        expect(deutBtn.getAttribute('aria-checked')).toBe('false');
        expect(protBtn.getAttribute('aria-checked')).toBe('false');
        expect(tritBtn.getAttribute('aria-checked')).toBe('false');

        // Клик по Дейтеранопия
        fireEvent.click(deutBtn);
        expect(handleTypeChange).toHaveBeenCalledWith('deuteranopia');

        // Клик по Протанопия
        fireEvent.click(protBtn);
        expect(handleTypeChange).toHaveBeenCalledWith('protanopia');

        // Клик по Тританопия
        fireEvent.click(tritBtn);
        expect(handleTypeChange).toHaveBeenCalledWith('tritanopia');
    });

    it('22. Интерактивная палитра предпросмотра адаптируется под каждый выбранный вид дальтонизма', () => {
        const { rerender } = render(
            <SettingsModal
                isOpen={true}
                onClose={vi.fn()}
                isColorBlind={true}
                colorBlindType="okabe"
            />
        );

        const palette = screen.getByTestId('settings-preview-palette');
        // Окабе: 0-20 -> #0072B2 -> rgb(0, 114, 178)
        expect(palette.children[0].style.backgroundColor).toBe('rgb(0, 114, 178)');
        expect(screen.getByText(/режим доступности: окабе/i)).toBeTruthy();

        // Дейтеранопия: 0-20 -> #1E88E5 -> rgb(30, 136, 229)
        rerender(
            <SettingsModal
                isOpen={true}
                onClose={vi.fn()}
                isColorBlind={true}
                colorBlindType="deuteranopia"
            />
        );
        expect(palette.children[0].style.backgroundColor).toBe('rgb(30, 136, 229)');
        expect(screen.getByText(/режим доступности: дейтеранопия/i)).toBeTruthy();

        // Протанопия: 0-20 -> #0077BB -> rgb(0, 119, 187)
        rerender(
            <SettingsModal
                isOpen={true}
                onClose={vi.fn()}
                isColorBlind={true}
                colorBlindType="protanopia"
            />
        );
        expect(palette.children[0].style.backgroundColor).toBe('rgb(0, 119, 187)');
        expect(screen.getByText(/режим доступности: протанопия/i)).toBeTruthy();

        // Тританопия: 0-20 -> #009E73 -> rgb(0, 158, 115)
        rerender(
            <SettingsModal
                isOpen={true}
                onClose={vi.fn()}
                isColorBlind={true}
                colorBlindType="tritanopia"
            />
        );
        expect(palette.children[0].style.backgroundColor).toBe('rgb(0, 158, 115)');
        expect(screen.getByText(/режим доступности: тританопия/i)).toBeTruthy();
    });

    it('23. В автономном режиме переключение вида сохраняется в localStorage и data-атрибуте', () => {
        localStorage.setItem('aerocast_colorblind', 'true');
        render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

        const deutBtn = screen.getByRole('radio', { name: /дейтеранопия/i });
        fireEvent.click(deutBtn);

        expect(localStorage.getItem('aerocast_colorblind_type')).toBe('deuteranopia');
        expect(document.documentElement.getAttribute('data-colorblind-type')).toBe('deuteranopia');

        const tritBtn = screen.getByRole('radio', { name: /тританопия/i });
        fireEvent.click(tritBtn);

        expect(localStorage.getItem('aerocast_colorblind_type')).toBe('tritanopia');
        expect(document.documentElement.getAttribute('data-colorblind-type')).toBe('tritanopia');
    });

    it('24. Экспортирует COLORBLIND_TYPES со всеми 4 видами', () => {
        expect(COLORBLIND_TYPES).toHaveLength(4);
        expect(COLORBLIND_TYPES.map(t => t.id)).toEqual(['okabe', 'deuteranopia', 'protanopia', 'tritanopia']);
    });
});
