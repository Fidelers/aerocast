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
            expect(duration).toBeLessThan(500);
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

        it('плавно увеличивает вес для загрязненных точек и насыщается при 110+', () => {
            const boost60 = getAqiWeightBoost(60);
            const boost75 = getAqiWeightBoost(75);
            const boost110 = getAqiWeightBoost(110);
            const boost150 = getAqiWeightBoost(150);

            // Формула: 1 + (3 * t)^2, где t = min(1, (val - 40) / 70)
            // При 60: t = 20/70, boost = 1 + (60/70)^2 ≈ 1.7347
            expect(boost60).toBeGreaterThan(1.5);
            expect(boost60).toBeLessThan(2.0);

            // При 75: t = 35/70 = 0.5, boost = 1 + (1.5)^2 = 3.25
            expect(boost75).toBeCloseTo(3.25, 2);

            // При 110 и выше: t = 1, boost = 1 + 9 = 10
            expect(boost110).toBeCloseTo(10.0, 2);
            expect(boost150).toBeCloseTo(10.0, 2);
        });

        it('дает точке с высоким EAQI больший вес при интерполяции', () => {
            const cleanPoint = { lat: 50.0, lon: 30.0, value: 20 };
            const pollutedPoint = { lat: 50.0, lon: 40.0, value: 110 };
            // С бустом точки 110 (вес 10 vs 1): (20*1 + 110*10) / 11 ≈ 101.82
            const val = interpolatePoint(50.0, 35.0, [cleanPoint, pollutedPoint], { p: 2 });
            expect(val).toBeGreaterThan(80);
            expect(val).toBeCloseTo(101.82, 1);
        });

        it('возвращает 1.0 для невалидных и нечисловых значений', () => {
            expect(getAqiWeightBoost('abc')).toBe(1.0);
            expect(getAqiWeightBoost(NaN)).toBe(1.0);
        });

        it('монотонно не убывает при росте EAQI', () => {
            let prev = getAqiWeightBoost(41);
            for (let v = 45; v <= 120; v += 5) {
                expect(getAqiWeightBoost(v)).toBeGreaterThanOrEqual(prev);
                prev = getAqiWeightBoost(v);
            }
        });
    });

    describe('6. Граничные случаи extractPointValue и sanitizePoints', () => {
        it('возвращает null для точки без value и european_aqi', () => {
            expect(interpolatePoint(55.0, 37.0, [{ lat: 55.0, lon: 37.0 }])).toBeNull();
        });

        it('использует european_aqi[0] при отсутствии timeIndex и value', () => {
            expect(interpolatePoint(55.0, 37.0, [{ lat: 55.0, lon: 37.0, european_aqi: [42] }], { timeIndex: null })).toBe(42);
        });

        it('возвращает null для пустого массива european_aqi', () => {
            expect(interpolatePoint(55.0, 37.0, [{ lat: 55.0, lon: 37.0, european_aqi: [] }])).toBeNull();
        });

        it('возвращает null если european_aqi[0] — NaN', () => {
            expect(interpolatePoint(55.0, 37.0, [{ lat: 55.0, lon: 37.0, european_aqi: [NaN] }])).toBeNull();
        });

        it('возвращает null если european_aqi[timeIndex] — NaN', () => {
            expect(interpolatePoint(55.0, 37.0, [{ lat: 55.0, lon: 37.0, european_aqi: [10, NaN, 30] }], { timeIndex: 1 })).toBeNull();
        });

        it('игнорирует value если это не число', () => {
            expect(interpolatePoint(55.0, 37.0, [{ lat: 55.0, lon: 37.0, value: 'abc' }])).toBeNull();
        });

        it('пропускает null-элементы в массиве точек', () => {
            expect(interpolatePoint(55.0, 37.0, [null, { lat: 55.0, lon: 37.0, value: 25 }, undefined])).toBe(25);
        });

        it('пропускает точки с невалидным val', () => {
            expect(interpolatePoint(55.5, 37.5, [{ lat: 55.0, lon: 37.0 }, { lat: 56.0, lon: 38.0, value: 50 }], { boostPolluted: false })).toBe(50);
        });
    });

    describe('7. Граничные случаи interpolatePoint', () => {
        it('возвращает ближайшее значение при всех точках вне maxRadius', () => {
            const points = [
                { lat: 70.0, lon: 70.0, value: 80 },
                { lat: 80.0, lon: 80.0, value: 90 }
            ];
            const val = interpolatePoint(55.0, 37.0, points, { maxRadius: 0.5, bgVal: 20 });
            // Все точки вне радиуса → sumWeight=0 → возвращается ближайшее значение (80)
            expect(val).toBe(80);
        });

        it('clamp ограничивает результат снизу minVal', () => {
            const val = interpolatePoint(60.0, 42.0, [{ lat: 55.0, lon: 37.0, value: -100 }], { minVal: 0, decayRadius: 1.0, bgVal: -50 });
            expect(val).toBeGreaterThanOrEqual(0);
        });

        it('использует useMercator=false', () => {
            const pts = [{ lat: 50.0, lon: 30.0, value: 20 }, { lat: 50.0, lon: 40.0, value: 80 }];
            expect(interpolatePoint(50.0, 35.0, pts, { useMercator: false, boostPolluted: false })).toBeCloseTo(50, 1);
        });

        it('поддерживает произвольную степень p (не 2)', () => {
            const pts = [{ lat: 50.0, lon: 0.0, value: 10 }, { lat: 50.0, lon: 4.0, value: 50 }];
            expect(interpolatePoint(50.0, 1.0, pts, { p: 3, boostPolluted: false })).toBeCloseTo(11.43, 1);
        });
    });

    describe('8. Граничные случаи interpolateGrid', () => {
        it('возвращает пустую сетку для пустого массива точек', () => {
            const grid = interpolateGrid([], 5, 5, [30, 50, 40, 60]);
            expect(grid.length).toBe(25);
            expect(grid.every(v => v === 0)).toBe(true);
        });

        it('заполняет одним значением для единственной точки без decayRadius', () => {
            const grid = interpolateGrid([{ lat: 53.5, lon: 87.0, value: 42 }], 3, 3, [86, 53, 88, 54]);
            expect(grid.every(v => v === 42)).toBe(true);
        });

        it('поддерживает useMercator=false', () => {
            const grid = interpolateGrid(
                [{ lat: 53.2, lon: 86.5, value: 20 }, { lat: 53.8, lon: 87.5, value: 80 }],
                10, 10, [86, 53, 88, 54], { useMercator: false }
            );
            expect(Math.max(...grid)).toBeGreaterThan(20);
        });

        it('учитывает maxRadius (cutoff)', () => {
            const grid = interpolateGrid(
                [{ lat: 53.5, lon: 87.0, value: 80 }, { lat: 60.0, lon: 95.0, value: 20 }],
                10, 10, [86, 53, 88, 54], { maxRadius: 1.0, bgVal: 10 }
            );
            expect(grid.length).toBe(100);
        });

        it('применяет clamp по minVal/maxVal', () => {
            const grid = interpolateGrid(
                [{ lat: 53.5, lon: 87.0, value: 300 }],
                3, 3, [86, 53, 88, 54], { maxVal: 150, decayRadius: 0.5, bgVal: 200 }
            );
            expect(Math.max(...grid)).toBeLessThanOrEqual(150);
            expect(Math.min(...grid)).toBeGreaterThanOrEqual(0);
        });

        it('поддерживает boostPolluted=false', () => {
            const grid = interpolateGrid(
                [{ lat: 53.5, lon: 87.0, value: 20 }, { lat: 53.8, lon: 87.5, value: 80 }],
                5, 5, [86, 53, 88, 54], { boostPolluted: false }
            );
            expect(grid.length).toBe(25);
        });

        it('поддерживает произвольную степень p', () => {
            const grid = interpolateGrid(
                [{ lat: 53.5, lon: 87.0, value: 20 }, { lat: 53.8, lon: 87.5, value: 80 }],
                5, 5, [86, 53, 88, 54], { p: 3, boostPolluted: false }
            );
            expect(Math.max(...grid)).toBeGreaterThan(20);
        });

        it('точное совпадение пикселя с точкой', () => {
            const grid = interpolateGrid(
                [{ lat: 53.75, lon: 86.5, value: 99 }],
                2, 2, [86.0, 53.0, 88.0, 54.0], { useMercator: false, boostPolluted: false }
            );
            expect(grid[0]).toBe(99);
        });

        it('точное совпадение с простыми координатами', () => {
            const grid = interpolateGrid(
                [{ lat: 0.5, lon: 0.5, value: 77 }],
                1, 1, [0, 0, 1, 1], { useMercator: false, boostPolluted: false }
            );
            expect(grid[0]).toBe(77);
        });

        it('исключает точки по dLon при cutoff', () => {
            const grid = interpolateGrid(
                [{ lat: 53.5, lon: 95.0, value: 80 }, { lat: 53.5, lon: 87.0, value: 20 }],
                10, 10, [86, 53, 88, 54], { maxRadius: 1.0, bgVal: 10 }
            );
            expect(grid.length).toBe(100);
        });

        it('clamp ограничивает интерполированное значение сверху maxVal', () => {
            const grid = interpolateGrid(
                [{ lat: 53.5, lon: 87.0, value: 300 }, { lat: 53.6, lon: 87.1, value: 280 }],
                5, 5, [86, 53, 88, 54], { maxVal: 150, boostPolluted: false }
            );
            expect(Math.max(...grid)).toBeLessThanOrEqual(150);
        });

        it('clamp ограничивает интерполированное значение снизу minVal', () => {
            const grid = interpolateGrid(
                [{ lat: 53.5, lon: 87.0, value: -50 }, { lat: 53.6, lon: 87.1, value: -30 }],
                5, 5, [86, 53, 88, 54], { minVal: 0, boostPolluted: false }
            );
            expect(Math.min(...grid)).toBeGreaterThanOrEqual(0);
        });

        it('возвращает nearestVal при sumWeight === 0 (все точки за пределами maxRadius)', () => {
            const grid = interpolateGrid([{ lat: 0.9, lon: 0.9, value: 30 }], 2, 2, [0, 0, 0.1, 0.1], { maxRadius: 0.01, bgVal: 15 });
            expect(grid[0]).toBe(30);
        });

        it('обрабатывает точное совпадение точки с пикселем сетки (exactMatchVal)', () => {
            const grid = interpolateGrid([{ lat: 0.5, lon: 0.5, value: 99 }], 1, 1, [0.5, 0.5, 0.5, 0.5]);
            expect(grid[0]).toBe(99);
        });
    });

    describe('9. Граничные случаи projectPixelToGeo', () => {
        it('возвращает lon=minLon при width=0 (защита деления)', () => {
            // width=0 → lonRatio=0 → lon = minLon
            expect(projectPixelToGeo(0, 0, 0, 100, [30, 50, 40, 60], false).lon).toBe(30);
        });

        it('возвращает lat=minLat при height=0', () => {
            expect(projectPixelToGeo(0, 0, 100, 0, [30, 50, 40, 60], false).lat).toBe(50);
        });
    });

    describe('10. Граничные случаи для полного покрытия ветвей IDW', () => {
        it('обрабатывает некорректные элементы в массиве точек при нормализации', () => {
            const result = interpolatePoint(55.0, 37.0, [null, undefined, 'invalid', { lat: 55.0, lon: 37.0, value: 50 }]);
            expect(result).toBe(50);
        });

        it('обрабатывает boostPolluted = true при отсутствии свойства boost у точки в interpolatePoint', () => {
            const points = [{ lat: 55.0, lon: 37.0, value: 20 }];
            const val = interpolatePoint(55.1, 37.1, points, { boostPolluted: true });
            expect(val).toBe(20);
        });

        it('обрабатывает ветку высоких широт cosLat <= 0.05 в interpolateGrid', () => {
            const grid = interpolateGrid(
                [
                    { lat: 88.0, lon: 10.0, value: 45 },
                    { lat: 88.1, lon: 10.1, value: 46 }
                ],
                3, 3,
                [9.0, 87.5, 11.0, 88.5],
                { maxRadius: 0.5, useMercator: false }
            );
            expect(grid.length).toBe(9);
            expect(grid[4]).toBeGreaterThan(0);
        });

        it('возвращает bgVal когда точки полностью за пределами maxRadius и bbox по широте/долготе', () => {
            const grid = interpolateGrid(
                [
                    { lat: -50.0, lon: -50.0, value: 99 },
                    { lat: -51.0, lon: -51.0, value: 98 }
                ],
                2, 2,
                [37.0, 55.0, 37.2, 55.2],
                { maxRadius: 0.01, bgVal: 77 }
            );
            expect(grid[0]).toBe(77);
            expect(grid[1]).toBe(77);
        });

        it('обрабатывает interpolateGrid с boostPolluted = true для точек без поля boost', () => {
            const grid = interpolateGrid(
                [{ lat: 55.0, lon: 37.0, value: 60 }],
                2, 2,
                [36.9, 54.9, 37.1, 55.1],
                { boostPolluted: true }
            );
            expect(grid.length).toBe(4);
            expect(grid[0]).toBeGreaterThan(0);
        });

        it('обрабатывает точку в углу, где distSq > maxRadiusSq с возвратом nearestVal', () => {
            const grid = interpolateGrid(
                [{ lat: 0.9, lon: 0.9, value: 80 }],
                1, 1,
                [0.5, 0.5, 0.5, 0.5],
                { maxRadius: 0.45, bgVal: 10 }
            );
            expect(grid[0]).toBe(80);
        });

        it('обрабатывает точное совпадение координаты пикселя с точкой (exactMatchVal)', () => {
            const grid = interpolateGrid(
                [{ lat: 0.5, lon: 0.5, value: 42 }],
                1, 1,
                [0.5, 0.5, 0.5, 0.5],
                { useMercator: false }
            );
            expect(grid[0]).toBe(42);
        });
    });
});

