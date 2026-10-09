const axios = require('axios');


const MACRO_GRID_POINTS = [
    // Западная часть и Северо-Запад (долготы 19 .. 40)
    { lat: 54.71, lon: 20.51 }, // Калининград
    { lat: 55.20, lon: 21.30 }, // Советск
    { lat: 57.81, lon: 28.33 }, // Псков
    { lat: 56.34, lon: 28.58 }, // Опочка
    { lat: 59.93, lon: 30.31 }, // Санкт-Петербург
    { lat: 60.71, lon: 28.75 }, // Выборг
    { lat: 58.52, lon: 31.27 }, // Великий Новгород
    { lat: 54.78, lon: 32.04 }, // Смоленск
    { lat: 68.96, lon: 33.08 }, // Мурманск
    { lat: 67.56, lon: 33.40 }, // Апатиты
    { lat: 61.78, lon: 34.35 }, // Петрозаводск
    { lat: 53.24, lon: 34.36 }, // Брянск
    { lat: 56.85, lon: 35.91 }, // Тверь
    { lat: 51.73, lon: 36.19 }, // Курск
    { lat: 50.60, lon: 36.60 }, // Белгород
    { lat: 55.75, lon: 37.61 }, // Москва
    { lat: 54.51, lon: 36.26 }, // Калуга
    { lat: 54.20, lon: 37.62 }, // Тула
    { lat: 52.60, lon: 38.50 }, // Елец
    { lat: 45.03, lon: 38.97 }, // Краснодар
    { lat: 51.66, lon: 39.20 }, // Воронеж
    { lat: 43.60, lon: 39.73 }, // Сочи
    { lat: 47.23, lon: 39.71 }, // Ростов-на-Дону
    { lat: 57.62, lon: 39.88 }, // Ярославль
    { lat: 59.22, lon: 39.88 }, // Вологда
    { lat: 64.54, lon: 40.54 }, // Архангельск

    // Центральный пояс и Поволжье (долготы 41 .. 58)
    { lat: 56.13, lon: 40.40 }, // Владимир
    { lat: 56.99, lon: 40.97 }, // Иваново
    { lat: 57.77, lon: 40.93 }, // Кострома
    { lat: 45.04, lon: 41.97 }, // Ставрополь
    { lat: 52.72, lon: 41.44 }, // Тамбов
    { lat: 56.32, lon: 44.00 }, // Нижний Новгород
    { lat: 48.71, lon: 44.51 }, // Волгоград
    { lat: 43.02, lon: 44.68 }, // Владикавказ
    { lat: 53.20, lon: 45.00 }, // Пенза
    { lat: 51.53, lon: 46.01 }, // Саратов
    { lat: 42.98, lon: 47.50 }, // Махачкала
    { lat: 46.35, lon: 48.04 }, // Астрахань
    { lat: 56.63, lon: 47.88 }, // Йошкар-Ола
    { lat: 56.14, lon: 47.24 }, // Чебоксары
    { lat: 55.79, lon: 49.12 }, // Казань
    { lat: 58.60, lon: 49.66 }, // Киров
    { lat: 53.19, lon: 50.10 }, // Самара
    { lat: 61.67, lon: 50.83 }, // Сыктывкар
    { lat: 53.51, lon: 52.12 }, // Бугуруслан
    { lat: 55.33, lon: 52.56 }, // Альметьевск
    { lat: 67.64, lon: 53.00 }, // Нарьян-Мар
    { lat: 56.85, lon: 53.20 }, // Ижевск
    { lat: 51.77, lon: 55.10 }, // Оренбург
    { lat: 54.73, lon: 55.97 }, // Уфа
    { lat: 58.01, lon: 56.24 }, // Пермь
    { lat: 59.63, lon: 56.77 }, // Березники

    // Урал и Западная Сибирь (долготы 60 .. 85)
    { lat: 56.84, lon: 60.61 }, // Екатеринбург
    { lat: 55.16, lon: 61.43 }, // Челябинск
    { lat: 53.42, lon: 60.03 }, // Магнитогорск
    { lat: 67.50, lon: 64.05 }, // Воркута
    { lat: 55.44, lon: 65.34 }, // Курган
    { lat: 57.15, lon: 65.54 }, // Тюмень
    { lat: 66.53, lon: 66.60 }, // Салехард
    { lat: 58.20, lon: 68.25 }, // Тобольск
    { lat: 61.00, lon: 69.02 }, // Ханты-Мансийск
    { lat: 54.98, lon: 73.37 }, // Омск
    { lat: 61.25, lon: 73.41 }, // Сургут
    { lat: 60.94, lon: 76.57 }, // Нижневартовск
    { lat: 66.08, lon: 76.68 }, // Новый Уренгой
    { lat: 55.03, lon: 82.92 }, // Новосибирск
    { lat: 53.35, lon: 83.77 }, // Барнаул
    { lat: 56.50, lon: 84.97 }, // Томск

    // Центральная Сибирь и Прибайкалье (долготы 86 .. 115)
    { lat: 55.35, lon: 86.08 }, // Кемерово
    { lat: 67.46, lon: 86.58 }, // Игарка
    { lat: 53.76, lon: 87.15 }, // Новокузнецк
    { lat: 69.35, lon: 88.20 }, // Норильск
    { lat: 53.72, lon: 91.43 }, // Абакан
    { lat: 56.01, lon: 92.85 }, // Красноярск
    { lat: 56.15, lon: 101.61 }, // Братск
    { lat: 52.28, lon: 104.30 }, // Иркутск
    { lat: 51.83, lon: 107.58 }, // Улан-Удэ
    { lat: 55.64, lon: 109.32 }, // Северобайкальск
    { lat: 52.03, lon: 113.50 }, // Чита
    { lat: 62.53, lon: 113.96 }, // Мирный

    // Дальний Восток и Северо-Восток (долготы 120 .. 180)
    { lat: 60.37, lon: 120.44 }, // Олёкминск
    { lat: 56.66, lon: 124.71 }, // Нерюнгри
    { lat: 58.60, lon: 125.38 }, // Алдан
    { lat: 50.27, lon: 127.54 }, // Благовещенск
    { lat: 71.63, lon: 128.87 }, // Тикси
    { lat: 62.03, lon: 129.73 }, // Якутск
    { lat: 43.11, lon: 131.88 }, // Владивосток
    { lat: 42.82, lon: 132.88 }, // Находка
    { lat: 48.48, lon: 135.07 }, // Хабаровск
    { lat: 50.55, lon: 137.00 }, // Комсомольск-на-Амуре
    { lat: 46.95, lon: 142.73 }, // Южно-Сахалинск
    { lat: 59.56, lon: 150.80 }, // Магадан
    { lat: 53.02, lon: 158.65 }, // Петропавловск-Камчатский
    { lat: 69.70, lon: 170.25 }, // Певек
    { lat: 64.73, lon: 177.51 }  // Анадырь
];


function generateMacroGridCoordinates() {
    return MACRO_GRID_POINTS.map(p => ({ lat: p.lat, lon: p.lon }));
}


function generateMicroGridCoordinates(centerLat, centerLon) {
    if (
        centerLat === null ||
        centerLon === null ||
        typeof centerLat !== 'number' ||
        typeof centerLon !== 'number' ||
        Number.isNaN(centerLat) ||
        Number.isNaN(centerLon)
    ) {
        throw new Error('Invalid center coordinates: lat and lon must be numbers');
    }

    if (centerLat < -90 || centerLat > 90 || centerLon < -180 || centerLon > 180) {
        throw new Error('Coordinates out of range: lat must be in [-90, 90], lon in [-180, 180]');
    }

    const points = [];
    const step = 0.10;
    const offsets = [-2, -1, 0, 1, 2];

    for (const dy of offsets) {
        for (const dx of offsets) {
            const lat = Number((centerLat + dy * step).toFixed(4));
            const lon = Number((centerLon + dx * step).toFixed(4));
            points.push({ lat, lon });
        }
    }

    const lats = points.map(p => p.lat);
    const lons = points.map(p => p.lon);
    const bbox = [
        Math.min(...lons),
        Math.min(...lats),
        Math.max(...lons),
        Math.max(...lats)
    ];

    return { points, bbox };
}


async function fetchBatchAirQuality(coordinates) {
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
        return [];
    }

    const lats = coordinates.map(c => Number(c.lat).toFixed(4)).join(',');
    const lons = coordinates.map(c => Number(c.lon).toFixed(4)).join(',');

    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}&hourly=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,european_aqi&timezone=Europe/Moscow&past_days=7&forecast_days=4`;

    const response = await axios.get(url, { timeout: 2000 });
    return response.data;
}


function normalizeBatchResponse(rawArray, coordinates) {
    const items = Array.isArray(rawArray) ? rawArray : [rawArray];

    if (!coordinates || items.length !== coordinates.length) {
        throw new Error(
            `Response count mismatch: Open-Meteo returned ${items.length} items, but expected ${coordinates ? coordinates.length : 0}`
        );
    }

    const time = items[0]?.hourly?.time || [];

    const points = items.map((item, idx) => {
        const coord = coordinates[idx];
        const rawAqi = item?.hourly?.european_aqi || [];
        const european_aqi = rawAqi.map(val => {
            if (val === null || val === undefined || Number.isNaN(Number(val))) {
                return 20; // базовый фоновый уровень
            }
            return Number(val);
        });

        return {
            lat: coord.lat,
            lon: coord.lon,
            european_aqi
        };
    });

    return {
        time,
        points
    };
}

module.exports = {
    generateMacroGridCoordinates,
    generateMicroGridCoordinates,
    fetchBatchAirQuality,
    normalizeBatchResponse
};
