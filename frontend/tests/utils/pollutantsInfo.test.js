// frontend/tests/utils/pollutantsInfo.test.js
import { describe, it, expect } from 'vitest';
import {
    POLLUTANTS_METADATA,
    normalizePollutantKey,
    getPollutantMetadata,
    getPollutantAssessment
} from '../../src/utils/pollutantsInfo';

describe('pollutantsInfo utility', () => {
    it('содержит метаданные для всех 6 основных загрязнителей', () => {
        const expectedKeys = ['pm2_5', 'pm10', 'nitrogen_dioxide', 'sulphur_dioxide', 'ozone', 'carbon_monoxide'];
        expectedKeys.forEach((key) => {
            expect(POLLUTANTS_METADATA[key]).toBeDefined();
            expect(POLLUTANTS_METADATA[key].name).toBeTruthy();
            expect(POLLUTANTS_METADATA[key].formula).toBeTruthy();
            expect(POLLUTANTS_METADATA[key].description).toBeTruthy();
            expect(POLLUTANTS_METADATA[key].sources).toBeTruthy();
            expect(POLLUTANTS_METADATA[key].healthImpact).toBeTruthy();
            expect(POLLUTANTS_METADATA[key].thresholds.length).toBeGreaterThan(0);
        });
    });

    it('нормализует синонимы ключей загрязнителей', () => {
        expect(normalizePollutantKey('no2')).toBe('nitrogen_dioxide');
        expect(normalizePollutantKey('so2')).toBe('sulphur_dioxide');
        expect(normalizePollutantKey('o3')).toBe('ozone');
        expect(normalizePollutantKey('co')).toBe('carbon_monoxide');
        expect(normalizePollutantKey('pm25')).toBe('pm2_5');
        expect(normalizePollutantKey('UNKNOWN')).toBeNull();
    });

    it('getPollutantMetadata возвращает метаданные для известного ключа', () => {
        expect(getPollutantMetadata('no2')).toBe(POLLUTANTS_METADATA.nitrogen_dioxide);
        expect(getPollutantMetadata('nonexistent')).toBeNull();
    });

    it('корректно оценивает статус PM2.5 по уровням', () => {
        // <=10 Отлично
        const exc = getPollutantAssessment('pm2_5', 8);
        expect(exc.label).toBe('Отлично');
        expect(exc.level).toBe('excellent');

        // 11-20 Хорошо
        const good = getPollutantAssessment('pm2_5', 18);
        expect(good.label).toBe('Хорошо');

        // 21-25 Умеренно
        const fair = getPollutantAssessment('pm2_5', 24);
        expect(fair.label).toBe('Умеренно');

        // 26-50 Повышено
        const poor = getPollutantAssessment('pm2_5', 35);
        expect(poor.label).toBe('Повышено');

        // 51-75 Плохо
        const veryPoor = getPollutantAssessment('pm2_5', 60);
        expect(veryPoor.label).toBe('Плохо');

        // >75 Опасно
        const haz = getPollutantAssessment('pm2_5', 120);
        expect(haz.label).toBe('Опасно');
    });

    it('обрабатывает null, undefined и NaN', () => {
        const nullRes = getPollutantAssessment('pm2_5', null);
        expect(nullRes.label).toBe('нет данных');
        expect(nullRes.color).toBe('#9E9E9E');

        const nanRes = getPollutantAssessment('pm2_5', NaN);
        expect(nanRes.label).toBe('нет данных');
    });
});
