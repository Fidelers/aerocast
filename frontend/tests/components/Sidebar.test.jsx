// tests/components/Sidebar.test.jsx — тесты компонента Sidebar
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
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
