import { interpolateGrid, latToMercator } from './idwInterpolator.js';

export const DEFAULT_CANVAS_WIDTH = 150;
export const DEFAULT_CANVAS_HEIGHT = 150;
export const DEFAULT_ALPHA = 166; // ~65% непрозрачности

// Контрольные точки шкалы EAQI (из types.js)
// Жёлтый сделан доминирующим: плато 40–72 EAQI + расширенные переходы.
const COLOR_STOPS = Object.freeze([
    Object.freeze({ aqi: 0,   r: 76,  g: 175, b: 80  }),  // #4CAF50 отлично
    Object.freeze({ aqi: 30,  r: 76,  g: 175, b: 80  }),  // #4CAF50 граница отлично
    Object.freeze({ aqi: 38,  r: 212, g: 225, b: 87  }),  // #D4E157 жёлто-зелёный
    Object.freeze({ aqi: 42,  r: 255, g: 235, b: 59  }),  // #FFEB3B жёлтый
    Object.freeze({ aqi: 50,  r: 255, g: 235, b: 59  }),  // #FFEB3B жёлтый (плато, 32 ед.)
    Object.freeze({ aqi: 55,  r: 255, g: 152, b: 0   }),  // #FF9800 оранжевый
    Object.freeze({ aqi: 77,  r: 244, g: 67,  b: 54  }),  // #F44336 красный
    Object.freeze({ aqi: 95,  r: 213, g: 0,   b: 0   })   // #D50000 опасно
]);

// Доступные контрольные точки шкалы для людей с цветовой слепотой (палитра Okabe-Ito).
// Совпадают с COLORBLIND_PALETTE в SettingsModal.jsx и CSS-оверрайдами в index.css.
export const COLORBLIND_COLOR_STOPS = Object.freeze([
    Object.freeze({ aqi: 0,   r: 0,   g: 114, b: 178 }),  // #0072B2 синий — отлично
    Object.freeze({ aqi: 30,  r: 0,   g: 114, b: 178 }),  // #0072B2 — граница отлично
    Object.freeze({ aqi: 38,  r: 86,  g: 180, b: 233 }),  // #56B4E9 голубой — хорошо
    Object.freeze({ aqi: 42,  r: 240, g: 228, b: 66  }),  // #F0E442 жёлтый — удовлетворительно
    Object.freeze({ aqi: 50,  r: 240, g: 228, b: 66  }),  // #F0E442 жёлтый (плато, 29 ед.)
    Object.freeze({ aqi: 55,  r: 213, g: 94,  b: 0   }),  // #D55E00 вермильон — очень плохо
    Object.freeze({ aqi: 77,  r: 204, g: 121, b: 167 }),  // #CC79A7 розово-пурпурный
    Object.freeze({ aqi: 95,  r: 123, g: 50,  b: 148 })   // #7B3294 фиолетовый — опасно
]);

// Набор контрольных точек для 4 видов дальтонизма:
// Окабе, Дейтеранопия, Протанопия, Тританопия.
export const COLORBLIND_COLOR_STOPS_MAP = Object.freeze({
    okabe: COLORBLIND_COLOR_STOPS,
    deuteranopia: Object.freeze([
        Object.freeze({ aqi: 0,   r: 30,  g: 136, b: 229 }),  // #1E88E5 синий — отлично
        Object.freeze({ aqi: 30,  r: 30,  g: 136, b: 229 }),  // #1E88E5
        Object.freeze({ aqi: 38,  r: 100, g: 181, b: 246 }),  // #64B5F6 светло-голубой — хорошо
        Object.freeze({ aqi: 42,  r: 255, g: 241, b: 118 }),  // #FFF176 светло-жёлтый — удовлетворительно
        Object.freeze({ aqi: 50,  r: 255, g: 241, b: 118 }),  // #FFF176
        Object.freeze({ aqi: 55,  r: 251, g: 140, b: 0   }),  // #FB8C00 янтарный — плохо
        Object.freeze({ aqi: 77,  r: 142, g: 36,  b: 170 }),  // #8E24AA пурпурный — очень плохо
        Object.freeze({ aqi: 95,  r: 74,  g: 20,  b: 140 })   // #4A148C глубокий тёмно-фиолетовый — опасно
    ]),
    protanopia: Object.freeze([
        Object.freeze({ aqi: 0,   r: 0,   g: 119, b: 187 }),  // #0077BB насыщенный синий — отлично
        Object.freeze({ aqi: 30,  r: 0,   g: 119, b: 187 }),  // #0077BB
        Object.freeze({ aqi: 38,  r: 51,  g: 187, b: 238 }),  // #33BBEE голубой / циан — хорошо
        Object.freeze({ aqi: 42,  r: 238, g: 204, b: 102 }),  // #EECC66 песочно-жёлтый — удовлетворительно
        Object.freeze({ aqi: 50,  r: 238, g: 204, b: 102 }),  // #EECC66
        Object.freeze({ aqi: 55,  r: 238, g: 119, b: 51  }),  // #EE7733 оранжевый — плохо
        Object.freeze({ aqi: 77,  r: 238, g: 51,  b: 119 }),  // #EE3377 малиновый / розовая фуксия — очень плохо
        Object.freeze({ aqi: 95,  r: 51,  g: 34,  b: 136 })   // #332288 темный индиго — опасно
    ]),
    tritanopia: Object.freeze([
        Object.freeze({ aqi: 0,   r: 0,   g: 158, b: 115 }),  // #009E73 изумрудно-зелёный — отлично
        Object.freeze({ aqi: 30,  r: 0,   g: 158, b: 115 }),  // #009E73
        Object.freeze({ aqi: 38,  r: 102, g: 194, b: 165 }),  // #66C2A5 морская волна — хорошо
        Object.freeze({ aqi: 42,  r: 254, g: 224, b: 139 }),  // #FEE08B песочный — удовлетворительно
        Object.freeze({ aqi: 50,  r: 254, g: 224, b: 139 }),  // #FEE08B
        Object.freeze({ aqi: 55,  r: 255, g: 112, b: 67  }),  // #FF7043 коралловый — плохо
        Object.freeze({ aqi: 77,  r: 229, g: 57,  b: 53  }),  // #E53935 ярко-красный — очень плохо
        Object.freeze({ aqi: 95,  r: 136, g: 14,  b: 79  })   // #880E4F тёмно-вишнёвый — опасно
    ])
});

export function interpolateAqiColor(aqi, alpha = DEFAULT_ALPHA, options = {}) {
    if (aqi === null || aqi === undefined || typeof aqi !== 'number' || Number.isNaN(aqi)) {
        return { r: 0, g: 0, b: 0, a: 0 };
    }

    let stops = COLOR_STOPS;
    if (options.colorBlind) {
        const type = options.colorBlindType || 'okabe';
        stops = COLORBLIND_COLOR_STOPS_MAP[type] || COLORBLIND_COLOR_STOPS;
    }

    const first = stops[0];
    const last = stops[stops.length - 1];

    // Ниже первого стопа — возвращаем его цвет (обычно «чистый» зелёный).
    // Порог берём из first.aqi, а не хардкодим 20 — нет разрыва при смене стопов.
    if (aqi <= first.aqi) {
        return { r: first.r, g: first.g, b: first.b, a: alpha };
    }

    if (aqi >= last.aqi) {
        return { r: last.r, g: last.g, b: last.b, a: alpha };
    }

    for (let i = 1; i < stops.length; i++) {
        const prev = stops[i - 1];
        const next = stops[i];

        if (aqi <= next.aqi) {
            const range = next.aqi - prev.aqi;
            const t = range > 0 ? (aqi - prev.aqi) / range : 0;
            const r = Math.round(prev.r + t * (next.r - prev.r));
            const g = Math.round(prev.g + t * (next.g - prev.g));
            const b = Math.round(prev.b + t * (next.b - prev.b));
            return { r, g, b, a: alpha };
        }
    }

    return { r: last.r, g: last.g, b: last.b, a: alpha };
}


export function hasPollutedZones(grid, threshold = 40) {
    if (!grid) return false;
    for (let i = 0; i < grid.length; i++) {
        if (grid[i] > threshold) return true;
    }
    return false;
}


export function renderFieldToBuffer(grid, imgData, width, height, options = {}) {
    const alpha = options.alpha !== undefined ? options.alpha : DEFAULT_ALPHA;
    const onlyPollution = options.onlyPollution === true;
    const pollutionThreshold = options.pollutionThreshold !== undefined ? options.pollutionThreshold : 40;
    const colorBlind = options.colorBlind === true;
    const colorBlindType = options.colorBlindType || 'okabe';
    const colorOpts = { colorBlind, colorBlindType };
    const data = imgData.data;
    const totalPixels = width * height;

    for (let i = 0; i < totalPixels; i++) {
        const val = grid[i];
        const idx = i * 4;

        if (onlyPollution) {
            // В режиме пульсирующего слоя загрязнения:
            // чистый воздух (<= 40) полностью прозрачен,
            // а загрязненные области (41-100+) плавно проявляются
            if (val <= pollutionThreshold) {
                data[idx] = 0;
                data[idx + 1] = 0;
                data[idx + 2] = 0;
                data[idx + 3] = 0;
                continue;
            }
            const baseColor = interpolateAqiColor(val, alpha, colorOpts);
            const fade = Math.min(1, (val - pollutionThreshold) / 6);
            data[idx] = baseColor.r;
            data[idx + 1] = baseColor.g;
            data[idx + 2] = baseColor.b;
            data[idx + 3] = Math.round(alpha * fade);
            continue;
        }

        // Абсолютно гладкое, монолитное и естественное поле без искусственных контуров, яиц и ступеней
        const baseColor = interpolateAqiColor(val, alpha, colorOpts);
        data[idx] = baseColor.r;
        data[idx + 1] = baseColor.g;
        data[idx + 2] = baseColor.b;
        data[idx + 3] = alpha;
    }
}



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


export function clipCanvasToPolygons(ctx, polygons, bbox, width, height, options = {}) {
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

    const useMercator = options?.useMercator !== false;
    const minMercY = useMercator ? latToMercator(minLat) : null;
    const maxMercY = useMercator ? latToMercator(maxLat) : null;
    const mercDiff = useMercator ? maxMercY - minMercY : null;
    const hasValidMerc = useMercator && mercDiff !== null && mercDiff > 0;

    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();

    for (let p = 0; p < polygons.length; p++) {
        const ring = polygons[p];
        if (!ring || ring.length < 3) continue;

        const startX = ((ring[0][0] - minLon) / lonSpan) * width;
        const startY = hasValidMerc
            ? ((maxMercY - latToMercator(ring[0][1])) / mercDiff) * height
            : ((maxLat - ring[0][1]) / latSpan) * height;
        ctx.moveTo(startX, startY);

        for (let i = 1; i < ring.length; i++) {
            const x = ((ring[i][0] - minLon) / lonSpan) * width;
            const y = hasValidMerc
                ? ((maxMercY - latToMercator(ring[i][1])) / mercDiff) * height
                : ((maxLat - ring[i][1]) / latSpan) * height;
            ctx.lineTo(x, y);
        }
        ctx.closePath();
    }

    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.restore();
}

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

    const useMercator = opts.useMercator !== false;
    opts = { ...opts, useMercator };

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
            clipCanvasToPolygons(ctx, opts.maskPolygons, bbox || [0, 0, 1, 1], width, height, opts);
        }
    }

    return {
        canvas,
        width,
        height,
        grid,
        hasPollution: hasPollutedZones(grid, 40),
        toDataUrl: () => (canvas.toDataURL ? canvas.toDataURL('image/png') : '')
    };
}
