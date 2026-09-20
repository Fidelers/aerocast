// types.js - типы и вспомогательные функции

// Классификация значения индекса качества воздуха (AQI/EAQI) по европейской шкале.
// Для каждого уровня возвращается подпись (label), CSS-класс и hex-код цвета.

const NO_DATA = Object.freeze({
    level: 'none',
    label: 'нет данных',
    cssClass: 'aqi-none',
    hex: '#9E9E9E'
});

const LEVELS = Object.freeze([
    Object.freeze({ max: 20, level: 'excellent', label: 'отлично', cssClass: 'aqi-excellent', hex: '#4CAF50' }),
    Object.freeze({ max: 40, level: 'good', label: 'хорошо', cssClass: 'aqi-good', hex: '#8BC34A' }),
    Object.freeze({ max: 60, level: 'fair', label: 'удовлетворительно', cssClass: 'aqi-fair', hex: '#FFEB3B' }),
    Object.freeze({ max: 80, level: 'poor', label: 'плохо', cssClass: 'aqi-poor', hex: '#FF9800' }),
    Object.freeze({ max: 100, level: 'very-poor', label: 'очень плохо', cssClass: 'aqi-very-poor', hex: '#F44336' })
]);

const HAZARDOUS = Object.freeze({
    level: 'hazardous',
    label: 'опасно',
    cssClass: 'aqi-hazardous',
    hex: '#D50000'
});


//Возвращает описание уровня для числового индекса качества воздуха.

export function getAqiInfo(aqi) {
    if (aqi === null || aqi === undefined || Number.isNaN(aqi)) {
        return NO_DATA;
    }

    for (const level of LEVELS) {
        if (aqi <= level.max) {
            return level;
        }
    }

    return HAZARDOUS;
}