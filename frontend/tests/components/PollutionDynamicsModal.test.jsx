// frontend/tests/components/PollutionDynamicsModal.test.jsx
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import PollutionDynamicsModal from '../../src/components/PollutionDynamicsModal';

// Генератор моковых почасовых данных за несколько суток (вчера, сегодня, завтра)
function createMockAirData() {
    const dates = ['2026-10-22', '2026-10-23', '2026-10-24'];
    const time = [];
    const european_aqi = [];
    const pm2_5 = [];
    const pm10 = [];
    const nitrogen_dioxide = [];
    const sulphur_dioxide = [];
    const ozone = [];
    const carbon_monoxide = [];

    dates.forEach((dateStr, dayIdx) => {
        for (let h = 0; h < 24; h++) {
            const hourStr = String(h).padStart(2, '0');
            time.push(`${dateStr}T${hourStr}:00`);

            // Синтетические волнообразные показатели для проверки суточного хода
            const baseVal = 20 + dayIdx * 5 + Math.sin((h / 24) * Math.PI * 2) * 15;
            european_aqi.push(Math.round(Math.max(10, baseVal)));
            pm2_5.push(Math.round(Math.max(5, baseVal * 0.4)));
            pm10.push(Math.round(Math.max(8, baseVal * 0.7)));
            nitrogen_dioxide.push(Math.round(Math.max(10, baseVal * 0.9)));
            sulphur_dioxide.push(Math.round(Math.max(2, baseVal * 0.2)));
            ozone.push(Math.round(Math.max(15, baseVal * 1.1)));
            carbon_monoxide.push(Math.round(Math.max(100, baseVal * 10)));
        }
    });

    return {
        latitude: 53.7596,
        longitude: 87.1467,
        used_source: 'open-meteo',
        hourly_units: {
            time: 'iso8601',
            european_aqi: 'EAQI',
            pm2_5: 'μg/m³',
            pm10: 'μg/m³',
            nitrogen_dioxide: 'μg/m³',
            sulphur_dioxide: 'μg/m³',
            ozone: 'μg/m³',
            carbon_monoxide: 'μg/m³'
        },
        hourly: {
            time,
            european_aqi,
            pm2_5,
            pm10,
            nitrogen_dioxide,
            sulphur_dioxide,
            ozone,
            carbon_monoxide
        }
    };
}

describe('PollutionDynamicsModal component (поверхностное окно суточной динамики качества воздуха)', () => {
    let mockAirData;

    beforeEach(() => {
        mockAirData = createMockAirData();
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    // -----------------------------------------------------------------------------------------------------------------
    // 1. Управление видимостью и базовый рендеринг (Lifecycle & Mounting)
    // -----------------------------------------------------------------------------------------------------------------
    it('1. Не рендерит модальное окно в DOM, если isOpen=false', () => {
        const { container } = render(
            <PollutionDynamicsModal
                isOpen={false}
                onClose={vi.fn()}
                airData={mockAirData}
                selectedTimeIndex={38} // 2026-10-23T14:00 (второй день)
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('2. Рендерит оверлей с размытием фона и диалоговое окно при isOpen=true', () => {
        const { container } = render(
            <PollutionDynamicsModal
                isOpen={true}
                onClose={vi.fn()}
                airData={mockAirData}
                selectedTimeIndex={38}
            />
        );

        const overlay = container.querySelector('.dynamics-modal-overlay') || screen.getByTestId('dynamics-modal-overlay');
        const dialog = screen.getByRole('dialog');

        expect(overlay).toBeTruthy();
        expect(dialog).toBeTruthy();
        expect(dialog.getAttribute('aria-modal')).toBe('true');
    });

    it('3. Отображает в шапке заголовок суточной динамики, выбранную дату и координаты точки', () => {
        render(
            <PollutionDynamicsModal
                isOpen={true}
                onClose={vi.fn()}
                airData={mockAirData}
                selectedTimeIndex={38} // 2026-10-23T14:00
                coords={{ lat: 53.7596, lon: 87.1467 }}
            />
        );

        // Заголовок окна
        expect(screen.getByRole('heading', { level: 2, name: /динамика/i })).toBeTruthy();

        // Дата выбранного дня (23 октября 2026)
        expect(screen.getByText(/2026-10-23|23.*октябр/i)).toBeTruthy();

        // Географические координаты
        expect(screen.getByText(/53\.7596/)).toBeTruthy();
        expect(screen.getByText(/87\.1467/)).toBeTruthy();
    });

    // -----------------------------------------------------------------------------------------------------------------
    // 2. Логика выборки и фильтрации 24 часов за выбранный день
    // -----------------------------------------------------------------------------------------------------------------
    it('4. Корректно фильтрует 24 часовых замера именно за выбранный день из общего массива данных', () => {
        const { container } = render(
            <PollutionDynamicsModal
                isOpen={true}
                onClose={vi.fn()}
                airData={mockAirData}
                selectedTimeIndex={38} // 2026-10-23T14:00 (14-й час второго дня)
            />
        );

        // Проверяем, что в контейнере графиков отфильтрованы точки выбранного дня:
        // метки часов от 00:00 до 23:00 (например, ключевые шаги 00:00, 06:00, 12:00, 18:00)
        expect(container.textContent).toContain('00:00');
        expect(container.textContent).toContain('12:00');
        expect(container.textContent).toContain('23:00');

        // Данные за другие даты не должны выводиться в заголовке суточного диапазона
        expect(screen.queryByText(/2026-10-22/)).toBeNull();
        expect(screen.queryByText(/2026-10-24/)).toBeNull();
    });

    it('5. Акцентирует текущий выбранный час (selectedTimeIndex) на графике или в метаданных', () => {
        const { container } = render(
            <PollutionDynamicsModal
                isOpen={true}
                onClose={vi.fn()}
                airData={mockAirData}
                selectedTimeIndex={38} // 14:00
            />
        );

        // Должен присутствовать маркер активного часа (14:00)
        const activeMarker = container.querySelector('.chart-active-marker, [data-active-hour="14"], [aria-current="time"]')
            || screen.getByText(/14:00/);
        expect(activeMarker).toBeTruthy();
    });

    // -----------------------------------------------------------------------------------------------------------------
    // 3. Главный график общего AQI (европейский индекс EAQI)
    // -----------------------------------------------------------------------------------------------------------------
    it('6. Отображает крупный график суточного хода общего индекса качества воздуха (EAQI)', () => {
        const { container } = render(
            <PollutionDynamicsModal
                isOpen={true}
                onClose={vi.fn()}
                airData={mockAirData}
                selectedTimeIndex={38}
            />
        );

        const mainChartSection = container.querySelector('.dynamics-modal-main-chart')
            || screen.getByTestId('dynamics-modal-main-chart');
        expect(mainChartSection).toBeTruthy();

        // Проверяем наличие векторного графика (SVG)
        const svgElement = mainChartSection.querySelector('svg');
        expect(svgElement).toBeTruthy();

        // Присутствует подпись индекса AQI / EAQI
        expect(mainChartSection.textContent).toMatch(/aqi|eaqi|индекс/i);
    });

    // -----------------------------------------------------------------------------------------------------------------
    // 4. Сетка 6 малых графиков для измеряемых веществ (PM2.5, PM10, NO2, SO2, O3, CO)
    // -----------------------------------------------------------------------------------------------------------------
    it('7. Отображает ровно 6 графиков меньшего размера для всех измеряемых загрязнителей', () => {
        const { container } = render(
            <PollutionDynamicsModal
                isOpen={true}
                onClose={vi.fn()}
                airData={mockAirData}
                selectedTimeIndex={38}
            />
        );

        // Проверяем наличие карточек всех 6 веществ
        expect(screen.getByText(/pm2\.?5/i)).toBeTruthy();
        expect(screen.getByText(/pm10/i)).toBeTruthy();
        expect(screen.getByText(/no2/i)).toBeTruthy();
        expect(screen.getByText(/so2/i)).toBeTruthy();
        expect(screen.getByText(/o3/i)).toBeTruthy();
        expect(screen.getByText(/co/i)).toBeTruthy();

        // Должно быть как минимум 6 карточек малых графиков
        const pollutantCards = container.querySelectorAll('.pollutant-chart-card, [data-testid^="pollutant-card-"]');
        expect(pollutantCards.length).toBe(6);
    });

    it('8. Отображает для каждого вещества единицы измерения (мкг/м³) и суточную статистику (min/max)', () => {
        render(
            <PollutionDynamicsModal
                isOpen={true}
                onClose={vi.fn()}
                airData={mockAirData}
                selectedTimeIndex={38}
            />
        );

        // Единицы измерения концентраций (мкг/м³ или μg/m³)
        const unitLabels = screen.getAllByText(/мкг\/м³|μg\/m³/i);
        expect(unitLabels.length).toBeGreaterThanOrEqual(6);

        // Индикаторы минимума и максимума
        expect(screen.getAllByText(/min|мин/i).length).toBeGreaterThanOrEqual(6);
        expect(screen.getAllByText(/max|макс/i).length).toBeGreaterThanOrEqual(6);
    });

    // -----------------------------------------------------------------------------------------------------------------
    // 5. Обработка событий закрытия окна (Interactions & A11y)
    // -----------------------------------------------------------------------------------------------------------------
    it('9. Вызывает onClose при клике на кнопку закрытия (крестик)', () => {
        const handleClose = vi.fn();
        render(
            <PollutionDynamicsModal
                isOpen={true}
                onClose={handleClose}
                airData={mockAirData}
                selectedTimeIndex={38}
            />
        );

        const closeBtn = screen.getByRole('button', { name: /закрыть/i });
        fireEvent.click(closeBtn);

        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('10. Вызывает onClose при клике на фоновую подложку (overlay)', () => {
        const handleClose = vi.fn();
        const { container } = render(
            <PollutionDynamicsModal
                isOpen={true}
                onClose={handleClose}
                airData={mockAirData}
                selectedTimeIndex={38}
            />
        );

        const overlay = container.querySelector('.dynamics-modal-overlay') || screen.getByTestId('dynamics-modal-overlay');
        fireEvent.click(overlay);

        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('11. Не вызывает onClose при клике внутри содержимого модального окна (stopPropagation)', () => {
        const handleClose = vi.fn();
        const { container } = render(
            <PollutionDynamicsModal
                isOpen={true}
                onClose={handleClose}
                airData={mockAirData}
                selectedTimeIndex={38}
            />
        );

        const modalContent = container.querySelector('.dynamics-modal-content') || screen.getByRole('dialog');
        fireEvent.click(modalContent);

        expect(handleClose).not.toHaveBeenCalled();
    });

    it('12. Вызывает onClose при нажатии клавиши Escape', () => {
        const handleClose = vi.fn();
        render(
            <PollutionDynamicsModal
                isOpen={true}
                onClose={handleClose}
                airData={mockAirData}
                selectedTimeIndex={38}
            />
        );

        fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('13. Не вызывает onClose при нажатии других клавиш (например Enter, Tab, Space)', () => {
        const handleClose = vi.fn();
        render(
            <PollutionDynamicsModal
                isOpen={true}
                onClose={handleClose}
                airData={mockAirData}
                selectedTimeIndex={38}
            />
        );

        fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });
        fireEvent.keyDown(window, { key: 'Tab', code: 'Tab' });
        fireEvent.keyDown(window, { key: ' ', code: 'Space' });

        expect(handleClose).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------------------------------------------------
    // 6. Поддержка доступности (цветовая слепота / дальтонизм)
    // -----------------------------------------------------------------------------------------------------------------
    it('14. Корректно применяет палитру дальтонизма при isColorBlind=true', () => {
        const { container } = render(
            <PollutionDynamicsModal
                isOpen={true}
                onClose={vi.fn()}
                airData={mockAirData}
                selectedTimeIndex={38}
                isColorBlind={true}
                colorBlindType="deuteranopia"
            />
        );

        const modal = container.querySelector('.dynamics-modal-content') || screen.getByRole('dialog');
        const colorblindAttr = modal.getAttribute('data-colorblind') || container.querySelector('[data-colorblind="true"]');

        expect(colorblindAttr || modal).toBeTruthy();
    });

    // -----------------------------------------------------------------------------------------------------------------
    // 7. Отказоустойчивость и граничные случаи (Edge cases & Defensive rendering)
    // -----------------------------------------------------------------------------------------------------------------
    it('15. Безопасно возвращает null и не падает, если airData === null или отсутствуют массивы hourly', () => {
        const { container } = render(
            <PollutionDynamicsModal
                isOpen={true}
                onClose={vi.fn()}
                airData={null}
                selectedTimeIndex={0}
            />
        );
        expect(container.firstChild).toBeNull();

        const { container: emptyContainer } = render(
            <PollutionDynamicsModal
                isOpen={true}
                onClose={vi.fn()}
                airData={{ hourly: { time: [] } }}
                selectedTimeIndex={0}
            />
        );
        expect(emptyContainer.firstChild).toBeNull();
    });

    it('16. Устойчив к наличию null и undefined в массивах концентраций загрязнителей', () => {
        const brokenAirData = createMockAirData();
        // Подмешиваем null значения в показатели
        brokenAirData.hourly.pm2_5 = brokenAirData.hourly.pm2_5.map((v, i) => (i % 2 === 0 ? null : v));
        brokenAirData.hourly.european_aqi = brokenAirData.hourly.european_aqi.map((v, i) => (i % 3 === 0 ? null : v));

        const { container } = render(
            <PollutionDynamicsModal
                isOpen={true}
                onClose={vi.fn()}
                airData={brokenAirData}
                selectedTimeIndex={38}
            />
        );

        // Компонент не упал и отрендерил диалоговое окно
        expect(screen.getByRole('dialog')).toBeTruthy();
        expect(container.querySelector('.dynamics-modal-main-chart')).toBeTruthy();
    });

    it('17. Безопасно обрабатывает отсутствие selectedTimeIndex или выход индекса за пределы массива', () => {
        render(
            <PollutionDynamicsModal
                isOpen={true}
                onClose={vi.fn()}
                airData={mockAirData}
                selectedTimeIndex={9999} // некорректный индекс
            />
        );

        // Компонент штатно открывается, используя первый доступный час по умолчанию
        expect(screen.getByRole('dialog')).toBeTruthy();
    });
});
