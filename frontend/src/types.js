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

// Палитра для людей с цветовой слепотой (дальтоников), палитра Okabe-Ito.
// Используется в режиме data-colorblind="true" и совпадает с CSS-оверрайдами в index.css.
const COLORBLIND_HEX = Object.freeze({
    none: '#9E9E9E',
    excellent: '#0072B2',
    good: '#56B4E9',
    fair: '#F0E442',
    poor: '#E69F00',
    'very-poor': '#D55E00',
    hazardous: '#7B3294'
});

// Возвращает описание уровня для числового индекса качества воздуха.
// Опция options.colorBlind=true возвращает hex из доступной палитры Okabe-Ito.
export function getAqiInfo(aqi, options = {}) {
    if (aqi === null || aqi === undefined || Number.isNaN(aqi)) {
        return NO_DATA;
    }

    let info = NO_DATA;
    for (const level of LEVELS) {
        if (aqi <= level.max) {
            info = level;
            break;
        }
    }
    if (info === NO_DATA) {
        info = HAZARDOUS;
    }

    if (options.colorBlind) {
        return { ...info, hex: COLORBLIND_HEX[info.level] || info.hex };
    }

    return info;
}

export const AQI_RECOMMENDATIONS = Object.freeze({
    excellent: 'Воздух чистый, идеальные условия для прогулок и спорта.',
    good: 'Качество воздуха приемлемое. Загрязнение минимально.',
    fair: 'Умеренное загрязнение. Чувствительным людям стоит быть осторожнее.',
    poor: 'Неблагоприятные условия. Ограничьте физические нагрузки на улице.',
    'very-poor': 'Высокое загрязнение. Рекомендуется оставаться в помещении.',
    hazardous: 'Опасный уровень! Закройте окна, используйте очистители воздуха.'
});

export function getAqiRecommendation(aqi) {
    if (aqi === null || aqi === undefined || (typeof aqi === 'number' && Number.isNaN(aqi))) {
        return '';
    }
    const info = typeof aqi === 'object' && aqi !== null ? aqi : getAqiInfo(aqi);
    return AQI_RECOMMENDATIONS[info.level] || '';
}