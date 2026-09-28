// tests/components/CitySearch.test.jsx — TDD-тесты для компонента поиска города

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import CitySearch from '../../src/components/CitySearch';

describe('CitySearch component (TDD)', () => {
    const mockGeocodingResults = [
        {
            id: 1,
            name: 'Москва',
            display_name: 'Москва, Россия',
            latitude: 55.7558,
            longitude: 37.6173
        },
        {
            id: 2,
            name: 'Московский',
            display_name: 'Московский, Новомосковский округ, Москва, Россия',
            latitude: 55.6033,
            longitude: 37.3556
        }
    ];

    beforeEach(() => {
        vi.useFakeTimers();
        global.fetch = vi.fn();
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('1. Рендерит контролируемое поле ввода с плейсхолдером "Город"', () => {
        render(<CitySearch onLocationSelect={vi.fn()} />);

        const input = screen.getByPlaceholderText('Город');
        expect(input).not.toBeNull();
        expect(input.id).toBe('city-search');

        // Проверяем ввод символов в поле
        fireEvent.change(input, { target: { value: 'Новокузнецк' } });
        expect(input.value).toBe('Новокузнецк');
    });

    it('2. Не отправляет сетевой запрос, если введено менее 3 символов', async () => {
        render(<CitySearch onLocationSelect={vi.fn()} />);
        const input = screen.getByPlaceholderText('Город');

        fireEvent.change(input, { target: { value: 'Мо' } });

        // Проматываем таймер debounce на 500мс
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });

        // Запрос не должен уйти
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('3. Дебаунсит ввод: отправляет ровно 1 запрос через 500мс после окончания быстрого ввода', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => mockGeocodingResults
        });

        render(<CitySearch onLocationSelect={vi.fn()} />);
        const input = screen.getByPlaceholderText('Город');

        // Пользователь быстро печатает: "М" -> "Мо" -> "Мос" -> "Моск" -> "Москва"
        fireEvent.change(input, { target: { value: 'М' } });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
        });

        fireEvent.change(input, { target: { value: 'Мо' } });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
        });

        fireEvent.change(input, { target: { value: 'Мос' } });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
        });

        fireEvent.change(input, { target: { value: 'Моск' } });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
        });

        fireEvent.change(input, { target: { value: 'Москва' } });

        // До истечения 500мс запрос ещё не должен быть отправлен
        expect(global.fetch).not.toHaveBeenCalled();

        // Проматываем оставшиеся 500мс
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });

        // Должен уйти ровно один запрос с финальным значением
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/search?q=' + encodeURIComponent('Москва'))
        );
    });

    it('4. Отображает выпадающий список результатов с display_name', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => mockGeocodingResults
        });

        render(<CitySearch onLocationSelect={vi.fn()} />);
        const input = screen.getByPlaceholderText('Город');

        fireEvent.change(input, { target: { value: 'Москва' } });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });

        // Проверяем отображение всех результатов с их display_name
        const item1 = screen.getByText('Москва, Россия');
        const item2 = screen.getByText('Московский, Новомосковский округ, Москва, Россия');

        expect(item1).not.toBeNull();
        expect(item2).not.toBeNull();
    });

    it('5. По клику на результат вызывает callback с координатами, подставляет имя в инпут и скрывает список', async () => {
        const handleLocationSelect = vi.fn();
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => mockGeocodingResults
        });

        render(<CitySearch onLocationSelect={handleLocationSelect} />);
        const input = screen.getByPlaceholderText('Город');

        fireEvent.change(input, { target: { value: 'Москва' } });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });

        const item = screen.getByText('Москва, Россия');
        fireEvent.click(item);

        // 1. Вызывается callback обновления координат для App.jsx
        expect(handleLocationSelect).toHaveBeenCalledWith(
            expect.objectContaining({
                lat: 55.7558,
                lon: 37.6173,
                name: expect.stringMatching(/Москва/)
            })
        );

        // 2. Имя выбранного города подставляется в значение поля ввода
        expect(input.value).toMatch(/Москва/);

        // 3. Выпадающий список скрывается
        expect(screen.queryByText('Москва, Россия')).toBeNull();
        expect(screen.queryByText('Московский, Новомосковский округ, Москва, Россия')).toBeNull();
    });

    it('6. Скрывает выпадающий список при нажатии клавиши Escape', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => mockGeocodingResults
        });

        render(<CitySearch onLocationSelect={vi.fn()} />);
        const input = screen.getByPlaceholderText('Город');

        fireEvent.change(input, { target: { value: 'Москва' } });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });

        expect(screen.getByText('Москва, Россия')).not.toBeNull();

        // Нажатие Escape
        fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });

        // Список должен закрыться
        expect(screen.queryByText('Москва, Россия')).toBeNull();
    });

    it('7. Скрывает выпадающий список при клике вне компонента (click outside)', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => mockGeocodingResults
        });

        render(
            <div>
                <span data-testid="outside-element">Внешняя область</span>
                <CitySearch onLocationSelect={vi.fn()} />
            </div>
        );

        const input = screen.getByPlaceholderText('Город');
        fireEvent.change(input, { target: { value: 'Москва' } });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });

        expect(screen.getByText('Москва, Россия')).not.toBeNull();

        // Клик вне компонента
        fireEvent.mouseDown(screen.getByTestId('outside-element'));

        // Список должен закрыться
        expect(screen.queryByText('Москва, Россия')).toBeNull();
    });

    it('8. Показывает сообщение "Город не найден", если бэкенд вернул пустой массив', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => []
        });

        render(<CitySearch onLocationSelect={vi.fn()} />);
        const input = screen.getByPlaceholderText('Город');

        fireEvent.change(input, { target: { value: 'НесуществующийГород123' } });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });

        // Должно отобразиться сообщение об отсутствии результатов
        expect(screen.getByText(/Город не найден|Ничего не найдено/i)).not.toBeNull();
    });
});
