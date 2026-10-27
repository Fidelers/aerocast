import React from 'react';
import { getAqiInfo, COLORBLIND_PALETTES } from '../types';
//часы для подписей
const TIME_LABELS = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '23:00'];
const TIME_INDICES = [0, 3, 6, 9, 12, 15, 18, 21, 23];
//порог европейской шкалы EAQI
const EAQI_THRESHOLDS = [
  { val: 20, level: 'excellent' },
  { val: 40, level: 'good' },
  { val: 60, level: 'fair' },
  { val: 80, level: 'poor' },
  { val: 100, level: 'very-poor' },
];

// кривая безье 
function buildBezierPath(points) {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  }

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpx1 = p0.x + (p1.x - p0.x) / 2;
    const cpy1 = p0.y;
    const cpx2 = p0.x + (p1.x - p0.x) / 2;
    const cpy2 = p1.y;
    d += ` C ${cpx1.toFixed(2)} ${cpy1.toFixed(2)}, ${cpx2.toFixed(2)} ${cpy2.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  }
  return d;
}

export default function DynamicsChart({
  mode = 'pollutant',
  data = [],
  valueKey = 'aqi',
  unit = '',
  color = '#3b82f6',
  activeIndex = 0,
  isColorBlind = false,
  colorBlindType = 'okabe',
  height,
}) {
  const chartHeight = height || (mode === 'aqi' ? 220 : 90);
  const width = mode === 'aqi' ? 720 : 320;
//извечение числовых значений показателя из массива данных за день 
    const rawValues = data.map((item) => {
    if (typeof item === 'number') return item;
    if (!item || typeof item !== 'object') return null;
    const v = item[valueKey] !== undefined ? item[valueKey] : (valueKey === 'aqi' ? item.european_aqi : item.value);
    const num = Number(v);
    return v !== null && v !== undefined && !Number.isNaN(num) ? num : null;
  });

  const validValues = rawValues.filter((v) => v !== null);
  let minVal = validValues.length > 0 ? Math.min(...validValues) : 0;
  let maxVal = validValues.length > 0 ? Math.max(...validValues) : 100;
//верхняя граница для главного графика Aqi не менее 100
    if (mode === 'aqi') {
    minVal = Math.min(0, minVal);
    maxVal = Math.max(100, maxVal);
  } else if (minVal === maxVal) {
    maxVal = minVal + 10;
  }

  // симметричный вертикальный отступ 10% сверху и снизу
  const padY = chartHeight * 0.1;
  const usableHeight = chartHeight - padY * 2;
  const valRange = maxVal - minVal || 1;

  // шаг по оси x для 24 точек
  const count = Math.max(data.length, 2);
  const stepX = width / (count - 1);

  const getY = (val) => {
    const safeVal = val !== null ? val : minVal;
    const ratio = (safeVal - minVal) / valRange;
    return chartHeight - padY - ratio * usableHeight;
  };

  // координаты точек графика
  const points = rawValues.map((val, idx) => ({
    x: idx * stepX,
    y: getY(val),
    val,
    idx,
  }));

  // основной цвет линии также и для дальтоников на всякий
  const paletteKey = colorBlindType && COLORBLIND_PALETTES[colorBlindType] ? colorBlindType : 'okabe';
  const palette = COLORBLIND_PALETTES[paletteKey] || COLORBLIND_PALETTES.okabe;

  let strokeColor = color;
  if (isColorBlind) {
    strokeColor = mode === 'aqi' ? palette.good : palette.excellent;
  }

  // геометрия кривой безье и замкнутого полигона для градиента
  const linePath = buildBezierPath(points);
  const areaPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${chartHeight} L ${points[0].x.toFixed(2)} ${chartHeight} Z`
      : '';

  const gradientId = `chart-grad-${mode}-${valueKey}`;
  const safeActiveIdx = activeIndex >= 0 && activeIndex < points.length ? activeIndex : 0;
  const activePoint = points[safeActiveIdx] || null;

  return (
    <div className={`dynamics-chart dynamics-chart--${mode}`} data-colorblind={isColorBlind ? 'true' : 'false'}>
      <svg viewBox={`0 0 ${width} ${chartHeight}`} width="100%" height={chartHeight} role="img" aria-label={`График ${valueKey}`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {mode === 'aqi' && EAQI_THRESHOLDS.map((t) => {
          const yPos = getY(t.val);
          const lineColor = isColorBlind ? palette[t.level] : getAqiInfo(t.val, { colorBlind: false }).hex;
          return (
            <g key={t.val} className="chart-threshold-line">
              <line x1="0" y1={yPos} x2={width} y2={yPos} stroke={lineColor} strokeDasharray="4 4" strokeWidth="1" opacity="0.65" />
              <text x="4" y={yPos - 4} fontSize="10" fill={lineColor}>{t.val}</text>
            </g>
          );
        })}

        {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
        {linePath && <path d={linePath} fill="none" stroke={strokeColor} strokeWidth={mode === 'aqi' ? '2.5' : '2'} />}

        {activePoint && activePoint.val !== null && (
          <g className="chart-active-marker" data-active-hour={safeActiveIdx} aria-current="time">
            <line x1={activePoint.x} y1={0} x2={activePoint.x} y2={chartHeight} stroke={strokeColor} strokeDasharray="3 3" strokeWidth="1" />
            <circle cx={activePoint.x} cy={activePoint.y} r={mode === 'aqi' ? 5 : 4} fill={strokeColor} stroke="#ffffff" strokeWidth="2" />
            <text x={activePoint.x} y={Math.max(12, activePoint.y - 8)} textAnchor="middle" fontSize="11" fontWeight="bold" fill={strokeColor}>
              {activePoint.val} {unit}
            </text>
          </g>
        )}

        {TIME_INDICES.map((hourIdx, idx) => {
          if (hourIdx >= count) return null;
          return (
            <text key={hourIdx} x={hourIdx * stepX} y={chartHeight - 2} textAnchor="middle" fontSize="10" fill="#6b7280">
              {TIME_LABELS[idx]}
            </text>
          );
        })}
      </svg>
    </div>
  );
}