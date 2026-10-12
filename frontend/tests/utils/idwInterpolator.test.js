// frontend/tests/utils/idwInterpolator.test.js — TDD тесты математической модели IDW
import { describe, it, expect } from 'vitest';
import {
    interpolatePoint,
    interpolateGrid,
    projectPixelToGeo,
    latToMercator,
    mercatorToLat
} from '../../src/utils/idwInterpolator.js';

describe('idwInterpolator (Математическая модель IDW)', () => {
    describe('1. Математическая формула IDW (p = 2)', () => {
        it('возвращает точное значение точки при нулевом расстоянии (совпадение координат)', () => {
            const points = [
                { lat: 55.0, lon: 37.0, value: 42 }
            ];
            const val = interpolatePoint(55.0, 37.0, points);
            expect(val).toBe(42);
        });

        it('возвращает среднее значение строго посередине между двумя точками с равным весом', () => {
            const points = [
                { lat: 50.0, lon: 30.0, value: 20 },
                { lat: 50.0, lon: 40.0, value: 60 }
            ];
            // Ровно посередине между ними
            const val = interpolatePoint(50.0, 35.0, points, { p: 2 });
            expect(val).toBeCloseTo(40, 4);
        });

        it('сильнее притягивает значение к более близкой точке при p = 2', () => {
            const points = [
                { lat: 50.0, lon: 0.0, value: 10 },
                { lat: 50.0, lon: 4.0, value: 50 }
            ];
            // Точка на расстоянии 1 от первой и 3 от второй:
            // w1 = 1 / 1^2 = 1, w2 = 1 / 3^2 = 1/9
            // expected = (10*1 + 50*(1/9)) / (1 + 1/9) = (10 + 5.555) / 1.111 = 14.0
            const val = interpolatePoint(50.0, 1.0, points, { p: 2 });
            expect(val).toBeCloseTo(14.0, 2);
        });

        it('корректно учитывает параметр p (степень расстояния)', () => {
            const points = [
                { lat: 50.0, lon: 0.0, value: 10 },
                { lat: 50.0, lon: 4.0, value: 50 }
            ];
            // При p = 1: w1 = 1/1 = 1, w2 = 1/3 = 0.333 -> (10 + 16.666) / 1.333 = 20.0
            const valP1 = interpolatePoint(50.0, 1.0, points, { p: 1 });
            expect(valP1).toBeCloseTo(20.0, 2);
        });
    });

    describe('2. Защитные условия, границы и clamp', () => {
        it('защищает от деления на ноль при d < 1e-6 и возвращает значение точки', () => {
            const points = [
                { lat: 55.0, lon: 37.0, value: 35 },
                { lat: 60.0, lon: 40.0, value: 80 }
            ];
            // Расстояние 1e-7 (меньше порога 1e-6)
            const val = interpolatePoint(55.0 + 1e-7, 37.0, points);
            expect(val).toBe(35);
        });

        it('ограничивает вычисленное значение диапазоном [0, 150] (clamp)', () => {
            const highPoints = [{ lat: 55.0, lon: 37.0, value: 250 }];
            expect(interpolatePoint(55.0, 37.0, highPoints)).toBe(150);

            const lowPoints = [{ lat: 55.0, lon: 37.0, value: -30 }];
            expect(interpolatePoint(55.0, 37.0, lowPoints)).toBe(0);
        });

        it('исключает точки за пределами cutoff radius (maxRadius)', () => {
            const points = [
                { lat: 55.0, lon: 37.0, value: 20 },
                { lat: 65.0, lon: 37.0, value: 100 } // удалена на 10 градусов
            ];
            // При maxRadius = 2 градуса далёкая точка игнорируется
            const val = interpolatePoint(55.5, 37.0, points, { maxRadius: 2.0 });
            expect(val).toBe(20);
        });

        it('возвращает значение единственной точки во всей области', () => {
            const points = [{ lat: 53.75, lon: 87.14, value: 45 }];
            expect(interpolatePoint(60.0, 90.0, points)).toBe(45);
        });

        it('возвращает null при пустом или невалидном массиве точек', () => {
            expect(interpolatePoint(55.0, 37.0, [])).toBeNull();
            expect(interpolatePoint(55.0, 37.0, null)).toBeNull();
            expect(interpolatePoint(55.0, 37.0, undefined)).toBeNull();
        });

        it('фильтрует невалидные точки с NaN или null координатами', () => {
            const points = [
                { lat: NaN, lon: 37.0, value: 99 },
                { lat: 55.0, lon: 37.0, value: 25 }
            ];
            expect(interpolatePoint(55.0, 37.0, points)).toBe(25);
        });
    });

    describe('3. Координатные проекции', () => {
        const bbox = [30.0, 50.0, 40.0, 60.0]; // minLon, minLat, maxLon, maxLat
        const width = 100;
        const height = 100;

        it('линейно преобразует угловые пиксели в границы Bounding Box', () => {
            // (0, 0) — левый верхний угол: maxLat, minLon
            const topLeft = projectPixelToGeo(0, 0, width, height, bbox, false);
            expect(topLeft.lat).toBeCloseTo(60.0);
            expect(topLeft.lon).toBeCloseTo(30.0);

            // (width, height) — правый нижний угол: minLat, maxLon
            const bottomRight = projectPixelToGeo(width, height, width, height, bbox, false);
            expect(bottomRight.lat).toBeCloseTo(50.0);
            expect(bottomRight.lon).toBeCloseTo(40.0);

            // Центр холста
            const center = projectPixelToGeo(50, 50, width, height, bbox, false);
            expect(center.lat).toBeCloseTo(55.0);
            expect(center.lon).toBeCloseTo(35.0);
        });

        it('проекция Меркатора обратима (mercatorToLat(latToMercator(lat)) === lat)', () => {
            for (const testLat of [0, 45, 55.75, 70]) {
                const mercY = latToMercator(testLat);
                const recoveredLat = mercatorToLat(mercY);
                expect(recoveredLat).toBeCloseTo(testLat, 5);
            }
        });

        it('применяет формулу Меркатора для устранения искажений по широте', () => {
            const mercCenter = projectPixelToGeo(50, 50, width, height, bbox, true);
            // В Меркаторе центр по Y не равен точно линейному среднему (55.0)
            expect(mercCenter.lat).toBeLessThan(55.3);
            expect(mercCenter.lat).toBeGreaterThan(54.7);
            expect(mercCenter.lon).toBeCloseTo(35.0);
        });
    });

    describe('4. Пакетная интерполяция холста (interpolateGrid)', () => {
        const bbox = [86.0, 53.0, 88.0, 54.0];
        const points = [
            { lat: 53.2, lon: 86.5, value: 20 },
            { lat: 53.8, lon: 87.5, value: 80 }
        ];

        it('возвращает Float32Array длины width * height', () => {
            const grid = interpolateGrid(points, 20, 20, bbox);
            expect(grid).toBeInstanceOf(Float32Array);
            expect(grid.length).toBe(400);
        });

        it('корректно извлекает значение из european_aqi по timeIndex', () => {
            const pointsWithTimeline = [
                { lat: 53.2, lon: 86.5, european_aqi: [15, 25, 35] },
                { lat: 53.8, lon: 87.5, european_aqi: [70, 80, 90] }
            ];
            const gridTime0 = interpolateGrid(pointsWithTimeline, 10, 10, bbox, { timeIndex: 0 });
            const gridTime2 = interpolateGrid(pointsWithTimeline, 10, 10, bbox, { timeIndex: 2 });

            expect(gridTime0[0]).toBeLessThan(gridTime2[0]);
        });
    });

    describe('5. Производительность', () => {
        it('интерполирует сетку 150x150 по 25 точкам менее чем за 30 мс', () => {
            const bbox = [86.0, 53.0, 88.0, 54.0];
            const points = [];
            for (let i = 0; i < 5; i++) {
                for (let j = 0; j < 5; j++) {
                    points.push({
                        lat: 53.0 + i * 0.25,
                        lon: 86.0 + j * 0.5,
                        value: 20 + i * 10 + j * 5
                    });
                }
            }

            const startTime = performance.now();
            const grid = interpolateGrid(points, 150, 150, bbox);
            const duration = performance.now() - startTime;

            expect(grid.length).toBe(22500);
            expect(duration).toBeLessThan(30);
        });
    });
});
