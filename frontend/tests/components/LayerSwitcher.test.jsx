// frontend/tests/components/LayerSwitcher.test.jsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import LayerSwitcher from '../../src/components/LayerSwitcher';

describe('LayerSwitcher component', () => {
    afterEach(() => {
        cleanup();
    });

    it('отображает текущий активный слой по умолчанию ("Карта")', () => {
        render(<LayerSwitcher activeLayer="osm" onLayerChange={() => {}} />);
        expect(screen.getAllByText('Карта').length).toBeGreaterThan(0);
    });

    it('отображает "Спутник", если activeLayer="satellite"', () => {
        render(<LayerSwitcher activeLayer="satellite" onLayerChange={() => {}} />);
        expect(screen.getAllByText('Спутник').length).toBeGreaterThan(0);
    });

    it('открывает и закрывает меню слоев при клике на кнопку', () => {
        const { container } = render(<LayerSwitcher activeLayer="osm" onLayerChange={() => {}} />);

        const toggleBtn = container.querySelector('.layer-switcher__toggle');
        const menu = container.querySelector('.layer-switcher__menu');

        expect(menu.className).not.toContain('layer-switcher__menu--visible');

        fireEvent.click(toggleBtn);
        expect(menu.className).toContain('layer-switcher__menu--visible');

        fireEvent.click(toggleBtn);
        expect(menu.className).not.toContain('layer-switcher__menu--visible');
    });

    it('вызывает onLayerChange("satellite") при выборе спутникового слоя', () => {
        const onLayerChangeMock = vi.fn();
        const { container } = render(<LayerSwitcher activeLayer="osm" onLayerChange={onLayerChangeMock} />);

        // Открываем меню
        fireEvent.click(container.querySelector('.layer-switcher__toggle'));

        // Кликаем по пункту "Спутник"
        const satelliteBtn = screen.getByText('Снимки ESRI World Imagery').closest('button');
        fireEvent.click(satelliteBtn);

        expect(onLayerChangeMock).toHaveBeenCalledWith('satellite');
    });

    it('не вызывает onLayerChange, если кликнули по уже активному слою', () => {
        const onLayerChangeMock = vi.fn();
        const { container } = render(<LayerSwitcher activeLayer="osm" onLayerChange={onLayerChangeMock} />);

        // Открываем меню
        fireEvent.click(container.querySelector('.layer-switcher__toggle'));

        // Кликаем по уже активной "Карте"
        const osmBtn = screen.getByText('Схема OpenStreetMap').closest('button');
        fireEvent.click(osmBtn);

        expect(onLayerChangeMock).not.toHaveBeenCalled();
    });
});
