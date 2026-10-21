import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import RightAirPanel from '../../src/components/RightAirPanel';

const mockAirData = {
    latitude: 53.7596,
    longitude: 87.1467,
    used_source: 'open-meteo',
    hourly: {
        time: ['2026-10-21T12:00'],
        european_aqi: [35],
        pm2_5: [15],
        pm10: [28],
        nitrogen_dioxide: [32],
        sulphur_dioxide: [12],
        ozone: [70],
        carbon_monoxide: [400]
    }
};

describe('RightAirPanel Pinning (Фиксация и расфиксация загрязнителей по клику)', () => {
    afterEach(() => {
        cleanup();
    });

    it('1. По умолчанию (без фиксации) наведение курсора (hover) переключает отображаемое вещество', () => {
        const { container } = render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} />
        );

        // Изначально отображается PM2.5
        expect(screen.getByText('Мелкодисперсные частицы (PM2.5)')).toBeTruthy();

        // Наводим курсор на NO2
        const no2Btn = container.querySelector('button[data-key="nitrogen_dioxide"]');
        expect(no2Btn).toBeTruthy();
        fireEvent.mouseEnter(no2Btn);

        // Инфо-карточка переключилась на NO2
        expect(screen.getByText('Диоксид азота (NO2)')).toBeTruthy();

        // Наводим курсор на O3
        const o3Btn = container.querySelector('button[data-key="ozone"]');
        expect(o3Btn).toBeTruthy();
        fireEvent.mouseEnter(o3Btn);

        // Инфо-карточка переключилась на O3
        expect(screen.getByText('Приземный озон (O3)')).toBeTruthy();
    });

    it('2. Клик по веществу фиксирует его (добавляется индикатор пина и класс .pollutant-tile--pinned)', () => {
        const { container } = render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} />
        );

        const no2Btn = container.querySelector('button[data-key="nitrogen_dioxide"]');
        expect(no2Btn.classList.contains('pollutant-tile--pinned')).toBe(false);

        // Кликаем по NO2 для фиксации
        fireEvent.click(no2Btn);

        // Плитка NO2 теперь зафиксирована
        expect(no2Btn.classList.contains('pollutant-tile--pinned')).toBe(true);
        expect(no2Btn.getAttribute('data-pinned')).toBe('true');
        expect(no2Btn.getAttribute('aria-pressed')).toBe('true');
        expect(container.querySelector('[data-testid="pin-indicator-nitrogen_dioxide"]')).toBeTruthy();

        // В шапке карточки общей информации отображается бейдж «Зафиксировано»
        expect(screen.getByTestId('general-info-pinned-tag')).toBeTruthy();
        expect(screen.getByText('Диоксид азота (NO2)')).toBeTruthy();
    });

    it('3. При зафиксированном веществе наведение курсора на другие элементы НЕ переключает инфо-карточку', () => {
        const { container } = render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} />
        );

        const no2Btn = container.querySelector('button[data-key="nitrogen_dioxide"]');
        const o3Btn = container.querySelector('button[data-key="ozone"]');
        const pm10Btn = container.querySelector('button[data-key="pm10"]');

        // Фиксируем NO2 кликом
        fireEvent.click(no2Btn);
        expect(screen.getByText('Диоксид азота (NO2)')).toBeTruthy();

        // Наводим курсор на O3
        fireEvent.mouseEnter(o3Btn);

        // Карточка по-прежнему отображает зафиксированный NO2!
        expect(screen.getByText('Диоксид азота (NO2)')).toBeTruthy();
        expect(screen.queryByText('Приземный озон (O3)')).toBeNull();

        // Наводим курсор на PM10
        fireEvent.mouseEnter(pm10Btn);

        // Карточка всё ещё зафиксирована на NO2
        expect(screen.getByText('Диоксид азота (NO2)')).toBeTruthy();
        expect(screen.queryByText('Крупнодисперсные частицы (PM10)')).toBeNull();
    });

    it('4. Повторный клик по зафиксированному веществу расфиксирует его, и наведение снова работает', () => {
        const { container } = render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} />
        );

        const no2Btn = container.querySelector('button[data-key="nitrogen_dioxide"]');
        const o3Btn = container.querySelector('button[data-key="ozone"]');

        // 1. Фиксируем NO2
        fireEvent.click(no2Btn);
        expect(no2Btn.classList.contains('pollutant-tile--pinned')).toBe(true);

        // 2. Повторный клик по NO2 снимает фиксацию
        fireEvent.click(no2Btn);
        expect(no2Btn.classList.contains('pollutant-tile--pinned')).toBe(false);
        expect(no2Btn.getAttribute('data-pinned')).toBeNull();
        expect(container.querySelector('[data-testid="pin-indicator-nitrogen_dioxide"]')).toBeNull();
        expect(screen.queryByTestId('general-info-pinned-tag')).toBeNull();

        // 3. Теперь наведение на O3 снова свободно переключает карточку!
        fireEvent.mouseEnter(o3Btn);
        expect(screen.getByText('Приземный озон (O3)')).toBeTruthy();
    });

    it('5. Клик по другому веществу переносит фиксацию на новое вещество', () => {
        const { container } = render(
            <RightAirPanel airData={mockAirData} selectedTimeIndex={0} isOpen={true} />
        );

        const no2Btn = container.querySelector('button[data-key="nitrogen_dioxide"]');
        const coBtn = container.querySelector('button[data-key="carbon_monoxide"]');

        // Фиксируем NO2
        fireEvent.click(no2Btn);
        expect(no2Btn.classList.contains('pollutant-tile--pinned')).toBe(true);
        expect(coBtn.classList.contains('pollutant-tile--pinned')).toBe(false);

        // Кликаем по CO
        fireEvent.click(coBtn);

        // Фиксация снята с NO2 и установлена на CO
        expect(no2Btn.classList.contains('pollutant-tile--pinned')).toBe(false);
        expect(coBtn.classList.contains('pollutant-tile--pinned')).toBe(true);
        expect(screen.getByText('Угарный газ (CO)')).toBeTruthy();
    });
});
