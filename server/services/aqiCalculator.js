// это таблицу порогов для каждого загрязнителя
const BREAKPOINTS = {
  pm2_5: [0, 10, 20, 25, 50, 75],
  pm10: [0, 20, 40, 50, 100, 150],
  no2: [0, 40, 90, 120, 230, 340],
  o3: [0, 50, 100, 130, 240, 380],
  so2: [0, 100, 200, 350, 500, 750],
};

// базовая шкала индексов из 5 интервалов: хорошо, приемлемо, умеренно, плохо, очень плохо
const INDEX_SCALE = [0, 20, 40, 60, 80, 100];


function interpolate(c, cLow, cHigh, iLow, iHigh) {
  // защита от ошибки деления на ноль
  if (cHigh === cLow) {
    return iLow;
  }
  // защита границ чтоб значение не выходило за пределы шкалы
  if (c <= cLow) {
    return iLow;
  }
  if (c >= cHigh) {
    return iHigh;
  }

  const index = ((c - cLow) / (cHigh - cLow)) * (iHigh - iLow) + iLow;
  return Math.round(index);
}

// расчёт под-индекса для конкретного загрязнителя
function getSubIndex(c, breakpoints) {
  const num = Number(c);

  // возврщаюа 0 при отрицательных, некорректных или пустых значениях
  if (c === null || c === undefined || isNaN(num) || num <= 0) {
    return 0;
  }

  // поиск подходящего стандартного интервала
  for (let i = 0; i < breakpoints.length - 1; i++) {
    const cLow = breakpoints[i];
    const cHigh = breakpoints[i + 1];
    const iLow = INDEX_SCALE[i];
    const iHigh = INDEX_SCALE[i + 1];

    if (num <= cHigh) {
      return interpolate(num, cLow, cHigh, iLow, iHigh);
    }
  }

  // экстраполяция, если концентрация превысила последний порог и ограничеваем  результатом 150
  const last = breakpoints.length - 1;
  const cLow = breakpoints[last - 1];
  const cHigh = breakpoints[last];
  const iLow = INDEX_SCALE[last - 1];
  const iHigh = INDEX_SCALE[last];

  const extrapolated = ((num - cLow) / (cHigh - cLow)) * (iHigh - iLow) + iLow;
  const rounded = Math.round(extrapolated);

  return Math.min(150, rounded);
}

// общий индекс калькулятора воздуха по 5 загрязнителям
function calculateEAQI(pm25OrObj, pm10, no2, o3, so2) {
  let p25 = 0;
  let p10 = 0;
  let n2 = 0;
  let oz = 0;
  let s2 = 0;

  // приемник данных, чтоб можно было вызывать функцию по разному
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

  // подсчет баллов по каждому загрязнителю
  const subIndices = [
    getSubIndex(p25, BREAKPOINTS.pm2_5),
    getSubIndex(p10, BREAKPOINTS.pm10),
    getSubIndex(n2, BREAKPOINTS.no2),
    getSubIndex(oz, BREAKPOINTS.o3),
    getSubIndex(s2, BREAKPOINTS.so2),
  ];

  // максимально вредный показатель определяет общий индекс кач-ва воздуха, ограниченный 150
  const maxSubIndex = Math.max(0, ...subIndices);

  return Math.min(150, maxSubIndex);
}
//экспортирую функции и константу для других модулей
module.exports = {
  interpolate,
  getSubIndex,
  calculateEAQI,
  BREAKPOINTS,
};
