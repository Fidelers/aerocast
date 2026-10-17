// frontend/tests/utils/idwInterpolator.test.js — TDD тесты математической модели IDW
import { describe, it, expect } from 'vitest';
import {
    interpolatePoint,
    interpolateGrid,
    projectPixelToGeo,
    latToMercator,
    mercatorToLat,
    getAqiWeightBoost
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
            // Ровно посередине между ними при равных весах (без буста)
            const val = interpolatePoint(50.0, 35.0, points, { p: 2, boostPolluted: false });
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
            const val = interpolatePoint(50.0, 1.0, points, { p: 2, boostPolluted: false });
            expect(val).toBeCloseTo(14.0, 2);
        });

        it('корректно учитывает параметр p (степень расстояния)', () => {
            const points = [
                { lat: 50.0, lon: 0.0, value: 10 },
                { lat: 50.0, lon: 4.0, value: 50 }
            ];
            // При p = 1: w1 = 1/1 = 1, w2 = 1/3 = 0.333 -> (10 + 16.666) / 1.333 = 20.0
            const valP1 = interpolatePoint(50.0, 1.0, points, { p: 1, boostPolluted: false });
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
            // В Меркаторе центр по Y между 50° и 60° сдвинут к северу: lat ≈ 55.31°
            expect(mercCenter.lat).toBeGreaterThan(55.0);
            expect(mercCenter.lat).toBeLessThan(56.0);
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
        it('интерполирует сетку 150x150 по 25 точкам менее чем за 50 мс', () => {
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
            expect(duration).toBeLessThan(50);
        });
    });

    describe('6. Точность позиционирования и центрирование очагов загрязнения', () => {
        it('строго центрирует пик загрязнения на координатах города без 0.5-пиксельного сдвига', () => {
            // Координаты Череповца
            const cherepovets = { lat: 59.12, lon: 37.91, value: 100 };
            const background = [
                { lat: 59.22, lon: 39.88, value: 25 }, // Вологда
                { lat: 58.05, lon: 38.83, value: 25 }  // Рыбинск
            ];
            // Региональная область Северо-Запада
            const bbox = [30.0, 55.0, 45.0, 62.0];
            const width = 100;
            const height = 100;

            const grid = interpolateGrid([cherepovets, ...background], width, height, bbox, {
                useMercator: true
            });

            // Находим пиксель с максимальным значением
            let maxVal = -1;
            let maxPx = -1;
            let maxPy = -1;
            for (let py = 0; py < height; py++) {
                for (let px = 0; px < width; px++) {
                    const val = grid[py * width + px];
                    if (val > maxVal) {
                        maxVal = val;
                        maxPx = px;
                        maxPy = py;
                    }
                }
            }

            // Центр найденного пикселя в географических координатах WebGL-текстуры
            const minMercY = latToMercator(bbox[1]);
            const maxMercY = latToMercator(bbox[3]);
            const mercDiff = maxMercY - minMercY;

            const centerLon = bbox[0] + ((maxPx + 0.5) / width) * (bbox[2] - bbox[0]);
            const centerMercY = minMercY + (1 - (maxPy + 0.5) / height) * mercDiff;
            const centerLat = mercatorToLat(centerMercY);

            // Расстояние от истинного положения Череповца до центра отображаемого пикселя
            const dLatKm = (centerLat - cherepovets.lat) * 111.32;
            const dLonKm = (centerLon - cherepovets.lon) * 111.32 * Math.cos(cherepovets.lat * Math.PI / 180);
            const distKm = Math.sqrt(dLatKm * dLatKm + dLonKm * dLonKm);

            // Пик локализован с точностью менее 3 км (в границах самого города)
            expect(distKm).toBeLessThan(3.0);
            expect(maxVal).toBeGreaterThan(99);
        });

        it('учитывает сжатие долготы на высоких широтах (cosLat) для изотропного распределения', () => {
            // На широте 60°: cos(60°) = 0.5.
            // 2 градуса долготы равны по расстоянию 1 градусу широты (~111.32 км)
            const center = { lat: 60.0, lon: 30.0 };
            const northPoint = { lat: 61.0, lon: 30.0, value: 80 }; // 1° на север = ~111 км
            const eastPoint = { lat: 60.0, lon: 32.0, value: 40 };  // 2° на восток = 2 * cos(60°) = ~111 км

            // В точке center расстояния до northPoint и eastPoint физически одинаковы
            const val = interpolatePoint(center.lat, center.lon, [northPoint, eastPoint], {
                useMercator: true,
                boostPolluted: false
            });

            // Так как физические расстояния равны, вес точек одинаков -> значение ровно (80 + 40) / 2 = 60
            expect(val).toBeCloseTo(60.0, 1);
        });

        it('плавно снижает загрязнение до фонового уровня (decayRadius) на удалении от очага', () => {
            const city = { lat: 55.0, lon: 37.0, value: 100 };
            const bbox = [35.0, 53.0, 39.0, 57.0];
            const width = 50;
            const height = 50;

            // Сетка с decayRadius = 0.30 (~33 км) и фоновым значением 20
            const grid = interpolateGrid([city], width, height, bbox, {
                decayRadius: 0.30,
                bgVal: 20
            });

            // Точка близко к городу (~5 км)
            const nearVal = interpolatePoint(55.04, 37.0, [city], { decayRadius: 0.30, bgVal: 20 });
            expect(nearVal).toBeGreaterThan(85);

            // Точка вдали от города (~60 км, > 0.5 градуса)
            const farVal = interpolatePoint(55.6, 37.0, [city], { decayRadius: 0.30, bgVal: 20, boostPolluted: false });
            expect(farVal).toBeLessThan(40);
        });

        it('гарантирует зеленое значение в измеренной чистой точке рядом с промышленным очагом', () => {
            const industrial = { lat: 59.12, lon: 37.91, value: 100 };
            const cleanReservoir = { lat: 59.08, lon: 37.85, value: 33 };

            // В точке чистого водоема значение должно быть близко к 33 (зеленая зона), а не 100
            const valAtReservoir = interpolatePoint(cleanReservoir.lat, cleanReservoir.lon, [industrial, cleanReservoir]);
            expect(valAtReservoir).toBe(33);

            // В точке промзоны значение 100
            const valAtIndustrial = interpolatePoint(industrial.lat, industrial.lon, [industrial, cleanReservoir]);
            expect(valAtIndustrial).toBe(100);
        });
    });

    describe('5. Адаптивный весовой буст по шкале EAQI (повышенная значимость красных зон)', () => {
        it('возвращает базовый вес 1.0 для чистых и умеренных значений (EAQI <= 40)', () => {
            expect(getAqiWeightBoost(0)).toBe(1.0);
            expect(getAqiWeightBoost(20)).toBe(1.0);
            expect(getAqiWeightBoost(40)).toBe(1.0);
            expect(getAqiWeightBoost(null)).toBe(1.0);
            expect(getAqiWeightBoost(undefined)).toBe(1.0);
        });

        it('плавно увеличивает вес для загрязненных точек и достигает x2.5 при 110+', () => {
            const boost60 = getAqiWeightBoost(60);
            const boost75 = getAqiWeightBoost(75);
            const boost110 = getAqiWeightBoost(110);
            const boost150 = getAqiWeightBoost(150);

            // При 60: 1 + 1.5 * (20/70) ≈ 1.43
            expect(boost60).toBeGreaterThan(1.3);
            expect(boost60).toBeLessThan(1.5);

            // При 75: 1 + 1.5 * (35/70) = 1.75
            expect(boost75).toBeCloseTo(1.75, 2);

            // При 110 и выше: ровно 2.5
            expect(boost110).toBeCloseTo(2.5, 2);
            expect(boost150).toBeCloseTo(2.5, 2);
        });

        it('дает точке с высоким EAQI (красная зона) больший вес при интерполяции, чем точке чистого воздуха', () => {
            // Две равноудаленные точки: чистая (20) и загрязненная (110)
            const cleanPoint = { lat: 50.0, lon: 30.0, value: 20 };
            const pollutedPoint = { lat: 50.0, lon: 40.0, value: 110 };

            // Середина между ними: без буста было бы (20 + 110)/2 = 65
            // С бустом точки 110 (вес 2.5 vs вес 1.0): (20*1 + 110*2.5) / (1 + 2.5) = (20 + 275) / 3.5 ≈ 84.3
            const val = interpolatePoint(50.0, 35.0, [cleanPoint, pollutedPoint], { p: 2 });
            expect(val).toBeGreaterThan(80);
            expect(val).toBeCloseTo(84.3, 1);
        });
    });
});
