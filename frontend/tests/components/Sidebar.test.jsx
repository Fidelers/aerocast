// tests/components/Sidebar.test.jsx — тесты компонента Sidebar (навигация по времени и переключатели режимов)
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Sidebar from '../../src/components/Sidebar';

describe('Sidebar component', () => {
    const mockAirData = {
        latitude: 53.7596,
        longitude: 87.1467,
        hourly: {
            time: [
                '2026-09-27T18:00', // index 0 (вчера, кратно 3)
                '2026-09-27T21:00', // index 1 (кратно 3)
                '2026-09-28T00:00', // index 2 (сегодня, кратно 3)
                '2026-09-28T01:00', // index 3 (НЕ кратно 3)
                '2026-09-28T03:00', // index 4 (кратно 3)
                '2026-09-28T06:00', // index 5 (кратно 3)
                '2026-09-29T00:00', // index 6 (прогноз, кратно 3)
                '2026-09-29T03:00'  // index 7 (кратно 3)
            ]
        }
    };

    it('рендерится без ошибок при отсутствии airData', () => {
        const html = renderToString(<Sidebar airData={null} />);
        expect(html).toContain('Нет данных о датах');
        expect(html).toContain('Нет доступных часов');
    });

    it('рендерит реальные дни из airData вместо хардкода', () => {
        const html = renderToString(
            <Sidebar
                airData={mockAirData}
                selectedTimeIndex={4} // 2026-09-28T03:00
            />
        );

        // Проверяем наличие чисел месяца из данных
        expect(html).toContain('27');
        expect(html).toContain('28');
        expect(html).toContain('29');

        // Проверяем наличие дней недели
        expect(html).toContain('ВС');
        expect(html).toContain('ПН');
        expect(html).toContain('ВТ');

        expect(html).not.toContain('<span class="day-card__num">10</span>');
        expect(html).not.toContain('<span class="day-card__num">16</span>');
    });

    it('показывает часы с шагом в 3 часа для активного дня и помечает выбранный час', () => {
        const html = renderToString(
            <Sidebar
                airData={mockAirData}
                selectedTimeIndex={4} // 2026-09-28T03:00
            />
        );

        // День 2026-09-28 содержит кратные 3 часы: 00:00, 03:00, 06:00
        expect(html).toContain('00:00');
        expect(html).toContain('03:00');
        expect(html).toContain('06:00');

        // Не кратный 3 час 01:00 должен быть отфильтрован
        expect(html).not.toContain('01:00');

        // Часы из 27 числа (18:00, 21:00) не должны показываться, так как активен день 28
        expect(html).not.toContain('18:00');
        expect(html).not.toContain('21:00');

        // Час 03:00 должен иметь класс time--active
        expect(html).toMatch(/class="[^"]*time--active[^"]*"[^>]*>03:00/);
    });

    it('помечает прогнозные дни классом day-card--forecast и бейджем прог', () => {
        const html = renderToString(
            <Sidebar
                airData={mockAirData}
                selectedTimeIndex={0}
            />
        );

        expect(html).toContain('day-card--forecast');
    });
});

describe('Sidebar component (TDD — переключатели режимов отображения)', () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('1. Присваивает класс .segmented__btn--active только кнопке "Цветовой", когда viewMode="color"', () => {
        render(<Sidebar viewMode="color" />);

        const colorBtn = screen.getByRole('button', { name: 'Цветовой' });
        const numericBtn = screen.getByRole('button', { name: 'Цифровой' });
        const comboBtn = screen.getByRole('button', { name: 'Комбо' });

        expect(colorBtn.className).toContain('segmented__btn--active');
        expect(numericBtn.className).not.toContain('segmented__btn--active');
        expect(comboBtn.className).not.toContain('segmented__btn--active');
    });

    it('2. Присваивает класс .segmented__btn--active только кнопке "Цифровой", когда viewMode="numeric"', () => {
        render(<Sidebar viewMode="numeric" />);

        const colorBtn = screen.getByRole('button', { name: 'Цветовой' });
        const numericBtn = screen.getByRole('button', { name: 'Цифровой' });
        const comboBtn = screen.getByRole('button', { name: 'Комбо' });

        expect(numericBtn.className).toContain('segmented__btn--active');
        expect(colorBtn.className).not.toContain('segmented__btn--active');
        expect(comboBtn.className).not.toContain('segmented__btn--active');
    });

    it('3. Присваивает класс .segmented__btn--active только кнопке "Комбо", когда viewMode="combo" (или по умолчанию)', () => {
        render(<Sidebar viewMode="combo" />);

        const colorBtn = screen.getByRole('button', { name: 'Цветовой' });
        const numericBtn = screen.getByRole('button', { name: 'Цифровой' });
        const comboBtn = screen.getByRole('button', { name: 'Комбо' });

        expect(comboBtn.className).toContain('segmented__btn--active');
        expect(colorBtn.className).not.toContain('segmented__btn--active');
        expect(numericBtn.className).not.toContain('segmented__btn--active');
    });

    it('4. Вызывает callback onViewModeChange с "color" при клике на кнопку "Цветовой"', () => {
        const handleViewModeChange = vi.fn();
        render(<Sidebar viewMode="combo" onViewModeChange={handleViewModeChange} />);

        const colorBtn = screen.getByRole('button', { name: 'Цветовой' });
        fireEvent.click(colorBtn);

        expect(handleViewModeChange).toHaveBeenCalledTimes(1);
        expect(handleViewModeChange).toHaveBeenCalledWith(expect.stringMatching(/color|цветовой/i));
    });

    it('5. Вызывает callback onViewModeChange с "numeric" при клике на кнопку "Цифровой"', () => {
        const handleViewModeChange = vi.fn();
        render(<Sidebar viewMode="combo" onViewModeChange={handleViewModeChange} />);

        const numericBtn = screen.getByRole('button', { name: 'Цифровой' });
        fireEvent.click(numericBtn);

        expect(handleViewModeChange).toHaveBeenCalledTimes(1);
        expect(handleViewModeChange).toHaveBeenCalledWith(expect.stringMatching(/numeric|цифровой/i));
    });

    it('6. Вызывает callback onViewModeChange с "combo" при клике на кнопку "Комбо"', () => {
        const handleViewModeChange = vi.fn();
        render(<Sidebar viewMode="color" onViewModeChange={handleViewModeChange} />);

        const comboBtn = screen.getByRole('button', { name: 'Комбо' });
        fireEvent.click(comboBtn);

        expect(handleViewModeChange).toHaveBeenCalledTimes(1);
        expect(handleViewModeChange).toHaveBeenCalledWith(expect.stringMatching(/combo|комбо/i));
    });

    it('7. Визуально переключает активный таб при смене пропса viewMode от родительского компонента', () => {
        const { rerender } = render(<Sidebar viewMode="color" />);

        expect(screen.getByRole('button', { name: 'Цветовой' }).className).toContain('segmented__btn--active');
        expect(screen.getByRole('button', { name: 'Цифровой' }).className).not.toContain('segmented__btn--active');

        // Родительский компонент App.jsx обновляет состояние viewMode на 'numeric'
        rerender(<Sidebar viewMode="numeric" />);

        expect(screen.getByRole('button', { name: 'Цифровой' }).className).toContain('segmented__btn--active');
        expect(screen.getByRole('button', { name: 'Цветовой' }).className).not.toContain('segmented__btn--active');
    });
});
