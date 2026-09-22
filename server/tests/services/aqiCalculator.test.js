// tests/services/aqiCalculator.test.js — тесты расчёта AQI
const { interpolate, getSubIndex, calculateEAQI, BREAKPOINTS } = require('../../services/aqiCalculator');

describe('Service: aqiCalculator', () => {

    describe('interpolate()', () => {
        it('должен возвращать нижний индекс, если концентрация <= нижнего порога', () => {
            expect(interpolate(5, 10, 20, 0, 20)).toBe(0);
            expect(interpolate(10, 10, 20, 0, 20)).toBe(0);
        });

        it('должен возвращать верхний индекс, если концентрация >= верхнего порога', () => {
            expect(interpolate(25, 10, 20, 0, 20)).toBe(20);
        });

        it('должен корректно применять формулу линейной интерполяции внутри интервала', () => {
            // (15 - 10) / (20 - 10) * (20 - 0) + 0 = 10
            expect(interpolate(15, 10, 20, 0, 20)).toBe(10);

            // (13 - 10) / (20 - 10) * (20 - 0) + 0 = 6
            expect(interpolate(13, 10, 20, 0, 20)).toBe(6);
        });

        it('должен округлять промежуточный результат до целого числа', () => {
            // (11 - 10) / (20 - 10) * (25 - 0) + 0 = 2.5 -> Math.round -> 3
            expect(interpolate(11, 10, 20, 0, 25)).toBe(3);
            // (12 - 10) / (20 - 10) * (23 - 0) + 0 = 4.6 -> Math.round -> 5
            expect(interpolate(12, 10, 20, 0, 23)).toBe(5);
        });

        it('должен корректно обрабатывать случай равенства верхнего и нижнего порогов', () => {
            expect(interpolate(15, 10, 10, 20, 40)).toBe(20);
        });
    });

    describe('getSubIndex()', () => {
        // Тестовая шкала порогов для загрязнителя (5 интервалов для 6 индексов: 0, 20, 40, 60, 80, 100)
        const mockBreakpoints = [0, 10, 20, 30, 40, 50];

        it('должен находить подходящий интервал и вычислять под-индекс', () => {
            expect(getSubIndex(5, mockBreakpoints)).toBe(10); // Интервал 0-10 -> Индексы 0-20
            expect(getSubIndex(15, mockBreakpoints)).toBe(30); // Интервал 10-20 -> Индексы 20-40
            expect(getSubIndex(25, mockBreakpoints)).toBe(50); // Интервал 20-30 -> Индексы 40-60
        });

        it('должен точно попадать в граничные точки порогов', () => {
            expect(getSubIndex(0, mockBreakpoints)).toBe(0);
            expect(getSubIndex(10, mockBreakpoints)).toBe(20);
            expect(getSubIndex(20, mockBreakpoints)).toBe(40);
            expect(getSubIndex(50, mockBreakpoints)).toBe(100);
        });

        it('должен корректно преобразовывать числовые строки', () => {
            expect(getSubIndex('15', mockBreakpoints)).toBe(30);
        });

        it('должен выполнять экстраполяцию по последнему отрезку, если концентрация превышает последний порог', () => {
            // Последний отрезок: пороги 40-50, индексы 80-100.
            // Шаг концентрации 1 = шаг индекса 2.
            // При c=55: (55 - 40) / (50 - 40) * 20 + 80 = 15 * 2 + 80 = 110.
            expect(getSubIndex(55, mockBreakpoints)).toBe(110);
        });

        it('должен ограничивать экстраполированный результат верхней границей 150', () => {
            // При c=100 экстраполяция дала бы (100 - 40) / 10 * 20 + 80 = 200,
            // но жесткий лимит — 150.
            expect(getSubIndex(100, mockBreakpoints)).toBe(150);
        });

        it('должен возвращать 0 для отрицательных и нечисловых значений концентрации', () => {
            expect(getSubIndex(-5, mockBreakpoints)).toBe(0);
            expect(getSubIndex(null, mockBreakpoints)).toBe(0);
            expect(getSubIndex(undefined, mockBreakpoints)).toBe(0);
            expect(getSubIndex(NaN, mockBreakpoints)).toBe(0);
            expect(getSubIndex('abc', mockBreakpoints)).toBe(0);
        });

        it('должен корректно работать со стандартными европейскими брейкпоинтами', () => {
            expect(BREAKPOINTS.pm2_5).toEqual([0, 10, 20, 25, 50, 75]);
            expect(BREAKPOINTS.pm10).toEqual([0, 20, 40, 50, 100, 150]);
            expect(BREAKPOINTS.no2).toEqual([0, 40, 90, 120, 230, 340]);
            expect(BREAKPOINTS.o3).toEqual([0, 50, 100, 130, 240, 380]);
            expect(BREAKPOINTS.so2).toEqual([0, 100, 200, 350, 500, 750]);
        });
    });

    describe('calculateEAQI()', () => {
        it('должен возвращать максимальный под-индекс (наихудший показатель) по всем загрязнителям (позиционный вызов)', () => {
            // Значения подобраны так, чтобы наихудшим показателем был pm10.
            // pm10 = 45: интервал 40-50 (индексы 40-60) -> 50
            const overallAqi = calculateEAQI(15, 45, 10, 20, 5);
            expect(overallAqi).toBe(50);
        });

        it('должен поддерживать вызов с объектом параметров (для совместимости с backupAirService)', () => {
            const overallAqi = calculateEAQI({
                pm2_5: 15,
                pm10: 45,
                no2: 10,
                o3: 20,
                so2: 5
            });
            expect(overallAqi).toBe(50);
        });

        it('должен правильно определять доминирующий загрязнитель, когда худший — PM2.5', () => {
            // PM2.5 = 60: интервал 50-75 (индексы 80-100) -> (60-50)/25 * 20 + 80 = 88
            const aqi = calculateEAQI({ pm2_5: 60, pm10: 10, no2: 10, o3: 10, so2: 10 });
            expect(aqi).toBe(88);
        });

        it('должен правильно определять доминирующий загрязнитель, когда худший — O3', () => {
            // O3 = 200: интервал 130-240 (индексы 60-80) -> (200-130)/110 * 20 + 60 = 73
            const aqi = calculateEAQI({ pm2_5: 5, pm10: 10, no2: 20, o3: 200, so2: 10 });
            expect(aqi).toBe(73);
        });

        it('должен правильно определять доминирующий загрязнитель, когда худший — NO2', () => {
            // NO2 = 175: интервал 120-230 (индексы 60-80) -> (175-120)/110 * 20 + 60 = 70
            const aqi = calculateEAQI({ pm2_5: 5, pm10: 10, no2: 175, o3: 20, so2: 10 });
            expect(aqi).toBe(70);
        });

        it('должен правильно определять доминирующий загрязнитель, когда худший — SO2', () => {
            // SO2 = 625: интервал 500-750 (индексы 80-100) -> (625-500)/250 * 20 + 80 = 90
            const aqi = calculateEAQI({ pm2_5: 5, pm10: 10, no2: 20, o3: 20, so2: 625 });
            expect(aqi).toBe(90);
        });

        it('должен безопасно игнорировать лишние поля (например, co из backupAirService)', () => {
            // backupAirService передаёт { pm10, pm2_5, co, no2, so2, o3 }
            const aqi = calculateEAQI({
                pm10: 22.0,
                pm2_5: 12.3,
                co: 250.5,
                no2: 18.2,
                so2: 5.1,
                o3: 45.0
            });
            expect(typeof aqi).toBe('number');
            expect(aqi).toBeGreaterThan(0);
        });

        it('должен корректно работать с неполным набором полей в объекте (отсутствующие = 0)', () => {
            // PM2.5 = 25: граница интервала 20-25 -> индекс 60
            expect(calculateEAQI({ pm2_5: 25 })).toBe(60);
        });

        it('должен ограничивать максимальный итоговый EAQI значением 150 при экстремальном загрязнении', () => {
            expect(calculateEAQI({ pm2_5: 200, pm10: 500 })).toBe(150);
            expect(calculateEAQI(200, 500, 500, 500, 1000)).toBe(150);
        });

        it('должен возвращать 0 при нулевых или пустых параметрах', () => {
            expect(calculateEAQI(0, 0, 0, 0, 0)).toBe(0);
            expect(calculateEAQI({})).toBe(0);
            expect(calculateEAQI()).toBe(0);
        });

        it('должен возвращать 0 при отрицательных или нечисловых значениях в объекте', () => {
            expect(calculateEAQI({ pm2_5: -10, pm10: null, no2: undefined, o3: NaN })).toBe(0);
        });
    });
});