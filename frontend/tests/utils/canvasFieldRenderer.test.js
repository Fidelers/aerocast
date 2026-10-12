// frontend/tests/utils/canvasFieldRenderer.test.js — TDD тесты попиксельного рендерера Canvas
import { describe, it, expect, vi } from 'vitest';
import {
    interpolateAqiColor,
    renderFieldToBuffer,
    renderFieldToCanvas,
    createFieldCanvas,
    DEFAULT_CANVAS_WIDTH,
    DEFAULT_CANVAS_HEIGHT,
    DEFAULT_ALPHA
} from '../../src/utils/canvasFieldRenderer.js';

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

    describe('4. Фабрика createFieldCanvas', () => {
        it('создаёт холст с дефолтными размерами 150x150', () => {
            const canvas = createFieldCanvas();
            expect(canvas.width).toBe(DEFAULT_CANVAS_WIDTH);
            expect(canvas.height).toBe(DEFAULT_CANVAS_HEIGHT);
        });
    });

    describe('5. Производительность', () => {
        it('заполняет буфер 150x150 (22 500 пикселей) менее чем за 15 мс', () => {
            const size = 150 * 150;
            const grid = new Float32Array(size);
            for (let i = 0; i < size; i++) {
                grid[i] = (i % 120);
            }
            const imgData = { data: new Uint8ClampedArray(size * 4) };

            const start = performance.now();
            renderFieldToBuffer(grid, imgData, 150, 150);
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(15);
        });
    });
});
