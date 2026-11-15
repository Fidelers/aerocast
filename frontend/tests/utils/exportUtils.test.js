import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateMetricStats,
  buildExportDataset,
  formatIsoToReadable,
  generateCsv,
  generateJson,
  formatExportFilename,
  copyTextToClipboard,
  downloadBlob,
  renderMultiChartPngBlob,
  renderSvgToPngBlob,
  AVAILABLE_METRICS,
} from '../../src/utils/exportUtils';

describe('exportUtils', () => {
  const mockRecords = [
    {
      time: '2026-10-22T00:00',
      aqi: 20,
      pm2_5: 8.0,
      pm10: 15.0,
      nitrogen_dioxide: 10.0,
      sulphur_dioxide: 2.0,
      ozone: 25.0,
      carbon_monoxide: 100.0,
    },
    {
      time: '2026-10-22T01:00',
      aqi: 40,
      pm2_5: 16.0,
      pm10: 30.0,
      nitrogen_dioxide: 20.0,
      sulphur_dioxide: 4.0,
      ozone: 35.0,
      carbon_monoxide: 200.0,
    },
    {
      time: '2026-10-23T00:00',
      aqi: 30,
      pm2_5: 12.0,
      pm10: 22.5,
      nitrogen_dioxide: 15.0,
      sulphur_dioxide: 3.0,
      ozone: 30.0,
      carbon_monoxide: 150.0,
    },
  ];

  describe('calculateMetricStats', () => {
    it('returns min, max, avg for valid numbers', () => {
      const stats = calculateMetricStats(mockRecords, 'aqi');
      expect(stats.min).toBe(20);
      expect(stats.max).toBe(40);
      expect(stats.avg).toBe(30);
    });

    it('handles empty or missing arrays safely', () => {
      expect(calculateMetricStats([], 'aqi')).toEqual({ min: null, max: null, avg: null });
      expect(calculateMetricStats(null, 'aqi')).toEqual({ min: null, max: null, avg: null });
    });
  });

  describe('formatIsoToReadable', () => {
    it('converts ISO string to YYYY-MM-DD HH:mm', () => {
      expect(formatIsoToReadable('2026-10-22T14:30:00Z')).toBe('2026-10-22 14:30');
      expect(formatIsoToReadable('2026-10-22T08:00')).toBe('2026-10-22 08:00');
    });

    it('returns empty string on empty input and returns raw on non-iso input', () => {
      expect(formatIsoToReadable('')).toBe('');
      expect(formatIsoToReadable(null)).toBe('');
      expect(formatIsoToReadable('simple-date')).toBe('simple-date');
    });
  });

  describe('buildExportDataset', () => {
    it('returns as_configured records by default', () => {
      const { records, metrics } = buildExportDataset({
        finalDayData: mockRecords,
        allRecords: mockRecords,
        scope: 'as_configured',
      });
      expect(records).toHaveLength(3);
      expect(metrics).toEqual(AVAILABLE_METRICS);
    });

    it('supports active_only metric mode', () => {
      const { metrics } = buildExportDataset({
        finalDayData: mockRecords,
        scope: 'as_configured',
        metricMode: 'active_only',
        activeMetricKey: 'pm2_5',
      });
      expect(metrics).toHaveLength(1);
      expect(metrics[0].key).toBe('pm2_5');
    });

    it('supports custom metric selection', () => {
      const { metrics } = buildExportDataset({
        finalDayData: mockRecords,
        scope: 'as_configured',
        metricMode: 'custom',
        selectedMetricKeys: ['aqi', 'ozone'],
      });
      expect(metrics.map((m) => m.key)).toEqual(['aqi', 'ozone']);
    });

    it('filters by selected_day', () => {
      const { records } = buildExportDataset({
        finalDayData: mockRecords,
        allRecords: mockRecords,
        selectedDateStr: '2026-10-23',
        scope: 'selected_day',
      });
      expect(records).toHaveLength(1);
      expect(records[0].time).toBe('2026-10-23T00:00');
    });

    it('filters by selection_only when customRange is provided', () => {
      const { records } = buildExportDataset({
        allRecords: mockRecords,
        customRange: { startGlobal: 0, endGlobal: 1 },
        scope: 'selection_only',
      });
      expect(records).toHaveLength(2);
    });
  });

  describe('generateCsv', () => {
    it('generates CSV with UTF-8 BOM, metadata, headers, rows and statistics', () => {
      const csv = generateCsv({
        records: mockRecords,
        metrics: AVAILABLE_METRICS.slice(0, 2),
        metadata: {
          locationName: 'Новокузнецк',
          lat: 53.75,
          lon: 87.14,
          periodStart: '2026-10-22 00:00',
          periodEnd: '2026-10-23 00:00',
        },
        includeStats: true,
        includeMeta: true,
        delimiter: ';',
      });

      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('# Локация: Новокузнецк');
      expect(csv).toContain('# Координаты: 53.7500, 87.1400');
      expect(csv).toContain('Дата и время;"AQI (EAQI)";"PM2.5 (мкг/м³)"');
      expect(csv).toContain('"2026-10-22 00:00";20;8.0');
      expect(csv).toContain('"Минимум";20;8.0');
      expect(csv).toContain('"Среднее";30;12.0');
      expect(csv).toContain('"Максимум";40;16.0');
    });

    it('respects includeMeta=false and includeStats=false', () => {
      const csv = generateCsv({
        records: mockRecords,
        metrics: AVAILABLE_METRICS.slice(0, 1),
        includeStats: false,
        includeMeta: false,
      });

      expect(csv).not.toContain('# Локация:');
      expect(csv).not.toContain('"Минимум"');
      expect(csv).toContain('Дата и время;"AQI (EAQI)"');
    });
  });

  describe('generateJson', () => {
    it('generates structured JSON string', () => {
      const jsonStr = generateJson({
        records: mockRecords,
        metrics: AVAILABLE_METRICS.slice(0, 2),
        metadata: {
          locationName: 'Новокузнецк',
          lat: 53.75,
          lon: 87.14,
        },
        includeStats: true,
        includeMeta: true,
      });

      const parsed = JSON.parse(jsonStr);
      expect(parsed.metadata.app).toBe('Aerocast');
      expect(parsed.metadata.location).toBe('Новокузнецк');
      expect(parsed.metadata.totalPoints).toBe(3);
      expect(parsed.statistics.aqi).toEqual({
        label: 'AQI',
        unit: 'EAQI',
        min: 20,
        avg: 30,
        max: 40,
      });
      expect(parsed.items).toHaveLength(3);
      expect(parsed.items[0].aqi).toBe(20);
      expect(parsed.items[0].pm2_5).toBe(8.0);
    });
  });

  describe('formatExportFilename', () => {
    it('cleans special characters and formats file name', () => {
      const name = formatExportFilename({
        locationName: 'Новокузнецк, Россия',
        dateStr: '2026-10-22',
        scope: 'daily',
        ext: 'csv',
      });
      expect(name).toBe('aerocast_analytics_Новокузнецк_Россия_2026-10-22_daily.csv');
    });
  });

  describe('copyTextToClipboard', () => {
    it('uses navigator.clipboard when available', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      });

      const result = await copyTextToClipboard('test text');
      expect(result).toBe(true);
      expect(writeTextMock).toHaveBeenCalledWith('test text');
    });

    it('returns false on empty text', async () => {
      expect(await copyTextToClipboard('')).toBe(false);
      expect(await copyTextToClipboard(null)).toBe(false);
    });

    it('falls back to execCommand when navigator.clipboard throws', async () => {
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockRejectedValue(new Error('fail')) },
      });
      document.execCommand = vi.fn().mockReturnValue(true);
      const res = await copyTextToClipboard('fallback text');
      expect(res).toBe(true);
      expect(document.execCommand).toHaveBeenCalledWith('copy');
    });

    it('returns false when execCommand also fails', async () => {
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockRejectedValue(new Error('fail')) },
      });
      document.execCommand = vi.fn().mockImplementation(() => { throw new Error('exec failed'); });
      const res = await copyTextToClipboard('fallback text');
      expect(res).toBe(false);
    });
  });

  describe('downloadBlob', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns early when blob is null or undefined', () => {
      expect(() => downloadBlob(null, 'test.csv')).not.toThrow();
    });

    it('creates anchor, appends to body, clicks and cleans up', () => {
      const mockUrl = 'blob:test';
      const createObjectURL = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue(mockUrl);
      const revokeObjectURL = vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
      const clickSpy = vi.fn();
      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        const el = origCreateElement(tag);
        if (tag === 'a') {
          el.click = clickSpy;
        }
        return el;
      });

      const blob = new Blob(['data'], { type: 'text/csv' });
      downloadBlob(blob, 'export.csv');

      expect(createObjectURL).toHaveBeenCalledWith(blob);
      expect(clickSpy).toHaveBeenCalled();

      vi.advanceTimersByTime(150);
      expect(revokeObjectURL).toHaveBeenCalledWith(mockUrl);

      createObjectURL.mockRestore();
      revokeObjectURL.mockRestore();
      vi.restoreAllMocks();
    });
  });

  describe('renderMultiChartPngBlob and renderSvgToPngBlob', () => {
    it('throws error when chartItems is empty', async () => {
      await expect(renderMultiChartPngBlob([])).rejects.toThrow('Графики не найдены');
    });

    it('throws error when 2d context is unavailable', async () => {
      const origGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);
      await expect(renderMultiChartPngBlob([{ svgElement: document.createElementNS('http://www.w3.org/2000/svg', 'svg') }])).rejects.toThrow('Canvas 2D context недоступен');
      HTMLCanvasElement.prototype.getContext = origGetContext;
    });

    it('renders multi-chart png blob with light and dark themes', async () => {
      const mockCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        scale: vi.fn(),
        fillText: vi.fn(),
        fillRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        rect: vi.fn(),
        roundRect: vi.fn(),
        drawImage: vi.fn(),
      };
      const origGetContext = HTMLCanvasElement.prototype.getContext;
      const origToBlob = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx);
      HTMLCanvasElement.prototype.toBlob = vi.fn((cb) => cb(new Blob(['png-data'], { type: 'image/png' })));

      const origImage = global.Image;
      global.Image = class {
        set src(v) {
          setTimeout(() => { if (this.onload) this.onload(); }, 5);
        }
      };

      const svg1 = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const svg2 = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

      const blob1 = await renderMultiChartPngBlob([
        { svgElement: svg1, label: 'AQI', unit: 'EAQI', statsText: 'мин: 10' },
        { svgElement: svg2, label: 'PM2.5', unit: 'мкг/м³', statsText: '' },
      ], { theme: 'dark', subtitle: 'г. Москва' });
      expect(blob1).toBeInstanceOf(Blob);

      delete mockCtx.roundRect;
      const blob2 = await renderMultiChartPngBlob([
        { svgElement: svg1, label: 'AQI', unit: 'EAQI' },
      ], { theme: 'light' });
      expect(blob2).toBeInstanceOf(Blob);

      const svgBlob = await renderSvgToPngBlob(svg1, { label: 'Одиночный график' });
      expect(svgBlob).toBeInstanceOf(Blob);

      HTMLCanvasElement.prototype.toBlob = vi.fn((cb) => cb(null));
      await expect(renderMultiChartPngBlob([{ svgElement: svg1 }])).rejects.toThrow('Не удалось сгенерировать PNG');

      HTMLCanvasElement.prototype.getContext = origGetContext;
      HTMLCanvasElement.prototype.toBlob = origToBlob;
      global.Image = origImage;
    });

    it('handles image error and missing svgElement gracefully', async () => {
      const mockCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        scale: vi.fn(),
        fillText: vi.fn(),
        fillRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        rect: vi.fn(),
        drawImage: vi.fn(),
      };
      const origGetContext = HTMLCanvasElement.prototype.getContext;
      const origToBlob = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx);
      HTMLCanvasElement.prototype.toBlob = vi.fn((cb) => cb(new Blob(['png-data'], { type: 'image/png' })));

      const origImage = global.Image;
      global.Image = class {
        set src(v) {
          setTimeout(() => { if (this.onerror) this.onerror(new Error('img error')); }, 5);
        }
      };

      const svg1 = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const blob = await renderMultiChartPngBlob([
        { svgElement: null, label: 'No SVG' },
        { svgElement: svg1, label: 'Error SVG' },
      ]);
      expect(blob).toBeInstanceOf(Blob);

      HTMLCanvasElement.prototype.getContext = origGetContext;
      HTMLCanvasElement.prototype.toBlob = origToBlob;
      global.Image = origImage;
    });
  });

  describe('buildExportDataset extra branches', () => {
    it('covers all_raw scope with empty allRecords fallback to finalDayData', () => {
      const res = buildExportDataset({
        allRecords: [],
        finalDayData: mockRecords,
        scope: 'all_raw',
      });
      expect(res.records).toHaveLength(3);
    });

    it('covers selection_only scope with reversed range and stepHours > 1', () => {
      const res = buildExportDataset({
        allRecords: mockRecords,
        customRange: { startGlobal: 2, endGlobal: 0 },
        scope: 'selection_only',
        stepHours: 2,
      });
      expect(res.records).toHaveLength(2);
    });

    it('covers selection_only scope with null customRange', () => {
      const res = buildExportDataset({
        allRecords: mockRecords,
        finalDayData: mockRecords,
        customRange: null,
        scope: 'selection_only',
      });
      expect(res.records).toHaveLength(3);
    });

    it('covers selected_day scope with no matching rows or empty allRecords', () => {
      const res = buildExportDataset({
        allRecords: mockRecords,
        finalDayData: mockRecords,
        selectedDateStr: '2020-01-01',
        scope: 'selected_day',
      });
      expect(res.records).toHaveLength(3);

      const resEmpty = buildExportDataset({
        allRecords: [],
        finalDayData: mockRecords,
        selectedDateStr: '2020-01-01',
        scope: 'selected_day',
      });
      expect(resEmpty.records).toHaveLength(3);
    });

    it('covers metricMode active_only with falsy key', () => {
      const res = buildExportDataset({
        finalDayData: mockRecords,
        metricMode: 'active_only',
        activeMetricKey: null,
      });
      expect(res.metrics[0].key).toBe('aqi');
    });

    it('covers metricMode custom with empty array', () => {
      const res = buildExportDataset({
        finalDayData: mockRecords,
        metricMode: 'custom',
        selectedMetricKeys: [],
      });
      expect(res.metrics[0].key).toBe('aqi');
    });

    it('covers formatExportFilename default params', () => {
      const filename = formatExportFilename({});
      expect(filename).toContain('aerocast_analytics_aerocast');
    });

    it('covers CSV and JSON generation with missing/invalid row values', () => {
      const sparseRecords = [
        { time: '2026-10-22T00:00', aqi: null, pm2_5: NaN, pm10: undefined },
      ];
      const csv = generateCsv({
        records: sparseRecords,
        metrics: AVAILABLE_METRICS.slice(0, 3),
        metadata: {},
      });
      expect(csv).toContain('"2026-10-22 00:00";;;');

      const json = generateJson({
        records: sparseRecords,
        metrics: AVAILABLE_METRICS.slice(0, 3),
        metadata: { lat: null, lon: null },
      });
      const parsed = JSON.parse(json);
      expect(parsed.metadata.coordinates).toBeNull();
      expect(parsed.items[0].aqi).toBeNull();
    });
  });
});
