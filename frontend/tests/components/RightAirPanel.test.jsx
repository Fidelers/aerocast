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

    it('не рендерится при isOpen={false}', () => {
        const { container } = render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={false} />
        );
        expect(container.firstChild).toBeNull();
    });

    it('рендерит шапку с координатами, временем и источником данных', () => {
        render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} />
        );

        expect(screen.getByText('Качество воздуха')).toBeTruthy();
        expect(screen.getByText(/53.7596/)).toBeTruthy();
        expect(screen.getByText(/87.1467/)).toBeTruthy();
        expect(screen.getByText(/2026-10-01/)).toBeTruthy();
        expect(screen.getByText(/open-meteo/)).toBeTruthy();
    });

    it('рендерит общий показатель AQI и рекомендацию', () => {
        render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} />
        );

        expect(screen.getByText('35')).toBeTruthy();
        expect(screen.getByText('хорошо')).toBeTruthy();
    });

    it('отображает перенесенную цветовую шкалу AQI с активным диапазоном 21–40', () => {
        const { container } = render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} />
        );

        expect(screen.getByText('Шкала уровней AQI')).toBeTruthy();
        expect(screen.getByText('0–20')).toBeTruthy();
        expect(screen.getByText('21–40')).toBeTruthy();
        expect(screen.getByText('100+')).toBeTruthy();

        // 35 попадает в 21-40 -> должен быть активный элемент
        const activeItem = container.querySelector('.scale-item--active');
        expect(activeItem).toBeTruthy();
        expect(activeItem.textContent).toContain('21–40');
    });

    it('рендерит все 6 загрязнителей со статусными бейджами', () => {
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

    it('переключает подробную информацию о веществе в блоке "Общ инф" по клику', () => {
        render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} />
        );

        // По умолчанию отображается PM2.5
        expect(screen.getByText('Мелкодисперсные частицы (PM2.5)')).toBeTruthy();

        // Кликаем на NO2
        const no2Btn = screen.getByText('NO₂').closest('button');
        fireEvent.click(no2Btn);

        // Теперь должно отобразиться название NO2
        expect(screen.getByText('Диоксид азота (NO2)')).toBeTruthy();
        expect(screen.getByText(/Токсичный едкий газ красно-бурого цвета/)).toBeTruthy();
        expect(screen.getByText(/Высокотемпературное горение топлива/)).toBeTruthy();
    });

    it('переключает вещество при наведении курсора (hover)', () => {
        render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} />
        );

        const o3Btn = screen.getByText('O₃').closest('button');
        fireEvent.mouseEnter(o3Btn);

        expect(screen.getByText('Приземный озон (O3)')).toBeTruthy();
    });

    it('вызывает onClose при клике на кнопку скрытия панели', () => {
        const onCloseMock = vi.fn();
        render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} onClose={onCloseMock} />
        );

        const closeBtn = screen.getByTestId('right-panel-close-btn');
        fireEvent.click(closeBtn);

        expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('вызывает onClose при нажатии клавиши Escape', () => {
        const onCloseMock = vi.fn();
        render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} onClose={onCloseMock} />
        );

        fireEvent.keyDown(window, { key: 'Escape' });

        expect(onCloseMock).toHaveBeenCalledTimes(1);
    });
});
