import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import App from '../../src/App';
import Sidebar from '../../src/components/Sidebar';
import RightAirPanel from '../../src/components/RightAirPanel';

// Мокаем MapComponent, так как jsdom не поддерживает WebGL
vi.mock('../../src/components/MapComponent', () => {
    return {
        default: function DummyMap(props) {
            return (
                <div data-testid="map">
                    <button
                        data-testid="map-click-btn"
                        onClick={() => props.onMapClick && props.onMapClick({ lat: 55.75, lon: 37.61 })}
                    >
                        Click Map
                    </button>
                    <button
                        data-testid="map-marker-btn"
                        onClick={() => props.onMarkerClick && props.onMarkerClick()}
                    >
                        Click Marker
                    </button>
                </div>
            );
        }
    };
});

// Мокаем хук useAirGrid
vi.mock('../../src/hooks/useAirGrid', () => {
    return {
        default: vi.fn(() => ({
            macroGrid: null,
            microGrid: null,
            loadMicroGrid: vi.fn(),
            loadMacroGrid: vi.fn(),
            isLoadingGrid: false,
            gridError: null
        }))
    };
});

const mockAirData = {
    latitude: 53.7596,
    longitude: 87.1467,
    used_source: 'open-meteo',
    hourly: {
        time: ['2026-10-01T12:00'],
        european_aqi: [42],
        pm2_5: [18],
        pm10: [32],
        nitrogen_dioxide: [40],
        sulphur_dioxide: [15],
        ozone: [65],
        carbon_monoxide: [380]
    }
};

describe('Mobile Layout & Responsive Controls (Оптимизация под телефоны)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => mockAirData
        });
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('1. Рендерит плавающую мобильную кнопку вызова меню/поиска на карте', async () => {
        render(<App />);

        const toggleBtn = screen.getByTestId('mobile-menu-toggle');
        expect(toggleBtn).toBeTruthy();
        expect(toggleBtn.textContent).toContain('Aerocast');
        expect(toggleBtn.textContent).toContain('Поиск');
    });

    it('2. При нажатии на мобильную кнопку меню открывает сайдбар и отображает затемняющий бэкдроп', async () => {
        render(<App />);

        const toggleBtn = screen.getByTestId('mobile-menu-toggle');
        const backdrop = document.querySelector('.sidebar-backdrop');
        expect(backdrop.classList.contains('sidebar-backdrop--visible')).toBe(false);

        fireEvent.click(toggleBtn);

        expect(backdrop.classList.contains('sidebar-backdrop--visible')).toBe(true);
        const sidebar = document.querySelector('.sidebar');
        expect(sidebar.classList.contains('sidebar--open')).toBe(true);
    });

    it('3. Клик по затемняющему бэкдропу закрывает мобильный сайдбар', async () => {
        render(<App />);

        const toggleBtn = screen.getByTestId('mobile-menu-toggle');
        const backdrop = document.querySelector('.sidebar-backdrop');

        // Открываем
        fireEvent.click(toggleBtn);
        expect(backdrop.classList.contains('sidebar-backdrop--visible')).toBe(true);

        // Кликаем по бэкдропу
        fireEvent.click(backdrop);
        expect(backdrop.classList.contains('sidebar-backdrop--visible')).toBe(false);
        const sidebar = document.querySelector('.sidebar');
        expect(sidebar.classList.contains('sidebar--open')).toBe(false);
    });

    it('4. Клик по кнопке закрытия (крестик) в шапке сайдбара закрывает мобильное меню', async () => {
        render(<App />);

        // Открываем меню
        const toggleBtn = screen.getByTestId('mobile-menu-toggle');
        fireEvent.click(toggleBtn);

        // Находим кнопку закрытия в шапке
        const closeBtn = screen.getByLabelText('Закрыть меню');
        expect(closeBtn).toBeTruthy();

        fireEvent.click(closeBtn);

        const backdrop = document.querySelector('.sidebar-backdrop');
        expect(backdrop.classList.contains('sidebar-backdrop--visible')).toBe(false);
        const sidebar = document.querySelector('.sidebar');
        expect(sidebar.classList.contains('sidebar--open')).toBe(false);
    });

    it('5. В компоненте RightAirPanel присутствует декоративный хэндл для мобильного Bottom Sheet', () => {
        render(
            <RightAirPanel
                airData={mockAirData}
                selectedTimeIndex={0}
                isOpen={true}
                onClose={() => {}}
            />
        );

        const handle = document.querySelector('.panel-drag-handle');
        expect(handle).toBeTruthy();
    });

    it('6. Выбор локации на карте автоматически закрывает мобильный сайдбар', async () => {
        render(<App />);

        // Открываем меню
        const toggleBtn = screen.getByTestId('mobile-menu-toggle');
        fireEvent.click(toggleBtn);

        const backdrop = document.querySelector('.sidebar-backdrop');
        expect(backdrop.classList.contains('sidebar-backdrop--visible')).toBe(true);

        // Кликаем на карте
        const mapClickBtn = screen.getByTestId('map-click-btn');
        fireEvent.click(mapClickBtn);

        expect(backdrop.classList.contains('sidebar-backdrop--visible')).toBe(false);
    });

    it('7. Клик на кнопку "Информация о проекте" в мобильном сайдбаре закрывает сайдбар и открывает модальное окно', async () => {
        render(<App />);

        // Открываем мобильный сайдбар
        const toggleBtn = screen.getByTestId('mobile-menu-toggle');
        fireEvent.click(toggleBtn);

        const sidebar = document.querySelector('.sidebar');
        expect(sidebar.classList.contains('sidebar--open')).toBe(true);

        // Кликаем по кнопке информации о проекте
        const infoBtn = screen.getByLabelText('Информация о проекте');
        fireEvent.click(infoBtn);

        // Сайдбар должен закрыться
        expect(sidebar.classList.contains('sidebar--open')).toBe(false);
        // Модальное окно «О проекте» должно открыться
        expect(screen.getByRole('dialog')).toBeTruthy();
        expect(screen.getByText(/О проекте Aerocast/i)).toBeTruthy();
    });

    it('8. В мобильном сайдбаре присутствует декоративный хэндл на правом краю (.sidebar__drag-handle)', () => {
        render(<Sidebar isOpen={true} onClose={() => {}} />);

        const handle = document.querySelector('.sidebar__drag-handle');
        expect(handle).toBeTruthy();
        expect(handle.getAttribute('data-testid')).toBe('sidebar-drag-handle');
    });

    it('9. Жест закрытия сайдбара: перетаскивание влево смещает сайдбар в реальном времени (transform: translateX)', () => {
        render(<Sidebar isOpen={true} onClose={() => {}} />);

        const handle = document.querySelector('.sidebar__drag-handle');
        const sidebar = document.querySelector('.sidebar');

        // Начинаем жест перетаскивания пальцем за правый край
        fireEvent.touchStart(handle, { touches: [{ clientX: 300, clientY: 200 }] });
        // Ведем влево на 80px (300 -> 220)
        fireEvent.touchMove(handle, { touches: [{ clientX: 220, clientY: 200 }] });

        expect(sidebar.style.transform).toBe('translateX(-80px)');
    });

    it('10. Жест закрытия сайдбара: при смещении влево больше порога сайдбар уходит за экран и вызывает onClose', async () => {
        const onCloseMock = vi.fn();
        render(<Sidebar isOpen={true} onClose={onCloseMock} />);

        const handle = document.querySelector('.sidebar__drag-handle');
        const sidebar = document.querySelector('.sidebar');

        // Перетаскиваем влево больше порога (на 140px)
        fireEvent.touchStart(handle, { touches: [{ clientX: 300, clientY: 200 }] });
        fireEvent.touchMove(handle, { touches: [{ clientX: 160, clientY: 200 }] });
        fireEvent.touchEnd(handle);

        // Сайдбар уходит за экран
        expect(sidebar.style.transform).toBe('translateX(-100%)');

        // Вызывается onClose
        await waitFor(() => {
            expect(onCloseMock).toHaveBeenCalled();
        });
    });

    it('11. Жест закрытия сайдбара: при смещении влево меньше порога сайдбар возвращается на место (snap back к 0)', async () => {
        const onCloseMock = vi.fn();
        render(<Sidebar isOpen={true} onClose={onCloseMock} />);

        const handle = document.querySelector('.sidebar__drag-handle');
        const sidebar = document.querySelector('.sidebar');

        // Смещаем влево всего на 15px (меньше порога)
        fireEvent.touchStart(handle, { touches: [{ clientX: 300, clientY: 200 }] });
        fireEvent.touchMove(handle, { touches: [{ clientX: 285, clientY: 200 }] });
        fireEvent.touchEnd(handle);

        // Сайдбар возвращается на место
        expect(sidebar.style.transform).toBe('translateX(0)');
        expect(onCloseMock).not.toHaveBeenCalled();
    });

    it('12. Жест закрытия показателей (RightAirPanel): перетаскивание вниз смещает панель в реальном времени (transform: translateY)', () => {
        render(
            <RightAirPanel
                airData={mockAirData}
                selectedTimeIndex={0}
                isOpen={true}
                onClose={() => {}}
            />
        );

        const handle = document.querySelector('.panel-drag-handle');
        const panel = document.querySelector('.right-air-panel');

        // Начинаем жест утягивания панели вниз за хэндл
        fireEvent.touchStart(handle, { touches: [{ clientX: 150, clientY: 100 }] });
        // Ведем вниз на 90px (100 -> 190)
        fireEvent.touchMove(handle, { touches: [{ clientX: 150, clientY: 190 }] });

        expect(panel.style.transform).toBe('translateY(90px)');
    });

    it('13. Жест закрытия показателей: при смещении вниз больше порога панель уходит за экран и вызывает onClose', async () => {
        const onCloseMock = vi.fn();
        render(
            <RightAirPanel
                airData={mockAirData}
                selectedTimeIndex={0}
                isOpen={true}
                onClose={onCloseMock}
            />
        );

        const handle = document.querySelector('.panel-drag-handle');
        const panel = document.querySelector('.right-air-panel');

        // Перетаскиваем вниз больше порога (на 150px)
        fireEvent.touchStart(handle, { touches: [{ clientX: 150, clientY: 100 }] });
        fireEvent.touchMove(handle, { touches: [{ clientX: 150, clientY: 250 }] });
        fireEvent.touchEnd(handle);

        // Панель уходит за экран вниз
        expect(panel.style.transform).toBe('translateY(100%)');

        // Вызывается onClose
        await waitFor(() => {
            expect(onCloseMock).toHaveBeenCalled();
        });
    });

    it('14. Жест закрытия показателей: при смещении вниз меньше порога панель возвращается в исходное положение (snap back)', () => {
        const onCloseMock = vi.fn();
        render(
            <RightAirPanel
                airData={mockAirData}
                selectedTimeIndex={0}
                isOpen={true}
                onClose={onCloseMock}
            />
        );

        const handle = document.querySelector('.panel-drag-handle');
        const panel = document.querySelector('.right-air-panel');

        // Смещаем вниз всего на 15px (меньше порога)
        fireEvent.touchStart(handle, { touches: [{ clientX: 150, clientY: 100 }] });
        fireEvent.touchMove(handle, { touches: [{ clientX: 150, clientY: 115 }] });
        fireEvent.touchEnd(handle);

        // Панель возвращается в исходное положение
        expect(panel.style.transform).toBe('translateY(0)');
        expect(onCloseMock).not.toHaveBeenCalled();
    });

    it('15. Поддержка управления жестами закрытия через Pointer Events (pointerdown, pointermove, pointerup)', async () => {
        const onCloseMock = vi.fn();
        render(
            <RightAirPanel
                airData={mockAirData}
                selectedTimeIndex={0}
                isOpen={true}
                onClose={onCloseMock}
            />
        );

        const handle = document.querySelector('.panel-drag-handle');
        const panel = document.querySelector('.right-air-panel');

        fireEvent.pointerDown(handle, { clientX: 150, clientY: 100, pointerType: 'mouse' });
        fireEvent.pointerMove(handle, { clientX: 150, clientY: 260, pointerType: 'mouse' });

        expect(panel.style.transform).toBe('translateY(160px)');

        fireEvent.pointerUp(handle, { pointerType: 'mouse' });

        await waitFor(() => {
            expect(onCloseMock).toHaveBeenCalled();
        });
    });

    it('16. Нажатие мыши/тачпада на тело панели или шапку не вызывает перетаскивание (защита для ноутбуков)', () => {
        const onCloseMock = vi.fn();
        render(
            <RightAirPanel
                airData={mockAirData}
                selectedTimeIndex={0}
                isOpen={true}
                onClose={onCloseMock}
            />
        );

        const header = document.querySelector('.panel-header');
        const panel = document.querySelector('.right-air-panel');

        // Клик и движение мышью/тачпадом по шапке или контенту
        fireEvent.pointerDown(header, { clientX: 150, clientY: 100, pointerType: 'mouse' });
        fireEvent.pointerMove(header, { clientX: 150, clientY: 260, pointerType: 'mouse' });

        // Панель НЕ должна сдвигаться
        expect(panel.style.transform).not.toBe('translateY(160px)');
        expect(panel.classList.contains('right-air-panel--dragging')).toBe(false);

        fireEvent.pointerUp(header, { pointerType: 'mouse' });
        expect(onCloseMock).not.toHaveBeenCalled();
    });
});
