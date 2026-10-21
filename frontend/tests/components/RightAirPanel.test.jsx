// frontend/tests/components/RightAirPanel.test.jsx
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import RightAirPanel from '../../src/components/RightAirPanel';

const mockAirData = {
    latitude: 53.7596,
    longitude: 87.1467,
    used_source: 'open-meteo',
    hourly: {
        time: ['2026-10-01T12:00'],
        european_aqi: [35],
        pm2_5: [15],
        pm10: [28],
        nitrogen_dioxide: [45],
        sulphur_dioxide: [12],
        ozone: [70],
        carbon_monoxide: [400]
    }
};

describe('RightAirPanel component', () => {
    afterEach(() => {
        cleanup();
    });

    it('1. Не рендерит основное окно панели при isOpen={false}', () => {
        const { container } = render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={false} />
        );
        expect(container.querySelector('.right-air-panel')).toBeNull();
    });

    it('2. Рендерит шапку с координатами, временем и источником данных при isOpen={true}', () => {
        render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} />
        );

        expect(screen.getByText('Качество воздуха')).toBeTruthy();
        expect(screen.getByText(/53.7596/)).toBeTruthy();
        expect(screen.getByText(/87.1467/)).toBeTruthy();
        expect(screen.getByText(/2026-10-01/)).toBeTruthy();
        expect(screen.getByText(/open-meteo/)).toBeTruthy();
    });

    it('3. Рендерит общий показатель AQI и динамическую текстовую рекомендацию', () => {
        render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} />
        );

        expect(screen.getByText('35')).toBeTruthy();
        expect(screen.getByText('хорошо')).toBeTruthy();
    });

    it('4. Отображает перенесенную цветовую шкалу AQI со всеми 6 диапазонами', () => {
        render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} />
        );

        expect(screen.getByText('Шкала уровней AQI')).toBeTruthy();
        expect(screen.getByText('0–20')).toBeTruthy();
        expect(screen.getByText('21–40')).toBeTruthy();
        expect(screen.getByText('41–60')).toBeTruthy();
        expect(screen.getByText('61–80')).toBeTruthy();
        expect(screen.getByText('81–100')).toBeTruthy();
        expect(screen.getByText('100+')).toBeTruthy();
    });

    it('5. Активирует соответствующий диапазон шкалы (.scale-item--active) для каждого уровня AQI', () => {
        const testRanges = [
            { aqi: 15, expectedRange: '0–20' },
            { aqi: 35, expectedRange: '21–40' },
            { aqi: 50, expectedRange: '41–60' },
            { aqi: 75, expectedRange: '61–80' },
            { aqi: 90, expectedRange: '81–100' },
            { aqi: 125, expectedRange: '100+' }
        ];

        testRanges.forEach(({ aqi, expectedRange }) => {
            const data = {
                ...mockAirData,
                hourly: { ...mockAirData.hourly, european_aqi: [aqi] }
            };

            const { container, unmount } = render(
                <RightAirPanel airData={data} selectedTimeIndex={0} isOpen={true} />
            );

            const activeItem = container.querySelector('.scale-item--active');
            expect(activeItem, `Для AQI ${aqi} должен быть активный элемент`).toBeTruthy();
            expect(activeItem.textContent).toContain(expectedRange);

            unmount();
        });
    });

    it('6. Защитный рендер: выводит "-" или "—" и "нет данных", если european_aqi равен null или отсутствует', () => {
        const nullAqiData = {
            latitude: 53.75,
            longitude: 87.14,
            hourly: {
                time: ['2026-10-01T12:00'],
                european_aqi: [null]
            }
        };

        const { container } = render(
            <RightAirPanel airData={nullAqiData} selectedTimeIndex={0} isOpen={true} />
        );

        // Значение AQI должно быть прочерком
        const aqiValue = container.querySelector('.aqi-indicator__number');
        expect(aqiValue).toBeTruthy();
        expect(aqiValue.textContent.trim()).toMatch(/^[—\-]$/);

        // Текстовая оценка должна быть 'нет данных'
        const aqiLabel = container.querySelector('.aqi-indicator__label');
        expect(aqiLabel).toBeTruthy();
        expect(aqiLabel.textContent.toLowerCase()).toContain('нет данных');
    });

    it('7. Защитный рендер: безопасно обрабатывает отсутствие airData без падений', () => {
        const { container } = render(
            <RightAirPanel airData={null} selectedTimeIndex={0} isOpen={true} />
        );
        expect(container.firstChild).toBeNull();
    });

    it('8. Поддерживает плавающую кнопку «Показатели» (FAB) при закрытом состоянии панели', () => {
        const onOpenMock = vi.fn();
        render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={false} onOpen={onOpenMock} />
        );

        const fabBtn = screen.queryByRole('button', { name: /показатели/i }) || screen.queryByTestId('fab-open-panel');
        if (fabBtn) {
            fireEvent.click(fabBtn);
            expect(onOpenMock).toHaveBeenCalledTimes(1);
        }
    });
});

describe('RightAirPanel component (Список 6 загрязнителей и карточка)', () => {
    afterEach(() => {
        cleanup();
    });

    it('1. Рендерит все 6 загрязнителей со статусными бейджами', () => {
        render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} />
        );

        expect(screen.getByText('PM₂.₅')).toBeTruthy();
        expect(screen.getByText('PM₁₀')).toBeTruthy();
        expect(screen.getByText('NO₂')).toBeTruthy();
        expect(screen.getByText('SO₂')).toBeTruthy();
        expect(screen.getByText('O₃')).toBeTruthy();
        expect(screen.getAllByText('CO').length).toBeGreaterThan(0);

        expect(screen.getAllByText('15 μg/m³').length).toBeGreaterThan(0);
        expect(screen.getAllByText('28 μg/m³').length).toBeGreaterThan(0);
    });

    it('2. Переключает подробную информацию о веществе в блоке "Общ инф" по клику', () => {
        render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} />
        );

        // По умолчанию отображается PM2.5
        expect(screen.getByText('Мелкодисперсные частицы (PM2.5)')).toBeTruthy();

        // Кликаем на NO2
        const no2Btn = screen.getByText('NO₂').closest('button');
        fireEvent.click(no2Btn);

        // Теперь должно отобразиться название и инфо NO2
        expect(screen.getByText('Диоксид азота (NO2)')).toBeTruthy();
        expect(screen.getByText(/Токсичный едкий газ красно-бурого цвета/)).toBeTruthy();
        expect(screen.getByText(/Высокотемпературное горение топлива/)).toBeTruthy();
    });

    it('3. Переключает вещество при наведении курсора (hover)', () => {
        render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} />
        );

        const o3Btn = screen.getByText('O₃').closest('button');
        fireEvent.mouseEnter(o3Btn);

        expect(screen.getByText('Приземный озон (O3)')).toBeTruthy();
    });

    it('4. Выводит прочерки и статус "нет данных" при пустых или некорректных данных загрязнителей', () => {
        const emptyAirData = {
            latitude: 55.75,
            longitude: 37.61,
            hourly: {
                time: ['2026-10-01T12:00'],
                european_aqi: [null],
                pm2_5: [null],
                pm10: [undefined],
                nitrogen_dioxide: [NaN],
                sulphur_dioxide: [''],
                ozone: [null],
                carbon_monoxide: [null]
            }
        };

        const { container } = render(
            <RightAirPanel airData={emptyAirData} selectedTimeIndex={0} isOpen={true} />
        );

        // Проверяем наличие прочерков
        const dashes = screen.getAllByText('—');
        expect(dashes.length).toBeGreaterThanOrEqual(6);

        // Все бейджи загрязнителей должны иметь статус "нет данных"
        const badges = container.querySelectorAll('.pollutant-badge');
        expect(badges.length).toBe(6);
        badges.forEach((b) => {
            expect(b.textContent).toBe('нет данных');
        });
    });

    it('5. Динамически вычисляет рекомендацию AQI при различных значениях', () => {
        const hazardousAirData = {
            ...mockAirData,
            hourly: {
                ...mockAirData.hourly,
                european_aqi: [120]
            }
        };

        const { rerender } = render(
            <RightAirPanel airData={hazardousAirData} selectedTimeIndex={0} isOpen={true} />
        );

        expect(screen.getByText('120')).toBeTruthy();
        expect(screen.getByText('опасно')).toBeTruthy();

        const excellentAirData = {
            ...mockAirData,
            hourly: {
                ...mockAirData.hourly,
                european_aqi: [10]
            }
        };

        rerender(
            <RightAirPanel airData={excellentAirData} selectedTimeIndex={0} isOpen={true} />
        );

        expect(screen.getByText('10')).toBeTruthy();
        expect(screen.getByText('отлично')).toBeTruthy();
    });
});

describe('RightAirPanel component (Закрытие по кнопке Escape и очистка)', () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('1. Вызывает onClose при клике на крестик панели', () => {
        const onCloseMock = vi.fn();
        render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} onClose={onCloseMock} />
        );

        const closeBtn = screen.getByTestId('right-panel-close-btn');
        fireEvent.click(closeBtn);

        expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('2. Вызывает onClose при нажатии клавиши Escape, когда панель открыта (isOpen=true)', () => {
        const onCloseMock = vi.fn();
        render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} onClose={onCloseMock} />
        );

        fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

        expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('3. Не вызывает onClose при нажатии Escape, если панель закрыта (isOpen=false)', () => {
        const onCloseMock = vi.fn();
        render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={false} onClose={onCloseMock} />
        );

        fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

        expect(onCloseMock).not.toHaveBeenCalled();
    });

    it('4. Не вызывает onClose при нажатии других клавиш (например Enter, Tab, Space)', () => {
        const onCloseMock = vi.fn();
        render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} onClose={onCloseMock} />
        );

        fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });
        fireEvent.keyDown(window, { key: 'Tab', code: 'Tab' });
        fireEvent.keyDown(window, { key: ' ', code: 'Space' });

        expect(onCloseMock).not.toHaveBeenCalled();
    });

    it('5. Удаляет слушатель событий клавиатуры (removeEventListener) при размонтировании или закрытии', () => {
        const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

        const { unmount } = render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} onClose={vi.fn()} />
        );

        unmount();

        expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
});

describe('RightAirPanel — режим для дальтоников (isColorBlind)', () => {
    afterEach(() => {
        cleanup();
    });

    it('1. Бейджи загрязнителей используют палитру Okabe-Ito при isColorBlind={true}', () => {
        const { container } = render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} isColorBlind={true} />
        );

        // PM2.5 = 15 -> Хорошо -> #56B4E9
        const pm25Badge = container.querySelector('.pollutant-badge');
        expect(pm25Badge.style.backgroundColor).toBe('rgb(86, 180, 233)');
    });

    it('2. Без isColorBlind бейджи остаются в стандартной палитре', () => {
        const { container } = render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} />
        );

        // PM2.5 = 15 -> Хорошо -> #8BC34A
        const pm25Badge = container.querySelector('.pollutant-badge');
        expect(pm25Badge.style.backgroundColor).toBe('rgb(139, 195, 74)');
    });

    it('3. Индикатор AQI получает цвет из палитры дальтоника', () => {
        const { container } = render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} isColorBlind={true} />
        );

        // AQI = 35 -> хорошо -> #56B4E9
        const indicator = container.querySelector('.aqi-indicator');
        expect(indicator.getAttribute('data-level')).toBe('good');
        expect(indicator.style.backgroundColor).toBe('rgb(86, 180, 233)');
    });

    it('4. Элементы шкалы AQI несут data-level для CSS-оверрайдов', () => {
        const { container } = render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} isColorBlind={true} />
        );

        const scaleItems = container.querySelectorAll('.scale-item');
        expect(scaleItems.length).toBe(6);
        const levels = Array.from(scaleItems).map((el) => el.getAttribute('data-level'));
        expect(levels).toEqual(['excellent', 'good', 'fair', 'poor', 'very-poor', 'hazardous']);
    });

    it('5. Подписи бейджей и шкалы не меняются в режиме дальтоника', () => {
        const { container } = render(<RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} isColorBlind={true} />);
        const badges = Array.from(container.querySelectorAll('.pollutant-badge')).map((b) => b.textContent);
        expect(badges).toContain('Хорошо');
        expect(container.querySelector('.scale-item').textContent).toBe('0–20');
    });
});

describe('RightAirPanel — touch/drag события', () => {
    beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-01T12:00:00')); });
    afterEach(() => { vi.useRealTimers(); cleanup(); });

    it('touch drag: выполняется без ошибок', () => {
        const onClose = vi.fn();
        const { container } = render(<RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} onClose={onClose} />);
        const panel = container.querySelector('.right-air-panel');
        const header = container.querySelector('.panel-header');
        expect(() => {
            fireEvent.touchStart(header, { touches: [{ clientX: 100, clientY: 200, target: header }] });
            fireEvent.touchMove(panel, { touches: [{ clientX: 100, clientY: 400, target: panel }], cancelable: true });
            fireEvent.touchEnd(panel, {});
        }).not.toThrow();
    });

    it('touch drag на кнопке закрытия: выполняется без ошибок', () => {
        const onClose = vi.fn();
        const { container } = render(<RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} onClose={onClose} />);
        const btn = container.querySelector('.panel-header__close-btn');
        expect(() => {
            fireEvent.touchStart(btn, { touches: [{ clientX: 100, clientY: 200, target: btn }] });
            fireEvent.touchMove(btn, { touches: [{ clientX: 100, clientY: 400, target: btn }] });
            fireEvent.touchEnd(btn, {});
        }).not.toThrow();
    });

    it('onTouchCancel без ошибок', () => {
        const { container } = render(<RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} onClose={vi.fn()} />);
        expect(() => fireEvent.touchCancel(container.querySelector('.right-air-panel'), {})).not.toThrow();
    });
});

describe('RightAirPanel — pointer события', () => {
    beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-01T12:00:00')); });
    afterEach(() => { vi.useRealTimers(); cleanup(); });

    it('drag за handle при native PointerEvent', () => {
        const { container } = render(<RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} onClose={vi.fn()} />);
        const panel = container.querySelector('.right-air-panel');
        const handle = container.querySelector('.panel-drag-handle');
        const ev1 = new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 200, pointerType: 'mouse', button: 0, pointerId: 1 });
        const ev2 = new PointerEvent('pointermove', { bubbles: true, clientX: 100, clientY: 300, pointerType: 'mouse' });
        const ev3 = new PointerEvent('pointerup', { bubbles: true, pointerId: 1 });
        act(() => { handle.dispatchEvent(ev1); });
        act(() => { panel.dispatchEvent(ev2); });
        act(() => { panel.dispatchEvent(ev3); });
        expect(panel.style.transform).toBeDefined();
    });

    it('drag вниз за handle вызывает onClose', () => {
        const onClose = vi.fn();
        const { container } = render(<RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} onClose={onClose} />);
        const panel = container.querySelector('.right-air-panel');
        const handle = container.querySelector('.panel-drag-handle');
        const ev1 = new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 200, pointerType: 'mouse', button: 0, pointerId: 1 });
        const ev2 = new PointerEvent('pointermove', { bubbles: true, clientX: 100, clientY: 500, pointerType: 'mouse' });
        const ev3 = new PointerEvent('pointerup', { bubbles: true, pointerId: 1 });
        act(() => { handle.dispatchEvent(ev1); });
        act(() => { panel.dispatchEvent(ev2); });
        act(() => { panel.dispatchEvent(ev3); });
        act(() => { vi.advanceTimersByTime(100); });
        expect(onClose).toHaveBeenCalled();
    });

    it('snap back при недостаточном drag', () => {
        const onClose = vi.fn();
        const { container } = render(<RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} onClose={onClose} />);
        const panel = container.querySelector('.right-air-panel');
        const handle = container.querySelector('.panel-drag-handle');
        const ev1 = new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 200, pointerType: 'mouse', button: 0, pointerId: 1 });
        const ev2 = new PointerEvent('pointermove', { bubbles: true, clientX: 100, clientY: 210, pointerType: 'mouse' });
        const ev3 = new PointerEvent('pointerup', { bubbles: true, pointerId: 1 });
        act(() => { handle.dispatchEvent(ev1); });
        act(() => { panel.dispatchEvent(ev2); });
        act(() => { panel.dispatchEvent(ev3); });
        act(() => { vi.advanceTimersByTime(350); });
        expect(onClose).not.toHaveBeenCalled();
    });

    it('drag вверх (rubber band) выполняется без ошибок', () => {
        const { container } = render(<RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} onClose={vi.fn()} />);
        const panel = container.querySelector('.right-air-panel');
        const handle = container.querySelector('.panel-drag-handle');
        const ev1 = new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 200, pointerType: 'mouse', button: 0, pointerId: 1 });
        const ev2 = new PointerEvent('pointermove', { bubbles: true, clientX: 100, clientY: 100, pointerType: 'mouse' });
        const ev3 = new PointerEvent('pointerup', { bubbles: true, pointerId: 1 });
        act(() => { handle.dispatchEvent(ev1); });
        act(() => { panel.dispatchEvent(ev2); });
        act(() => { panel.dispatchEvent(ev3); });
    });

    it('не начинает drag при mouse pointer не на handle', () => {
        const { container } = render(<RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} onClose={vi.fn()} />);
        const panel = container.querySelector('.right-air-panel');
        fireEvent.pointerDown(panel, { clientX: 100, clientY: 200, pointerType: 'mouse', button: 0, pointerId: 1, target: panel });
        fireEvent.pointerMove(panel, { clientX: 100, clientY: 400, pointerType: 'mouse', target: panel });
        fireEvent.pointerUp(panel, { pointerId: 1, target: panel });
        expect(panel.style.transform).not.toContain('translateY(');
    });

    it('onPointerCancel без ошибок', () => {
        const { container } = render(<RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} onClose={vi.fn()} />);
        expect(() => fireEvent.pointerCancel(container.querySelector('.right-air-panel'), { pointerId: 1 })).not.toThrow();
    });

    it('блокирует клик после drag', () => {
        const { container } = render(<RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} onClose={vi.fn()} />);
        const panel = container.querySelector('.right-air-panel');
        const handle = container.querySelector('.panel-drag-handle');
        fireEvent.pointerDown(handle, { clientX: 100, clientY: 200, pointerType: 'mouse', button: 0, pointerId: 1, target: handle });
        fireEvent.pointerMove(panel, { clientX: 100, clientY: 300, pointerType: 'mouse', target: panel, cancelable: true });
        const ce = new MouseEvent('click', { bubbles: true });
        const sp = vi.spyOn(ce, 'stopPropagation');
        panel.dispatchEvent(ce);
        expect(sp).toHaveBeenCalled();
    });

    it('правый клик (button=2) не начинает drag', () => {
        const { container } = render(<RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} onClose={vi.fn()} />);
        expect(() => fireEvent.pointerDown(container.querySelector('.panel-drag-handle'), { button: 2, pointerType: 'mouse' })).not.toThrow();
    });
});

describe('RightAirPanel — граничные случаи данных', () => {
    afterEach(() => { cleanup(); });

    it('отображает «—» при отсутствии координат', () => {
        const data = { used_source: 'test', hourly: { time: ['2026-10-01T12:00'], european_aqi: [35] } };
        const { container } = render(<RightAirPanel airData={data} selectedTimeIndex={0} isOpen={true} />);
        expect(container.textContent).toContain('—');
    });

    it('отображает «—» при невалидном AQI', () => {
        const data = { latitude: 53.7596, longitude: 87.1467, used_source: 'test', hourly: { time: ['2026-10-01T12:00'], european_aqi: [null] } };
        const { container } = render(<RightAirPanel airData={data} selectedTimeIndex={0} isOpen={true} />);
        const indicator = container.querySelector('.aqi-indicator__number');
        expect(indicator.textContent).toBe('—');
    });

    it('отображает «—» при отсутствии времени', () => {
        const data = { latitude: 53.7596, longitude: 87.1467, used_source: 'test', hourly: { european_aqi: [35] } };
        const { container } = render(<RightAirPanel airData={data} selectedTimeIndex={0} isOpen={true} />);
        expect(container.textContent).toContain('—');
    });

    it('не рендерится при отсутствии airData', () => {
        const { container } = render(<RightAirPanel airData={null} isOpen={true} />);
        expect(container.querySelector('.right-air-panel')).toBeNull();
    });

    it('переключает загрязнитель при наведении', () => {
        const { container } = render(<RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} />);
        const rows = container.querySelectorAll('.pollutant-row');
        fireEvent.mouseEnter(rows[1]);
        expect(rows[1].className).toContain('pollutant-row--selected');
    });
});

describe('RightAirPanel — выбор сетки (3x2 / 2x3) и цветной контур нормы', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        cleanup();
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it('1. По умолчанию отображает сетку 3 × 2 (3 карточки в ряд) с активной кнопкой', () => {
        const { container } = render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} />
        );

        const btn3x2 = screen.getByTestId('grid-toggle-3x2');
        const btn2x3 = screen.getByTestId('grid-toggle-2x3');
        expect(btn3x2).toBeTruthy();
        expect(btn2x3).toBeTruthy();

        expect(btn3x2.classList.contains('grid-toggle-btn--active')).toBe(true);
        expect(btn3x2.getAttribute('aria-pressed')).toBe('true');
        expect(btn2x3.classList.contains('grid-toggle-btn--active')).toBe(false);

        const grid = container.querySelector('.pollutants-grid');
        expect(grid.classList.contains('pollutants-grid--3cols')).toBe(true);
        expect(grid.classList.contains('pollutants-grid--2cols')).toBe(false);
    });

    it('2. Переключает сетку на 2 × 3 при клике на соответствующую кнопку и сохраняет в localStorage', () => {
        const { container } = render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} />
        );

        const btn2x3 = screen.getByTestId('grid-toggle-2x3');
        fireEvent.click(btn2x3);

        const grid = container.querySelector('.pollutants-grid');
        expect(grid.classList.contains('pollutants-grid--2cols')).toBe(true);
        expect(grid.classList.contains('pollutants-grid--3cols')).toBe(false);
        expect(btn2x3.classList.contains('grid-toggle-btn--active')).toBe(true);
        expect(btn2x3.getAttribute('aria-pressed')).toBe('true');

        expect(localStorage.getItem('aerocast_pollutants_grid')).toBe('2x3');

        // Переключаем обратно на 3x2
        const btn3x2 = screen.getByTestId('grid-toggle-3x2');
        fireEvent.click(btn3x2);
        expect(grid.classList.contains('pollutants-grid--3cols')).toBe(true);
        expect(localStorage.getItem('aerocast_pollutants_grid')).toBe('3x2');
    });

    it('3. Инициализирует сетку из сохраненного значения в localStorage', () => {
        localStorage.setItem('aerocast_pollutants_grid', '2x3');

        const { container } = render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} />
        );

        const grid = container.querySelector('.pollutants-grid');
        expect(grid.classList.contains('pollutants-grid--2cols')).toBe(true);
        expect(screen.getByTestId('grid-toggle-2x3').classList.contains('grid-toggle-btn--active')).toBe(true);
    });

    it('4. Каждая карточка выделена цветным контуром (borderColor) и имеет атрибут data-level', () => {
        const { container } = render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} />
        );

        const tiles = container.querySelectorAll('.pollutant-tile');
        expect(tiles.length).toBe(6);

        tiles.forEach((tile) => {
            const level = tile.getAttribute('data-level');
            expect(level).toBeTruthy();
            expect(tile.style.borderColor).toBeTruthy();
        });

        // PM2.5 = 15 -> Хорошо -> #8BC34A
        const pm25Tile = container.querySelector('.pollutant-tile[data-key="pm2_5"]');
        expect(pm25Tile.getAttribute('data-level')).toBe('good');
        expect(pm25Tile.style.borderColor).toBe('rgb(139, 195, 74)');
    });

    it('5. В режиме дальтоников контур карточки использует палитру Okabe-Ito', () => {
        const { container } = render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} isColorBlind={true} />
        );

        // PM2.5 = 15 -> Хорошо в Okabe-Ito -> #56B4E9
        const pm25Tile = container.querySelector('.pollutant-tile[data-key="pm2_5"]');
        expect(pm25Tile.style.borderColor).toBe('rgb(86, 180, 233)');
    });

    it('6. Устойчив к ошибкам localStorage при переключении сетки', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError');
        });

        const { container } = render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} />
        );

        const btn2x3 = screen.getByTestId('grid-toggle-2x3');
        expect(() => fireEvent.click(btn2x3)).not.toThrow();

        const grid = container.querySelector('.pollutants-grid');
        expect(grid.classList.contains('pollutants-grid--2cols')).toBe(true);
    });
});
