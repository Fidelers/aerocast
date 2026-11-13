import { describe, it, expect, vi } from 'vitest';
import {
  calculateMetricStats,
  buildExportDataset,
  formatIsoToReadable,
  generateCsv,
  generateJson,
  formatExportFilename,
  copyTextToClipboard,
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

    it('returns empty string on empty input', () => {
      expect(formatIsoToReadable('')).toBe('');
      expect(formatIsoToReadable(null)).toBe('');
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
  });
});
