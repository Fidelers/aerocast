// frontend/src/utils/canvasFieldRenderer.js — попиксельный рендерер цветового поля
/**
 * Модуль генерации растрового изображения качества воздуха в буфере Canvas (OffscreenCanvas)
 * на основе интерполированной сетки EAQI и непрерывной RGB-шкалы проекта types.js.
 */

import { interpolateGrid } from './idwInterpolator.js';

export const DEFAULT_CANVAS_WIDTH = 150;
export const DEFAULT_CANVAS_HEIGHT = 150;
export const DEFAULT_ALPHA = 166; // ~65% непрозрачности

// Контрольные точки шкалы EAQI (из types.js)
const COLOR_STOPS = Object.freeze([
    Object.freeze({ aqi: 0, r: 76, g: 175, b: 80 }),     // #4CAF50 отлично
    Object.freeze({ aqi: 20, r: 76, g: 175, b: 80 }),    // #4CAF50 граница отлично
    Object.freeze({ aqi: 40, r: 139, g: 195, b: 74 }),   // #8BC34A хорошо
    Object.freeze({ aqi: 60, r: 255, g: 235, b: 59 }),   // #FFEB3B удовлетворительно
    Object.freeze({ aqi: 80, r: 255, g: 152, b: 0 }),    // #FF9800 плохо
    Object.freeze({ aqi: 100, r: 244, g: 67, b: 54 }),   // #F44336 очень плохо
    Object.freeze({ aqi: 150, r: 213, g: 0, b: 0 })      // #D50000 опасно
]);

/**
 * Преобразует числовое значение AQI в RGBA-цвет с непрерывной линейной RGB-интерполяцией.
 * @param {number|null|undefined} aqi - значение индекса качества воздуха
 * @param {number} [alpha=DEFAULT_ALPHA] - альфа-канал (0..255)
 * @returns {{ r: number, g: number, b: number, a: number }}
 */
export function interpolateAqiColor(aqi, alpha = DEFAULT_ALPHA) {
    if (aqi === null || aqi === undefined || typeof aqi !== 'number' || Number.isNaN(aqi)) {
        return { r: 0, g: 0, b: 0, a: 0 };
    }

    if (aqi <= 20) {
        return { r: 76, g: 175, b: 80, a: alpha };
    }

    if (aqi >= 150) {
        return { r: 213, g: 0, b: 0, a: alpha };
    }

    for (let i = 1; i < COLOR_STOPS.length; i++) {
        const prev = COLOR_STOPS[i - 1];
        const next = COLOR_STOPS[i];

        if (aqi <= next.aqi) {
            const range = next.aqi - prev.aqi;
            const t = range > 0 ? (aqi - prev.aqi) / range : 0;
            const r = Math.round(prev.r + t * (next.r - prev.r));
            const g = Math.round(prev.g + t * (next.g - prev.g));
            const b = Math.round(prev.b + t * (next.b - prev.b));
            return { r, g, b, a: alpha };
        }
    }

    return { r: 213, g: 0, b: 0, a: alpha };
}

/**
 * Заполняет буфер ImageData (Uint8ClampedArray) пикселями на основе массива сетки.
 * @param {Float32Array|Array<number>} grid - одномерный массив значений EAQI (размера width * height)
 * @param {{ data: Uint8ClampedArray }} imgData - объект с буфером пикселей
 * @param {number} width - ширина холста
 * @param {number} height - высота холста
 * @param {Object} [options={}] - параметры (alpha)
 */
export function renderFieldToBuffer(grid, imgData, width, height, options = {}) {
    const alpha = options.alpha !== undefined ? options.alpha : DEFAULT_ALPHA;
    const data = imgData.data;
    const totalPixels = width * height;

    for (let i = 0; i < totalPixels; i++) {
        const val = grid[i];
        const color = interpolateAqiColor(val, alpha);
        const idx = i * 4;
        data[idx] = color.r;
        data[idx + 1] = color.g;
        data[idx + 2] = color.b;
        data[idx + 3] = color.a;
    }
}

/**
 * Создаёт экземпляр холста (OffscreenCanvas либо HTMLCanvasElement) с заданными размерами.
 * @param {number} [width=DEFAULT_CANVAS_WIDTH]
 * @param {number} [height=DEFAULT_CANVAS_HEIGHT]
 * @returns {OffscreenCanvas|HTMLCanvasElement|{width: number, height: number}}
 */
export function createFieldCanvas(width = DEFAULT_CANVAS_WIDTH, height = DEFAULT_CANVAS_HEIGHT) {
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }
    if (typeof OffscreenCanvas !== 'undefined') {
        return new OffscreenCanvas(width, height);
    }
    return { width, height };
}

/**
 * Клиппирует контекст Canvas по набору полигонов (например, государственным границам РФ),
 * делая все пиксели за пределами полигонов абсолютно прозрачными (alpha = 0).
 *
 * @param {CanvasRenderingContext2D} ctx - 2D контекст холста
 * @param {Array<Array<[number, number]>>} polygons - массив колец полигонов [[lon, lat], ...]
 * @param {[number, number, number, number]} bbox - [minLon, minLat, maxLon, maxLat]
 * @param {number} width - ширина холста
 * @param {number} height - высота холста
 */
export function clipCanvasToPolygons(ctx, polygons, bbox, width, height) {
    if (
        !ctx ||
        !polygons ||
        !Array.isArray(polygons) ||
        polygons.length === 0 ||
        !bbox ||
        bbox.length !== 4 ||
        typeof ctx.save !== 'function' ||
        typeof ctx.beginPath !== 'function' ||
        typeof ctx.fill !== 'function' ||
        typeof ctx.restore !== 'function'
    ) {
        return;
    }

    const [minLon, minLat, maxLon, maxLat] = bbox;
    const lonSpan = maxLon - minLon;
    const latSpan = maxLat - minLat;
    if (lonSpan <= 0 || latSpan <= 0) return;

    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();

    for (let p = 0; p < polygons.length; p++) {
        const ring = polygons[p];
        if (!ring || ring.length < 3) continue;

        const startX = ((ring[0][0] - minLon) / lonSpan) * width;
        const startY = ((maxLat - ring[0][1]) / latSpan) * height;
        ctx.moveTo(startX, startY);

        for (let i = 1; i < ring.length; i++) {
            const x = ((ring[i][0] - minLon) / lonSpan) * width;
            const y = ((maxLat - ring[i][1]) / latSpan) * height;
            ctx.lineTo(x, y);
        }
        ctx.closePath();
    }

    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.restore();
}

/**
 * Рендерит цветовое поле в буфер переданного Canvas.
 * Принимает как готовый массив сетки (Float32Array), так и массив опорных точек + BBox.
 *
 * @param {HTMLCanvasElement|OffscreenCanvas|Object} canvas - целевой холст
 * @param {Float32Array|Array<Object>} gridOrPoints - сетка значений либо массив точек
 * @param {Array<number>|Object} [bboxOrOptions={}] - [minLon, minLat, maxLon, maxLat] либо опции
 * @param {Object} [options={}] - дополнительные параметры (width, height, alpha, timeIndex, p, useMercator)
 * @returns {{ canvas: Object, width: number, height: number, grid: Float32Array, toDataUrl: Function }}
 */
export function renderFieldToCanvas(canvas, gridOrPoints, bboxOrOptions = {}, options = {}) {
    let opts = options;
    let bbox = null;

    if (Array.isArray(bboxOrOptions) && bboxOrOptions.length === 4) {
        bbox = bboxOrOptions;
    } else if (typeof bboxOrOptions === 'object' && bboxOrOptions !== null) {
        opts = { ...bboxOrOptions, ...options };
    }

    const width = opts.width || canvas.width || DEFAULT_CANVAS_WIDTH;
    const height = opts.height || canvas.height || DEFAULT_CANVAS_HEIGHT;

    let grid;
    if (gridOrPoints instanceof Float32Array || (Array.isArray(gridOrPoints) && typeof gridOrPoints[0] === 'number')) {
        grid = gridOrPoints;
    } else if (Array.isArray(gridOrPoints)) {
        if (!bbox && opts.bbox) {
            bbox = opts.bbox;
        }
        grid = interpolateGrid(gridOrPoints, width, height, bbox || [0, 0, 1, 1], opts);
    } else {
        grid = new Float32Array(width * height);
    }

    const ctx = canvas.getContext ? canvas.getContext('2d') : null;
    if (ctx) {
        const imgData = ctx.createImageData(width, height);
        renderFieldToBuffer(grid, imgData, width, height, opts);
        ctx.putImageData(imgData, 0, 0);

        if (opts.maskPolygons) {
            clipCanvasToPolygons(ctx, opts.maskPolygons, bbox || [0, 0, 1, 1], width, height);
        }
    }

    return {
        canvas,
        width,
        height,
        grid,
        toDataUrl: () => (canvas.toDataURL ? canvas.toDataURL('image/png') : '')
    };
}
