// метаданные для 6 основных загрязнителей воздуха
export const POLLUTANTS_METADATA = {
  pm2_5: {
    name: 'Мелкодисперсные частицы (PM2.5)',
    formula: 'PM2.5',
    description: 'Взвешенные микрочастицы пыли, сажи и капель жидкости диаметром до 2.5 мкм. Проникают глубоко в лёгкие.',
    sources: 'Автотранспорт, промышленность, лесные пожары, сжигание топлива.',
    healthImpact: 'Провоцируют астму, аллергии, сердечно-сосудистые и дыхательные заболевания.',
    thresholds: [10, 20, 25, 50, 75]
  },
  pm10: {
    name: 'Крупные твердые частицы (PM10)',
    formula: 'PM10',
    description: 'Пыль, пыльца растений, частицы почвы диаметром до 10 мкм. Задерживаются в верхних дыхательных путях.',
    sources: 'Дорожная и песчаная пыль, строительные работы, промышленное производство.',
    healthImpact: 'Раздражение глаз, горла, приступы кашля и сухости слизистых оболочек.',
    thresholds: [20, 40, 50, 100, 150]
  },
  nitrogen_dioxide: {
    name: 'Диоксид азота (NO2)',
    formula: 'NO2',
    description: 'Токсичный едкий газ красно-бурого цвета с резким неприятным запахом.',
    sources: 'Высокотемпературное горение топлива, выхлопы автомобилей, теплоэлектростанции, продукты сгорания газа.',
    healthImpact: 'Снижает защитные функции лёгких, усиливает риск инфекционных заболеваний.',
    thresholds: [40, 90, 120, 230, 340]
  },
  sulphur_dioxide: {
    name: 'Диоксид серы (SO2)',
    formula: 'SO2',
    description: 'Бесцветный газ с едким запахом загорающейся спички.',
    sources: 'Угольные котельные, металлургические заводы, тепловые электростанции.',
    healthImpact: 'Вызывает спазм бронхов, удушье, раздражение дыхательных путей.',
    thresholds: [100, 200, 350, 500, 750]
  },
  ozone: {
    name: 'Приземный озон (O3)',
    formula: 'O3',
    description: 'Газ с резким запахом, формирующийся при солнечном свете из выхлопов и летучих соединений.',
    sources: 'Фотохимический смог в жаркие солнечные дни в крупных городах.',
    healthImpact: 'Затрудняет дыхание, раздражает глаза, вызывает першение в горле.',
    thresholds: [50, 100, 130, 240, 380]
  },
  carbon_monoxide: {
    name: 'Угарный газ (CO)',
    formula: 'CO',
    description: 'Газ без цвета, вкуса и запаха. Накапливается при неполном сгорании топлива.',
    sources: 'Выхлопные газы автомобилей, печное отопление, табачный дым.',
    healthImpact: 'Блокирует перенос кислорода в крови, вызывает головокружение и головную боль.',
    thresholds: [4400, 9400, 12400, 15400, 20400]
  }
};

// словарь синонимов для приведения любых сокращений к единому ключу
const KEY_ALIASES = {
  no2: 'nitrogen_dioxide',
  so2: 'sulphur_dioxide',
  o3: 'ozone',
  co: 'carbon_monoxide',
  pm25: 'pm2_5',
  'pm2.5': 'pm2_5',
  pm2_5: 'pm2_5',
  pm_2_5: 'pm2_5',
  pm10: 'pm10',
  nitrogen_dioxide: 'nitrogen_dioxide',
  sulphur_dioxide: 'sulphur_dioxide',
  ozone: 'ozone',
  carbon_monoxide: 'carbon_monoxide'
};

// нормализация синонимов ключей загрязнителей
export function normalizePollutantKey(key) {
  if (!key || typeof key !== 'string') return null;
  const lower = key.trim().toLowerCase();
  return KEY_ALIASES[lower] || null;
}

// получение метаданных по ключу или синониму
export function getPollutantMetadata(key) {
  const normalized = normalizePollutantKey(key);
  if (!normalized) return null;
  return POLLUTANTS_METADATA[normalized] || null;
}

// Доступные палитры бейджей загрязнителей для различных видов дальтонизма
export const POLLUTANT_COLORBLIND_PALETTES = Object.freeze({
  okabe: Object.freeze({
    excellent: '#0072B2',
    good: '#56B4E9',
    fair: '#F0E442',
    poor: '#E69F00',
    veryPoor: '#D55E00',
    haz: '#7B3294'
  }),
  deuteranopia: Object.freeze({
    excellent: '#1E88E5',
    good: '#64B5F6',
    fair: '#FFF176',
    poor: '#FB8C00',
    veryPoor: '#8E24AA',
    haz: '#4A148C'
  }),
  protanopia: Object.freeze({
    excellent: '#0077BB',
    good: '#33BBEE',
    fair: '#EECC66',
    poor: '#EE7733',
    veryPoor: '#EE3377',
    haz: '#332288'
  }),
  tritanopia: Object.freeze({
    excellent: '#009E73',
    good: '#66C2A5',
    fair: '#FEE08B',
    poor: '#FF7043',
    veryPoor: '#E53935',
    haz: '#880E4F'
  })
});

// оценка статуса вещества по европейским порогам.
// Опция options.colorBlind=true возвращает цвета из доступной палитры,
// совпадающей с палитрой types.js и CSS-оверрайдами index.css.
export function getPollutantAssessment(key, value, options = {}) {
  const num = Number(value);

  // цвета бейджей: стандартная палитра или палитра для выбранного вида дальтонизма
  const cbType = options.colorBlindType || 'okabe';
  const COLORS = options.colorBlind
    ? (POLLUTANT_COLORBLIND_PALETTES[cbType] || POLLUTANT_COLORBLIND_PALETTES.okabe)
    : {
        excellent: '#4CAF50',
        good: '#8BC34A',
        fair: '#FFC107',
        poor: '#FF9800',
        veryPoor: '#F44336',
        haz: '#9C27B0'
      };

  // обработка null, undefined, пустой строки, отрицательных чисел и NaN
  if (value === null || value === undefined || value === '' || isNaN(num) || num < 0) {
    return {
      label: 'нет данных',
      color: '#9E9E9E',
      level: 'unknown'
    };
  }

  const meta = getPollutantMetadata(key);
  if (!meta) {
    return {
      label: 'нет данных',
      color: '#9E9E9E',
      level: 'unknown'
    };
  }

  const [t1, t2, t3, t4, t5] = meta.thresholds;

  if (num <= t1) {
    return { label: 'Отлично', level: 'excellent', color: COLORS.excellent };
  }
  if (num <= t2) {
    return { label: 'Хорошо', level: 'good', color: COLORS.good };
  }
  if (num <= t3) {
    return { label: 'Умеренно', level: 'fair', color: COLORS.fair };
  }
  if (num <= t4) {
    return { label: 'Повышено', level: 'poor', color: COLORS.poor };
  }
  if (num <= t5) {
    return { label: 'Плохо', level: 'veryPoor', color: COLORS.veryPoor };
  }
  return { label: 'Опасно', level: 'haz', color: COLORS.haz };
}

// текстовая рекомендация по уровню общего AQI
export function getAqiRecommendation(aqi) {
  const num = Number(aqi);
  if (aqi === null || aqi === undefined || isNaN(num) || num < 0) return 'нет данных';
  if (num <= 20) return 'отлично';
  if (num <= 40) return 'хорошо';
  if (num <= 60) return 'удовлетворительно';
  if (num <= 80) return 'плохо';
  if (num <= 100) return 'очень плохо';
  return 'опасно';
}
