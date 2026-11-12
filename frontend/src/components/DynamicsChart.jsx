import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getAqiInfo, COLORBLIND_PALETTES } from '../types';

const TIME_LABELS = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '23:00'];
const TIME_INDICES = [0, 3, 6, 9, 12, 15, 18, 21, 23];

const EAQI_THRESHOLDS = [
  { val: 20, level: 'excellent' },
  { val: 40, level: 'good' },
  { val: 60, level: 'fair' },
  { val: 80, level: 'poor' },
  { val: 100, level: 'very-poor' },
];

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

function formatPointTooltip(item, isMultiDay = false) {
  if (!item || typeof item !== 'object') return '';
  const timeStr = item.time || '';
  const rawTime = timeStr ? timeStr.split('T')[1]?.slice(0, 5) : '';
  const hourFmt = rawTime || item.hourLabel || '';
  if (!isMultiDay) {
    return hourFmt;
  }
  const datePart = timeStr ? timeStr.split('T')[0] : '';
  const dParts = datePart ? datePart.split('-') : [];
  const dateFmt = dParts.length === 3 ? `${dParts[2]}.${dParts[1]}` : datePart;
  return dateFmt ? `${dateFmt} ${hourFmt}`.trim() : hourFmt;
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
  onPointClick,
  isAllDays = false,
  enableRangeSelection = false,
  onRangeSelect = null,
  isMain = false,
}) {
  const isMainChart = isMain || (height && height >= 180) || mode === 'aqi';
  const chartHeight = height || (isMainChart ? 220 : 90);
  const defaultWidth = isMainChart ? 720 : 320;

  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(defaultWidth);
  const width = containerWidth || defaultWidth;

  const [dragState, setDragState] = useState(null);
  const isMouseDownRef = useRef(false);
  const dragStartRef = useRef(null);
  const didDragRef = useRef(false);

  const [isHovered, setIsHovered] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    const measure = () => {
      const clientW = el.clientWidth;
      if (clientW && clientW > 100) {
        setContainerWidth(Math.round(clientW));
      }
    };

    measure();

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect?.width;
          if (w && w > 100) {
            setContainerWidth(Math.round(w));
          }
        }
      });
      ro.observe(el);
    } else {
      window.addEventListener('resize', measure);
    }

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

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

  if (mode === 'aqi') {
    minVal = Math.min(0, minVal);
    maxVal = Math.max(100, maxVal);
  } else if (minVal === maxVal) {
    maxVal = minVal + 10;
  }

  const padLeft = isMainChart ? 26 : 10;
  const padRight = isMainChart ? 22 : 10;
  const padTop = isMainChart ? 18 : 8;
  const padBottom = isMainChart ? 22 : 14;

  const usableWidth = width - padLeft - padRight;
  const usableHeight = chartHeight - padTop - padBottom;
  const valRange = maxVal - minVal || 1;

  const count = Math.max(data.length, 2);
  const stepX = usableWidth / (count - 1);

  const getY = (val) => {
    const safeVal = val !== null ? val : minVal;
    const ratio = (safeVal - minVal) / valRange;
    return chartHeight - padBottom - ratio * usableHeight;
  };

  const points = rawValues.map((val, idx) => ({
    x: padLeft + idx * stepX,
    y: getY(val),
    val,
    idx,
  }));

  const paletteKey = colorBlindType && COLORBLIND_PALETTES[colorBlindType] ? colorBlindType : 'okabe';
  const palette = COLORBLIND_PALETTES[paletteKey] || COLORBLIND_PALETTES.okabe;

  let strokeColor = color;
  if (isColorBlind) {
    strokeColor = mode === 'aqi' ? palette.good : palette.excellent;
  }

  const linePath = buildBezierPath(points);
  const areaBottom = chartHeight - padBottom;
  const areaPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${areaBottom} L ${points[0].x.toFixed(2)} ${areaBottom} Z`
      : '';

  const gradientId = `chart-grad-${mode}-${valueKey}-${Math.round(chartHeight)}-${width}`;
  const safeActiveIdx = activeIndex >= 0 && activeIndex < points.length ? activeIndex : 0;
  const activePoint = points[safeActiveIdx] || null;

  const hoveredPoint =
    hoveredIdx !== null && hoveredIdx >= 0 && hoveredIdx < points.length ? points[hoveredIdx] : null;

  const getCoordinatesFromClientX = useCallback(
    (clientX) => {
      if (!svgRef.current) return { svgX: padLeft, idx: 0 };
      const svg = svgRef.current;
      let svgX = null;

      if (typeof svg.getScreenCTM === 'function' && typeof svg.createSVGPoint === 'function') {
        try {
          const ctm = svg.getScreenCTM();
          if (ctm) {
            const pt = svg.createSVGPoint();
            pt.x = clientX;
            pt.y = 0;
            const transformed = pt.matrixTransform(ctm.inverse());
            if (!Number.isNaN(transformed.x)) {
              svgX = transformed.x;
            }
          }
        } catch {
          // fallback to getBoundingClientRect
        }
      }

      if (svgX === null) {
        const rect = svg.getBoundingClientRect();
        const clampedClientX = Math.max(rect.left, Math.min(rect.right, clientX));
        const relX = clampedClientX - rect.left;
        svgX = (relX / (rect.width || 1)) * width;
      }

      const clampedSvgX = Math.max(padLeft, Math.min(width - padRight, svgX));
      const rawIdx = Math.round((clampedSvgX - padLeft) / (stepX || 1));
      const idx = Math.max(0, Math.min(data.length - 1, rawIdx));
      return { svgX: clampedSvgX, idx };
    },
    [width, stepX, padLeft, padRight, data.length]
  );

  const handleMouseDown = (e) => {
    if (e.button !== 0 || !enableRangeSelection || data.length < 2) return;
    const { svgX, idx } = getCoordinatesFromClientX(e.clientX);
    isMouseDownRef.current = true;
    didDragRef.current = false;
    dragStartRef.current = { startX: svgX, startIdx: idx, clientX: e.clientX };
    setDragState({
      startX: svgX,
      currentX: svgX,
      startIdx: idx,
      currentIdx: idx,
      isDragging: false,
    });
  };

  useEffect(() => {
    if (!enableRangeSelection) return;

    const handleWindowMouseMove = (e) => {
      if (!isMouseDownRef.current || !dragStartRef.current) return;
      const diffPixels = Math.abs(e.clientX - dragStartRef.current.clientX);
      const { svgX, idx } = getCoordinatesFromClientX(e.clientX);

      if (diffPixels > 4) {
        didDragRef.current = true;
        setDragState({
          startX: dragStartRef.current.startX,
          currentX: svgX,
          startIdx: dragStartRef.current.startIdx,
          currentIdx: idx,
          isDragging: true,
        });
      }
    };

    const handleWindowMouseUp = (e) => {
      if (!isMouseDownRef.current || !dragStartRef.current) return;
      const { startIdx, clientX } = dragStartRef.current;
      const { idx } = getCoordinatesFromClientX(e.clientX);
      const diffPixels = Math.abs(e.clientX - clientX);

      isMouseDownRef.current = false;
      dragStartRef.current = null;
      setDragState(null);

      if (diffPixels > 4 && Math.abs(startIdx - idx) >= 1) {
        const fromIdx = Math.min(startIdx, idx);
        const toIdx = Math.max(startIdx, idx);
        onRangeSelect?.(fromIdx, toIdx);
        setTimeout(() => {
          didDragRef.current = false;
        }, 80);
      } else {
        didDragRef.current = false;
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [enableRangeSelection, getCoordinatesFromClientX, onRangeSelect]);

  const handleInteraction = (idx) => {
    if (didDragRef.current) return;
    if (onPointClick && idx >= 0 && idx < data.length) {
      onPointClick(idx);
    }
  };

  const handleSvgMouseEnter = () => {
    setIsHovered(true);
  };

  const handleSvgMouseLeave = () => {
    setIsHovered(false);
    setHoveredIdx(null);
  };

  const handleSvgMouseMove = (e) => {
    if (!isMouseDownRef.current && onPointClick) {
      const { idx } = getCoordinatesFromClientX(e.clientX);
      setHoveredIdx(idx);
    }
  };

  const isMultiDay =
    isAllDays ||
    (data.length > 0 &&
      (() => {
        const firstDate = data[0]?.time ? data[0].time.split('T')[0] : null;
        const lastDate = data[data.length - 1]?.time ? data[data.length - 1].time.split('T')[0] : null;
        return Boolean(firstDate && lastDate && firstDate !== lastDate);
      })());

  const dayTicks = [];
  let currentDayStr = null;
  data.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const timeStr = item.time || '';
    const dateStr = timeStr.split('T')[0];
    if (dateStr && dateStr !== currentDayStr) {
      currentDayStr = dateStr;
      const parts = dateStr.split('-');
      const label = parts.length === 3 ? `${parts[2]}.${parts[1]}` : dateStr;
      dayTicks.push({
        idx,
        x: padLeft + idx * stepX,
        label,
        dateStr,
      });
    }
  });

  const renderAxisLabels = () => {
    if (isMultiDay && dayTicks.length > 1) {
      let visibleDays = dayTicks;
      if (width < 500 && dayTicks.length > 6) {
        const step = Math.ceil(dayTicks.length / 5);
        visibleDays = dayTicks.filter((_, i) => i % step === 0 || i === dayTicks.length - 1);
      } else if (dayTicks.length > 14) {
        visibleDays = dayTicks.filter((_, i) => i % 2 === 0 || i === dayTicks.length - 1);
      }

      return (
        <g className="chart-axis-labels">
          {visibleDays.map((day, dIdx) => {
            let anchor = 'middle';
            let renderX = day.x;
            if (day.x < padLeft + 16) {
              anchor = 'start';
              renderX = Math.max(padLeft, day.x);
            } else if (day.x > width - padRight - 16) {
              anchor = 'end';
              renderX = Math.min(width - padRight, day.x);
            }

            return (
              <g key={`day-tick-${day.dateStr}-${dIdx}`}>
                {day.idx > 0 && (
                  <line
                    x1={day.x}
                    y1={padTop}
                    x2={day.x}
                    y2={chartHeight - padBottom}
                    stroke="currentColor"
                    strokeOpacity="0.12"
                    strokeDasharray="3 3"
                  />
                )}
                <text
                  x={renderX}
                  y={chartHeight - 4}
                  textAnchor={anchor}
                  fontSize={width < 500 ? '9' : '10'}
                  fill="#9ca3af"
                  fontWeight="500"
                >
                  {day.label}
                </text>
              </g>
            );
          })}
        </g>
      );
    }

    if (!isAllDays && data.length === 24) {
      return (
        <g className="chart-axis-labels">
          {TIME_INDICES.map((hourIdx, idx) => {
            if (hourIdx >= count) return null;
            const x = padLeft + hourIdx * stepX;
            return (
              <text
                key={hourIdx}
                x={x}
                y={chartHeight - 4}
                textAnchor="middle"
                fontSize="10"
                fill="#9ca3af"
              >
                {TIME_LABELS[idx]}
              </text>
            );
          })}
        </g>
      );
    }

    const labelStep = Math.max(1, Math.ceil(data.length / 8));
    return (
      <g className="chart-axis-labels">
        {data.map((item, idx) => {
          if (idx % labelStep !== 0 && idx !== data.length - 1) return null;
          const x = padLeft + idx * stepX;
          const timeLabel = item?.hourLabel || (item?.time ? item.time.split('T')[1]?.slice(0, 5) : '') || `${idx}:00`;
          let anchor = 'middle';
          let renderX = x;
          if (x < padLeft + 16) {
            anchor = 'start';
            renderX = padLeft;
          } else if (x > width - padRight - 16) {
            anchor = 'end';
            renderX = width - padRight;
          }

          return (
            <text
              key={`hour-tick-${idx}`}
              x={renderX}
              y={chartHeight - 4}
              textAnchor={anchor}
              fontSize="10"
              fill="#9ca3af"
            >
              {timeLabel}
            </text>
          );
        })}
      </g>
    );
  };

  const selectionBox =
    dragState && dragState.isDragging
      ? {
          left: Math.max(padLeft, Math.min(dragState.startX, dragState.currentX)),
          right: Math.min(width - padRight, Math.max(dragState.startX, dragState.currentX)),
          fromIdx: Math.min(dragState.startIdx, dragState.currentIdx),
          toIdx: Math.max(dragState.startIdx, dragState.currentIdx),
        }
      : null;

  return (
    <div
      ref={containerRef}
      className={`dynamics-chart dynamics-chart--${mode}`}
      data-colorblind={isColorBlind ? 'true' : 'false'}
      style={{ userSelect: 'none', position: 'relative', width: '100%' }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${chartHeight}`}
        width="100%"
        height={chartHeight}
        preserveAspectRatio="none"
        role="img"
        aria-label={`График ${valueKey}`}
        style={{ cursor: enableRangeSelection ? 'crosshair' : 'default', display: 'block' }}
        onMouseDown={handleMouseDown}
        onMouseEnter={handleSvgMouseEnter}
        onMouseLeave={handleSvgMouseLeave}
        onMouseMove={handleSvgMouseMove}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.38" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {mode === 'aqi' &&
          EAQI_THRESHOLDS.map((t) => {
            const yPos = getY(t.val);
            const lineColor = isColorBlind ? palette[t.level] : getAqiInfo(t.val, { colorBlind: false }).hex;
            return (
              <g key={t.val} className="chart-threshold-line">
                <line
                  x1={padLeft}
                  y1={yPos}
                  x2={width - padRight}
                  y2={yPos}
                  stroke={lineColor}
                  strokeDasharray="4 4"
                  strokeWidth="1"
                  opacity="0.6"
                />
                <text x="4" y={yPos + 3} fontSize="10" fill={lineColor} fontWeight="600">
                  {t.val}
                </text>
              </g>
            );
          })}

        {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}

        {/* Сетка направляющих линий и маркеров точек при наведении мыши (показывает, на какие точки можно нажать) */}
        {isHovered && onPointClick && (
          <g className="chart-hover-grid" pointerEvents="none" data-testid="chart-hover-grid">
            {points.map((p, pIdx) => {
              const isPHovered = p.idx === hoveredIdx;
              return (
                <g key={`grid-col-${pIdx}`}>
                  <line
                    x1={p.x}
                    y1={padTop}
                    x2={p.x}
                    y2={chartHeight - padBottom}
                    stroke={isPHovered ? strokeColor : 'currentColor'}
                    strokeOpacity={isPHovered ? 0.65 : 0.16}
                    strokeDasharray={isPHovered ? '3 2' : '2 3'}
                    strokeWidth={isPHovered ? 1.5 : 1}
                  />
                  {p.val !== null && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isPHovered ? 4.5 : 2.5}
                      fill={isPHovered ? strokeColor : 'currentColor'}
                      fillOpacity={isPHovered ? 1 : 0.4}
                      stroke={isPHovered ? '#ffffff' : 'none'}
                      strokeWidth={isPHovered ? 1.5 : 0}
                    />
                  )}
                </g>
              );
            })}
          </g>
        )}

        {linePath && <path d={linePath} fill="none" stroke={strokeColor} strokeWidth={isMainChart ? '2.5' : '2'} />}

        {activePoint && activePoint.val !== null && (
          <g
            className="chart-active-marker"
            data-active-hour={data[safeActiveIdx]?.hourIndex ?? safeActiveIdx}
            aria-current="time"
          >
            <line
              x1={activePoint.x}
              y1={padTop}
              x2={activePoint.x}
              y2={chartHeight - padBottom}
              stroke={strokeColor}
              strokeDasharray="3 3"
              strokeWidth="1.2"
            />
            <circle cx={activePoint.x} cy={activePoint.y} r={isMainChart ? 5 : 4} fill={strokeColor} stroke="#ffffff" strokeWidth="2" />
            <text
              x={Math.max(padLeft + 20, Math.min(width - padRight - 20, activePoint.x))}
              y={Math.max(padTop - 2, activePoint.y - 8)}
              textAnchor="middle"
              fontSize="11"
              fontWeight="bold"
              fill={strokeColor}
            >
              {activePoint.val} {unit}
            </text>
          </g>
        )}

        {/* Маркер и всплывающая подсказка над текущей точкой под курсором мыши */}
        {isHovered && onPointClick && hoveredPoint && hoveredPoint.val !== null && !dragState?.isDragging && (
          <g className="chart-hover-marker" pointerEvents="none" data-testid="chart-hover-marker">
            {(() => {
              const item = data[hoveredPoint.idx ?? hoveredIdx];
              const timeText = formatPointTooltip(item, isMultiDay);
              const valText = `${hoveredPoint.val} ${unit}`.trim();
              const tooltipText = `${timeText}: ${valText}`;
              const badgeX = Math.max(padLeft + 48, Math.min(width - padRight - 48, hoveredPoint.x));
              const badgeY = Math.max(padTop + 14, Math.min(chartHeight - padBottom - 18, hoveredPoint.y - 12));

              return (
                <g transform={`translate(${badgeX}, ${badgeY})`}>
                  <rect
                    x="-48"
                    y="-11"
                    width="96"
                    height="20"
                    rx="4"
                    fill="rgba(15, 23, 42, 0.9)"
                    stroke={strokeColor}
                    strokeWidth="1.2"
                  />
                  <text
                    textAnchor="middle"
                    y="3.5"
                    fontSize="10"
                    fontWeight="600"
                    fill="#ffffff"
                  >
                    {tooltipText}
                  </text>
                </g>
              );
            })()}
          </g>
        )}

        {renderAxisLabels()}

        {selectionBox && (
          <g className="chart-selection-box" pointerEvents="none">
            <rect
              x={selectionBox.left}
              y={padTop}
              width={Math.max(1, selectionBox.right - selectionBox.left)}
              height={usableHeight}
              fill="rgba(59, 130, 246, 0.2)"
              stroke="rgba(59, 130, 246, 0.5)"
              strokeWidth="1"
              strokeDasharray="4 2"
            />
            <line
              x1={selectionBox.left}
              y1={padTop}
              x2={selectionBox.left}
              y2={chartHeight - padBottom}
              stroke="#60a5fa"
              strokeWidth="2.5"
            />
            <line
              x1={selectionBox.right}
              y1={padTop}
              x2={selectionBox.right}
              y2={chartHeight - padBottom}
              stroke="#60a5fa"
              strokeWidth="2.5"
            />
            {(() => {
              const startT = formatPointTooltip(data[selectionBox.fromIdx], isMultiDay);
              const endT = formatPointTooltip(data[selectionBox.toIdx], isMultiDay);
              const rangeText = `${startT} — ${endT}`;
              const midX = (selectionBox.left + selectionBox.right) / 2;
              const badgeX = Math.max(75, Math.min(width - 75, midX));
              return (
                <g transform={`translate(${badgeX}, ${padTop + 20})`}>
                  <rect
                    x="-70"
                    y="-13"
                    width="140"
                    height="24"
                    rx="6"
                    fill="#1e293b"
                    stroke="#60a5fa"
                    strokeWidth="1.5"
                  />
                  <text
                    textAnchor="middle"
                    y="3"
                    fontSize="11"
                    fontWeight="600"
                    fill="#ffffff"
                  >
                    {rangeText}
                  </text>
                </g>
              );
            })()}
          </g>
        )}

        {onPointClick &&
          points.map((point, idx) => {
            const rectWidth = stepX;
            const rectX = point.x - rectWidth / 2;
            const timeLabel = point.idx !== undefined ? data[point.idx]?.hourLabel || `Точка ${idx}` : `Точка ${idx}`;

            return (
              <rect
                key={`interactive-${idx}`}
                x={Math.max(0, rectX)}
                y={0}
                width={rectWidth}
                height={chartHeight}
                fill="transparent"
                style={{ cursor: enableRangeSelection ? 'crosshair' : 'pointer', outline: 'none' }}
                role="button"
                tabIndex={0}
                aria-label={`Выбрать время: ${timeLabel}, значение: ${point.val ?? 'нет данных'} ${unit}`}
                onClick={() => handleInteraction(point.idx ?? idx)}
                onMouseEnter={() => setHoveredIdx(point.idx ?? idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleInteraction(point.idx ?? idx);
                  }
                }}
              />
            );
          })}
      </svg>
    </div>
  );
}
