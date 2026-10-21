import { describe, it, expect } from 'vitest';
import russiaBoundaries, { isPointInCoverage, isPointInPolygon } from '../../src/utils/russiaBoundary2026';

describe('russiaBoundary2026 (границы РФ и зона покрытия)', () => {
    it('экспортирует корректный массив полигонов границ РФ', () => {
        expect(russiaBoundaries).toBeDefined();
        expect(Array.isArray(russiaBoundaries)).toBe(true);
        expect(russiaBoundaries.length).toBeGreaterThan(0);
    });

    describe('isPointInCoverage (проверка нахождения точки в зоне покрытия сетки РФ)', () => {
        it('определяет российские города как находящиеся внутри покрытия', () => {
            const russianLocations = [
                { name: 'Москва', lat: 55.7558, lon: 37.6173 },
                { name: 'Санкт-Петербург', lat: 59.9343, lon: 30.3351 },
                { name: 'Владивосток', lat: 43.1155, lon: 131.8855 },
                { name: 'Калининград', lat: 54.7104, lon: 20.4522 },
                { name: 'Сочи', lat: 43.6028, lon: 39.7342 },
                { name: 'Новосибирск', lat: 55.0084, lon: 82.9357 },
                { name: 'Якутск', lat: 62.0355, lon: 129.6755 },
                { name: 'Мурманск', lat: 68.9585, lon: 33.0827 },
                { name: 'Анадырь', lat: 64.7333, lon: 177.5167 },
                { name: 'Уэлен (Чукотка, западное полушарие)', lat: 66.1600, lon: -169.8100 },
            ];

            for (const loc of russianLocations) {
                expect(isPointInCoverage(loc.lat, loc.lon), `Должен быть в РФ: ${loc.name}`).toBe(true);
            }
        });

        it('определяет зарубежные города и океаны как находящиеся вне покрытия', () => {
            const foreignLocations = [
                { name: 'Лондон', lat: 51.5074, lon: -0.1278 },
                { name: 'Париж', lat: 48.8566, lon: 2.3522 },
                { name: 'Берлин', lat: 52.5200, lon: 13.4050 },
                { name: 'Хельсинки', lat: 60.1699, lon: 24.9384 },
                { name: 'Минск', lat: 53.9045, lon: 27.5615 },
                { name: 'Астана', lat: 51.1694, lon: 71.4491 },
                { name: 'Токио', lat: 35.6762, lon: 139.6503 },
                { name: 'Нью-Йорк', lat: 40.7128, lon: -74.0060 },
                { name: 'Атлантический океан', lat: 30.0, lon: -40.0 },
                { name: 'Тихий океан', lat: 20.0, lon: 160.0 },
            ];

            for (const loc of foreignLocations) {
                expect(isPointInCoverage(loc.lat, loc.lon), `Не должен быть в РФ: ${loc.name}`).toBe(false);
            }
        });

        it('безопасно обрабатывает невалидные значения (null, undefined, NaN, строки)', () => {
            expect(isPointInCoverage(null, null)).toBe(false);
            expect(isPointInCoverage(undefined, 37.6)).toBe(false);
            expect(isPointInCoverage(55.75, NaN)).toBe(false);
            expect(isPointInCoverage('55.75', '37.6')).toBe(false);
            expect(isPointInCoverage(-10, 37.6)).toBe(false);
            expect(isPointInCoverage(90, 0)).toBe(false);
        });
    });
});
