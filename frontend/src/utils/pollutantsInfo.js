// метаданные для 6 основных загрязнителей воздуха
export const POLLUTANTS_METADATA = {
  pm2_5: {
    name: 'Мелкодисперсные частицы PM2.5',
    formula: 'PM2.5',
    description: 'Взвешенные микрочастицы пыли, сажи и капель жидкости диаметром до 2.5 мкм. Проникают глубоко в лёгкие.',
    sources: 'Автотранспорт, промышленность, лесные пожары, сжигание топлива.',
    healthImpact: 'Провоцируют астму, аллергии, сердечно-сосудистые и дыхательные заболевания.',
    thresholds: [10, 20, 25, 50, 75]
  },
  pm10: {
    name: 'Крупные твердые частицы PM10',
    formula: 'PM10',
    description: 'Пыль, пыльца растений, частицы почвы диаметром до 10 мкм. Задерживаются в верхних дыхательных путях.',
    sources: 'Дорожная и песчаная пыль, строительные работы, промышленное производство.',
    healthImpact: 'Раздражение глаз, горла, приступы кашля и сухости слизистых оболочек.',
    thresholds: [20, 40, 50, 100, 150]
  },
  nitrogen_dioxide: {
    name: 'Диоксид азота',
    formula: 'NO2',
    description: 'Ядовитый газ красно-бурого цвета с резким неприятным запахом.',
    sources: 'Выхлопы автомобилей, теплоэлектростанции, продукты сгорания газа.',
    healthImpact: 'Снижает защитные функции лёгких, усиливает риск инфекционных заболеваний.',
    thresholds: [40, 90, 120, 230, 340]
  },
  sulphur_dioxide: {
    name: 'Диоксид серы',
    formula: 'SO2',
    description: 'Бесцветный газ с едким запахом загорающейся спички.',
    sources: 'Угольные котельные, металлургические заводы, тепловые электростанции.',
    healthImpact: 'Вызывает спазм бронхов, удушье, раздражение дыхательных путей.',
    thresholds: [100, 200, 350, 500, 750]
  },
  ozone: {
    name: 'Озон',
    formula: 'O3',
    description: 'Газ с резким запахом, формирующийся при солнечном свете из выхлопов и летучих соединений.',
    sources: 'Фотохимический смог в жаркие солнечные дни в крупных городах.',
    healthImpact: 'Затрудняет дыхание, раздражает глаза, вызывает першение в горле.',
    thresholds: [50, 100, 130, 240, 380]
  },
  carbon_monoxide: {
    name: 'Угарный газ',
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
  pm2_5: 'pm2_5',
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


 // оценка статуса вещества по европейским порогам

export function getPollutantAssessment(key, value) {
  const num = Number(value);

  // обработка null, undefined и NaN
  if (value === null || value === undefined || isNaN(num)) {
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
    return { label: 'Отлично', level: 'excellent', color: '#4CAF50' };
  }
  if (num <= t2) {
    return { label: 'Хорошо', level: 'good', color: '#8BC34A' };
  }
  if (num <= t3) {
    return { label: 'Умеренно', level: 'fair', color: '#FFC107' };
  }
  if (num <= t4) {
    return { label: 'Повышено', level: 'poor', color: '#FF9800' };
  }
  if (num <= t5) {
    return { label: 'Плохо', level: 'veryPoor', color: '#F44336' };
  }
  return { label: 'Опасно', level: 'haz', color: '#9C27B0' };
}
