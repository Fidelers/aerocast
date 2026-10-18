// frontend/tests/utils/pollutantsInfo.test.js
import { describe, it, expect } from 'vitest';
import {
    POLLUTANTS_METADATA,
    normalizePollutantKey,
    getPollutantMetadata,
    getPollutantAssessment,
    getAqiRecommendation
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

    it('в режиме дальтоника (colorBlind: true) возвращает цвета палитры Okabe-Ito', () => {
        const opts = { colorBlind: true };
        expect(getPollutantAssessment('pm2_5', 8, opts).color).toBe('#0072B2');   // Отлично
        expect(getPollutantAssessment('pm2_5', 18, opts).color).toBe('#56B4E9');  // Хорошо
        expect(getPollutantAssessment('pm2_5', 24, opts).color).toBe('#F0E442');  // Умеренно
        expect(getPollutantAssessment('pm2_5', 35, opts).color).toBe('#E69F00');  // Повышено
        expect(getPollutantAssessment('pm2_5', 60, opts).color).toBe('#D55E00');  // Плохо
        expect(getPollutantAssessment('pm2_5', 120, opts).color).toBe('#7B3294'); // Опасно
    });

    it('в режиме дальтоника label и level остаются прежними', () => {
        const res = getPollutantAssessment('pm2_5', 18, { colorBlind: true });
        expect(res.label).toBe('Хорошо');
        expect(res.level).toBe('good');
    });

    it('без опции colorBlind (или при false) возвращает стандартные цвета', () => {
        expect(getPollutantAssessment('pm2_5', 8).color).toBe('#4CAF50');
        expect(getPollutantAssessment('pm2_5', 8, { colorBlind: false }).color).toBe('#4CAF50');
    });

    it('в режиме дальтоника «нет данных» остается нейтрально-серым', () => {
        expect(getPollutantAssessment('pm2_5', null, { colorBlind: true }).color).toBe('#9E9E9E');
    });
});

describe('getAqiRecommendation', () => {
    it('возвращает «отлично» для AQI <= 20', () => {
        expect(getAqiRecommendation(0)).toBe('отлично');
        expect(getAqiRecommendation(20)).toBe('отлично');
    });

    it('возвращает «хорошо» для AQI 21-40', () => {
        expect(getAqiRecommendation(35)).toBe('хорошо');
    });

    it('возвращает «удовлетворительно» для AQI 41-60', () => {
        expect(getAqiRecommendation(50)).toBe('удовлетворительно');
    });

    it('возвращает «плохо» для AQI 61-80', () => {
        expect(getAqiRecommendation(75)).toBe('плохо');
    });

    it('возвращает «очень плохо» для AQI 81-100', () => {
        expect(getAqiRecommendation(90)).toBe('очень плохо');
    });

    it('возвращает «опасно» для AQI > 100', () => {
        expect(getAqiRecommendation(150)).toBe('опасно');
    });

    it('возвращает «нет данных» для null, undefined, NaN и отрицательных', () => {
        expect(getAqiRecommendation(null)).toBe('нет данных');
        expect(getAqiRecommendation(undefined)).toBe('нет данных');
        expect(getAqiRecommendation(NaN)).toBe('нет данных');
        expect(getAqiRecommendation(-5)).toBe('нет данных');
    });

    it('приводит строковые числа к числу', () => {
        expect(getAqiRecommendation('35')).toBe('хорошо');
        expect(getAqiRecommendation('abc')).toBe('нет данных');
    });
});

describe('pollutantsInfo — дополнительные граничные случаи', () => {
    it('normalizePollutantKey возвращает null для невалидных типов', () => {
        expect(normalizePollutantKey(null)).toBeNull();
        expect(normalizePollutantKey(undefined)).toBeNull();
        expect(normalizePollutantKey(123)).toBeNull();
        expect(normalizePollutantKey({})).toBeNull();
    });

    it('normalizePollutantKey обрабатывает синонимы с точками и подчёркиваниями', () => {
        expect(normalizePollutantKey('pm2.5')).toBe('pm2_5');
        expect(normalizePollutantKey('pm_2_5')).toBe('pm2_5');
        expect(normalizePollutantKey('PM2_5')).toBe('pm2_5');
        expect(normalizePollutantKey('PM10')).toBe('pm10');
        expect(normalizePollutantKey('NO2')).toBe('nitrogen_dioxide');
        expect(normalizePollutantKey('SO2')).toBe('sulphur_dioxide');
        expect(normalizePollutantKey('O3')).toBe('ozone');
        expect(normalizePollutantKey('CO')).toBe('carbon_monoxide');
    });

    it('normalizePollutantKey обрезает пробелы', () => {
        expect(normalizePollutantKey('  no2  ')).toBe('nitrogen_dioxide');
    });

    it('getPollutantAssessment возвращает «нет данных» для неизвестного загрязнителя', () => {
        const res = getPollutantAssessment('unknown_pollutant', 50);
        expect(res.label).toBe('нет данных');
        expect(res.color).toBe('#9E9E9E');
        expect(res.level).toBe('unknown');
    });

    it('getPollutantAssessment возвращает «нет данных» для пустой строки и отрицательных', () => {
        expect(getPollutantAssessment('pm2_5', '').label).toBe('нет данных');
        expect(getPollutantAssessment('pm2_5', -5).label).toBe('нет данных');
        expect(getPollutantAssessment('pm2_5', undefined).label).toBe('нет данных');
    });

    it('getPollutantAssessment корректно оценивает все пороги для PM10', () => {
        expect(getPollutantAssessment('pm10', 15).level).toBe('excellent');
        expect(getPollutantAssessment('pm10', 30).level).toBe('good');
        expect(getPollutantAssessment('pm10', 45).level).toBe('fair');
        expect(getPollutantAssessment('pm10', 80).level).toBe('poor');
        expect(getPollutantAssessment('pm10', 120).level).toBe('veryPoor');
        expect(getPollutantAssessment('pm10', 200).level).toBe('haz');
    });

    it('getPollutantMetadata возвращает null для невалидного ключа', () => {
        expect(getPollutantMetadata(null)).toBeNull();
        expect(getPollutantMetadata(123)).toBeNull();
        expect(getPollutantMetadata('')).toBeNull();
    });
});
