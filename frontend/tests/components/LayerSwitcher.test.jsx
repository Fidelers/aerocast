// frontend/tests/components/LayerSwitcher.test.jsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import LayerSwitcher from '../../src/components/LayerSwitcher';

describe('LayerSwitcher component', () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('1. Отображает текущий активный слой по умолчанию ("Карта")', () => {
        render(<LayerSwitcher activeLayer="osm" onLayerChange={() => { }} />);
        expect(screen.getAllByText('Карта').length).toBeGreaterThan(0);
    });

    it('2. Отображает "Спутник", если activeLayer="satellite"', () => {
        render(<LayerSwitcher activeLayer="satellite" onLayerChange={() => { }} />);
        expect(screen.getAllByText('Спутник').length).toBeGreaterThan(0);
    });

    it('3. Открывает и закрывает меню слоев при клике на кнопку переключения', () => {
        const { container } = render(<LayerSwitcher activeLayer="osm" onLayerChange={() => { }} />);

        const toggleBtn = container.querySelector('.layer-switcher__toggle');
        const menu = container.querySelector('.layer-switcher__menu');

        expect(menu.className).not.toContain('layer-switcher__menu--visible');

        fireEvent.click(toggleBtn);
        expect(menu.className).toContain('layer-switcher__menu--visible');

        fireEvent.click(toggleBtn);
        expect(menu.className).not.toContain('layer-switcher__menu--visible');
    });

    it('4. Вызывает onLayerChange("satellite") при выборе спутникового слоя ("Снимки ESRI World Imagery")', () => {
        const onLayerChangeMock = vi.fn();
        const { container } = render(<LayerSwitcher activeLayer="osm" onLayerChange={onLayerChangeMock} />);

        // Открываем меню
        fireEvent.click(container.querySelector('.layer-switcher__toggle'));

        // Кликаем по пункту "Спутник"
        const satelliteBtn = screen.getByText('Снимки ESRI World Imagery').closest('button');
        fireEvent.click(satelliteBtn);

        expect(onLayerChangeMock).toHaveBeenCalledWith('satellite');
    });

    it('5. Вызывает onLayerChange("osm") при выборе векторного слоя ("Схема OpenStreetMap")', () => {
        const onLayerChangeMock = vi.fn();
        const { container } = render(<LayerSwitcher activeLayer="satellite" onLayerChange={onLayerChangeMock} />);

        // Открываем меню
        fireEvent.click(container.querySelector('.layer-switcher__toggle'));

        // Кликаем по пункту "Карта"
        const osmBtn = screen.getByText('Схема OpenStreetMap').closest('button');
        fireEvent.click(osmBtn);

        expect(onLayerChangeMock).toHaveBeenCalledWith('osm');
    });

    it('6. Не вызывает onLayerChange, если кликнули по уже активному слою', () => {
        const onLayerChangeMock = vi.fn();
        const { container } = render(<LayerSwitcher activeLayer="osm" onLayerChange={onLayerChangeMock} />);

        // Открываем меню
        fireEvent.click(container.querySelector('.layer-switcher__toggle'));

        // Кликаем по уже активной "Карте"
        const osmBtn = screen.getByText('Схема OpenStreetMap').closest('button');
        fireEvent.click(osmBtn);

        expect(onLayerChangeMock).not.toHaveBeenCalled();
    });

    it('7. Закрывает выпадающее меню слоев при нажатии клавиши Escape (UX-требование #65)', () => {
        const { container } = render(<LayerSwitcher activeLayer="osm" onLayerChange={() => { }} />);

        const toggleBtn = container.querySelector('.layer-switcher__toggle');
        const menu = container.querySelector('.layer-switcher__menu');

        // Открываем меню
        fireEvent.click(toggleBtn);
        expect(menu.className).toContain('layer-switcher__menu--visible');

        // Нажимаем Escape
        fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

        // Меню должно закрыться
        expect(menu.className).not.toContain('layer-switcher__menu--visible');
    });

    it('8. Закрывает выпадающее меню при клике вне компонента (click-outside)', () => {
        const { container } = render(
            <div>
                <LayerSwitcher activeLayer="osm" onLayerChange={() => { }} />
                <div data-testid="outside-area">Внешняя область</div>
            </div>
        );

        const toggleBtn = container.querySelector('.layer-switcher__toggle');
        const menu = container.querySelector('.layer-switcher__menu');

        // Открываем меню
        fireEvent.click(toggleBtn);
        expect(menu.className).toContain('layer-switcher__menu--visible');

        // Кликаем вне компонента
        const outside = screen.getByTestId('outside-area');
        fireEvent.mouseDown(outside);

        // Меню должно закрыться
        expect(menu.className).not.toContain('layer-switcher__menu--visible');
    });

    it('9. Не закрывает меню при клике внутри контейнера меню', () => {
        const { container } = render(<LayerSwitcher activeLayer="osm" onLayerChange={() => { }} />);

        const toggleBtn = container.querySelector('.layer-switcher__toggle');
        const menu = container.querySelector('.layer-switcher__menu');

        // Открываем меню
        fireEvent.click(toggleBtn);
        expect(menu.className).toContain('layer-switcher__menu--visible');

        // Кликаем внутри меню (не по кнопке выбора слоя)
        fireEvent.mouseDown(menu);

        // Меню должно остаться видимым
        expect(menu.className).toContain('layer-switcher__menu--visible');
    });

    it('10. Очищает слушатели событий (removeEventListener) при размонтировании', () => {
        const removeKeydownSpy = vi.spyOn(window, 'removeEventListener');
        const removeMousedownSpy = vi.spyOn(document, 'removeEventListener');

        const { container, unmount } = render(<LayerSwitcher activeLayer="osm" onLayerChange={() => { }} />);

        // Открываем меню, чтобы слушатели точно были активны
        const toggleBtn = container.querySelector('.layer-switcher__toggle');
        fireEvent.click(toggleBtn);

        unmount();

        // Должно быть вызвано удаление слушателей Escape или mousedown
        const keydownRemoved = removeKeydownSpy.mock.calls.some(([event]) => event === 'keydown');
        const mousedownRemoved = removeMousedownSpy.mock.calls.some(([event]) => event === 'mousedown');

        expect(keydownRemoved || mousedownRemoved).toBe(true);
    });

    it('11. Игнорирует нажатие клавиш кроме Escape при открытом меню', () => {
        const { container } = render(<LayerSwitcher activeLayer="osm" onLayerChange={() => { }} />);
        const toggleBtn = container.querySelector('.layer-switcher__toggle');
        const menu = container.querySelector('.layer-switcher__menu');
        fireEvent.click(toggleBtn);
        expect(menu.className).toContain('layer-switcher__menu--visible');

        fireEvent.keyDown(window, { key: 'Enter' });
        expect(menu.className).toContain('layer-switcher__menu--visible');
    });

    it('12. Адаптивность: кнопка и меню содержат элементы иконки и читаемой подписи слоя', () => {
        const { container } = render(<LayerSwitcher activeLayer="osm" onLayerChange={() => { }} />);
        const toggleBtn = container.querySelector('.layer-switcher__toggle');
        const icon = toggleBtn.querySelector('.layer-switcher__icon');
        const label = toggleBtn.querySelector('.layer-switcher__label');

        expect(toggleBtn).toBeTruthy();
        expect(icon).toBeTruthy();
        expect(label).toBeTruthy();
        expect(label.textContent).toBe('Карта');
    });

    it('13. Кнопка переключения слоёв сохраняет класс и структуру независимо от темы', () => {
        document.documentElement.setAttribute('data-theme', 'dark');
        const { container } = render(<LayerSwitcher activeLayer="osm" onLayerChange={() => { }} />);
        const toggleBtn = container.querySelector('.layer-switcher__toggle');
        expect(toggleBtn).toBeTruthy();
        expect(toggleBtn.classList.contains('layer-switcher__toggle')).toBe(true);
        document.documentElement.removeAttribute('data-theme');
    });

    it('14. Монтируется через createPortal при передаче targetContainer', () => {
        const portalTarget = document.createElement('div');
        document.body.appendChild(portalTarget);
        const { unmount } = render(
            <LayerSwitcher activeLayer="osm" onLayerChange={() => { }} targetContainer={portalTarget} />
        );
        expect(portalTarget.querySelector('[data-testid="layer-switcher"]')).toBeTruthy();
        unmount();
        document.body.removeChild(portalTarget);
    });

    it('15. Находит .map-container .maplibregl-ctrl-top-right сразу при монтировании и по поллингу', async () => {
        vi.useFakeTimers();
        const mapContainer = document.createElement('div');
        mapContainer.className = 'map-container';
        const ctrlTopRight = document.createElement('div');
        ctrlTopRight.className = 'maplibregl-ctrl-top-right';
        document.body.appendChild(mapContainer);

        const { unmount: unmountDelayed } = render(
            <LayerSwitcher activeLayer="osm" onLayerChange={() => { }} />
        );
        mapContainer.appendChild(ctrlTopRight);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
        });
        expect(ctrlTopRight.querySelector('[data-testid="layer-switcher"]')).toBeTruthy();
        unmountDelayed();

        const { unmount: unmountImmediate } = render(
            <LayerSwitcher activeLayer="osm" onLayerChange={() => { }} />
        );
        expect(ctrlTopRight.querySelector('[data-testid="layer-switcher"]')).toBeTruthy();
        unmountImmediate();

        document.body.removeChild(mapContainer);

        const { unmount: unmountTimeout } = render(
            <LayerSwitcher activeLayer="osm" onLayerChange={() => { }} />
        );
        await vi.advanceTimersByTimeAsync(2100);
        unmountTimeout();
        vi.useRealTimers();
    });
});
