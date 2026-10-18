// frontend/tests/utils/canvasFieldRenderer.test.js — TDD тесты попиксельного рендерера Canvas
import { describe, it, expect, vi } from 'vitest';
import {
    interpolateAqiColor,
    renderFieldToBuffer,
    renderFieldToCanvas,
    createFieldCanvas,
    clipCanvasToPolygons,
    hasPollutedZones,
    DEFAULT_CANVAS_WIDTH,
    DEFAULT_CANVAS_HEIGHT,
    DEFAULT_ALPHA
} from '../../src/utils/canvasFieldRenderer.js';
import { latToMercator } from '../../src/utils/idwInterpolator.js';

describe('canvasFieldRenderer (Попиксельный рендерер цветового поля)', () => {
    describe('1. Линейная RGB-интерполяция цвета по шкале EAQI', () => {
        it('возвращает точный зелёный цвет #4CAF50 для диапазона 0..20', () => {
            const c0 = interpolateAqiColor(0);
            expect(c0).toEqual({ r: 76, g: 175, b: 80, a: DEFAULT_ALPHA });

            const c20 = interpolateAqiColor(20);
            expect(c20).toEqual({ r: 76, g: 175, b: 80, a: DEFAULT_ALPHA });
        });

        it('возвращает точные цвета на контрольных границах 40, 60, 80, 100, 150', () => {
            expect(interpolateAqiColor(40)).toEqual({ r: 139, g: 195, b: 74, a: DEFAULT_ALPHA }); // #8BC34A
            expect(interpolateAqiColor(60)).toEqual({ r: 255, g: 235, b: 59, a: DEFAULT_ALPHA }); // #FFEB3B
            expect(interpolateAqiColor(80)).toEqual({ r: 255, g: 152, b: 0, a: DEFAULT_ALPHA });  // #FF9800
            expect(interpolateAqiColor(100)).toEqual({ r: 244, g: 67, b: 54, a: DEFAULT_ALPHA }); // #F44336
            expect(interpolateAqiColor(150)).toEqual({ r: 213, g: 0, b: 0, a: DEFAULT_ALPHA });   // #D50000
        });

        it('плавно интерполирует промежуточные значения между порогами', () => {
            // AQI = 30 (ровно середина между 20 [76, 175, 80] и 40 [139, 195, 74])
            // r = round(76 + 31.5) = 108, g = round(175 + 10) = 185, b = round(80 - 3) = 77
            const c30 = interpolateAqiColor(30);
            expect(c30.r).toBe(108);
            expect(c30.g).toBe(185);
            expect(c30.b).toBe(77);

            // AQI = 50 (середина между 40 и 60)
            const c50 = interpolateAqiColor(50);
            expect(c50.r).toBe(197);
            expect(c50.g).toBe(215);
            expect(c50.b).toBe(67);
        });

        it('ограничивает значения за пределами шкалы (clamp)', () => {
            // Отрицательный AQI приравнивается к 0 (зелёный)
            expect(interpolateAqiColor(-10)).toEqual({ r: 76, g: 175, b: 80, a: DEFAULT_ALPHA });
            // Значения выше 150 остаются бордовыми #D50000
            expect(interpolateAqiColor(250)).toEqual({ r: 213, g: 0, b: 0, a: DEFAULT_ALPHA });
        });

        it('возвращает прозрачный пиксель (a = 0) при отсутствии данных или NaN', () => {
            expect(interpolateAqiColor(null).a).toBe(0);
            expect(interpolateAqiColor(undefined).a).toBe(0);
            expect(interpolateAqiColor(NaN).a).toBe(0);
        });

        it('поддерживает кастомную прозрачность alpha', () => {
            const custom = interpolateAqiColor(50, 200);
            expect(custom.a).toBe(200);
        });
    });

    describe('1b. Доступная палитра для дальтоников (options.colorBlind)', () => {
        it('возвращает цвета палитры Okabe-Ito на контрольных границах', () => {
            const opts = { colorBlind: true };
            expect(interpolateAqiColor(0, DEFAULT_ALPHA, opts)).toEqual({ r: 0, g: 114, b: 178, a: DEFAULT_ALPHA });    // #0072B2
            expect(interpolateAqiColor(20, DEFAULT_ALPHA, opts)).toEqual({ r: 0, g: 114, b: 178, a: DEFAULT_ALPHA });   // #0072B2
            expect(interpolateAqiColor(40, DEFAULT_ALPHA, opts)).toEqual({ r: 86, g: 180, b: 233, a: DEFAULT_ALPHA });  // #56B4E9
            expect(interpolateAqiColor(60, DEFAULT_ALPHA, opts)).toEqual({ r: 240, g: 228, b: 66, a: DEFAULT_ALPHA });  // #F0E442
            expect(interpolateAqiColor(80, DEFAULT_ALPHA, opts)).toEqual({ r: 230, g: 159, b: 0, a: DEFAULT_ALPHA });   // #E69F00
            expect(interpolateAqiColor(100, DEFAULT_ALPHA, opts)).toEqual({ r: 213, g: 94, b: 0, a: DEFAULT_ALPHA });   // #D55E00
            expect(interpolateAqiColor(150, DEFAULT_ALPHA, opts)).toEqual({ r: 123, g: 50, b: 148, a: DEFAULT_ALPHA }); // #7B3294
        });

        it('интерполирует промежуточные значения в доступной палитре', () => {
            // AQI = 30 (середина между 20 [0,114,178] и 40 [86,180,233])
            const c30 = interpolateAqiColor(30, DEFAULT_ALPHA, { colorBlind: true });
            expect(c30.r).toBe(43);
            expect(c30.g).toBe(147);
            expect(c30.b).toBe(206);
        });

        it('ограничивает значения за пределами шкалы (clamp) в доступной палитре', () => {
            expect(interpolateAqiColor(-10, DEFAULT_ALPHA, { colorBlind: true })).toEqual({ r: 0, g: 114, b: 178, a: DEFAULT_ALPHA });
            expect(interpolateAqiColor(250, DEFAULT_ALPHA, { colorBlind: true })).toEqual({ r: 123, g: 50, b: 148, a: DEFAULT_ALPHA });
        });

        it('без опции colorBlind (или при false) использует стандартную палитру', () => {
            expect(interpolateAqiColor(10)).toEqual({ r: 76, g: 175, b: 80, a: DEFAULT_ALPHA });
            expect(interpolateAqiColor(10, DEFAULT_ALPHA, { colorBlind: false })).toEqual({ r: 76, g: 175, b: 80, a: DEFAULT_ALPHA });
        });

        it('renderFieldToBuffer применяет доступную палитру при options.colorBlind', () => {
            const width = 2;
            const height = 1;
            const grid = new Float32Array([10, 90]);
            const imgData = { data: new Uint8ClampedArray(width * height * 4) };

            renderFieldToBuffer(grid, imgData, width, height, { colorBlind: true });

            // Пиксель 0: AQI 10 -> #0072B2
            expect(imgData.data[0]).toBe(0);
            expect(imgData.data[1]).toBe(114);
            expect(imgData.data[2]).toBe(178);
            // Пиксель 1: AQI 90 -> интерполяция между #E69F00 (80) и #D55E00 (100)
            const idx = 4;
            expect(imgData.data[idx]).toBe(222); // round(230 + 0.5 * (213-230)) = 222
            expect(imgData.data[idx + 1]).toBe(127); // round(159 + 0.5 * (94-159)) = 127
            expect(imgData.data[idx + 2]).toBe(0);
        });

        it('renderFieldToBuffer в режиме onlyPollution тоже поддерживает палитру дальтоника', () => {
            const width = 2;
            const height = 1;
            const grid = new Float32Array([20, 90]);
            const imgData = { data: new Uint8ClampedArray(width * height * 4) };

            renderFieldToBuffer(grid, imgData, width, height, { onlyPollution: true, colorBlind: true });

            // Чистый воздух (20) — полностью прозрачен
            expect(imgData.data[3]).toBe(0);
            // Загрязнение (90) — доступный оранжевый #E69F00..#D55E00
            expect(imgData.data[4]).toBe(222);
            expect(imgData.data[5]).toBe(127);
            expect(imgData.data[6]).toBe(0);
        });
    });

    describe('2. Заполнение буфера пикселей (renderFieldToBuffer)', () => {
        it('корректно заполняет массив ImageData длиной width * height * 4', () => {
            const width = 10;
            const height = 10;
            const grid = new Float32Array(width * height);
            grid[0] = 20;  // левый верхний пиксель (зелёный)
            grid[99] = 100; // правый нижний пиксель (красный)

            const imgData = { data: new Uint8ClampedArray(width * height * 4) };
            renderFieldToBuffer(grid, imgData, width, height);

            // Пиксель 0: #4CAF50, alpha 166
            expect(imgData.data[0]).toBe(76);
            expect(imgData.data[1]).toBe(175);
            expect(imgData.data[2]).toBe(80);
            expect(imgData.data[3]).toBe(166);

            // Пиксель 99: #F44336, alpha 166
            const idx99 = 99 * 4;
            expect(imgData.data[idx99]).toBe(244);
            expect(imgData.data[idx99 + 1]).toBe(67);
            expect(imgData.data[idx99 + 2]).toBe(54);
            expect(imgData.data[idx99 + 3]).toBe(166);
        });
    });

    describe('3. Генерация кадра на холсте (renderFieldToCanvas)', () => {
        function createMockCanvas(width = DEFAULT_CANVAS_WIDTH, height = DEFAULT_CANVAS_HEIGHT) {
            const buffer = new Uint8ClampedArray(width * height * 4);
            const mockImgData = { data: buffer, width, height };
            const ctx = {
                createImageData: vi.fn(() => mockImgData),
                putImageData: vi.fn(),
            };
            return {
                width,
                height,
                getContext: vi.fn((type) => (type === '2d' ? ctx : null)),
                toDataURL: vi.fn(() => 'data:image/png;base64,mockImage'),
                _mockCtx: ctx,
                _mockImgData: mockImgData
            };
        }

        it('вызывает createImageData и putImageData с корректными размерами', () => {
            const mockCanvas = createMockCanvas(150, 150);
            const grid = new Float32Array(150 * 150).fill(25);

            const result = renderFieldToCanvas(mockCanvas, grid);

            expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');
            expect(mockCanvas._mockCtx.createImageData).toHaveBeenCalledWith(150, 150);
            expect(mockCanvas._mockCtx.putImageData).toHaveBeenCalledWith(mockCanvas._mockImgData, 0, 0);
            expect(result.toDataUrl()).toBe('data:image/png;base64,mockImage');
        });

        it('интегрируется с idwInterpolator при передаче массива опорных точек и bbox', () => {
            const mockCanvas = createMockCanvas(20, 20);
            const bbox = [86.0, 53.0, 88.0, 54.0];
            const points = [
                { lat: 53.5, lon: 87.0, value: 50 }
            ];

            const result = renderFieldToCanvas(mockCanvas, points, bbox, { width: 20, height: 20 });
            expect(result.width).toBe(20);
            expect(result.height).toBe(20);
            expect(mockCanvas._mockCtx.putImageData).toHaveBeenCalled();
        });
    });

    describe('4. Клиппирование холста по полигонам границ (clipCanvasToPolygons)', () => {
        function createMockClipContext() {
            return {
                save: vi.fn(),
                restore: vi.fn(),
                beginPath: vi.fn(),
                closePath: vi.fn(),
                moveTo: vi.fn(),
                lineTo: vi.fn(),
                fill: vi.fn(),
                globalCompositeOperation: '',
                fillStyle: ''
            };
        }

        it('по умолчанию проецирует широты в Web Mercator для точного совпадения с картой', () => {
            const ctx = createMockClipContext();
            const bbox = [30.0, 50.0, 40.0, 60.0]; // minLon, minLat, maxLon, maxLat
            const width = 100;
            const height = 100;
            // Полигон с точкой посередине долготы и широты
            const midLat = 55.0;
            const polygons = [
                [[30.0, 60.0], [35.0, midLat], [40.0, 50.0], [30.0, 50.0], [30.0, 60.0]]
            ];

            clipCanvasToPolygons(ctx, polygons, bbox, width, height);

            expect(ctx.save).toHaveBeenCalled();
            expect(ctx.beginPath).toHaveBeenCalled();
            expect(ctx.globalCompositeOperation).toBe('destination-in');

            // В Web Mercator Y для 55° между 50° и 60°:
            const minMercY = latToMercator(50.0);
            const maxMercY = latToMercator(60.0);
            const expectedMercY = ((maxMercY - latToMercator(midLat)) / (maxMercY - minMercY)) * height;

            // startX = (30 - 30)/10 * 100 = 0, startY = (maxMercY - maxMercY) = 0
            expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);

            // Точка [35.0, 55.0]: X = 50, Y = expectedMercY
            expect(ctx.lineTo).toHaveBeenCalledWith(50, expectedMercY);
            // При линейном расчёте Y было бы ровно 50. В Меркаторе высокие широты растянуты,
            // поэтому 55° находится дальше от верхнего края (60°): Y > 50 (≈ 53.13)
            expect(expectedMercY).toBeGreaterThan(50);
            expect(expectedMercY).toBeCloseTo(53.13, 1);
        });

        it('при useMercator: false рассчитывает координаты линейно', () => {
            const ctx = createMockClipContext();
            const bbox = [30.0, 50.0, 40.0, 60.0];
            const width = 100;
            const height = 100;
            const polygons = [
                [[30.0, 60.0], [35.0, 55.0], [40.0, 50.0]]
            ];

            clipCanvasToPolygons(ctx, polygons, bbox, width, height, { useMercator: false });

            // Линейно: Y для 55° ровно посередине = 50
            expect(ctx.lineTo).toHaveBeenCalledWith(50, 50);
        });

        it('безопасно завершается при невалидном контексте или пустых полигонах', () => {
            expect(() => clipCanvasToPolygons(null, [], [0, 0, 1, 1], 100, 100)).not.toThrow();
            expect(() => clipCanvasToPolygons({}, null, [0, 0, 1, 1], 100, 100)).not.toThrow();
            expect(() => clipCanvasToPolygons({}, [[]], [0, 0, 1, 1], 100, 100)).not.toThrow();
        });
    });

    describe('5. Фабрика createFieldCanvas', () => {
        it('создаёт холст с дефолтными размерами 150x150', () => {
            const canvas = createFieldCanvas();
            expect(canvas.width).toBe(DEFAULT_CANVAS_WIDTH);
            expect(canvas.height).toBe(DEFAULT_CANVAS_HEIGHT);
        });
    });

    describe('7. Плавный режим чётких зон загрязнения с обводкой без дырок (zoneMode)', () => {
        it('заполняет чистый воздух (AQI <= 20) непрерывным зеленым цветом без дырок (alpha = DEFAULT_ALPHA)', () => {
            const width = 4;
            const height = 4;
            const grid = new Float32Array(width * height);
            grid.fill(15); // чистый воздух

            const imgData = { data: new Uint8ClampedArray(width * height * 4) };
            renderFieldToBuffer(grid, imgData, width, height, { zoneMode: true });

            for (let i = 0; i < width * height; i++) {
                expect(imgData.data[i * 4 + 3]).toBe(DEFAULT_ALPHA);
                expect(imgData.data[i * 4]).toBe(76);
                expect(imgData.data[i * 4 + 1]).toBe(175);
                expect(imgData.data[i * 4 + 2]).toBe(80);
            }
        });

        it('создает плавное сплошное поле без искусственных контуров и яиц', () => {
            const width = 5;
            const height = 5;
            const grid = new Float32Array(width * height);
            grid.fill(15); // чистый воздух
            // Центр 3x3 — загрязнение
            for (let y = 1; y <= 3; y++) {
                for (let x = 1; x <= 3; x++) {
                    grid[y * width + x] = 50;
                }
            }

            const imgData = { data: new Uint8ClampedArray(width * height * 4) };
            renderFieldToBuffer(grid, imgData, width, height, { zoneMode: true });

            // (0, 0) — чистый воздух -> непрерывный цвет, alpha = DEFAULT_ALPHA
            expect(imgData.data[0 * 4 + 3]).toBe(DEFAULT_ALPHA);

            // (1, 1) — край зоны -> ровный базовый alpha без искусственной обводки/яиц
            const edgeIdx = (1 * width + 1) * 4;
            expect(imgData.data[edgeIdx + 3]).toBe(DEFAULT_ALPHA);

            // (2, 2) — внутренняя часть зоны -> базовый alpha
            const innerIdx = (2 * width + 2) * 4;
            expect(imgData.data[innerIdx + 3]).toBe(DEFAULT_ALPHA);
        });

        it('в чистом воздухе (AQI <= 40) отсутствуют искусственные контуры или кольца', () => {
            const width = 4;
            const height = 4;
            const grid = new Float32Array(width * height);
            // Плавный переход вокруг 20 (например, 19.5 и 20.5)
            grid[0] = 19;
            grid[1] = 21;
            grid[2] = 25;
            grid[3] = 30;

            const imgData = { data: new Uint8ClampedArray(width * height * 4) };
            renderFieldToBuffer(grid, imgData, width, height, { zoneMode: true });

            // Все пиксели чистого воздуха имеют стандартную прозрачность DEFAULT_ALPHA (нет колец)
            for (let i = 0; i < 4; i++) {
                expect(imgData.data[i * 4 + 3]).toBe(DEFAULT_ALPHA);
            }
        });

        it('в режиме onlyPollution делает чистый воздух (<= 40) полностью прозрачным', () => {
            const width = 4;
            const height = 4;
            const grid = new Float32Array(width * height);
            grid[0] = 20; // чистый
            grid[1] = 35; // чистый
            grid[2] = 55; // загрязнение (AQI > 40)
            grid[3] = 85; // сильное загрязнение

            const imgData = { data: new Uint8ClampedArray(width * height * 4) };
            renderFieldToBuffer(grid, imgData, width, height, { onlyPollution: true });

            // Чистый воздух (<= 40) -> alpha = 0
            expect(imgData.data[0 * 4 + 3]).toBe(0);
            expect(imgData.data[1 * 4 + 3]).toBe(0);

            // Загрязненные зоны (> 40) -> alpha > 0
            expect(imgData.data[2 * 4 + 3]).toBeGreaterThan(0);
            expect(imgData.data[3 * 4 + 3]).toBeGreaterThan(0);
        });

        it('hasPollutedZones корректно определяет наличие значений > 40', () => {
            const cleanGrid = new Float32Array([10, 20, 30, 40]);
            expect(hasPollutedZones(cleanGrid, 40)).toBe(false);

            const pollutedGrid = new Float32Array([10, 20, 41, 15]);
            expect(hasPollutedZones(pollutedGrid, 40)).toBe(true);

            expect(hasPollutedZones(null)).toBe(false);
        });
    });

    describe('5. renderFieldToBuffer — доп. параметры', () => {
        it('поддерживает явную передачу alpha', () => {
            const imgData = { data: new Uint8ClampedArray(4) };
            renderFieldToBuffer(new Float32Array([50]), imgData, 1, 1, { alpha: 200 });
            expect(imgData.data[3]).toBe(200);
        });

        it('поддерживает явную передачу pollutionThreshold', () => {
            const imgData = { data: new Uint8ClampedArray(4) };
            renderFieldToBuffer(new Float32Array([45]), imgData, 1, 1, { onlyPollution: true, pollutionThreshold: 50 });
            expect(imgData.data[3]).toBe(0);
        });

        it('поддерживает режим colorBlind', () => {
            const imgData = { data: new Uint8ClampedArray(4) };
            renderFieldToBuffer(new Float32Array([50]), imgData, 1, 1, { colorBlind: true });
            expect(imgData.data[3]).toBe(DEFAULT_ALPHA);
        });
    });

    describe('6. clipCanvasToPolygons — граничные случаи', () => {
        const makeCtx = () => ({
            save: vi.fn(), beginPath: vi.fn(), fill: vi.fn(), restore: vi.fn(),
            moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(),
            fillStyle: '', globalCompositeOperation: ''
        });

        it('пропускает полигоны с < 3 точками', () => {
            const ctx = makeCtx();
            clipCanvasToPolygons(ctx, [[ [30, 55], [31, 55] ]], [30, 50, 40, 60], 100, 100);
            expect(ctx.moveTo).not.toHaveBeenCalled();
        });

        it('пропускает null-полигоны', () => {
            const ctx = makeCtx();
            clipCanvasToPolygons(ctx, [null, [ [30, 55], [31, 55], [32, 56] ]], [30, 50, 40, 60], 100, 100);
            expect(ctx.moveTo).toHaveBeenCalledTimes(1);
        });

        it('возвращает при bbox с нулевым span', () => {
            const ctx = makeCtx();
            clipCanvasToPolygons(ctx, [[ [30, 55], [31, 55], [32, 56] ]], [30, 50, 30, 60], 100, 100);
            expect(ctx.save).not.toHaveBeenCalled();
        });

        it('поддерживает useMercator=false', () => {
            const ctx = makeCtx();
            clipCanvasToPolygons(ctx, [[ [30, 55], [35, 56], [40, 55] ]], [30, 50, 40, 60], 100, 100, { useMercator: false });
            expect(ctx.fill).toHaveBeenCalled();
        });

        it('не падает при невалидном ctx', () => {
            expect(() => clipCanvasToPolygons(null, [], [30, 50, 40, 60], 100, 100)).not.toThrow();
        });
    });

    describe('7. createFieldCanvas', () => {
        it('создаёт canvas через document', () => {
            const c = createFieldCanvas(50, 50);
            expect(c.width).toBe(50);
        });

        it('использует значения по умолчанию', () => {
            const c = createFieldCanvas();
            expect(c.width).toBe(DEFAULT_CANVAS_WIDTH);
        });
    });

    describe('8. renderFieldToCanvas — типы входных данных', () => {
        const makeCanvas = (ctx) => ({ width: 2, height: 2, getContext: vi.fn(() => ctx) });
        const makeCtx = () => ({
            createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(16) })),
            putImageData: vi.fn()
        });

        it('принимает Float32Array как grid', () => {
            const grid = new Float32Array([50, 60, 70, 80]);
            const result = renderFieldToCanvas(makeCanvas(makeCtx()), grid, [0, 0, 1, 1], { width: 2, height: 2 });
            expect(result.grid).toBe(grid);
            expect(result.hasPollution).toBe(true);
        });

        it('принимает массив чисел как grid', () => {
            const gridArr = [50, 60, 70, 80];
            const result = renderFieldToCanvas(makeCanvas(makeCtx()), gridArr, [0, 0, 1, 1], { width: 2, height: 2 });
            expect(result.grid).toBe(gridArr);
        });

        it('создаёт пустую сетку для невалидного gridOrPoints', () => {
            const result = renderFieldToCanvas(makeCanvas(makeCtx()), null, [0, 0, 1, 1], { width: 2, height: 2 });
            expect(result.grid).toBeInstanceOf(Float32Array);
            expect(result.grid.length).toBe(4);
        });

        it('принимает opts как второй аргумент', () => {
            const result = renderFieldToCanvas(makeCanvas(makeCtx()), new Float32Array([50, 60, 70, 80]), { width: 2, height: 2 });
            expect(result.width).toBe(2);
        });

        it('возвращает toDataURL при наличии', () => {
            const canvas = makeCanvas(makeCtx());
            canvas.toDataURL = vi.fn(() => 'png-data');
            const result = renderFieldToCanvas(canvas, new Float32Array([50, 60, 70, 80]), [0, 0, 1, 1], { width: 2, height: 2 });
            expect(result.toDataUrl()).toBe('png-data');
        });

        it('возвращает пустую строку без toDataURL', () => {
            const result = renderFieldToCanvas(makeCanvas(makeCtx()), new Float32Array([50, 60, 70, 80]), [0, 0, 1, 1], { width: 2, height: 2 });
            expect(result.toDataUrl()).toBe('');
        });

        it('не падает при null контексте', () => {
            const canvas = { width: 2, height: 2, getContext: vi.fn(() => null) };
            const result = renderFieldToCanvas(canvas, new Float32Array([50, 60, 70, 80]), [0, 0, 1, 1], { width: 2, height: 2 });
            expect(result.canvas).toBe(canvas);
        });

        it('не падает без getContext', () => {
            const canvas = { width: 2, height: 2 };
            const result = renderFieldToCanvas(canvas, new Float32Array([50, 60, 70, 80]), [0, 0, 1, 1], { width: 2, height: 2 });
            expect(result.canvas).toBe(canvas);
        });

        it('применяет maskPolygons', () => {
            const ctx = makeCtx();
            ctx.save = vi.fn(); ctx.beginPath = vi.fn(); ctx.fill = vi.fn(); ctx.restore = vi.fn();
            ctx.moveTo = vi.fn(); ctx.lineTo = vi.fn(); ctx.closePath = vi.fn();
            ctx.fillStyle = ''; ctx.globalCompositeOperation = '';
            renderFieldToCanvas(makeCanvas(ctx), new Float32Array([50, 60, 70, 80]), [0, 0, 1, 1], {
                width: 2, height: 2, maskPolygons: [[[0.1, 0.1], [0.5, 0.5], [0.9, 0.1]]]
            });
            expect(ctx.save).toHaveBeenCalled();
        });
    });
});


