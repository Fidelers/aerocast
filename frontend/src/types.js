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

// Палитры для людей с цветовой слепотой (дальтоников).
// Поддерживаются 4 вида: Okabe-Ito (универсальная), Дейтеранопия, Протанопия, Тританопия.
// Используются в режиме data-colorblind="true" и совпадают с CSS-оверрайдами в index.css.
export const COLORBLIND_PALETTES = Object.freeze({
    okabe: Object.freeze({
        none: '#9E9E9E',
        excellent: '#0072B2',
        good: '#56B4E9',
        fair: '#F0E442',
        poor: '#E69F00',
        'very-poor': '#D55E00',
        hazardous: '#7B3294'
    }),
    deuteranopia: Object.freeze({
        none: '#9E9E9E',
        excellent: '#1E88E5',
        good: '#64B5F6',
        fair: '#FFF176',
        poor: '#FB8C00',
        'very-poor': '#8E24AA',
        hazardous: '#4A148C'
    }),
    protanopia: Object.freeze({
        none: '#9E9E9E',
        excellent: '#0077BB',
        good: '#33BBEE',
        fair: '#EECC66',
        poor: '#EE7733',
        'very-poor': '#EE3377',
        hazardous: '#332288'
    }),
    tritanopia: Object.freeze({
        none: '#9E9E9E',
        excellent: '#009E73',
        good: '#66C2A5',
        fair: '#FEE08B',
        poor: '#FF7043',
        'very-poor': '#E53935',
        hazardous: '#880E4F'
    })
});

// Для обратной совместимости со старыми модулями/тестами
export const COLORBLIND_HEX = COLORBLIND_PALETTES.okabe;

// Возвращает описание уровня для числового индекса качества воздуха.
// Опция options.colorBlind=true возвращает hex из доступной палитры (Okabe-Ito, Deuteranopia, Protanopia, Tritanopia).
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
        const type = options.colorBlindType || 'okabe';
        const palette = COLORBLIND_PALETTES[type] || COLORBLIND_PALETTES.okabe;
        return { ...info, hex: palette[info.level] || info.hex };
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
