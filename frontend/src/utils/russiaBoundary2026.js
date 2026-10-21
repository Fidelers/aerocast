import boundaries from './russiaBoundary2026.json';

const russiaBoundaries = boundaries;
export default russiaBoundaries;

export function isPointInPolygon(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isPointInCoverage(lat, lon, toleranceDeg = 0.1) {
  if (typeof lat !== 'number' || typeof lon !== 'number' || Number.isNaN(lat) || Number.isNaN(lon)) {
    return false;
  }
  // Быстрая фильтрация по широте РФ
  if (lat < 40.5 || lat > 83.0) {
    return false;
  }

  // Поддержка нормализации долготы через меридиан 180 (Чукотка)
  const lons = [lon, lon < 0 ? lon + 360 : lon - 360];

  for (let r = 0; r < boundaries.length; r++) {
    const ring = boundaries[r];
    for (let l = 0; l < lons.length; l++) {
      if (isPointInPolygon(lons[l], lat, ring)) {
        return true;
      }
    }
  }

  // Небольшой допуск (tolerance) для прибрежных портовых зон и эстуариев (~10 км)
  for (let r = 0; r < boundaries.length; r++) {
    const ring = boundaries[r];
    for (let l = 0; l < lons.length; l++) {
      const curLon = lons[l];
      for (let i = 0; i < ring.length; i++) {
        const d = Math.hypot(ring[i][0] - curLon, ring[i][1] - lat);
        if (d <= toleranceDeg) {
          return true;
        }
      }
    }
  }

  return false;
}
