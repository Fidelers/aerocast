# AeroCast Two-Tier AI E2E Evaluation Suite

Набор тестов для независимой и сквозной оценки двухконтурной архитектуры AI в AeroCast:
* **System 1 (Jev-Style-0.8B):** сверхбыстрый (~20–100 мс) классификатор решений, роутер команд UI (слои карты, темы, палитры дальтонизма) и Guardrails (перехват кода/оффтопа).
* **System 2 (Gemma-4-E2B-it):** локальная большая языковая модель (~2–4 сек) для отыгрыша персонажа Аи, ответов на вопросы о сервисе, навигации и глубокого анализа качества воздуха.

---

## 📁 Структура директорий

```
server/ai/tests/
├── jev/                               # ⚡ ТЕСТЫ SYSTEM 1 (Jev-Style-0.8B)
│   ├── dataset.json                   # Сценарии UI-роутинга, смены слоев, тем, дальтонизма и guardrails
│   └── jev.eval.test.js               # Jest-раннер для быстрого прогона Jev (~5 секунд)
│
├── gemma/                             # 🧠 ТЕСТЫ SYSTEM 2 (Gemma-4-E2B-it)
│   ├── dataset.json                   # Сценарии аналитики воздуха, прогноза, архивов, здоровья и персоны Аи
│   └── gemma.eval.test.js             # Jest-раннер для инференса Gemma-4
│
├── evalRunner.js                      # Унифицированный CLI-раннер (--target=all|jev|gemma)
├── ai.eval.test.js                    # Сквозной Jest-тест, объединяющий обе подсистемы
├── evalReport.md                      # Автоматический отчет с замерами задержек и разбивкой
└── README.md
```

---

## 🚀 Запуск тестов

### 1. Быстрые тесты System 1 (Jev-Style):
Запускает только тесты роутера UI и Guardrails. Выполняются мгновенно (~3–5 секунд на весь сьют из 34 тестов):
```bash
# Через npm script
npm run test:eval:jev --prefix server

# Напрямую через CLI runner
node server/ai/tests/evalRunner.js --target=jev
```

### 2. Тесты System 2 (Gemma-4):
Запускает тесты глубокой аналитики воздуха, прогноза, архива и диалогового персонажа:
```bash
# Через npm script
npm run test:eval:gemma --prefix server

# Напрямую через CLI runner
node server/ai/tests/evalRunner.js --target=gemma
```

### 3. Полный прогон обоих контуров (Все 64+ теста):
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
| **Jev (System 1)** | `map_layers` | 9 | Спутник, OSM, сленг «космос», «сделай обратно карту» |
| **Jev (System 1)** | `theme` | 6 | Тёмная, светлая, ночной/дневной режим, «сделай обратно тему» |
| **Jev (System 1)** | `colorblind` | 11 | Окабе (по умолчанию), Дейтеранопия, Протанопия, Тританопия, выключение |
| **Jev (System 1)** | `guardrails` | 8 | Отказ от генерации кода (Python, JS, C++), рецептов, крипты, математики, jailbreak |
| **Gemma (System 2)** | `map_layers_qa` | 1 | Ответы на вопросы о доступных слоях карты |
| **Gemma (System 2)** | `colorblind_qa` | 1 | Пояснение назначения палитры Окабе |
| **Gemma (System 2)** | `app_knowledge` | 3 | База знаний об интерфейсе, панелях, датчиках (Open-Meteo) |
| **Gemma (System 2)** | `persona_grammar`| 4 | Ая, разработчик Николаев Артём, женский род («сама проверила») |
| **Gemma (System 2)** | `navigation` | 9 | Переход к Москве, СПб, Казани, Сочи, Екб, отказ от геокодинга «точка»/«тачка» |
| **Gemma (System 2)** | `analytics` | 12 | Анализ текущей точки, бег/спорт, астма/ингалятор, дети, NO2, O3, прогноз на 3 дня, архив, все дни |
