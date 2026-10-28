import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import Sidebar from '../../src/components/Sidebar';

const mockAirData = {
    latitude: 53.7596,
    longitude: 87.1467,
    hourly: {
        time: ['2026-09-28T00:00', '2026-09-28T03:00', '2026-09-28T06:00']
    }
};

describe('SidebarCoverage — граничные случаи и полное покрытие веток', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-28T10:00:00'));
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe('1. Запасной вариант геолокации при isSecureContext === false', () => {
        it('использует /api/locate-me когда isSecureContext равен false', async () => {
            const onLocationSelect = vi.fn();
            const onClose = vi.fn();

            const origSecure = window.isSecureContext;
            window.isSecureContext = false;

            const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
                ok: true,
                json: async () => ({ latitude: 55.75, longitude: 37.61, city: 'Москва' })
            });

            render(
                <Sidebar
                    airData={mockAirData}
                    isOpen={true}
                    onLocationSelect={onLocationSelect}
                    onClose={onClose}
                />
            );

            const geoBtn = screen.getByText('Моё местоположение');
            await act(async () => {
                fireEvent.click(geoBtn);
            });

            expect(fetchSpy).toHaveBeenCalledWith('/api/locate-me');
            expect(onLocationSelect).toHaveBeenCalledWith(55.75, 37.61, 'Москва');
            expect(onClose).toHaveBeenCalled();

            window.isSecureContext = origSecure;
        });

        it('сначала пробует GPS даже при isSecureContext === false', async () => {
            const onLocationSelect = vi.fn();

            const origSecure = window.isSecureContext;
            const origGeo = globalThis.navigator.geolocation;
            window.isSecureContext = false;
            globalThis.navigator.geolocation = {
                getCurrentPosition: vi.fn((success) => {
                    success({ coords: { latitude: 54.1, longitude: 86.2 } });
                })
            };

            const fetchSpy = vi.spyOn(globalThis, 'fetch');

            try {
                render(
                    <Sidebar
                        airData={mockAirData}
                        isOpen={true}
                        onLocationSelect={onLocationSelect}
                    />
                );

                await act(async () => {
                    fireEvent.click(screen.getByText('Моё местоположение'));
                });

                expect(globalThis.navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
                expect(onLocationSelect).toHaveBeenCalledWith(54.1, 86.2, '');
                expect(fetchSpy).not.toHaveBeenCalled();
            } finally {
                window.isSecureContext = origSecure;
                if (origGeo === undefined) {
                    delete globalThis.navigator.geolocation;
                } else {
                    globalThis.navigator.geolocation = origGeo;
                }
            }
        });

        it('игнорирует статический fallback бекенда и пробует браузерный IP-сервис', async () => {
            const onLocationSelect = vi.fn();

            const origSecure = window.isSecureContext;
            window.isSecureContext = false;

            vi.spyOn(globalThis, 'fetch')
                .mockResolvedValueOnce({
                    ok: true,
                    headers: { get: (name) => (name.toLowerCase() === 'x-geo-fallback' ? '1' : null) },
                    json: async () => ({ latitude: 53.7596, longitude: 87.1467, city: 'Новокузнецк' })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ success: true, latitude: 59.93, longitude: 30.33, city: 'Санкт-Петербург' })
                });

            try {
                render(
                    <Sidebar
                        airData={mockAirData}
                        isOpen={true}
                        onLocationSelect={onLocationSelect}
                    />
                );

                await act(async () => {
                    fireEvent.click(screen.getByText('Моё местоположение'));
                });

                expect(onLocationSelect).toHaveBeenCalledWith(59.93, 30.33, 'Санкт-Петербург');
            } finally {
                window.isSecureContext = origSecure;
            }
        });

        it('переключается на ipwho.is при сбое /api/locate-me в небезопасном контексте', async () => {            const onLocationSelect = vi.fn();
            const onClose = vi.fn();

            const origSecure = window.isSecureContext;
            window.isSecureContext = false;

            vi.spyOn(globalThis, 'fetch')
                .mockRejectedValueOnce(new Error('Backend error'))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        success: true,
                        latitude: 59.93,
                        longitude: 30.33,
                        city: 'Санкт-Петербург'
                    })
                });

            render(
                <Sidebar
                    airData={mockAirData}
                    isOpen={true}
                    onLocationSelect={onLocationSelect}
                    onClose={onClose}
                />
            );

            const geoBtn = screen.getByText('Моё местоположение');
            await act(async () => {
                fireEvent.click(geoBtn);
            });

            expect(onLocationSelect).toHaveBeenCalledWith(59.93, 30.33, 'Санкт-Петербург');
            expect(onClose).toHaveBeenCalled();

            window.isSecureContext = origSecure;
        });

        it('отображает ошибку если все резервные IP-сервисы завершились сбоем', async () => {
            const origSecure = window.isSecureContext;
            window.isSecureContext = false;

            vi.spyOn(globalThis, 'fetch')
                .mockRejectedValueOnce(new Error('API error'))
                .mockRejectedValueOnce(new Error('Ipwho error'));

            render(
                <Sidebar
                    airData={mockAirData}
                    isOpen={true}
                />
            );

            const geoBtn = screen.getByText('Моё местоположение');
            await act(async () => {
                fireEvent.click(geoBtn);
            });

            expect(document.querySelector('.geo-nav__error')?.textContent).toContain(
                'Не удалось определить местоположение. Попробуйте поиск города.'
            );

            window.isSecureContext = origSecure;
        });
    });

    describe('2. Жесты перетаскивания и граничные случаи Pointer/Touch', () => {
        it('игнорирует начало перетаскивания мыши на контенте без ручки перетаскивания', () => {
            render(
                <Sidebar
                    airData={mockAirData}
                    isOpen={true}
                />
            );

            const sidebar = document.querySelector('.sidebar');
            const citySearch = document.querySelector('.city-search');

            fireEvent.pointerDown(citySearch, {
                clientX: 200,
                clientY: 100,
                button: 0,
                pointerType: 'mouse'
            });

            expect(sidebar.classList.contains('sidebar--dragging')).toBe(false);
        });

        it('игнорирует начало перетаскивания при клике на интерактивные элементы', () => {
            render(
                <Sidebar
                    airData={mockAirData}
                    isOpen={true}
                    onClose={vi.fn()}
                />
            );

            const sidebar = document.querySelector('.sidebar');
            const closeBtn = document.querySelector('.sidebar__close-btn');

            fireEvent.pointerDown(closeBtn, {
                clientX: 200,
                clientY: 100,
                button: 0,
                pointerType: 'touch'
            });

            expect(sidebar.classList.contains('sidebar--dragging')).toBe(false);
        });

        it('игнорирует перетаскивание при нажатии правой кнопки мыши (button !== 0)', () => {
            render(
                <Sidebar
                    airData={mockAirData}
                    isOpen={true}
                />
            );

            const sidebar = document.querySelector('.sidebar');
            const handle = document.querySelector('.sidebar__drag-handle');

            fireEvent.pointerDown(handle, {
                clientX: 200,
                clientY: 100,
                button: 2,
                pointerType: 'mouse'
            });

            expect(sidebar.classList.contains('sidebar--dragging')).toBe(false);
        });

        it('начинает перетаскивание за заголовок или ручку перетаскивания', () => {
            render(
                <Sidebar
                    airData={mockAirData}
                    isOpen={true}
                />
            );

            const sidebar = document.querySelector('.sidebar');
            const handle = document.querySelector('.sidebar__drag-handle');

            fireEvent.pointerDown(handle, {
                clientX: 200,
                clientY: 100,
                button: 0,
                pointerType: 'mouse',
                pointerId: 1
            });

            expect(sidebar.classList.contains('sidebar--dragging')).toBe(true);

            fireEvent.pointerMove(sidebar, {
                clientX: 150,
                clientY: 100,
                pointerType: 'mouse'
            });

            expect(sidebar.style.transform).toContain('translateX(-50px)');

            fireEvent.pointerMove(sidebar, {
                clientX: 250,
                clientY: 100,
                pointerType: 'mouse'
            });

            expect(sidebar.style.transform).toContain('translateX');
        });

        it('распознает горизонтальный свайп тачем и отличает его от вертикальной прокрутки', () => {
            render(
                <Sidebar
                    airData={mockAirData}
                    isOpen={true}
                />
            );

            const sidebar = document.querySelector('.sidebar');

            fireEvent.touchStart(sidebar, {
                touches: [{ clientX: 200, clientY: 100 }]
            });

            fireEvent.touchMove(sidebar, {
                touches: [{ clientX: 200, clientY: 120 }]
            });
            expect(sidebar.classList.contains('sidebar--dragging')).toBe(false);

            fireEvent.touchMove(sidebar, {
                touches: [{ clientX: 180, clientY: 100 }]
            });
            expect(sidebar.classList.contains('sidebar--dragging')).toBe(true);
        });

        it('закрывает боковую панель при превышении порога смещения или скорости', () => {
            const onClose = vi.fn();
            render(
                <Sidebar
                    airData={mockAirData}
                    isOpen={true}
                    onClose={onClose}
                />
            );

            const sidebar = document.querySelector('.sidebar');
            const handle = document.querySelector('.sidebar__drag-handle');

            fireEvent.pointerDown(handle, {
                clientX: 200,
                clientY: 100,
                button: 0,
                pointerType: 'mouse'
            });

            fireEvent.pointerMove(sidebar, {
                clientX: 50,
                clientY: 100,
                pointerType: 'mouse'
            });

            fireEvent.pointerUp(sidebar, {
                pointerId: 1
            });

            act(() => {
                vi.advanceTimersByTime(250);
            });

            expect(onClose).toHaveBeenCalled();
        });

        it('возвращает панель назад при смещении меньше порогового', () => {
            const onClose = vi.fn();
            render(
                <Sidebar
                    airData={mockAirData}
                    isOpen={true}
                    onClose={onClose}
                />
            );

            const sidebar = document.querySelector('.sidebar');
            const handle = document.querySelector('.sidebar__drag-handle');

            fireEvent.pointerDown(handle, {
                clientX: 200,
                clientY: 100,
                button: 0,
                pointerType: 'mouse'
            });

            fireEvent.pointerMove(sidebar, {
                clientX: 195,
                clientY: 100,
                pointerType: 'mouse'
            });

            fireEvent.pointerUp(sidebar, {
                pointerId: 1
            });

            act(() => {
                vi.advanceTimersByTime(250);
            });

            expect(onClose).not.toHaveBeenCalled();
            expect(sidebar.style.transform).toBe('');
        });

        it('обрабатывает события отмены onTouchCancel и onPointerCancel', () => {
            render(
                <Sidebar
                    airData={mockAirData}
                    isOpen={true}
                />
            );

            const sidebar = document.querySelector('.sidebar');
            const handle = document.querySelector('.sidebar__drag-handle');

            fireEvent.pointerDown(handle, {
                clientX: 200,
                clientY: 100,
                button: 0,
                pointerType: 'touch',
                pointerId: 1
            });

            fireEvent.pointerCancel(sidebar, {
                pointerId: 1
            });

            fireEvent.touchStart(sidebar, {
                touches: [{ clientX: 200, clientY: 100 }]
            });

            fireEvent.touchCancel(sidebar);

            act(() => {
                vi.advanceTimersByTime(150);
            });

            expect(sidebar.classList.contains('sidebar--dragging')).toBe(false);
        });

        it('предотвращает всплытие клика после завершения перетаскивания', () => {
            render(
                <Sidebar
                    airData={mockAirData}
                    isOpen={true}
                />
            );

            const sidebar = document.querySelector('.sidebar');
            const handle = document.querySelector('.sidebar__drag-handle');

            fireEvent.pointerDown(handle, {
                clientX: 200,
                clientY: 100,
                button: 0,
                pointerType: 'mouse'
            });

            fireEvent.pointerMove(sidebar, {
                clientX: 150,
                clientY: 100,
                pointerType: 'mouse'
            });

            fireEvent.pointerUp(sidebar, {
                pointerId: 1
            });

            const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
            const stopPropagationSpy = vi.spyOn(clickEvent, 'stopPropagation');
            const preventDefaultSpy = vi.spyOn(clickEvent, 'preventDefault');

            sidebar.dispatchEvent(clickEvent);

            expect(stopPropagationSpy).toHaveBeenCalled();
            expect(preventDefaultSpy).toHaveBeenCalled();
        });

        it('анимирует прозрачность оверлея sidebar-backdrop при закрытии и возврате', () => {
            const onClose = vi.fn();
            render(
                <div>
                    <div className="sidebar-backdrop" />
                    <Sidebar
                        airData={mockAirData}
                        isOpen={true}
                        onClose={onClose}
                    />
                </div>
            );

            const sidebar = document.querySelector('.sidebar');
            const handle = document.querySelector('.sidebar__drag-handle');
            const backdrop = document.querySelector('.sidebar-backdrop');

            fireEvent.pointerDown(handle, { clientX: 200, clientY: 100, button: 0, pointerType: 'mouse', pointerId: 1 });
            fireEvent.pointerMove(sidebar, { clientX: 30, clientY: 100, pointerType: 'mouse' });
            fireEvent.pointerUp(sidebar, { pointerId: 1 });

            expect(backdrop.style.opacity).toBe('0');
            act(() => { vi.advanceTimersByTime(250); });
            expect(onClose).toHaveBeenCalled();
            expect(backdrop.style.opacity).toBe('');

            fireEvent.pointerDown(handle, { clientX: 200, clientY: 100, button: 0, pointerType: 'mouse', pointerId: 1 });
            fireEvent.pointerMove(sidebar, { clientX: 190, clientY: 100, pointerType: 'mouse' });
            fireEvent.pointerUp(sidebar, { pointerId: 1 });

            expect(backdrop.style.opacity).toBe('1');
            act(() => { vi.advanceTimersByTime(250); });
            expect(backdrop.style.opacity).toBe('');
        });

        it('игнорирует pointer-события при активном таче и обрабатывает ошибки захвата указателя', () => {
            render(
                <Sidebar
                    airData={mockAirData}
                    isOpen={true}
                    onClose={vi.fn()}
                />
            );

            const sidebar = document.querySelector('.sidebar');
            const handle = document.querySelector('.sidebar__drag-handle');

            handle.setPointerCapture = () => { throw new Error('capture error'); };
            handle.releasePointerCapture = () => { throw new Error('release error'); };

            expect(() => {
                fireEvent.pointerDown(handle, { clientX: 200, clientY: 100, button: 0, pointerType: 'mouse', pointerId: 1 });
                fireEvent.pointerUp(handle, { pointerId: 1 });
            }).not.toThrow();

            fireEvent.touchStart(sidebar, { touches: [{ clientX: 200, clientY: 100 }] });
            fireEvent.pointerDown(handle, { clientX: 200, clientY: 100, button: 0, pointerType: 'mouse' });
            fireEvent.pointerMove(sidebar, { clientX: 150, clientY: 100, pointerType: 'mouse' });
            fireEvent.pointerUp(sidebar);
            fireEvent.pointerCancel(sidebar);

            fireEvent.touchEnd(sidebar);
            act(() => { vi.advanceTimersByTime(150); });
        });

        it('освобождает захват указателя при pointerCancel', () => {
            render(
                <Sidebar
                    airData={mockAirData}
                    isOpen={true}
                    onClose={vi.fn()}
                />
            );

            const handle = document.querySelector('.sidebar__drag-handle');
            const releaseCaptureSpy = vi.fn();
            handle.releasePointerCapture = releaseCaptureSpy;

            fireEvent.pointerDown(handle, { clientX: 200, clientY: 100, button: 0, pointerType: 'mouse', pointerId: 4 });
            fireEvent.pointerCancel(handle, { pointerId: 4 });

            expect(releaseCaptureSpy).toHaveBeenCalledWith(4);
        });

        it('игнорирует перетаскивание в процессе анимации закрытия isClosing', () => {
            const onClose = vi.fn();
            render(
                <Sidebar
                    airData={mockAirData}
                    isOpen={true}
                    onClose={onClose}
                />
            );

            const sidebar = document.querySelector('.sidebar');
            const handle = document.querySelector('.sidebar__drag-handle');

            fireEvent.pointerDown(handle, { clientX: 200, clientY: 100, button: 0, pointerType: 'mouse', pointerId: 1 });
            fireEvent.pointerMove(sidebar, { clientX: 30, clientY: 100, pointerType: 'mouse' });
            fireEvent.pointerUp(sidebar, { pointerId: 1 });

            fireEvent.pointerDown(handle, { clientX: 200, clientY: 100, button: 0, pointerType: 'mouse' });
            fireEvent.pointerMove(sidebar, { clientX: 100, clientY: 100, pointerType: 'mouse' });

            act(() => { vi.advanceTimersByTime(250); });
            expect(onClose).toHaveBeenCalled();
        });

        it('переключается на поиск по IP при ошибке геолокации GPS', async () => {
            vi.useRealTimers();
            const onLocationSelect = vi.fn();
            const onClose = vi.fn();

            globalThis.navigator.geolocation = {
                getCurrentPosition: vi.fn().mockImplementation((success, error) => {
                    error({
                        code: 1,
                        message: 'User denied geolocation',
                        PERMISSION_DENIED: 1,
                        POSITION_UNAVAILABLE: 2,
                        TIMEOUT: 3
                    });
                })
            };

            vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
                ok: true,
                json: async () => ({ latitude: 59.93, longitude: 30.33 })
            });

            render(
                <Sidebar
                    airData={mockAirData}
                    isOpen={true}
                    onClose={onClose}
                    onLocationSelect={onLocationSelect}
                />
            );

            const locateBtn = screen.getByRole('button', { name: /моё местоположение/i });
            await act(async () => {
                fireEvent.click(locateBtn);
            });

            await waitFor(() => {
                expect(onLocationSelect).toHaveBeenCalledWith(59.93, 30.33, '');
            });
            expect(onClose).toHaveBeenCalled();
        });

        it('обрабатывает пустой массив касаний touches и вертикальный скролл', () => {
            render(
                <Sidebar
                    airData={mockAirData}
                    isOpen={true}
                    onClose={vi.fn()}
                />
            );

            const sidebar = document.querySelector('.sidebar');

            fireEvent.touchStart(sidebar, { touches: [] });
            fireEvent.touchMove(sidebar, { touches: [] });
            expect(sidebar.classList.contains('sidebar--dragging')).toBe(false);

            fireEvent.touchStart(sidebar, { touches: [{ clientX: 200, clientY: 100 }] });
            fireEvent.touchMove(sidebar, { touches: [{ clientX: 200, clientY: 130 }] });
            expect(sidebar.classList.contains('sidebar--dragging')).toBe(false);

            fireEvent.pointerDown(sidebar, { clientX: 200, clientY: 100, pointerType: 'mouse', button: 0 });
            fireEvent.pointerMove(sidebar, { clientX: 150, clientY: 100, pointerType: 'mouse' });
            expect(sidebar.classList.contains('sidebar--dragging')).toBe(false);
        });

        it('обрабатывает неуспешные ответы от /api/locate-me и ipwho.is с запасным городом', async () => {
            vi.useRealTimers();
            const onLocationSelect = vi.fn();
            const origSecure = window.isSecureContext;
            window.isSecureContext = false;

            vi.spyOn(globalThis, 'fetch')
                .mockResolvedValueOnce({ ok: false, status: 500 })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ success: true, latitude: 45.0, longitude: 35.0 })
                });

            try {
                render(
                    <Sidebar
                        airData={mockAirData}
                        isOpen={true}
                        onClose={vi.fn()}
                        onLocationSelect={onLocationSelect}
                    />
                );

                const locateBtn = screen.getByRole('button', { name: /моё местоположение/i });
                await act(async () => {
                    fireEvent.click(locateBtn);
                });

                await waitFor(() => {
                    expect(onLocationSelect).toHaveBeenCalledWith(45.0, 35.0, '');
                });
            } finally {
                window.isSecureContext = origSecure;
            }
        });

        it('обрабатывает анимацию закрытия без переданного колбэка onClose', () => {
            render(
                <Sidebar
                    airData={mockAirData}
                    isOpen={true}
                />
            );

            const sidebar = document.querySelector('.sidebar');
            const handle = document.querySelector('.sidebar__drag-handle');

            fireEvent.pointerDown(handle, { clientX: 200, clientY: 100, button: 0, pointerType: 'mouse', pointerId: 1 });
            fireEvent.pointerMove(sidebar, { clientX: 30, clientY: 100, pointerType: 'mouse' });
            fireEvent.pointerUp(sidebar, { pointerId: 1 });

            fireEvent.touchStart(sidebar, { touches: [{ clientX: 200, clientY: 100 }] });
            fireEvent.touchMove(sidebar, { touches: [{ clientX: 150, clientY: 100 }] });

            act(() => { vi.advanceTimersByTime(250); });
        });

        it('применяет резиновое сопротивление при перетаскивании вправо и обрабатывает неотменяемые события', () => {
            render(
                <Sidebar
                    airData={mockAirData}
                    isOpen={true}
                    onClose={vi.fn()}
                />
            );

            const sidebar = document.querySelector('.sidebar');
            const handle = document.querySelector('.sidebar__drag-handle');

            fireEvent.pointerDown(handle, { clientX: 200, clientY: 100, button: 0, pointerType: 'mouse', pointerId: 2 });

            fireEvent.pointerMove(sidebar, { clientX: 250, clientY: 100, pointerType: 'mouse' });

            const uncancelableEvent = new MouseEvent('pointermove', { bubbles: true, cancelable: false });
            Object.defineProperty(uncancelableEvent, 'clientX', { value: 180 });
            Object.defineProperty(uncancelableEvent, 'clientY', { value: 100 });
            sidebar.dispatchEvent(uncancelableEvent);

            fireEvent.pointerUp(handle, { pointerId: 2 });
            act(() => { vi.advanceTimersByTime(250); });
        });

        it('игнорирует начало и перемещение при закрытом состоянии isOpen === false', () => {
            render(
                <Sidebar
                    airData={mockAirData}
                    isOpen={false}
                />
            );

            const sidebar = document.querySelector('.sidebar');
            fireEvent.touchStart(sidebar, { touches: [{ clientX: 200, clientY: 100 }] });
            fireEvent.touchMove(sidebar, { touches: [{ clientX: 150, clientY: 100 }] });
            expect(sidebar.classList.contains('sidebar--dragging')).toBe(false);
        });
    });
});
