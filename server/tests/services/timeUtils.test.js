const timeUtils = require('../../services/timeUtils');

describe('Service: timeUtils', () => {
    describe('formatIsoHour(unixSeconds)', () => {
        it('должен преобразовывать Unix time (секунды, UTC) в строку "ГГГГ-ММ-ДДTЧЧ:00" в Europe/Moscow', () => {
            // 1789862400 -> 2026-09-20 00:00:00 UTC -> 2026-09-20 03:00:00 Europe/Moscow (+3)
            expect(timeUtils.formatIsoHour(1789862400)).toBe('2026-09-20T03:00');
            // 1789866000 -> 2026-09-20 01:00:00 UTC -> 2026-09-20 04:00:00 Europe/Moscow (+3)
            expect(timeUtils.formatIsoHour(1789866000)).toBe('2026-09-20T04:00');
        });

        it('должен корректно обрабатывать нулевую метку времени (эпоха Unix)', () => {
            // 0 -> 1970-01-01 00:00:00 UTC -> 1970-01-01 03:00:00 Europe/Moscow
            expect(timeUtils.formatIsoHour(0)).toBe('1970-01-01T03:00');
        });

        it('должен правильно переносить час через границу суток в Europe/Moscow', () => {
            // 1789855200 -> 2026-09-19 22:00:00 UTC -> 2026-09-20 01:00:00 Europe/Moscow
            // (по UTC ещё 19.09, а по Москве уже сегодня — 20.09)
            expect(timeUtils.formatIsoHour(1789855200)).toBe('2026-09-20T01:00');
        });

        it('должен правильно обрабатывать границу года в Europe/Moscow', () => {
            // 1798754400 -> 2026-12-31 22:00:00 UTC -> 2027-01-01 01:00:00 Europe/Moscow
            expect(timeUtils.formatIsoHour(1798754400)).toBe('2027-01-01T01:00');
            // 1798678800 -> 2026-12-31 01:00:00 UTC -> 2026-12-31 04:00:00 Europe/Moscow
            expect(timeUtils.formatIsoHour(1798678800)).toBe('2026-12-31T04:00');
        });

        it('должен корректно работать с високосным днём и летним месяцем (в России нет DST)', () => {
            // 1835438400 -> 2028-02-29 12:00:00 UTC -> 2028-02-29 15:00:00 Europe/Moscow (високосный год)
            expect(timeUtils.formatIsoHour(1835438400)).toBe('2028-02-29T15:00');
            // 1818320400 -> 2027-08-15 09:00:00 UTC -> 2027-08-15 12:00:00 Europe/Moscow (лето, смещение то же)
            expect(timeUtils.formatIsoHour(1818320400)).toBe('2027-08-15T12:00');
        });

        it('должен сохранять минуты, если метка времени не кратна часу', () => {
            // 1789862460 -> 2026-09-20 00:01:00 UTC -> 2026-09-20 03:01:00 Europe/Moscow
            expect(timeUtils.formatIsoHour(1789862460)).toBe('2026-09-20T03:01');
        });
    });

    describe('formatIsoHourMillis(milliseconds)', () => {
        it('должен принимать Unix time в миллисекундах (как в архиве air_quality_history)', () => {
            expect(timeUtils.formatIsoHourMillis(1789862400 * 1000)).toBe('2026-09-20T03:00');
            expect(timeUtils.formatIsoHourMillis(1789866000 * 1000)).toBe('2026-09-20T04:00');
        });

        it('должен давать тот же результат, что и formatIsoHour для той же метки', () => {
            expect(timeUtils.formatIsoHourMillis(0)).toBe(timeUtils.formatIsoHour(0));
            expect(timeUtils.formatIsoHourMillis(1789862400 * 1000)).toBe(timeUtils.formatIsoHour(1789862400));
        });
    });

    describe('getTodayDateString(timestamp)', () => {
        it('возвращает дату в формате "ГГГГ-ММ-ДД" в часовом поясе Europe/Moscow', () => {
            // 1789862400 -> 2026-09-20T03:00 Europe/Moscow
            expect(timeUtils.getTodayDateString(1789862400 * 1000)).toBe('2026-09-20');
            // 1789855200 -> 2026-09-19T22:00 UTC -> 2026-09-20T01:00 Europe/Moscow
            expect(timeUtils.getTodayDateString(1789855200 * 1000)).toBe('2026-09-20');
        });

        it('принимает объект Date в качестве временной метки', () => {
            const date = new Date('2026-09-20T12:00:00Z');
            expect(timeUtils.getTodayDateString(date)).toBe('2026-09-20');
        });
    });

    describe('isToday(timestampOrDate, referenceDate)', () => {
        it('возвращает true, если метка времени относится к тому же дню в Europe/Moscow', () => {
            const ref = 1789862400 * 1000;
            const sameDay = ref + 3600 * 1000;
            expect(timeUtils.isToday(sameDay, ref)).toBe(true);
            expect(timeUtils.isToday('2026-09-20', ref)).toBe(true);
        });

        it('возвращает false, если метка времени из другого дня (вчера / завтра)', () => {
            const ref = 1789862400 * 1000;
            const yesterday = ref - 24 * 3600 * 1000;
            const tomorrow = ref + 24 * 3600 * 1000;
            expect(timeUtils.isToday(yesterday, ref)).toBe(false);
            expect(timeUtils.isToday(tomorrow, ref)).toBe(false);
            expect(timeUtils.isToday('2026-09-19', ref)).toBe(false);
        });

        it('возвращает false для невалидных значений', () => {
            expect(timeUtils.isToday(null)).toBe(false);
            expect(timeUtils.isToday(undefined)).toBe(false);
            expect(timeUtils.isToday('invalid-date')).toBe(false);
        });

        it('корректно обрабатывает объект Date как временную метку', () => {
            const ref = 1789862400 * 1000;
            const sameDay = new Date(ref + 3600 * 1000);
            expect(timeUtils.isToday(sameDay, ref)).toBe(true);

            const otherDay = new Date(ref - 24 * 3600 * 1000);
            expect(timeUtils.isToday(otherDay, ref)).toBe(false);
        });
    });
});

