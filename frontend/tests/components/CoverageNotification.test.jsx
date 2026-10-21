import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import App from '../../src/App';

// Мокаем MapComponent для эмуляции кликов по карте
vi.mock('../../src/components/MapComponent', () => ({
    default: function DummyMap(props) {
        return (
            <div data-testid="map">
                <button
                    data-testid="mock-click-russia-moscow"
                    onClick={() => props.onMapClick && props.onMapClick(55.7558, 37.6173)}
                >
                    Click Moscow
                </button>
                <button
                    data-testid="mock-click-russia-spb"
                    onClick={() => props.onMapClick && props.onMapClick(59.9343, 30.3351)}
                >
                    Click SPb
                </button>
                <button
                    data-testid="mock-click-foreign-london"
                    onClick={() => props.onMapClick && props.onMapClick(51.5074, -0.1278)}
                >
                    Click London
                </button>
                <button
                    data-testid="mock-click-foreign-ocean"
                    onClick={() => props.onMapClick && props.onMapClick(30.0, -40.0)}
                >
                    Click Ocean
                </button>
            </div>
        );
    }
}));

// Мокаем хук useAirGrid
vi.mock('../../src/hooks/useAirGrid', () => ({
    default: vi.fn(() => ({
        macroGrid: null,
        microGrid: null,
        loadMicroGrid: vi.fn(),
        loadMacroGrid: vi.fn(),
        isLoadingGrid: false,
        gridError: null
    }))
}));

describe('CoverageNotification (Уведомление о нахождении вне зоны покрытия цветовой сетки)', () => {
    const mockAirData = {
        latitude: 53.7596,
        longitude: 87.1467,
        used_source: 'open-meteo',
        hourly: {
            time: ['2026-10-21T12:00', '2026-10-21T13:00'],
            european_aqi: [25, 25],
            pm2_5: [10, 10],
            pm10: [20, 20],
            nitrogen_dioxide: [15, 15],
            sulphur_dioxide: [5, 5],
            ozone: [30, 30],
            carbon_monoxide: [200, 200]
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => mockAirData
        });
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('1. При старте (дефолтные координаты в РФ) уведомление отсутствует', async () => {
        render(<App />);

        await waitFor(() => {
            expect(screen.queryByTestId('coverage-notification')).toBeNull();
        });
    });

    it('2. При клике на территорию РФ (Москва) уведомление не показывается', async () => {
        render(<App />);

        const moscowBtn = screen.getByTestId('mock-click-russia-moscow');
        fireEvent.click(moscowBtn);

        expect(screen.queryByTestId('coverage-notification')).toBeNull();
    });

    it('3. При клике за пределы зоны покрытия (Лондон) отображается уведомление с правильным текстом', async () => {
        render(<App />);

        const londonBtn = screen.getByTestId('mock-click-foreign-london');
        fireEvent.click(londonBtn);

        const notification = await screen.findByTestId('coverage-notification');
        expect(notification).toBeTruthy();
        expect(notification.textContent).toContain('Эта территория не находится в пределах покрытия цветовым отображением');
        expect(notification.classList.contains('coverage-notification--visible')).toBe(true);
        expect(notification.getAttribute('role')).toBe('alert');
        expect(notification.querySelector('.coverage-notification__icon')).toBeTruthy();
        expect(notification.querySelector('.coverage-notification__close')).toBeTruthy();
    });

    it('4. Клик по кнопке закрытия уведомления (крестик) сразу скрывает уведомление', async () => {
        render(<App />);

        const londonBtn = screen.getByTestId('mock-click-foreign-london');
        fireEvent.click(londonBtn);

        const notification = await screen.findByTestId('coverage-notification');
        expect(notification).toBeTruthy();

        const closeBtn = screen.getByTestId('coverage-notification-close');
        fireEvent.click(closeBtn);

        expect(screen.queryByTestId('coverage-notification')).toBeNull();
    });

    it('5. При клике обратно на территорию РФ (СПб) активное уведомление автоматически исчезает', async () => {
        render(<App />);

        // Кликаем вне РФ (океан)
        const oceanBtn = screen.getByTestId('mock-click-foreign-ocean');
        fireEvent.click(oceanBtn);

        const notification = await screen.findByTestId('coverage-notification');
        expect(notification).toBeTruthy();

        // Кликаем в РФ (СПб)
        const spbBtn = screen.getByTestId('mock-click-russia-spb');
        fireEvent.click(spbBtn);

        expect(screen.queryByTestId('coverage-notification')).toBeNull();
    });

    it('6. Повторный клик за пределами РФ обновляет уведомление и сохраняет его видимость', async () => {
        render(<App />);

        const londonBtn = screen.getByTestId('mock-click-foreign-london');
        fireEvent.click(londonBtn);

        const notification1 = await screen.findByTestId('coverage-notification');
        expect(notification1).toBeTruthy();

        const oceanBtn = screen.getByTestId('mock-click-foreign-ocean');
        fireEvent.click(oceanBtn);

        const notification2 = screen.getByTestId('coverage-notification');
        expect(notification2).toBeTruthy();
        expect(notification2.textContent).toContain(
            'Эта территория не находится в пределах покрытия цветовым отображением'
        );
    });

    it('7. Клик по самому телу уведомления не пробрасывает событие дальше (stopPropagation)', async () => {
        render(<App />);

        const londonBtn = screen.getByTestId('mock-click-foreign-london');
        fireEvent.click(londonBtn);

        const notification = await screen.findByTestId('coverage-notification');
        expect(notification).toBeTruthy();

        // Клик по уведомлению
        fireEvent.click(notification);
        // Уведомление не исчезает
        expect(screen.getByTestId('coverage-notification')).toBeTruthy();
    });
});
