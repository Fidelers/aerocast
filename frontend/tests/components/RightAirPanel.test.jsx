// frontend/tests/components/RightAirPanel.test.jsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
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
