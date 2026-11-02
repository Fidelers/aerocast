# AeroCast Two-Tier AI E2E Evaluation Suite

Набор тестов для независимой и сквозной оценки двухконтурной архитектуры AI в AeroCast:
* **System 1 (Jev-Style-0.8B):** сверхбыстрый (~20–100 мс) классификатор решений, роутер команд UI (слои карты, темы, палитры дальтонизма) и Guardrails (перехват кода/оффтопа).
* **System 2 (Gemma-4-E2B-it):** локальная большая языковая модель (~2–4 сек) для отыгрыша персонажа Аи, ответов на вопросы о сервисе, навигации и глубокого анализа качества воздуха.

---

## 📁 Структура директорий

```
server/ai/tests/
├── jev/                               # ⚡ ТЕСТЫ SYSTEM 1 (Jev-Style-0.8B) — 86 сценариев
│   ├── dataset.json                   # Сценарии UI-роутинга, смены слоев, тем, дальтонизма и guardrails
│   └── jev.eval.test.js               # Jest-раннер для быстрого прогона Jev (~5 секунд)
│
├── gemma/                             # 🧠 ТЕСТЫ SYSTEM 2 (Gemma-4-E2B-it) — 156 сценариев
│   ├── dataset.json                   # Сценарии аналитики воздуха, прогноза, архивов, здоровья и персоны Аи
│   └── gemma.eval.test.js             # Jest-раннер для инференса Gemma-4
│
├── evalRunner.js                      # Унифицированный CLI-раннер (--target=all|jev|gemma)
├── ai.eval.test.js                    # Сквозной Jest-тест, объединяющий обе подсистемы (242 теста)
├── evalDataset.json                   # Объединенный полный датасет (242 сценария)
├── evalReport.md                      # Автоматический отчет с замерами задержек и разбивкой
└── README.md
```

---

## 🚀 Запуск тестов

### 1. Быстрые тесты System 1 (Jev-Style):
Запускает только тесты роутера UI и Guardrails. Выполняются мгновенно (~86 тестов):
```bash
# Через npm script
npm run test:eval:jev --prefix server

# Напрямую через CLI runner
node server/ai/tests/evalRunner.js --target=jev
```

### 2. Тесты System 2 (Gemma-4):
Запускает тесты глубокой аналитики воздуха, прогноза, архива, навигации и диалогового персонажа (~156 тестов):
```bash
# Через npm script
npm run test:eval:gemma --prefix server

# Напрямую через CLI runner
node server/ai/tests/evalRunner.js --target=gemma
```

### 3. Полный прогон обоих контуров (Все 242 теста):
```bash
# Через CLI runner (с генерацией evalReport.md)
npm run test:eval --prefix server

# Или напрямую
node server/ai/tests/evalRunner.js --target=all
```

### 4. Дополнительные флаги фильтрации:
```bash
# Фильтр по категории (например, только темы или только аналитика)
node server/ai/tests/evalRunner.js --category=theme
node server/ai/tests/evalRunner.js --category=analytics

# Ограничение количества сценариев
node server/ai/tests/evalRunner.js --limit=5

# Подробный вывод ошибок валидации в консоль
node server/ai/tests/evalRunner.js --verbose
```

---

## 📊 Категории тестов

| Подсистема | Категория | Количество | Описание |
|------------|-----------|:----------:|----------|
| **Jev (System 1)** | `map_layers` | 20 | Спутник, OSM, сленг «космос», «сделай обратно карту», снимки с орбиты |
| **Jev (System 1)** | `theme` | 18 | Тёмная, светлая, ночной/дневной режим, возврат темы, быстрые команды |
| **Jev (System 1)** | `colorblind` | 25 | Окабе (по умолчанию), Дейтеранопия, Протанопия, Тританопия, выключение, сброс |
| **Jev (System 1)** | `guardrails` | 23 | Отказ от генерации кода (Python, JS, C++, SQL, Bash, Java, HTML/CSS, Rust), рецептов, крипты, математики, jailbreak |
| **Gemma (System 2)** | `map_layers_qa` | 8 | Ответы на вопросы о доступных слоях карты, источнике ESRI, разнице со схемой |
| **Gemma (System 2)** | `colorblind_qa` | 8 | Пояснение назначения палитры Окабе, тританопии, контраста и настроек |
| **Gemma (System 2)** | `app_knowledge` | 20 | База знаний: панели, датчики (Open-Meteo), индексы EAQI, нормы ВОЗ, PM2.5, PM10, NO2, O3, SO2, CO |
| **Gemma (System 2)** | `persona_grammar`| 16 | Маскот Ая, создатель Николаев Артём, женский род («сама проверила», «рада помочь») |
| **Gemma (System 2)** | `navigation` | 36 | Переход к городам России (25+ городов) и мира, защита от ложного геокодинга («точка», «тачка», «тут») |
| **Gemma (System 2)** | `analytics` | 68 | Анализ текущей точки, бег/марафон, астма/ХОБЛ, дети/коляска, пожилые, NO2, O3, прогноз на 3 дня, архив, все дни |
| **ИТОГО** | **Все категории** | **242** | **86 тестов Jev (System 1) + 156 тестов Gemma (System 2)** |
