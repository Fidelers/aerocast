const { getSystemPrompt, formatPointAnalyticsContext } = require('../../ai/services/promptManager');

describe('promptManager', () => {
    describe('formatPointAnalyticsContext', () => {
        it('возвращает пустую строку, если pointAnalytics не передан или не объект', () => {
            expect(formatPointAnalyticsContext(null)).toBe('');
            expect(formatPointAnalyticsContext(undefined)).toBe('');
            expect(formatPointAnalyticsContext('не объект')).toBe('');
            expect(formatPointAnalyticsContext(123)).toBe('');
        });

        it('корректно форматирует диапазон AQI "Отлично" (<= 20)', () => {
            const res = formatPointAnalyticsContext({ aqi: 15 });
            expect(res).toContain('Отлично (0–20)');
            expect(res).toContain('Воздух очень чистый');
        });

        it('корректно форматирует диапазон AQI "Хорошо" (21–40)', () => {
            const res = formatPointAnalyticsContext({ aqi: 35 });
            expect(res).toContain('Хорошо (21–40)');
        });

        it('корректно форматирует диапазон AQI "Удовлетворительно" (41–60)', () => {
            const res = formatPointAnalyticsContext({ aqi: 55 });
            expect(res).toContain('Удовлетворительно (41–60)');
        });

        it('корректно форматирует диапазон AQI "Плохо" (61–80)', () => {
            const res = formatPointAnalyticsContext({ aqi: 75 });
            expect(res).toContain('Плохо (61–80)');
        });

        it('корректно форматирует диапазон AQI "Очень плохо" (81–100)', () => {
            const res = formatPointAnalyticsContext({ aqi: 95 });
            expect(res).toContain('Очень плохо (81–100)');
        });

        it('корректно форматирует диапазон AQI "Опасно" (> 100)', () => {
            const res = formatPointAnalyticsContext({ aqi: 125 });
            expect(res).toContain('Опасно (100+)');
            expect(res).toContain('Опасный токсичный уровень');
        });

        it('корректно форматирует архивные данные historyData', () => {
            const res = formatPointAnalyticsContext({
                aqi: 25,
                historyData: {
                    pastDaysCount: 7,
                    pastMaxAqi: { aqi: 48, label: 'Понедельник, 15:00' },
                    pastMinAqi: { aqi: 12, label: 'Среда, 04:00' },
                    pastAvgAqi: 24,
                    pastAvgPm25: 15,
                    pastDays: [
                        { dayLabel: 'Пн', date: '2026-10-26', avgAqi: 28, status: 'Хорошо', maxAqi: 48, maxAqiTime: '15:00', minAqi: 15, avgPm25: 14 }
                    ]
                }
            });
            expect(res).toContain('АРХИВНЫЕ ДАННЫЕ ЗА ПРОШЕДШИЕ ДНИ');
            expect(res).toContain('48 (зафиксировано: Понедельник, 15:00)');
        });

        it('обрабатывает fallback peakAqi в historyData, если pastMaxAqi не передан', () => {
            const res = formatPointAnalyticsContext({
                aqi: 25,
                historyData: {
                    peakAqi: 50,
                    peakDate: '25 октября, 12:00'
                }
            });
            expect(res).toContain('50 (зафиксировано: 25 октября, 12:00)');
        });

        it('корректно форматирует allDaysSummary', () => {
            const res = formatPointAnalyticsContext({
                aqi: 25,
                allDaysSummary: {
                    totalDaysCount: 11,
                    overallAvgAqi: 26,
                    overallMinAqi: { aqi: 10, label: 'Вс' },
                    overallMaxAqi: { aqi: 55, label: 'Пн' },
                    overallAvgPm25: 18,
                    days: [
                        { kindLabel: 'Архив', dayLabel: 'Пн', avgAqi: 30, status: 'Хорошо', maxAqi: 55, maxAqiTime: '14:00', minAqi: 15, avgPm25: 16 }
                    ]
                }
            });
            expect(res).toContain('ДАННЫЕ ЗА ВСЕ ДНИ (ОБЩИЙ ПЕРИОД');
            expect(res).toContain('55 (зафиксирован: Пн)');
        });

        it('корректно форматирует forecast3Days', () => {
            const res = formatPointAnalyticsContext({
                aqi: 25,
                forecast3Days: {
                    periodAvgAqi: 22,
                    periodMinAqi: 15,
                    periodMaxAqi: 30,
                    periodAvgPm25: 12,
                    days: [
                        { dayLabel: 'Завтра', avgAqi: 20, status: 'Отлично', minAqi: 15, maxAqi: 25, avgPm25: 10 }
                    ]
                }
            });
            expect(res).toContain('ДАННЫЕ ПРОГНОЗА КАЧЕСТВА ВОЗДУХА НА 3 ДНЯ');
            expect(res).toContain('средний EAQI = 22');
        });

        it('добавляет примечание о выбранном времени в прошлом и будущем', () => {
            const resPast = formatPointAnalyticsContext({
                aqi: 25,
                selectedTimeInfo: { kind: 'past', label: 'Вчера 14:00' }
            });
            expect(resPast).toContain('пользователь выбрал точку в ПРОШЛОМ');

            const resForecast = formatPointAnalyticsContext({
                aqi: 25,
                selectedTimeInfo: { kind: 'forecast', label: 'Завтра 12:00' }
            });
            expect(resForecast).toContain('пользователь выбрал время в БУДУЩЕМ');
        });
    });

    describe('getSystemPrompt', () => {
        it('возвращает базовый системный промпт без аналитики при null', () => {
            const prompt = getSystemPrompt(null);
            expect(prompt).toContain('Ая');
            expect(prompt).not.toContain('ДАННЫЕ ТЕКУЩЕЙ ВЫБРАННОЙ ТОЧКИ НА КАРТЕ:');
        });

        it('включает блок аналитики при передаче объекта pointAnalytics', () => {
            const prompt = getSystemPrompt({ aqi: 18, locationName: 'Томск' });
            expect(prompt).toContain('ДАННЫЕ ТЕКУЩЕЙ ВЫБРАННОЙ ТОЧКИ НА КАРТЕ:');
            expect(prompt).toContain('Томск');
            expect(prompt).toContain('18');
        });

        it('содержит полный блок возможностей и функционала маскота Аи', () => {
            const prompt = getSystemPrompt(null);
            expect(prompt).toContain('ФУНКЦИОНАЛ И ВОЗМОЖНОСТИ АИ (ЧТО УМЕЕТ АЯ)');
            expect(prompt).toContain('Управление картой');
            expect(prompt).toContain('Оформление интерфейса');
            expect(prompt).toContain('Режим цветовой слепоты');
            expect(prompt).toContain('Навигация по городам');
            expect(prompt).toContain('Экологическая аналитика');
            expect(prompt).toContain('Архив и прогноз');
            expect(prompt).toContain('Экспертные советы по здоровью');
        });

        it('содержит строгую структуру аналитических ответов из 4 секций', () => {
            const prompt = getSystemPrompt(null);
            expect(prompt).toContain('СТРУКТУРА АНАЛИТИЧЕСКИХ ОТВЕТОВ:');
            expect(prompt).toContain('1. Статус и индекс');
            expect(prompt).toContain('2. Загрязнители');
            expect(prompt).toContain('3. Динамика, архив и прогноз');
            expect(prompt).toContain('4. Рекомендации по здоровью');
            expect(prompt).toContain('Всегда завершай мысль');
        });

        it('использует только формулировку "режим цветовой слепоты" и 4 палитры', () => {
            const prompt = getSystemPrompt(null);
            expect(prompt).toContain('режим цветовой слепоты');
            expect(prompt).not.toContain('режим дальтонизма');
            expect(prompt).toContain('Окабе');
            expect(prompt).toContain('Дейтеранопия');
            expect(prompt).toContain('Протанопия');
            expect(prompt).toContain('Тританопия');
        });
    });
});
