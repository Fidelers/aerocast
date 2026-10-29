// Пространственная интерполяция IDW с поддержкой Web Mercator для макро-сеток

const EPSILON_SQ = 1e-12; // (1e-6)^2 — порог совпадения с точкой
const DEFAULT_P = 2;
const DEFAULT_MIN_VAL = 0;
const DEFAULT_MAX_VAL = 150;

// Прямое преобразование широты в проекцию Web Mercator (EPSG:3857)
export function latToMercator(lat) {
    const latRad = (lat * Math.PI) / 180;
    // Ограничение широт пределами Web Mercator (~85.051129°)
    const clampedLatRad = Math.max(-1.4844, Math.min(1.4844, latRad));
    return Math.log(Math.tan(Math.PI / 4 + clampedLatRad / 2));
}

// Обратное преобразование Y-координаты Меркатора в географическую широту
export function mercatorToLat(mercY) {
    return (2 * Math.atan(Math.exp(mercY)) - Math.PI / 2) * (180 / Math.PI);
}

// Преобразование координат экранного пикселя (px, py) в географические (lat, lon)
export function projectPixelToGeo(px, py, width, height, bbox, useMercator = false) {
    const [minLon, minLat, maxLon, maxLat] = bbox;

    const lonRatio = width > 0 ? px / width : 0;
    const latRatio = height > 0 ? 1 - py / height : 0;

    const lon = minLon + lonRatio * (maxLon - minLon);

    let lat;
    if (useMercator) {
        const minMercY = latToMercator(minLat);
        const maxMercY = latToMercator(maxLat);
        const mercatorY = minMercY + latRatio * (maxMercY - minMercY);
        lat = mercatorToLat(mercatorY);
    } else {
        lat = minLat + latRatio * (maxLat - minLat);
    }

    return { lat, lon };
}

// Извлечение числового значения показателя из объекта точки
function extractPointValue(pt, timeIndex) {
    if (!pt || typeof pt !== 'object') return null;

    if (timeIndex !== null && timeIndex !== undefined && Array.isArray(pt.european_aqi)) {
        const val = pt.european_aqi[timeIndex];
        return typeof val === 'number' && !Number.isNaN(val) ? val : null;
    }

    if (typeof pt.value === 'number' && !Number.isNaN(pt.value)) {
        return pt.value;
    }

    if (Array.isArray(pt.european_aqi) && pt.european_aqi.length > 0) {
        const val = pt.european_aqi[0];
        return typeof val === 'number' && !Number.isNaN(val) ? val : null;
    }

    return null;
}

// Нормализация и фильтрация массива опорных точек
function sanitizePoints(points, timeIndex) {
    if (!Array.isArray(points) || points.length === 0) return [];

    const result = [];
    for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        if (!pt || typeof pt !== 'object') continue;

        const lat = Number(pt.lat);
        const lon = Number(pt.lon);
        if (Number.isNaN(lat) || Number.isNaN(lon)) continue;

        const val = extractPointValue(pt, timeIndex);
        if (val === null) continue;

        result.push({ lat, lon, val });
    }
    return result;
}

// Расчёт значения показателя в точке (lat, lon) по формуле IDW
export function interpolatePoint(lat, lon, points, options = {}) {
    const {
        p = DEFAULT_P,
        maxRadius = Infinity,
        decayRadius = 0,
        bgVal = 20,
        minVal = DEFAULT_MIN_VAL,
        maxVal = DEFAULT_MAX_VAL,
        timeIndex = null,
        useMercator = true
    } = options;

    const validPoints = sanitizePoints(points, timeIndex);
    if (validPoints.length === 0) {
        return null;
    }

    if (validPoints.length === 1 && (!decayRadius || decayRadius <= 0)) {
        return Math.max(minVal, Math.min(maxVal, validPoints[0].val));
    }

    let sumWeightVal = 0;
    let sumWeight = 0;
    let nearestVal = null;
    let minDistanceSq = Infinity;
    const maxRadiusSq = maxRadius * maxRadius;
    const isP2 = p === DEFAULT_P;
    const cosLat = useMercator ? Math.cos((lat * Math.PI) / 180) : 1;

    const bgWeight = (Number.isFinite(decayRadius) && decayRadius > 0) ? 1 / (decayRadius * decayRadius) : 0;

    for (let i = 0; i < validPoints.length; i++) {
        const pt = validPoints[i];
        const dLat = lat - pt.lat;
        const dLon = (lon - pt.lon) * cosLat;
        const distSq = dLat * dLat + dLon * dLon;

        if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
            nearestVal = pt.val;
        }

        // Защита от деления на ноль: пиксель практически совпал с точкой измерения
        if (distSq < EPSILON_SQ) {
            return Math.max(minVal, Math.min(maxVal, pt.val));
        }

        // Ограничение радиуса влияния (cutoff radius)
        if (distSq > maxRadiusSq) {
            continue;
        }

        const weight = isP2 ? 1 / distSq : 1 / Math.pow(distSq, p / 2);
        sumWeightVal += weight * pt.val;
        sumWeight += weight;
    }

    if (bgWeight > 0) {
        sumWeightVal += bgWeight * bgVal;
        sumWeight += bgWeight;
    }

    if (sumWeight === 0) {
        // Все точки оказались за пределами maxRadius — возвращаем значение ближайшей
        return nearestVal !== null ? Math.max(minVal, Math.min(maxVal, nearestVal)) : bgVal;
    }

    const calculated = sumWeightVal / sumWeight;
    return Math.max(minVal, Math.min(maxVal, calculated));
}

// Пакетная интерполяция всей сетки холста (Float32Array) по методу IDW
export function interpolateGrid(points, width, height, bbox, options = {}) {
    const {
        p = DEFAULT_P,
        maxRadius = Infinity,
        decayRadius = 0,
        bgVal = 20,
        minVal = DEFAULT_MIN_VAL,
        maxVal = DEFAULT_MAX_VAL,
        timeIndex = null,
        useMercator = true
    } = options;

    const totalPixels = width * height;
    const grid = new Float32Array(totalPixels);

    const validPoints = sanitizePoints(points, timeIndex);
    if (validPoints.length === 0) {
        return grid;
    }

    // Если точка всего одна и без затухания к фону — мгновенно заполняем весь массив её значением
    if (validPoints.length === 1 && (!decayRadius || decayRadius <= 0)) {
        const clampedSingle = Math.max(minVal, Math.min(maxVal, validPoints[0].val));
        grid.fill(clampedSingle);
        return grid;
    }

    const [minLon, minLat, maxLon, maxLat] = bbox;

    // Предрасчёт долгот по X (сэмплирование строго по центрам пикселей WebGL-текстуры)
    const lons = new Float64Array(width);
    for (let px = 0; px < width; px++) {
        lons[px] = minLon + ((px + 0.5) / width) * (maxLon - minLon);
    }

    // Предрасчёт широт по Y (сэмплирование строго по центрам пикселей WebGL-текстуры)
    const lats = new Float64Array(height);
    if (useMercator) {
        const minMercY = latToMercator(minLat);
        const maxMercY = latToMercator(maxLat);
        const mercDiff = maxMercY - minMercY;
        for (let py = 0; py < height; py++) {
            const mercY = minMercY + (1 - (py + 0.5) / height) * mercDiff;
            lats[py] = mercatorToLat(mercY);
        }
    } else {
        const latDiff = maxLat - minLat;
        for (let py = 0; py < height; py++) {
            lats[py] = minLat + (1 - (py + 0.5) / height) * latDiff;
        }
    }

    const pointsCount = validPoints.length;
    const maxRadiusSq = maxRadius * maxRadius;
    const isP2 = p === DEFAULT_P;
    const hasCutoff = Number.isFinite(maxRadius) && maxRadius > 0;
    const rowPts = hasCutoff ? [] : null;
    const bgWeight = (Number.isFinite(decayRadius) && decayRadius > 0) ? 1 / (decayRadius * decayRadius) : 0;

    // Оптимизированный цикл по всем строкам и колонкам без Math.hypot и Math.sqrt
    for (let py = 0; py < height; py++) {
        const curLat = lats[py];
        const cosLat = useMercator ? Math.cos((curLat * Math.PI) / 180) : 1;
        const rowOffset = py * width;

        let activePoints = validPoints;
        let activeCount = pointsCount;

        if (hasCutoff) {
            rowPts.length = 0;
            for (let i = 0; i < pointsCount; i++) {
                const pt = validPoints[i];
                const dLat = curLat - pt.lat;
                if (dLat >= -maxRadius && dLat <= maxRadius) {
                    rowPts.push(pt);
                }
            }
            activePoints = rowPts;
            activeCount = rowPts.length;
        }

        const maxLonDiff = hasCutoff ? (cosLat > 0.05 ? maxRadius / cosLat : maxRadius * 20) : Infinity;

        for (let px = 0; px < width; px++) {
            const curLon = lons[px];

            let sumWeightVal = 0;
            let sumWeight = 0;
            let nearestVal = null;
            let minDistanceSq = Infinity;
            let exactMatchVal = null;

            for (let i = 0; i < activeCount; i++) {
                const pt = activePoints[i];
                const dLonRaw = curLon - pt.lon;
                if (hasCutoff && (dLonRaw < -maxLonDiff || dLonRaw > maxLonDiff)) {
                    continue;
                }

                const dLat = curLat - pt.lat;
                const dLon = dLonRaw * cosLat;
                const distSq = dLat * dLat + dLon * dLon;

                if (distSq < minDistanceSq) {
                    minDistanceSq = distSq;
                    nearestVal = pt.val;
                }

                if (distSq < EPSILON_SQ) {
                    exactMatchVal = pt.val;
                    break;
                }

                if (distSq > maxRadiusSq) {
                    continue;
                }

                const weight = isP2 ? 1 / distSq : 1 / Math.pow(distSq, p / 2);
                sumWeightVal += weight * pt.val;
                sumWeight += weight;
            }

            let finalValue;
            if (exactMatchVal !== null) {
                finalValue = exactMatchVal;
            } else {
                if (bgWeight > 0) {
                    sumWeightVal += bgWeight * bgVal;
                    sumWeight += bgWeight;
                }
                if (sumWeight === 0) {
                    finalValue = nearestVal !== null ? nearestVal : bgVal;
                } else {
                    finalValue = sumWeightVal / sumWeight;
                }
            }

            if (finalValue < minVal) finalValue = minVal;
            else if (finalValue > maxVal) finalValue = maxVal;

            grid[rowOffset + px] = finalValue;
        }
    }

    return grid;
}
