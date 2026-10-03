import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import Sidebar from '../../src/components/Sidebar';

const mockAirData = {
    latitude: 53.7596,
    longitude: 87.1467,
    hourly: {
        time: [
            '2026-09-27T18:00', // index 0 (вчера, кратно 3)
            '2026-09-27T21:00', // index 1 (кратно 3)
            '2026-09-28T00:00', // index 2 (кратно 3)
            '2026-09-28T01:00', // index 3 (НЕ кратно 3)
            '2026-09-28T03:00', // index 4 (кратно 3)
            '2026-09-28T06:00', // index 5 (кратно 3)
            '2026-09-29T00:00', // index 6 (сегодня, кратно 3)
            '2026-09-29T03:00', // index 7 (кратно 3)
            '2026-09-30T00:00'  // index 8 (прогноз, кратно 3)
        ]
    }
};

describe('Sidebar component', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-28T10:00:00'));
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });
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

describe('Sidebar component (TDD — Геолокация пользователя)', () => {
    let originalGeolocation;

    beforeEach(() => {
        originalGeolocation = globalThis.navigator.geolocation;
        globalThis.navigator.geolocation = {
            getCurrentPosition: vi.fn(),
        };
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
        globalThis.navigator.geolocation = originalGeolocation;
    });

    it('1. При клике на "Моё местоположение" запрашивает права на гео (вызывает getCurrentPosition)', () => {
        render(<Sidebar />);

        const geoBtn = screen.getByRole('button', { name: /моё местоположение/i });
        fireEvent.click(geoBtn);

        expect(globalThis.navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
    });

    it('2. При успешном получении координат вызывает onLocationSelect с широтой и долготой (lat, lon)', () => {
        const handleLocationSelect = vi.fn();

        globalThis.navigator.geolocation.getCurrentPosition.mockImplementationOnce((successCb) => {
            successCb({
                coords: { latitude: 55.75, longitude: 37.61 }
            });
        });

        render(<Sidebar onLocationSelect={handleLocationSelect} />);

        const geoBtn = screen.getByRole('button', { name: /моё местоположение/i });
        fireEvent.click(geoBtn);

        expect(handleLocationSelect).toHaveBeenCalledTimes(1);
        expect(handleLocationSelect).toHaveBeenCalledWith(55.75, 37.61, expect.any(String));
    });

    it('3. При запрете доступа или ошибке показывает аккуратное сообщение об ошибке (без падения)', async () => {
        globalThis.navigator.geolocation.getCurrentPosition.mockImplementationOnce((successCb, errorCb) => {
            errorCb({ message: 'User denied Geolocation' });
        });

        render(<Sidebar />);

        const geoBtn = screen.getByRole('button', { name: /моё местоположение/i });
        fireEvent.click(geoBtn);

        const errorMessage = await screen.findByText(/ошибк|не удалось|запрещен/i);
        expect(errorMessage).toBeTruthy();
    });
});

describe('Sidebar component (TDD — вызов информационного модального окна)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-28T10:00:00'));
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('1. При клике на кнопку информации вызывает onOpenAbout', () => {
        const handleOpenAbout = vi.fn();
        render(<Sidebar onOpenAbout={handleOpenAbout} />);

        const infoBtn = screen.getByLabelText(/информация о проекте/i);
        fireEvent.click(infoBtn);

        expect(handleOpenAbout).toHaveBeenCalledTimes(1);
    });

    it('2. Предотвращает стандартный переход по ссылке (preventDefault) при клике на кнопку информации', () => {
        const handleOpenAbout = vi.fn();
        render(<Sidebar onOpenAbout={handleOpenAbout} />);

        const infoBtn = screen.getByLabelText(/информация о проекте/i);
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

        infoBtn.dispatchEvent(event);

        expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('3. Открывает и закрывает внутренний AboutModal, если onOpenAbout не передан в пропсы', () => {
        render(<Sidebar />);

        const infoBtn = screen.getByLabelText(/информация о проекте/i);
        fireEvent.click(infoBtn);

        expect(screen.getByRole('dialog')).toBeTruthy();

        const closeBtn = screen.getByRole('button', { name: /закрыть/i });
        fireEvent.click(closeBtn);

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('вызывает onLocateMe при нажатии кнопки "Моё местоположение", если передан коллбэк', () => {
        const handleLocateMe = vi.fn();
        render(<Sidebar onLocateMe={handleLocateMe} />);

        const geoBtn = screen.getByRole('button', { name: /моё местоположение/i });
        fireEvent.click(geoBtn);

        expect(handleLocateMe).toHaveBeenCalledTimes(1);
    });

    it('отображает ошибку, если navigator.geolocation не поддерживается', () => {
        const originalGeo = globalThis.navigator.geolocation;
        delete globalThis.navigator.geolocation;

        render(<Sidebar />);

        const geoBtn = screen.getByRole('button', { name: /моё местоположение/i });
        fireEvent.click(geoBtn);

        expect(screen.getByText(/Геолокация не поддерживается/i)).toBeTruthy();

        globalThis.navigator.geolocation = originalGeo;
    });

    it('корректно отображает поле поиска города в сайдбаре', () => {
        const handleLocationSelect1 = vi.fn();
        const handleCitySelect = vi.fn();

        render(
            <Sidebar
                onLocationSelect={handleLocationSelect1}
                onCitySelect={handleCitySelect}
            />
        );

        const input = screen.getByPlaceholderText('Город');
        fireEvent.change(input, { target: { value: 'Казань' } });

        expect(input.value).toBe('Казань');
    });

    it('выбирает сегодняшний день или первый доступный день по умолчанию, если selectedTimeIndex не задан', () => {
        render(<Sidebar airData={mockAirData} selectedTimeIndex={null} />);
        expect(screen.getByRole('button', { name: '00:00' })).toBeTruthy();
    });

    it('вызывает onSelectTime при клике по плитке часа', () => {
        const handleSelectTime = vi.fn();
        render(<Sidebar airData={mockAirData} selectedTimeIndex={2} onSelectTime={handleSelectTime} />);
        const hourBtn = screen.getByRole('button', { name: '03:00' });
        fireEvent.click(hourBtn);
        expect(handleSelectTime).toHaveBeenCalledWith(4);
    });

    it('пробрасывает выбор города из CitySearch в onLocationSelect (3 аргумента) и onCitySelect', async () => {
        const handleLocationSelect = vi.fn((...args) => args);
        Object.defineProperty(handleLocationSelect, 'length', { value: 3 });
        const handleCitySelect = vi.fn();

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [
                { id: 1, name: 'Москва', display_name: 'Москва, Россия', latitude: 55.7558, longitude: 37.6173 }
            ]
        });

        render(
            <Sidebar
                onLocationSelect={handleLocationSelect}
                onCitySelect={handleCitySelect}
            />
        );

        const input = screen.getByPlaceholderText('Город');
        fireEvent.change(input, { target: { value: 'Москва' } });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });

        const item = screen.getByText('Москва, Россия');
        fireEvent.click(item);

        expect(handleLocationSelect).toHaveBeenCalledWith(55.7558, 37.6173, 'Москва');
        expect(handleCitySelect).toHaveBeenCalledWith(expect.objectContaining({ lat: 55.7558, lon: 37.6173 }));
    });

    it('пробрасывает выбор города в onLocationSelect с 1 аргументом', async () => {
        const handleLocationSelect = vi.fn((...args) => args);

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [
                { id: 1, name: 'Москва', display_name: 'Москва, Россия', latitude: 55.7558, longitude: 37.6173 }
            ]
        });

        render(<Sidebar onLocationSelect={handleLocationSelect} />);

        const input = screen.getByPlaceholderText('Город');
        fireEvent.change(input, { target: { value: 'Москва' } });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });

        const item = screen.getByText('Москва, Россия');
        fireEvent.click(item);

        expect(handleLocationSelect).toHaveBeenCalledWith(expect.objectContaining({ lat: 55.7558, lon: 37.6173 }));
    });

    it('обрабатывает успех геолокации без падения, если onLocationSelect не передан', () => {
        const mockCoords = { latitude: 53.75, longitude: 87.14 };
        globalThis.navigator.geolocation = {
            getCurrentPosition: vi.fn((success) => {
                success({ coords: mockCoords });
            })
        };

        render(<Sidebar />);
        const geoBtn = screen.getByRole('button', { name: /моё местоположение/i });
        fireEvent.click(geoBtn);

        expect(globalThis.navigator.geolocation.getCurrentPosition).toHaveBeenCalled();
    });

    it('позволяет кликнуть по часу без падения, если onSelectTime не передан', () => {
        render(<Sidebar airData={mockAirData} selectedTimeIndex={2} />);
        const hourBtn = screen.getByRole('button', { name: '00:00' });
        fireEvent.click(hourBtn);
    });

    it('выбирает days[0], если в данных нет сегодняшнего дня и активного часа', () => {
        const pastAirData = {
            hourly: {
                time: ['2020-01-01T00:00', '2020-01-01T03:00'],
                european_aqi: [20, 20]
            }
        };

        render(<Sidebar airData={pastAirData} selectedTimeIndex={null} />);
        expect(screen.getByRole('button', { name: '00:00' })).toBeTruthy();
    });

    it('обрабатывает случай, когда activeTimeIndex не найден ни в одном дне', () => {
        render(<Sidebar airData={mockAirData} selectedTimeIndex={9999} />);
        expect(screen.getByRole('button', { name: '00:00' })).toBeTruthy();
    });

    it('обрабатывает выбор города, если onLocationSelect и onCitySelect не переданы', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [
                { id: 1, name: 'Москва', display_name: 'Москва, Россия', latitude: 55.7558, longitude: 37.6173 }
            ]
        });

        render(<Sidebar />);

        const input = screen.getByPlaceholderText('Город');
        fireEvent.change(input, { target: { value: 'Москва' } });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });

        const item = screen.getByText('Москва, Россия');
        fireEvent.click(item);
    });

    it('выбирает день по умолчанию, если ранее выбранный день отсутствует в новых данных (selectedDayStr не найден)', () => {
        const { rerender } = render(<Sidebar airData={mockAirData} selectedTimeIndex={0} />);

        const day29Btn = screen.getByRole('button', { name: /29/i });
        fireEvent.click(day29Btn);

        const singleDayAirData = {
            hourly: {
                time: ['2026-09-28T00:00', '2026-09-28T03:00'],
                european_aqi: [20, 20]
            }
        };

        rerender(<Sidebar airData={singleDayAirData} selectedTimeIndex={0} />);
        expect(screen.getByRole('button', { name: '00:00' })).toBeTruthy();
    });

    it('передает координаты в onLocationSelect при успешной геолокации', () => {
        const handleLocationSelect = vi.fn();
        const mockCoords = { latitude: 53.75, longitude: 87.14 };
        globalThis.navigator.geolocation = {
            getCurrentPosition: vi.fn((success) => {
                success({ coords: mockCoords });
            })
        };

        render(<Sidebar onLocationSelect={handleLocationSelect} />);
        const geoBtn = screen.getByRole('button', { name: /моё местоположение/i });
        fireEvent.click(geoBtn);

        expect(handleLocationSelect).toHaveBeenCalledWith(53.75, 87.14, '');
    });

    it('обрабатывает ошибку геолокации PERMISSION_DENIED', () => {
        globalThis.navigator.geolocation = {
            getCurrentPosition: vi.fn((_, error) => {
                error({
                    code: 1,
                    PERMISSION_DENIED: 1,
                    POSITION_UNAVAILABLE: 2,
                    TIMEOUT: 3
                });
            })
        };

        render(<Sidebar />);
        const geoBtn = screen.getByRole('button', { name: /моё местоположение/i });
        fireEvent.click(geoBtn);

        expect(screen.getByText(/Доступ к геолокации запрещён/i)).toBeTruthy();
    });

    it('обрабатывает ошибку геолокации POSITION_UNAVAILABLE', () => {
        globalThis.navigator.geolocation = {
            getCurrentPosition: vi.fn((_, error) => {
                error({
                    code: 2,
                    PERMISSION_DENIED: 1,
                    POSITION_UNAVAILABLE: 2,
                    TIMEOUT: 3
                });
            })
        };

        render(<Sidebar />);
        const geoBtn = screen.getByRole('button', { name: /моё местоположение/i });
        fireEvent.click(geoBtn);

        expect(screen.getByText(/Информация о местоположении недоступна/i)).toBeTruthy();
    });

    it('обрабатывает ошибку геолокации TIMEOUT', () => {
        globalThis.navigator.geolocation = {
            getCurrentPosition: vi.fn((_, error) => {
                error({
                    code: 3,
                    PERMISSION_DENIED: 1,
                    POSITION_UNAVAILABLE: 2,
                    TIMEOUT: 3
                });
            })
        };

        render(<Sidebar />);
        const geoBtn = screen.getByRole('button', { name: /моё местоположение/i });
        fireEvent.click(geoBtn);

        expect(screen.getByText(/Превышено время ожидания ответа от GPS/i)).toBeTruthy();
    });

    it('обрабатывает неизвестную ошибку геолокации', () => {
        globalThis.navigator.geolocation = {
            getCurrentPosition: vi.fn((_, error) => {
                error({
                    code: 999,
                    PERMISSION_DENIED: 1,
                    POSITION_UNAVAILABLE: 2,
                    TIMEOUT: 3
                });
            })
        };

        render(<Sidebar />);
        const geoBtn = screen.getByRole('button', { name: /моё местоположение/i });
        fireEvent.click(geoBtn);

        expect(screen.getByText(/Не удалось определить местоположение/i)).toBeTruthy();
    });

    it('вызывает onViewModeChange при клике на кнопки режимов отображения', () => {
        const handleViewModeChange = vi.fn();
        render(<Sidebar onViewModeChange={handleViewModeChange} />);

        const colorBtn = screen.getByRole('button', { name: 'Цветовой' });
        const numericBtn = screen.getByRole('button', { name: 'Цифровой' });
        const comboBtn = screen.getByRole('button', { name: 'Комбо' });

        fireEvent.click(colorBtn);
        expect(handleViewModeChange).toHaveBeenCalledWith('color');

        fireEvent.click(numericBtn);
        expect(handleViewModeChange).toHaveBeenCalledWith('numeric');

        fireEvent.click(comboBtn);
        expect(handleViewModeChange).toHaveBeenCalledWith('combo');
    });

    it('позволяет кликать по кнопкам режимов без падения, если onViewModeChange не задан', () => {
        render(<Sidebar />);
        const colorBtn = screen.getByRole('button', { name: 'Цветовой' });
        fireEvent.click(colorBtn);
    });

    it('вызывает scrollIntoView на карточке дня при handleDayClick', () => {
        const scrollIntoViewMock = vi.fn();
        HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

        try {
            render(<Sidebar airData={mockAirData} selectedTimeIndex={0} />);
            const day29Btn = screen.getByRole('button', { name: /29/i });
            fireEvent.click(day29Btn);

            expect(scrollIntoViewMock).toHaveBeenCalledWith(
                expect.objectContaining({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
            );
        } finally {
            delete HTMLElement.prototype.scrollIntoView;
        }
    });

    it('игнорирует ошибку, если scrollIntoView в handleDayClick выбрасывает исключение', () => {
        HTMLElement.prototype.scrollIntoView = vi.fn(() => {
            throw new Error('scroll error');
        });

        try {
            render(<Sidebar airData={mockAirData} selectedTimeIndex={0} />);
            const day29Btn = screen.getByRole('button', { name: /29/i });
            fireEvent.click(day29Btn);
            // Не должно упасть
        } finally {
            delete HTMLElement.prototype.scrollIntoView;
        }
    });

    it('выполняет прокрутку контейнера при clientWidth > 0', () => {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
            configurable: true,
            value: 400
        });
        Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
            configurable: true,
            value: 150
        });
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
            configurable: true,
            value: 60
        });

        try {
            const { container } = render(<Sidebar airData={mockAirData} selectedTimeIndex={4} />);
            const daysContainer = container.querySelector('.days');
            expect(daysContainer.scrollLeft).toBe(150 - (400 - 60) / 2);
        } finally {
            delete HTMLElement.prototype.clientWidth;
            delete HTMLElement.prototype.offsetLeft;
            delete HTMLElement.prototype.offsetWidth;
        }
    });

    it('выполняет targetCard.scrollIntoView при clientWidth === 0 и ловит ошибку если есть', () => {
        const scrollIntoViewMock = vi.fn(() => {
            throw new Error('scroll fail');
        });
        HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

        try {
            render(<Sidebar airData={mockAirData} selectedTimeIndex={4} />);
            expect(scrollIntoViewMock).toHaveBeenCalledWith(
                expect.objectContaining({ inline: 'center', block: 'nearest' })
            );
        } finally {
            delete HTMLElement.prototype.scrollIntoView;
        }
    });

    it('очищает requestAnimationFrame при размонтировании', () => {
        const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
        const { unmount } = render(<Sidebar airData={mockAirData} selectedTimeIndex={0} />);
        unmount();
        expect(cancelSpy).toHaveBeenCalled();
        cancelSpy.mockRestore();
    });

    it('не падает при scrollContainer, если карточка дня не найдена через querySelector', () => {
        const querySpy = vi.spyOn(Element.prototype, 'querySelector').mockReturnValue(null);
        render(<Sidebar airData={mockAirData} selectedTimeIndex={0} />);
        querySpy.mockRestore();
    });

    it('рендерит часы с fallback-ключом по индексу, если timeStr пустой', () => {
        const dataNoTimeStr = {
            hourly: {
                time: ['not-iso', 'not-iso-2'],
                european_aqi: [10, 20]
            }
        };
        render(<Sidebar airData={dataNoTimeStr} selectedTimeIndex={0} />);
    });

    it('автоматически скрывает ошибку геолокации через 5000 мс', () => {
        const mockGeolocation = {
            getCurrentPosition: vi.fn((success, error) => {
                error({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
            })
        };
        vi.stubGlobal('navigator', { ...navigator, geolocation: mockGeolocation });

        render(<Sidebar airData={null} />);
        const btn = screen.getByText('Моё местоположение');
        fireEvent.click(btn);

        expect(screen.getByText(/Доступ к геолокации запрещён/i)).toBeTruthy();

        act(() => {
            vi.advanceTimersByTime(5000);
        });

        expect(screen.queryByText(/Доступ к геолокации запрещён/i)).toBeNull();
        vi.unstubAllGlobals();
    });
});



