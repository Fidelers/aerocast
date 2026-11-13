export const AVAILABLE_METRICS = [
  { key: 'aqi', label: 'AQI', unit: 'EAQI', decimals: 0, color: '#3b82f6' },
  { key: 'pm2_5', label: 'PM2.5', unit: 'мкг/м³', decimals: 1, color: '#3b82f6' },
  { key: 'pm10', label: 'PM10', unit: 'мкг/м³', decimals: 1, color: '#10b981' },
  { key: 'nitrogen_dioxide', label: 'NO2', unit: 'мкг/м³', decimals: 1, color: '#f59e0b' },
  { key: 'sulphur_dioxide', label: 'SO2', unit: 'мкг/м³', decimals: 1, color: '#8b5cf6' },
  { key: 'ozone', label: 'O3', unit: 'мкг/м³', decimals: 1, color: '#ec4899' },
  { key: 'carbon_monoxide', label: 'CO', unit: 'мкг/м³', decimals: 1, color: '#6366f1' },
];

export function calculateMetricStats(records = [], metricKey) {
  if (!Array.isArray(records) || records.length === 0 || !metricKey) {
    return { min: null, max: null, avg: null };
  }

  const valid = records
    .map((r) => r?.[metricKey])
    .filter((v) => v !== null && v !== undefined && !Number.isNaN(Number(v)))
    .map((v) => Number(v));

  if (valid.length === 0) {
    return { min: null, max: null, avg: null };
  }

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const avg = valid.reduce((sum, v) => sum + v, 0) / valid.length;

  return { min, max, avg };
}

export function buildExportDataset({
  allRecords = [],
  finalDayData = [],
  customRange = null,
  selectedDateStr = '',
  scope = 'as_configured',
  stepHours = 1,
  metricMode = 'all',
  activeMetricKey = 'aqi',
  selectedMetricKeys = ['aqi', 'pm2_5', 'pm10', 'nitrogen_dioxide', 'sulphur_dioxide', 'ozone', 'carbon_monoxide'],
}) {
  let records = [];

  switch (scope) {
    case 'selection_only': {
      if (customRange && allRecords.length > 0) {
        const start = Math.max(0, Math.min(allRecords.length - 1, customRange.startGlobal));
        const end = Math.max(0, Math.min(allRecords.length - 1, customRange.endGlobal));
        const minIdx = Math.min(start, end);
        const maxIdx = Math.max(start, end);
        records = allRecords.slice(minIdx, maxIdx + 1);
        if (stepHours > 1) {
          records = records.filter((_, i) => i % stepHours === 0);
        }
      } else {
        records = finalDayData;
      }
      break;
    }
    case 'all_raw': {
      records = allRecords.length > 0 ? allRecords : finalDayData;
      break;
    }
    case 'selected_day': {
      if (allRecords.length > 0 && selectedDateStr) {
        const dayRows = allRecords.filter((r) => {
          const t = r.time || '';
          return t.startsWith(selectedDateStr);
        });
        records = dayRows.length > 0 ? dayRows : finalDayData;
      } else {
        records = finalDayData;
      }
      break;
    }
    case 'as_configured':
    default: {
      records = finalDayData.length > 0 ? finalDayData : allRecords;
      break;
    }
  }

  let targetMetricKeys = [];
  if (metricMode === 'active_only') {
    targetMetricKeys = [activeMetricKey || 'aqi'];
  } else if (metricMode === 'custom') {
    targetMetricKeys = Array.isArray(selectedMetricKeys) && selectedMetricKeys.length > 0
      ? selectedMetricKeys
      : ['aqi'];
  } else {
    targetMetricKeys = AVAILABLE_METRICS.map((m) => m.key);
  }

  const activeMetrics = AVAILABLE_METRICS.filter((m) => targetMetricKeys.includes(m.key));

  return {
    records,
    metrics: activeMetrics,
  };
}

export function formatIsoToReadable(isoString) {
  if (!isoString) return '';
  const parts = isoString.split('T');
  if (parts.length === 2) {
    const timePart = parts[1].slice(0, 5);
    return `${parts[0]} ${timePart}`;
  }
  return isoString;
}

export function generateCsv({
  records = [],
  metrics = AVAILABLE_METRICS,
  metadata = {},
  includeStats = true,
  includeMeta = true,
  delimiter = ';',
}) {
  const lines = [];
  const BOM = '\uFEFF';

  if (includeMeta) {
    lines.push(`# Aerocast – Экспорт аналитики качества воздуха`);
    if (metadata.locationName) {
      lines.push(`# Локация: ${metadata.locationName}`);
    }
    if (metadata.lat != null && metadata.lon != null) {
      lines.push(`# Координаты: ${Number(metadata.lat).toFixed(4)}, ${Number(metadata.lon).toFixed(4)}`);
    }
    if (metadata.periodStart && metadata.periodEnd) {
      lines.push(`# Период: ${metadata.periodStart} – ${metadata.periodEnd}`);
    }
    lines.push(`# Количество измерений: ${records.length}`);
    lines.push(`# Дата выгрузки: ${metadata.exportedAt || new Date().toISOString()}`);
    lines.push('');
  }

  const headers = ['Дата и время', ...metrics.map((m) => `"${m.label} (${m.unit})"` )];
  lines.push(headers.join(delimiter));

  records.forEach((row) => {
    const rowCells = [
      `"${formatIsoToReadable(row.time)}"`,
      ...metrics.map((m) => {
        const val = row[m.key];
        if (val === null || val === undefined || Number.isNaN(Number(val))) {
          return '';
        }
        return Number(val).toFixed(m.decimals);
      }),
    ];
    lines.push(rowCells.join(delimiter));
  });

  if (includeStats && records.length > 0) {
    lines.push('');
    lines.push('# Сводная статистика за выбранный период:');

    const minRow = [
      '"Минимум"',
      ...metrics.map((m) => {
        const s = calculateMetricStats(records, m.key);
        return s.min !== null ? s.min.toFixed(m.decimals) : '';
      }),
    ];
    const avgRow = [
      '"Среднее"',
      ...metrics.map((m) => {
        const s = calculateMetricStats(records, m.key);
        return s.avg !== null ? s.avg.toFixed(m.decimals) : '';
      }),
    ];
    const maxRow = [
      '"Максимум"',
      ...metrics.map((m) => {
        const s = calculateMetricStats(records, m.key);
        return s.max !== null ? s.max.toFixed(m.decimals) : '';
      }),
    ];

    lines.push(minRow.join(delimiter));
    lines.push(avgRow.join(delimiter));
    lines.push(maxRow.join(delimiter));
  }

  return BOM + lines.join('\r\n');
}

export function generateJson({
  records = [],
  metrics = AVAILABLE_METRICS,
  metadata = {},
  includeStats = true,
  includeMeta = true,
}) {
  const result = {};

  if (includeMeta) {
    result.metadata = {
      app: 'Aerocast',
      version: '1.0',
      exportedAt: metadata.exportedAt || new Date().toISOString(),
      location: metadata.locationName || null,
      coordinates: (metadata.lat != null && metadata.lon != null)
        ? { lat: Number(metadata.lat), lon: Number(metadata.lon) }
        : null,
      period: {
        start: metadata.periodStart || (records[0]?.time ? formatIsoToReadable(records[0].time) : null),
        end: metadata.periodEnd || (records[records.length - 1]?.time ? formatIsoToReadable(records[records.length - 1].time) : null),
      },
      totalPoints: records.length,
    };
  }

  if (includeStats && records.length > 0) {
    result.statistics = {};
    metrics.forEach((m) => {
      const s = calculateMetricStats(records, m.key);
      result.statistics[m.key] = {
        label: m.label,
        unit: m.unit,
        min: s.min !== null ? Number(s.min.toFixed(m.decimals)) : null,
        avg: s.avg !== null ? Number(s.avg.toFixed(m.decimals)) : null,
        max: s.max !== null ? Number(s.max.toFixed(m.decimals)) : null,
      };
    });
  }

  result.items = records.map((r) => {
    const item = {
      time: r.time,
      formattedTime: formatIsoToReadable(r.time),
    };
    metrics.forEach((m) => {
      const val = r[m.key];
      item[m.key] = (val !== null && val !== undefined && !Number.isNaN(Number(val)))
        ? Number(Number(val).toFixed(m.decimals))
        : null;
    });
    return item;
  });

  return JSON.stringify(result, null, 2);
}

export function formatExportFilename({
  locationName = 'aerocast',
  dateStr = '',
  scope = 'custom',
  ext = 'csv',
}) {
  const safeLocation = (locationName || 'aerocast')
    .replace(/[^\wа-яА-ЯёЁ0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 30);

  const cleanDate = dateStr ? dateStr.replace(/[^\w-]/g, '') : new Date().toISOString().slice(0, 10);
  return `aerocast_analytics_${safeLocation}_${cleanDate}_${scope}.${ext}`;
}

export function downloadBlob(blob, filename) {
  if (typeof window === 'undefined' || !blob) return;

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, 100);
}

export async function copyTextToClipboard(text) {
  if (!text) return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}

export async function renderMultiChartPngBlob(chartItems = [], {
  title = 'Aerocast – Динамика качества воздуха',
  subtitle = '',
  includeStats = true,
  theme = 'light',
} = {}) {
  if (!Array.isArray(chartItems) || chartItems.length === 0) {
    throw new Error('Графики не найдены для экспорта изображения');
  }

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0f172a' : '#ffffff';
  const cardBg = isDark ? '#1e293b' : '#f8fafc';
  const titleColor = isDark ? '#f8fafc' : '#0f172a';
  const subtitleColor = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? '#334155' : '#e2e8f0';

  const width = 860;
  const scale = 2;

  const headerHeight = 75;
  const footerHeight = 35;
  const cardHeaderHeight = 32;
  const chartHeight = chartItems.length === 1 ? 220 : 110;
  const cardPadding = 12;
  const cardGap = 14;

  const totalCardHeight = cardHeaderHeight + chartHeight + (cardPadding * 2);
  const totalHeight = headerHeight + (totalCardHeight + cardGap) * chartItems.length + footerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = totalHeight * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context недоступен');
  }

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width * scale, totalHeight * scale);

  ctx.save();
  ctx.scale(scale, scale);

  ctx.fillStyle = titleColor;
  ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(title, 24, 30);

  if (subtitle) {
    ctx.fillStyle = subtitleColor;
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(subtitle, 24, 52);
  }

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, headerHeight - 12);
  ctx.lineTo(width - 24, headerHeight - 12);
  ctx.stroke();

  ctx.restore();

  const loadedImages = await Promise.all(
    chartItems.map((item) => {
      return new Promise((resolve) => {
        if (!item.svgElement) {
          resolve(null);
          return;
        }

        const cloned = item.svgElement.cloneNode(true);
        const svgWidth = width - 48 - (cardPadding * 2);
        cloned.setAttribute('width', svgWidth);
        cloned.setAttribute('height', chartHeight);

        const xml = new XMLSerializer().serializeToString(cloned);
        const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve({ img, item, svgWidth });
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(null);
        };
        img.src = url;
      });
    })
  );

  let currentY = headerHeight;

  loadedImages.forEach((loaded) => {
    if (!loaded) return;
    const { img, item, svgWidth } = loaded;

    ctx.save();
    ctx.scale(scale, scale);

    const cardX = 24;
    const cardW = width - 48;

    ctx.fillStyle = cardBg;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;

    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(cardX, currentY, cardW, totalCardHeight, 8);
    } else {
      ctx.rect(cardX, currentY, cardW, totalCardHeight);
    }
    ctx.fill();
    ctx.stroke();

    const pillX = cardX + cardPadding;
    const pillY = currentY + cardPadding;

    ctx.fillStyle = item.color || '#3b82f6';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(pillX, pillY + 2, 8, 14, 3);
    } else {
      ctx.rect(pillX, pillY + 2, 8, 14);
    }
    ctx.fill();

    ctx.fillStyle = titleColor;
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`${item.label} (${item.unit})`, pillX + 14, pillY + 14);

    if (includeStats && item.statsText) {
      ctx.fillStyle = subtitleColor;
      ctx.font = '11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(item.statsText, cardX + cardW - cardPadding, pillY + 14);
      ctx.textAlign = 'left';
    }

    ctx.drawImage(img, pillX, pillY + cardHeaderHeight, svgWidth, chartHeight);

    ctx.restore();

    currentY += totalCardHeight + cardGap;
  });

  ctx.save();
  ctx.scale(scale, scale);
  ctx.fillStyle = subtitleColor;
  ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Aerocast • Сводка качества воздуха', 24, totalHeight - 14);
  ctx.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Не удалось сгенерировать PNG изображение'));
    }, 'image/png');
  });
}

export async function renderSvgToPngBlob(svgElement, options = {}) {
  return renderMultiChartPngBlob([
    {
      svgElement,
      label: options.label || 'Качество воздуха',
      unit: options.unit || '',
      color: options.color || '#3b82f6',
      statsText: options.statsText || '',
    },
  ], options);
}
