import { describe, it, expect } from 'vitest';
import {
  computeAllDaysSummary,
  computeForecast3Days,
  computeAirHistory,
  formatSelectedTimeInfo,
  isForecastTime
} from '../../src/utils/timeUtils';

describe('timeUtilsCoverage', () => {
  it('покрывает все статусы качества воздуха в getStatus внутри computeAllDaysSummary', () => {
    const hourly = {
      time: [
        '2026-10-21T12:00',
        '2026-10-22T12:00',
        '2026-10-23T12:00',
        '2026-10-24T12:00'
      ],
      european_aqi: [50, 70, 90, 120],
      pm2_5: [15, 25, 45, 80],
      pm10: [20, 40, 70, 110]
    };

    const result = computeAllDaysSummary(hourly, new Date('2026-10-22T12:00'));
    expect(result).toBeDefined();
    expect(result.days).toHaveLength(4);
    expect(result.days[0].status).toBe('Удовлетворительно');
    expect(result.days[1].status).toBe('Плохо');
    expect(result.days[2].status).toBe('Очень плохо');
    expect(result.days[3].status).toBe('Опасно');
    expect(result.overallMaxAqi.label).toBeDefined();
    expect(result.overallMinAqi.label).toBeDefined();
  });

  it('возвращает null если allDates.length === 0 в computeAllDaysSummary', () => {
    const hourly = {
      time: [
        'invalid-timestamp-string'
      ],
      european_aqi: [10]
    };

    const result = computeAllDaysSummary(hourly, new Date('2026-10-22T12:00'));
    expect(result).toBeNull();
  });

  it('покрывает все статусы в computeForecast3Days и пустые даты', () => {
    const hourly = {
      time: [
        'invalid-time',
        '2026-10-23T12:00',
        '2026-10-24T12:00',
        '2026-10-25T12:00'
      ],
      european_aqi: [10, 70, 90, 120],
      pm2_5: [5, 30, 50, 90],
      pm10: [8, 40, 70, 120]
    };

    const result = computeForecast3Days(hourly, new Date('2026-10-23T10:00'));
    expect(result).toBeDefined();
    expect(result.days[0].status).toBe('Плохо');
    expect(result.days[1].status).toBe('Очень плохо');
    expect(result.days[2].status).toBe('Опасно');

    expect(computeForecast3Days({ time: ['invalid-time'] }, new Date())).toBeNull();
  });

  it('покрывает все статусы и невалидные строки в computeAirHistory', () => {
    const hourly = {
      time: [
        'invalid-time',
        '2026-10-19T12:00',
        '2026-10-20T12:00',
        '2026-10-21T12:00',
        '2026-10-22T12:00'
      ],
      european_aqi: [10, 50, 70, 90, 120],
      pm2_5: [5, 20, 30, 50, 90],
      pm10: [8, 30, 40, 70, 120]
    };

    const result = computeAirHistory(hourly, new Date('2026-10-23T12:00'));
    expect(result).toBeDefined();
    expect(result.pastDays[0].status).toBe('Удовлетворительно');
    expect(result.pastDays[1].status).toBe('Плохо');
    expect(result.pastDays[2].status).toBe('Очень плохо');
    expect(result.pastDays[3].status).toBe('Опасно');
  });

  it('покрывает граничные случаи в formatSelectedTimeInfo и isForecastTime', () => {
    expect(formatSelectedTimeInfo('invalid')).toBeNull();

    const info1 = formatSelectedTimeInfo('2026-10-23T18:00', '2026-10-23T10:00');
    expect(info1.kind).toBe('forecast');
    expect(info1.kindLabel).toBe('прогноз на более поздние часы сегодня');

    expect(isForecastTime('2026-10-23T18:00', '2026-10-23')).toBe(true);
    expect(isForecastTime('2026-10-23T18:00', 'invalid-ref')).toBe(false);
  });
});
