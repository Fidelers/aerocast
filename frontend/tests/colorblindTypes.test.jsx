// frontend/tests/colorblindTypes.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import SettingsModal, { COLORBLIND_TYPES, COLORBLIND_PALETTES } from '../src/components/SettingsModal';
import { getAqiInfo, COLORBLIND_PALETTES as AQI_COLORBLIND_PALETTES } from '../src/types';
import { getPollutantAssessment, POLLUTANT_COLORBLIND_PALETTES } from '../src/utils/pollutantsInfo';
import { interpolateAqiColor, renderFieldToBuffer, COLORBLIND_COLOR_STOPS_MAP, DEFAULT_ALPHA } from '../src/utils/canvasFieldRenderer';

describe('Комплексные тесты 4 видов дальтонизма (Окабе, Дейтеранопия, Протанопия, Тританопия)', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.removeAttribute('data-colorblind');
        document.documentElement.removeAttribute('data-colorblind-type');
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    describe('1. Выбор вида дальтонизма в SettingsModal', () => {
        it('когда цветовая слепота выключена, блок выбора вида дальтонизма скрыт', () => {
            render(<SettingsModal isOpen={true} onClose={vi.fn()} isColorBlind={false} />);
            expect(screen.queryByTestId('settings-colorblind-types')).toBeNull();
            expect(screen.queryByRole('radio', { name: /окабе/i })).toBeNull();
            expect(screen.queryByRole('radio', { name: /дейтеранопия/i })).toBeNull();
            expect(screen.queryByRole('radio', { name: /протанопия/i })).toBeNull();
            expect(screen.queryByRole('radio', { name: /тританопия/i })).toBeNull();
        });

        it('когда цветовая слепота включена, отображается выбор из 4 видов: Окабе, Дейтеранопия, Протанопия, Тританопия', () => {
            render(<SettingsModal isOpen={true} onClose={vi.fn()} isColorBlind={true} colorBlindType="okabe" />);
            expect(screen.getByTestId('settings-colorblind-types')).toBeTruthy();
            expect(screen.getByRole('radio', { name: /окабе/i })).toBeTruthy();
            expect(screen.getByRole('radio', { name: /дейтеранопия/i })).toBeTruthy();
            expect(screen.getByRole('radio', { name: /протанопия/i })).toBeTruthy();
            expect(screen.getByRole('radio', { name: /тританопия/i })).toBeTruthy();
        });

        it('можно включить только 1 какой-либо из видов дальтонизма (single choice)', () => {
            const onTypeChange = vi.fn();
            render(
                <SettingsModal
                    isOpen={true}
                    onClose={vi.fn()}
                    isColorBlind={true}
                    colorBlindType="deuteranopia"
                    onColorBlindTypeChange={onTypeChange}
                />
            );

            const okabe = screen.getByRole('radio', { name: /окабе/i });
            const deut = screen.getByRole('radio', { name: /дейтеранопия/i });
            const prot = screen.getByRole('radio', { name: /протанопия/i });
            const trit = screen.getByRole('radio', { name: /тританопия/i });

            expect(deut.getAttribute('aria-checked')).toBe('true');
            expect(okabe.getAttribute('aria-checked')).toBe('false');
            expect(prot.getAttribute('aria-checked')).toBe('false');
            expect(trit.getAttribute('aria-checked')).toBe('false');

            fireEvent.click(prot);
            expect(onTypeChange).toHaveBeenCalledWith('protanopia');
        });

        it('динамически обновляет палитру предпросмотра при выборе любого из 4 видов', () => {
            const { rerender } = render(
                <SettingsModal isOpen={true} onClose={vi.fn()} isColorBlind={true} colorBlindType="okabe" />
            );

            const palette = screen.getByTestId('settings-preview-palette');
            expect(palette.children[0].style.backgroundColor).toBe('rgb(0, 114, 178)'); // #0072B2 (Okabe)
            expect(screen.getByText(/режим доступности: окабе/i)).toBeTruthy();

            rerender(<SettingsModal isOpen={true} onClose={vi.fn()} isColorBlind={true} colorBlindType="deuteranopia" />);
            expect(palette.children[0].style.backgroundColor).toBe('rgb(30, 136, 229)'); // #1E88E5 (Deuteranopia)
            expect(screen.getByText(/режим доступности: дейтеранопия/i)).toBeTruthy();

            rerender(<SettingsModal isOpen={true} onClose={vi.fn()} isColorBlind={true} colorBlindType="protanopia" />);
            expect(palette.children[0].style.backgroundColor).toBe('rgb(0, 119, 187)'); // #0077BB (Protanopia)
            expect(screen.getByText(/режим доступности: протанопия/i)).toBeTruthy();

            rerender(<SettingsModal isOpen={true} onClose={vi.fn()} isColorBlind={true} colorBlindType="tritanopia" />);
            expect(palette.children[0].style.backgroundColor).toBe('rgb(0, 158, 115)'); // #009E73 (Tritanopia)
            expect(screen.getByText(/режим доступности: тританопия/i)).toBeTruthy();
        });

        it('в автономном режиме выбор сохраняется в localStorage и data-атрибут data-colorblind-type', () => {
            localStorage.setItem('aerocast_colorblind', 'true');
            render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

            const protBtn = screen.getByRole('radio', { name: /протанопия/i });
            fireEvent.click(protBtn);

            expect(localStorage.getItem('aerocast_colorblind_type')).toBe('protanopia');
            expect(document.documentElement.getAttribute('data-colorblind-type')).toBe('protanopia');
        });
    });

    describe('2. Интеграция с types.js (getAqiInfo)', () => {
        it('возвращает корректные цвета для всех 4 палитр', () => {
            // Okabe
            expect(getAqiInfo(10, { colorBlind: true, colorBlindType: 'okabe' }).hex).toBe('#0072B2');
            expect(getAqiInfo(120, { colorBlind: true, colorBlindType: 'okabe' }).hex).toBe('#7B3294');

            // Deuteranopia
            expect(getAqiInfo(10, { colorBlind: true, colorBlindType: 'deuteranopia' }).hex).toBe('#1E88E5');
            expect(getAqiInfo(120, { colorBlind: true, colorBlindType: 'deuteranopia' }).hex).toBe('#4A148C');

            // Protanopia
            expect(getAqiInfo(10, { colorBlind: true, colorBlindType: 'protanopia' }).hex).toBe('#0077BB');
            expect(getAqiInfo(120, { colorBlind: true, colorBlindType: 'protanopia' }).hex).toBe('#332288');

            // Tritanopia
            expect(getAqiInfo(10, { colorBlind: true, colorBlindType: 'tritanopia' }).hex).toBe('#009E73');
            expect(getAqiInfo(120, { colorBlind: true, colorBlindType: 'tritanopia' }).hex).toBe('#880E4F');
        });

        it('при отсутствии colorBlindType использует Okabe по умолчанию', () => {
            expect(getAqiInfo(10, { colorBlind: true }).hex).toBe('#0072B2');
        });
    });

    describe('3. Интеграция с pollutantsInfo.js (getPollutantAssessment)', () => {
        it('возвращает цвета бейджей для каждого вида дальтонизма', () => {
            const val = 8; // Отлично
            expect(getPollutantAssessment('pm2_5', val, { colorBlind: true, colorBlindType: 'okabe' }).color).toBe('#0072B2');
            expect(getPollutantAssessment('pm2_5', val, { colorBlind: true, colorBlindType: 'deuteranopia' }).color).toBe('#1E88E5');
            expect(getPollutantAssessment('pm2_5', val, { colorBlind: true, colorBlindType: 'protanopia' }).color).toBe('#0077BB');
            expect(getPollutantAssessment('pm2_5', val, { colorBlind: true, colorBlindType: 'tritanopia' }).color).toBe('#009E73');
        });
    });

    describe('4. Интеграция с canvasFieldRenderer.js', () => {
        it('interpolateAqiColor использует палитру соответствующего вида дальтонизма', () => {
            expect(interpolateAqiColor(10, DEFAULT_ALPHA, { colorBlind: true, colorBlindType: 'deuteranopia' }))
                .toEqual({ r: 30, g: 136, b: 229, a: DEFAULT_ALPHA });
            expect(interpolateAqiColor(10, DEFAULT_ALPHA, { colorBlind: true, colorBlindType: 'protanopia' }))
                .toEqual({ r: 0, g: 119, b: 187, a: DEFAULT_ALPHA });
            expect(interpolateAqiColor(10, DEFAULT_ALPHA, { colorBlind: true, colorBlindType: 'tritanopia' }))
                .toEqual({ r: 0, g: 158, b: 115, a: DEFAULT_ALPHA });
        });

        it('renderFieldToBuffer передает colorBlindType в интерполяцию', () => {
            const width = 1;
            const height = 1;
            const grid = new Float32Array([10]);
            const imgData = { data: new Uint8ClampedArray(4) };

            renderFieldToBuffer(grid, imgData, width, height, { colorBlind: true, colorBlindType: 'tritanopia' });
            expect(imgData.data[0]).toBe(0);
            expect(imgData.data[1]).toBe(158);
            expect(imgData.data[2]).toBe(115);
        });
    });
});
