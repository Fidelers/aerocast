const BREAKPOINTS = {
  pm2_5: [0, 10, 20, 25, 50, 75],
  pm10: [0, 20, 40, 50, 100, 150],
  no2: [0, 40, 90, 120, 230, 340],
  o3: [0, 50, 100, 130, 240, 380],
  so2: [0, 100, 200, 350, 500, 750],
};

// Базовая шкала индексов (EAQI): хорошо, приемлемо, умеренно, плохо, очень плохо
const INDEX_SCALE = [0, 20, 40, 60, 80, 100];


function interpolate(c, cLow, cHigh, iLow, iHigh) {
  if (cHigh === cLow) {
    return iLow;
  }
  if (c <= cLow) {
    return iLow;
  }
  if (c >= cHigh) {
    return iHigh;
  }

  const index = ((c - cLow) / (cHigh - cLow)) * (iHigh - iLow) + iLow;
  return Math.round(index);
}

function getSubIndex(c, breakpoints) {
  const num = Number(c);

  if (c === null || c === undefined || isNaN(num) || num <= 0) {
    return 0;
  }

  for (let i = 0; i < breakpoints.length - 1; i++) {
    const cLow = breakpoints[i];
    const cHigh = breakpoints[i + 1];
    const iLow = INDEX_SCALE[i];
    const iHigh = INDEX_SCALE[i + 1];

    if (num <= cHigh) {
      return interpolate(num, cLow, cHigh, iLow, iHigh);
    }
  }

  // Экстраполяция при превышении максимального порога с ограничением в 150
  const last = breakpoints.length - 1;
  const cLow = breakpoints[last - 1];
  const cHigh = breakpoints[last];
  const iLow = INDEX_SCALE[last - 1];
  const iHigh = INDEX_SCALE[last];

  const extrapolated = ((num - cLow) / (cHigh - cLow)) * (iHigh - iLow) + iLow;
  const rounded = Math.round(extrapolated);

  return Math.min(150, rounded);
}

function calculateEAQI(pm25OrObj, pm10, no2, o3, so2) {
  let p25 = 0;
  let p10 = 0;
  let n2 = 0;
  let oz = 0;
  let s2 = 0;

  if (typeof pm25OrObj === 'object' && pm25OrObj !== null) {
    p25 = pm25OrObj.pm2_5 ?? pm25OrObj.pm25 ?? 0;
    p10 = pm25OrObj.pm10 ?? 0;
    n2 = pm25OrObj.no2 ?? 0;
    oz = pm25OrObj.o3 ?? 0;
    s2 = pm25OrObj.so2 ?? 0;
  } else {
    p25 = pm25OrObj ?? 0;
    p10 = pm10 ?? 0;
    n2 = no2 ?? 0;
    oz = o3 ?? 0;
    s2 = so2 ?? 0;
  }

  const subIndices = [
    getSubIndex(p25, BREAKPOINTS.pm2_5),
    getSubIndex(p10, BREAKPOINTS.pm10),
    getSubIndex(n2, BREAKPOINTS.no2),
    getSubIndex(oz, BREAKPOINTS.o3),
    getSubIndex(s2, BREAKPOINTS.so2),
  ];

  // Наихудший под-индекс определяет итоговый уровень качества воздуха (до 150)
  const maxSubIndex = Math.max(0, ...subIndices);

  return Math.min(150, maxSubIndex);
}

module.exports = {
  interpolate,
  getSubIndex,
  calculateEAQI,
  BREAKPOINTS,
};
