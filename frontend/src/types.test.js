// types.test.js — тесты классификации AQI (Vitest)
import { describe, it, expect } from 'vitest';
import { getAqiInfo } from './types.js';

describe('types.getAqiInfo', () => {
    describe('Отсутствие данных', () => {
        it('должен возвращать «нет данных» для null, undefined и NaN', () => {
            for (const value of [null, undefined, Number.NaN]) {
                const info = getAqiInfo(value);
                expect(info.label).toBe('нет данных');
                expect(info.level).toBe('none');
            }
        });
    });

    describe('Границы уровней', () => {
        it('должен классифицировать AQI <= 20 как «отлично»', () => {
            for (const value of [0, 10, 20]) {
                expect(getAqiInfo(value).label).toBe('отлично');
            }
        });

        it('должен классифицировать AQI 21..40 как «хорошо»', () => {
            for (const value of [21, 30, 40]) {
                expect(getAqiInfo(value).label).toBe('хорошо');
            }
        });

        it('должен классифицировать AQI 41..60 как «удовлетворительно»', () => {
            for (const value of [41, 50, 60]) {
                expect(getAqiInfo(value).label).toBe('удовлетворительно');
            }
        });

        it('должен классифицировать AQI 61..80 как «плохо»', () => {
            for (const value of [61, 70, 80]) {
                expect(getAqiInfo(value).label).toBe('плохо');
            }
        });

        it('должен классифицировать AQI 81..100 как «очень плохо»', () => {
            for (const value of [81, 90, 100]) {
                expect(getAqiInfo(value).label).toBe('очень плохо');
            }
        });

        it('должен классифицировать AQI > 100 как «опасно»', () => {
            for (const value of [101, 150, 1000]) {
                expect(getAqiInfo(value).label).toBe('опасно');
            }
        });
    });

    describe('Структура результата', () => {
        it('должен возвращать подпись уровня, CSS-класс и hex-код для числового AQI', () => {
            const info = getAqiInfo(25);
            expect(info.label).toBe('хорошо');
            expect(info.cssClass).toBe('aqi-good');
            expect(info.hex).toBe('#8BC34A');
        });

        it('должен возвращать корректные поля для уровня «нет данных»', () => {
            const info = getAqiInfo(null);
            expect(info).toEqual({
                level: 'none',
                label: 'нет данных',
                cssClass: 'aqi-none',
                hex: '#9E9E9E'
            });
        });

        it('должен использовать разные hex-коды для разных уровней', () => {
            const hexes = [
                getAqiInfo(0).hex,    // отлично
                getAqiInfo(30).hex,   // хорошо
                getAqiInfo(50).hex,   // удовлетворительно
                getAqiInfo(70).hex,   // плохо
                getAqiInfo(90).hex,   // очень плохо
                getAqiInfo(120).hex   // опасно
            ];
            expect(new Set(hexes).size).toBe(6);
        });
    });
});