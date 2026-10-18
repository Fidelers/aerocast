import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

if (typeof window !== 'undefined' && !window.AnimationEvent) {
    window.AnimationEvent = class AnimationEvent extends window.Event {};
}

import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import RightAirPanel from '../../src/components/RightAirPanel';

const mockAirData = {
    latitude: 53.7596,
    longitude: 87.1467,
    used_source: 'open-meteo',
    hourly: {
        time: ['2026-09-28T00:00', '2026-09-28T03:00'],
        european_aqi: [35, 65],
        pm2_5: [10, 25],
        pm10: [20, 50],
        nitrogen_dioxide: [15, 30],
        ozone: [40, 60],
        sulphur_dioxide: [5, 10],
        carbon_monoxide: [300, 500]
    }
};

describe('RightAirPanelCoverage — граничные случаи и полное покрытие веток', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-28T10:00:00'));
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe('1. Жесты перетаскивания, защита от мыши и сопротивление свайпу', () => {
        it('игнорирует начало перетаскивания мыши на контенте без panel-drag-handle', () => {
            render(
                <RightAirPanel
                    airData={mockAirData}
                    selectedTimeIndex={0}
                    isOpen={true}
                    onClose={vi.fn()}
                />
            );

            const panel = screen.getByLabelText('Детальная информация о качестве воздуха');
            const meta = panel.querySelector('.panel-meta');

            fireEvent.pointerDown(meta, {
                clientX: 100,
                clientY: 200,
                button: 0,
                pointerType: 'mouse'
            });

            expect(panel.classList.contains('right-air-panel--dragging')).toBe(false);
        });

        it('игнорирует перетаскивание при клике на кнопку закрытия в заголовке', () => {
            render(
                <RightAirPanel
                    airData={mockAirData}
                    selectedTimeIndex={0}
                    isOpen={true}
                    onClose={vi.fn()}
                />
            );

            const panel = screen.getByLabelText('Детальная информация о качестве воздуха');
            const closeBtn = panel.querySelector('.panel-header__close-btn');

            fireEvent.pointerDown(closeBtn, {
                clientX: 100,
                clientY: 200,
                button: 0,
                pointerType: 'touch'
            });

            expect(panel.classList.contains('right-air-panel--dragging')).toBe(false);
        });

        it('игнорирует pointerdown при button !== 0 (правый клик)', () => {
            render(
                <RightAirPanel
                    airData={mockAirData}
                    selectedTimeIndex={0}
                    isOpen={true}
                    onClose={vi.fn()}
                />
            );

            const panel = screen.getByLabelText('Детальная информация о качестве воздуха');
            const handle = panel.querySelector('.panel-drag-handle');

            fireEvent.pointerDown(handle, {
                clientX: 100,
                clientY: 200,
                button: 2,
                pointerType: 'mouse'
            });

            expect(panel.classList.contains('right-air-panel--dragging')).toBe(false);
        });

        it('начинает перетаскивание за ручку, тянет вниз и проверяет резиновое сопротивление при движении вверх', () => {
            render(
                <RightAirPanel
                    airData={mockAirData}
                    selectedTimeIndex={0}
                    isOpen={true}
                    onClose={vi.fn()}
                />
            );

            const panel = screen.getByLabelText('Детальная информация о качестве воздуха');
            const handle = panel.querySelector('.panel-drag-handle');

            fireEvent.pointerDown(handle, {
                clientX: 100,
                clientY: 200,
                button: 0,
                pointerType: 'mouse',
                pointerId: 1
            });

            expect(panel.classList.contains('right-air-panel--dragging')).toBe(true);

            fireEvent.pointerMove(panel, {
                clientX: 100,
                clientY: 260,
                pointerType: 'mouse'
            });

            expect(panel.style.transform).toContain('translateY(60px)');

            fireEvent.pointerMove(panel, {
                clientX: 100,
                clientY: 100,
                pointerType: 'mouse'
            });

            expect(panel.style.transform).toContain('translateY(-15px)');
        });

        it('закрывает панель при смещении вниз больше порогового значения', () => {
            const onClose = vi.fn();
            render(
                <RightAirPanel
                    airData={mockAirData}
                    selectedTimeIndex={0}
                    isOpen={true}
                    onClose={onClose}
                />
            );

            const panel = screen.getByLabelText('Детальная информация о качестве воздуха');
            const handle = panel.querySelector('.panel-drag-handle');

            fireEvent.pointerDown(handle, {
                clientX: 100,
                clientY: 100,
                button: 0,
                pointerType: 'mouse',
                pointerId: 1
            });

            fireEvent.pointerMove(panel, {
                clientX: 100,
                clientY: 300,
                pointerType: 'mouse'
            });

            fireEvent.pointerUp(panel, {
                pointerId: 1
            });

            act(() => {
                vi.advanceTimersByTime(250);
            });

            expect(onClose).toHaveBeenCalled();
        });

        it('возвращает панель назад при смещении вниз меньше порогового', () => {
            const onClose = vi.fn();
            render(
                <RightAirPanel
                    airData={mockAirData}
                    selectedTimeIndex={0}
                    isOpen={true}
                    onClose={onClose}
                />
            );

            const panel = screen.getByLabelText('Детальная информация о качестве воздуха');
            const handle = panel.querySelector('.panel-drag-handle');

            fireEvent.pointerDown(handle, {
                clientX: 100,
                clientY: 100,
                button: 0,
                pointerType: 'mouse',
                pointerId: 1
            });

            fireEvent.pointerMove(panel, {
                clientX: 100,
                clientY: 110,
                pointerType: 'mouse'
            });

            fireEvent.pointerUp(panel, {
                pointerId: 1
            });

            act(() => {
                vi.advanceTimersByTime(250);
            });

            expect(onClose).not.toHaveBeenCalled();
            expect(panel.style.transform).toBe('translateY(0)');
        });

        it('распознает свайп вниз тачем и отличает его от горизонтальной прокрутки', () => {
            render(
                <RightAirPanel
                    airData={mockAirData}
                    selectedTimeIndex={0}
                    isOpen={true}
                    onClose={vi.fn()}
                />
            );

            const panel = screen.getByLabelText('Детальная информация о качестве воздуха');

            fireEvent.touchStart(panel, {
                touches: [{ clientX: 100, clientY: 100 }]
            });

            fireEvent.touchMove(panel, {
                touches: [{ clientX: 150, clientY: 102 }]
            });
            expect(panel.classList.contains('right-air-panel--dragging')).toBe(false);

            fireEvent.touchMove(panel, {
                touches: [{ clientX: 100, clientY: 120 }]
            });
            expect(panel.classList.contains('right-air-panel--dragging')).toBe(true);

            fireEvent.touchEnd(panel);
            act(() => {
                vi.advanceTimersByTime(250);
            });
        });

        it('обрабатывает события отмены onTouchCancel и onPointerCancel', () => {
            render(
                <RightAirPanel
                    airData={mockAirData}
                    selectedTimeIndex={0}
                    isOpen={true}
                    onClose={vi.fn()}
                />
            );

            const panel = screen.getByLabelText('Детальная информация о качестве воздуха');
            const handle = panel.querySelector('.panel-drag-handle');

            fireEvent.pointerDown(handle, {
                clientX: 100,
                clientY: 100,
                button: 0,
                pointerType: 'touch',
                pointerId: 1
            });

            fireEvent.pointerCancel(panel, {
                pointerId: 1
            });

            fireEvent.touchStart(panel, {
                touches: [{ clientX: 100, clientY: 100 }]
            });

            fireEvent.touchCancel(panel);

            act(() => {
                vi.advanceTimersByTime(150);
            });

            expect(panel.classList.contains('right-air-panel--dragging')).toBe(false);
        });

        it('сбрасывает анимацию по событию onAnimationEnd', () => {
            render(
                <RightAirPanel
                    airData={mockAirData}
                    selectedTimeIndex={0}
                    isOpen={true}
                />
            );

            const panel = screen.getByLabelText('Детальная информация о качестве воздуха');
            panel.style.animation = 'someAnimation 0.3s ease';

            const reactPropsKey = Object.keys(panel).find(p => p.startsWith('__reactProps'));
            if (panel[reactPropsKey]?.onAnimationEnd) {
                act(() => {
                    panel[reactPropsKey].onAnimationEnd();
                });
            }

            expect(panel.style.animation).toBe('none');
        });

        it('предотвращает всплытие клика после завершения перетаскивания', () => {
            render(
                <RightAirPanel
                    airData={mockAirData}
                    selectedTimeIndex={0}
                    isOpen={true}
                />
            );

            const panel = screen.getByLabelText('Детальная информация о качестве воздуха');
            const handle = panel.querySelector('.panel-drag-handle');

            fireEvent.pointerDown(handle, {
                clientX: 100,
                clientY: 100,
                button: 0,
                pointerType: 'mouse'
            });

            fireEvent.pointerMove(panel, {
                clientX: 100,
                clientY: 150,
                pointerType: 'mouse'
            });

            fireEvent.pointerUp(panel);

            const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
            const stopPropagationSpy = vi.spyOn(clickEvent, 'stopPropagation');
            const preventDefaultSpy = vi.spyOn(clickEvent, 'preventDefault');

            panel.dispatchEvent(clickEvent);

            expect(stopPropagationSpy).toHaveBeenCalled();
            expect(preventDefaultSpy).toHaveBeenCalled();
        });

        it('закрывает панель при резком смахивании с высокой скоростью даже при малом смещении', () => {
            const onClose = vi.fn();
            render(
                <RightAirPanel
                    airData={mockAirData}
                    selectedTimeIndex={0}
                    isOpen={true}
                    onClose={onClose}
                />
            );

            const panel = screen.getByLabelText('Детальная информация о качестве воздуха');
            const handle = panel.querySelector('.panel-drag-handle');

            fireEvent.pointerDown(handle, { clientX: 100, clientY: 100, button: 0, pointerType: 'mouse', pointerId: 1 });
            fireEvent.pointerMove(panel, { clientX: 100, clientY: 130, pointerType: 'mouse' });
            fireEvent.pointerUp(panel, { pointerId: 1 });

            act(() => { vi.advanceTimersByTime(250); });
            expect(onClose).toHaveBeenCalled();
        });

        it('игнорирует события указателя при активном таче и обрабатывает ошибки захвата указателя', () => {
            render(
                <RightAirPanel
                    airData={mockAirData}
                    selectedTimeIndex={0}
                    isOpen={true}
                    onClose={vi.fn()}
                />
            );

            const panel = screen.getByLabelText('Детальная информация о качестве воздуха');
            const handle = panel.querySelector('.panel-drag-handle');

            handle.setPointerCapture = () => { throw new Error('capture error'); };
            handle.releasePointerCapture = () => { throw new Error('release error'); };

            expect(() => {
                fireEvent.pointerDown(handle, { clientX: 100, clientY: 100, button: 0, pointerType: 'mouse', pointerId: 1 });
                fireEvent.pointerUp(panel, { pointerId: 1 });
            }).not.toThrow();

            fireEvent.touchStart(panel, { touches: [{ clientX: 100, clientY: 100 }] });
            fireEvent.pointerDown(handle, { clientX: 100, clientY: 100, button: 0, pointerType: 'mouse' });
            fireEvent.pointerMove(panel, { clientX: 100, clientY: 150, pointerType: 'mouse' });
            fireEvent.pointerUp(panel);
            fireEvent.pointerCancel(panel);

            fireEvent.touchEnd(panel);
            act(() => { vi.advanceTimersByTime(150); });
        });

        it('обрабатывает pointerCancel и освобождает захват указателя', () => {
            render(
                <RightAirPanel
                    airData={mockAirData}
                    selectedTimeIndex={0}
                    isOpen={true}
                    onClose={vi.fn()}
                />
            );

            const panel = screen.getByLabelText('Детальная информация о качестве воздуха');
            const handle = panel.querySelector('.panel-drag-handle');
            const releaseCaptureSpy = vi.fn();
            handle.releasePointerCapture = releaseCaptureSpy;

            fireEvent.pointerDown(handle, { clientX: 100, clientY: 100, button: 0, pointerType: 'mouse', pointerId: 7 });
            fireEvent.pointerCancel(handle, { pointerId: 7 });

            expect(releaseCaptureSpy).toHaveBeenCalledWith(7);
        });

        it('игнорирует начало и перемещение перетаскивания когда isClosing равен true', () => {
            const onClose = vi.fn();
            render(
                <RightAirPanel
                    airData={mockAirData}
                    selectedTimeIndex={0}
                    isOpen={true}
                    onClose={onClose}
                />
            );

            const panel = screen.getByLabelText('Детальная информация о качестве воздуха');
            const handle = panel.querySelector('.panel-drag-handle');

            fireEvent.pointerDown(handle, { clientX: 100, clientY: 100, button: 0, pointerType: 'mouse', pointerId: 1 });
            fireEvent.pointerMove(panel, { clientX: 100, clientY: 250, pointerType: 'mouse' });
            fireEvent.pointerUp(panel, { pointerId: 1 });

            fireEvent.pointerDown(handle, { clientX: 100, clientY: 100, button: 0, pointerType: 'mouse' });
            fireEvent.pointerMove(panel, { clientX: 100, clientY: 150, pointerType: 'mouse' });

            act(() => { vi.advanceTimersByTime(250); });
            expect(onClose).toHaveBeenCalled();
        });

        it('предотвращает перетаскивание при прокрутке вниз (scrollTop > 0) и блокирует авто-перетаскивание мыши', () => {
            render(
                <RightAirPanel
                    airData={mockAirData}
                    selectedTimeIndex={0}
                    isOpen={true}
                    onClose={vi.fn()}
                />
            );

            const panel = screen.getByLabelText('Детальная информация о качестве воздуха');

            Object.defineProperty(panel, 'scrollTop', { value: 50, configurable: true });

            fireEvent.touchStart(panel, { touches: [{ clientX: 100, clientY: 100 }] });
            fireEvent.touchMove(panel, { touches: [{ clientX: 100, clientY: 150 }] });

            expect(panel.classList.contains('right-air-panel--dragging')).toBe(false);

            fireEvent.pointerDown(panel, { clientX: 100, clientY: 100, button: 0, pointerType: 'mouse' });
            fireEvent.pointerMove(panel, { clientX: 100, clientY: 150, pointerType: 'mouse' });
            expect(panel.classList.contains('right-air-panel--dragging')).toBe(false);
        });

        it('обрабатывает пустой массив касаний touches в onTouchStart и onTouchMove', () => {
            render(
                <RightAirPanel
                    airData={mockAirData}
                    selectedTimeIndex={0}
                    isOpen={true}
                    onClose={vi.fn()}
                />
            );

            const panel = screen.getByLabelText('Детальная информация о качестве воздуха');
            fireEvent.touchStart(panel, { touches: [] });
            fireEvent.touchMove(panel, { touches: [] });
            expect(panel.classList.contains('right-air-panel--dragging')).toBe(false);
        });

        it('обрабатывает анимацию закрытия без колбэка onClose и освобождает захват указателя при pointerUp', () => {
            render(
                <RightAirPanel
                    airData={mockAirData}
                    selectedTimeIndex={0}
                    isOpen={true}
                />
            );

            const panel = screen.getByLabelText('Детальная информация о качестве воздуха');
            const handle = panel.querySelector('.panel-drag-handle');
            const releaseCaptureSpy = vi.fn();
            handle.releasePointerCapture = releaseCaptureSpy;

            fireEvent.pointerDown(handle, { clientX: 100, clientY: 100, button: 0, pointerType: 'mouse', pointerId: 8 });
            fireEvent.pointerMove(panel, { clientX: 100, clientY: 250, pointerType: 'mouse' });
            fireEvent.pointerUp(handle, { pointerId: 8 });
            expect(releaseCaptureSpy).toHaveBeenCalledWith(8);

            fireEvent.touchStart(panel, { touches: [{ clientX: 100, clientY: 100 }] });
            fireEvent.touchMove(panel, { touches: [{ clientX: 100, clientY: 150 }] });

            act(() => { vi.advanceTimersByTime(250); });
        });

        it('обрабатывает перетаскивание вверх (deltaY <= 0) и неотменяемые события перемещения', () => {
            render(
                <RightAirPanel
                    airData={mockAirData}
                    selectedTimeIndex={0}
                    isOpen={true}
                    onClose={vi.fn()}
                />
            );

            const panel = screen.getByLabelText('Детальная информация о качестве воздуха');
            const handle = panel.querySelector('.panel-drag-handle');

            fireEvent.pointerDown(handle, { clientX: 100, clientY: 100, button: 0, pointerType: 'mouse', pointerId: 9 });

            fireEvent.pointerMove(panel, { clientX: 100, clientY: 80, pointerType: 'mouse' });

            const uncancelableEvent = new MouseEvent('pointermove', { bubbles: true, cancelable: false });
            Object.defineProperty(uncancelableEvent, 'clientY', { value: 120 });
            Object.defineProperty(uncancelableEvent, 'clientX', { value: 100 });
            panel.dispatchEvent(uncancelableEvent);

            fireEvent.pointerUp(handle, { pointerId: 9 });
            act(() => { vi.advanceTimersByTime(250); });
        });
    });
});
