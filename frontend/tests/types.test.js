// tests/types.test.js — тесты классификации AQI (Vitest)
import { describe, it, expect } from 'vitest';
import { getAqiInfo, getAqiRecommendation, COLORBLIND_PALETTES } from '../src/types.js';

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

        it('должен корректно классифицировать дробные значения на границах диапазонов', () => {
            expect(getAqiInfo(20.0).label).toBe('отлично');
            expect(getAqiInfo(20.1).label).toBe('хорошо');
            expect(getAqiInfo(40.0).label).toBe('хорошо');
            expect(getAqiInfo(40.1).label).toBe('удовлетворительно');
            expect(getAqiInfo(60.0).label).toBe('удовлетворительно');
            expect(getAqiInfo(60.1).label).toBe('плохо');
            expect(getAqiInfo(80.0).label).toBe('плохо');
            expect(getAqiInfo(80.1).label).toBe('очень плохо');
            expect(getAqiInfo(100.0).label).toBe('очень плохо');
            expect(getAqiInfo(100.1).label).toBe('опасно');
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

        it('должен возвращать иммутабельные (замороженные) объекты описания уровня', () => {
            expect(Object.isFrozen(getAqiInfo(null))).toBe(true);
            expect(Object.isFrozen(getAqiInfo(15))).toBe(true);
            expect(Object.isFrozen(getAqiInfo(150))).toBe(true);
        });
    });

    describe('Режим для дальтоников (options.colorBlind)', () => {
        it('возвращает hex из палитры Okabe-Ito при colorBlind: true по умолчанию', () => {
            expect(getAqiInfo(10, { colorBlind: true }).hex).toBe('#0072B2');  // отлично
            expect(getAqiInfo(30, { colorBlind: true }).hex).toBe('#56B4E9');  // хорошо
            expect(getAqiInfo(50, { colorBlind: true }).hex).toBe('#F0E442');  // удовлетворительно
            expect(getAqiInfo(70, { colorBlind: true }).hex).toBe('#E69F00');  // плохо
            expect(getAqiInfo(90, { colorBlind: true }).hex).toBe('#D55E00');  // очень плохо
            expect(getAqiInfo(120, { colorBlind: true }).hex).toBe('#7B3294'); // опасно
        });

        it('поддерживает палитру Дейтеранопия при colorBlindType: deuteranopia', () => {
            const opts = { colorBlind: true, colorBlindType: 'deuteranopia' };
            expect(getAqiInfo(10, opts).hex).toBe('#1E88E5');
            expect(getAqiInfo(30, opts).hex).toBe('#64B5F6');
            expect(getAqiInfo(50, opts).hex).toBe('#FFF176');
            expect(getAqiInfo(70, opts).hex).toBe('#FB8C00');
            expect(getAqiInfo(90, opts).hex).toBe('#8E24AA');
            expect(getAqiInfo(120, opts).hex).toBe('#4A148C');
        });

        it('поддерживает палитру Протанопия при colorBlindType: protanopia', () => {
            const opts = { colorBlind: true, colorBlindType: 'protanopia' };
            expect(getAqiInfo(10, opts).hex).toBe('#0077BB');
            expect(getAqiInfo(30, opts).hex).toBe('#33BBEE');
            expect(getAqiInfo(50, opts).hex).toBe('#EECC66');
            expect(getAqiInfo(70, opts).hex).toBe('#EE7733');
            expect(getAqiInfo(90, opts).hex).toBe('#EE3377');
            expect(getAqiInfo(120, opts).hex).toBe('#332288');
        });

        it('поддерживает палитру Тританопия при colorBlindType: tritanopia', () => {
            const opts = { colorBlind: true, colorBlindType: 'tritanopia' };
            expect(getAqiInfo(10, opts).hex).toBe('#009E73');
            expect(getAqiInfo(30, opts).hex).toBe('#66C2A5');
            expect(getAqiInfo(50, opts).hex).toBe('#FEE08B');
            expect(getAqiInfo(70, opts).hex).toBe('#FF7043');
            expect(getAqiInfo(90, opts).hex).toBe('#E53935');
            expect(getAqiInfo(120, opts).hex).toBe('#880E4F');
        });

        it('не изменяет label, level и cssClass в режиме дальтоника', () => {
            const info = getAqiInfo(30, { colorBlind: true, colorBlindType: 'deuteranopia' });
            expect(info.label).toBe('хорошо');
            expect(info.level).toBe('good');
            expect(info.cssClass).toBe('aqi-good');
        });

        it('без опции colorBlind (или при false) возвращает стандартную палитру', () => {
            expect(getAqiInfo(30).hex).toBe('#8BC34A');
            expect(getAqiInfo(30, { colorBlind: false }).hex).toBe('#8BC34A');
        });

        it('для «нет данных» возвращает нейтральный серый #9E9E9E', () => {
            expect(getAqiInfo(null, { colorBlind: true }).hex).toBe('#9E9E9E');
            expect(getAqiInfo(null, { colorBlind: true, colorBlindType: 'tritanopia' }).hex).toBe('#9E9E9E');
        });

        it('экспортирует COLORBLIND_PALETTES со всеми 4 видами дальтонизма', () => {
            expect(COLORBLIND_PALETTES.okabe).toBeDefined();
            expect(COLORBLIND_PALETTES.deuteranopia).toBeDefined();
            expect(COLORBLIND_PALETTES.protanopia).toBeDefined();
            expect(COLORBLIND_PALETTES.tritanopia).toBeDefined();
        });
    });

    describe('types.getAqiRecommendation', () => {
        it('возвращает рекомендации для каждого уровня качества воздуха', () => {
            expect(getAqiRecommendation(10)).toContain('Воздух чистый');
            expect(getAqiRecommendation(30)).toContain('приемлемое');
            expect(getAqiRecommendation(50)).toContain('Умеренное');
            expect(getAqiRecommendation(70)).toContain('Неблагоприятные');
            expect(getAqiRecommendation(90)).toContain('Высокое загрязнение');
            expect(getAqiRecommendation(120)).toContain('Опасный уровень');
        });

        it('возвращает пустую строку для null, undefined и NaN', () => {
            expect(getAqiRecommendation(null)).toBe('');
            expect(getAqiRecommendation(undefined)).toBe('');
            expect(getAqiRecommendation(NaN)).toBe('');
        });

        it('поддерживает передачу объекта aqiInfo', () => {
            expect(getAqiRecommendation({ level: 'excellent' })).toContain('Воздух чистый');
            expect(getAqiRecommendation({ level: 'unknown' })).toBe('');
        });
    });
});
