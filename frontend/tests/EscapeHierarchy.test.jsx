// frontend/tests/EscapeHierarchy.test.jsx
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import App from '../src/App';

// Мокаем MapComponent, так как jsdom не поддерживает WebGL / canvas
vi.mock('../src/components/MapComponent', () => {
    return {
        default: function DummyMap(props) {
            return (
                <div data-testid="map">
                    <button
                        data-testid="map-btn-marker-click"
                        onClick={() => props.onMarkerClick && props.onMarkerClick()}
                    >
                        Click Marker
                    </button>
                </div>
            );
        }
    };
});

globalThis.fetch = vi.fn();

const mockAirData = {
    latitude: 53.7596,
    longitude: 87.1467,
    used_source: 'open-meteo',
    hourly: {
        time: ['2026-10-01T12:00', '2026-10-01T13:00'],
        european_aqi: [35, 40],
        pm2_5: [15, 18],
        pm10: [28, 30],
        nitrogen_dioxide: [45, 50],
        sulphur_dioxide: [12, 14],
        ozone: [70, 75],
        carbon_monoxide: [400, 420]
    }
};

describe('Иерархия закрытия окон по Escape (Очередь закрытия)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => mockAirData
        });
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('1. При одновременно открытых RightAirPanel и AboutModal первое нажатие Escape закрывает ТОЛЬКО AboutModal (RightAirPanel остается открытой)', async () => {
        render(<App />);

        // Ждем начальной загрузки и рендера открытой правой панели
        await waitFor(() => {
            expect(document.querySelector('.right-air-panel')).toBeTruthy();
        });

        // Открываем модальное окно «О проекте» через кнопку в сайдбаре
        const aboutBtn = screen.getByLabelText(/информация о проекте/i);
        fireEvent.click(aboutBtn);

        // Проверяем, что в данный момент открыты ОБА окна
        expect(screen.getByRole('dialog')).toBeTruthy();
        expect(document.querySelector('.right-air-panel')).toBeTruthy();

        // Нажимаем Escape в первый раз
        fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

        // Правая панель при этом ОБЯЗАНА остаться открытой.
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.querySelector('.right-air-panel')).toBeTruthy();
    });

    it('2. Второе нажатие Escape закрывает правую панель RightAirPanel', async () => {
        render(<App />);

        await waitFor(() => {
            expect(document.querySelector('.right-air-panel')).toBeTruthy();
        });

        // Открываем AboutModal
        const aboutBtn = screen.getByLabelText(/информация о проекте/i);
        fireEvent.click(aboutBtn);

        // Первое нажатие закрывает AboutModal, правая панель остается открытой
        fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.querySelector('.right-air-panel')).toBeTruthy();

        // Второе нажатие Escape закрывает правую панель
        fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
        expect(document.querySelector('.right-air-panel')).toBeNull();

        // После закрытия правой панели появляется плавающая кнопка «Показатели»
        expect(screen.getByTestId('fab-open-panel')).toBeTruthy();
    });

    it('3. Если открыта только RightAirPanel (без модальных окон), одно нажатие Escape сразу закрывает ее', async () => {
        render(<App />);

        await waitFor(() => {
            expect(document.querySelector('.right-air-panel')).toBeTruthy();
        });

        // AboutModal закрыт
        expect(screen.queryByRole('dialog')).toBeNull();

        // Одно нажатие Escape
        fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

        // Правая панель закрывается
        expect(document.querySelector('.right-air-panel')).toBeNull();
        expect(screen.getByTestId('fab-open-panel')).toBeTruthy();
    });

    it('4. Если открыто только AboutModal (а RightAirPanel предварительно закрыта), нажатие Escape закрывает AboutModal', async () => {
        render(<App />);

        await waitFor(() => {
            expect(document.querySelector('.right-air-panel')).toBeTruthy();
        });

        // Закрываем правую панель крестиком
        const closePanelBtn = screen.getByTestId('right-panel-close-btn');
        fireEvent.click(closePanelBtn);
        expect(document.querySelector('.right-air-panel')).toBeNull();

        // Открываем AboutModal
        const aboutBtn = screen.getByLabelText(/информация о проекте/i);
        fireEvent.click(aboutBtn);
        expect(screen.getByRole('dialog')).toBeTruthy();

        // Нажимаем Escape
        fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

        // AboutModal закрывается
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
