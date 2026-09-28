# aerocast

Проект карты химического состава воздуха и прогнозирования на 3 дня.

Стек: **React (Vite)** — фронтенд, **Express** + **SQLite** — бэкенд, оба на Node.js.

## Требования

- **Node.js** версии **20+** (рекомендуется последняя LTS) и **npm**.
- Проверить версии: `node -v` и `npm -v`.

## Структура проекта

```
aerocast/
├── frontend/                       # React-приложение (Vite)
│   ├── public/                     # Статика (favicon.svg, icons.svg)
│   ├── src/
│   │   ├── assets/                 # Картинки (hero.png, react.svg, vite.svg)
│   │   ├── components/
│   │   │   ├── Test.jsx            # Проверка связи с бэкендом (/ping)
│   │   │   ├── CitySearch.jsx      # Поиск города с автодополнением (TDD в процессе)
│   │   │   ├── Sidebar.jsx         # Боковая панель: выбор дней и часов (реализовано)
│   │   │   └── MapComponent.jsx    # Карта и отрисовка данных (заготовка)
│   │   ├── styles/
│   │   │   ├── Sidebar.css         # Стили боковой панели
│   │   │   └── mapStyle.js         # Конфигурация тайлового слоя карты OpenStreetMap
│   │   ├── utils/
│   │   │   └── timeUtils.js        # Утилиты группировки времени по суткам и часам (реализовано)
│   │   ├── App.jsx                 # Главный компонент
│   │   ├── main.jsx                # Точка входа React
│   │   ├── types.js                # Классификация AQI: уровни, подписи, цвета (реализовано)
│   │   ├── App.css
│   │   └── index.css
│   ├── tests/                      # Unit и компонентные тесты (Vitest)
│   │   ├── components/             # CitySearch.test.jsx, Sidebar.test.jsx
│   │   ├── utils/                  # timeUtils.test.js
│   │   └── types.test.js           # Тесты классификации AQI
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── server/                         # Серверная часть (Express + SQLite)
│   ├── config/
│   │   └── db.js                   # Подключение к SQLite (cache.db), WAL-режим, миграции таблиц и индексов (реализовано)
│   ├── controllers/
│   │   ├── airController.js        # Логика /api/air: стратегия источников, кэш, история, офлайн-резерв (реализовано)
│   │   └── searchController.js     # Логика /api/search: геокодер с кэшированием и валидацией длины (реализовано)
│   ├── routes/
│   │   └── api.js                  # Регистрация маршрутов API (/ping, /api/air, /api/air-quality, /api/search) (реализовано)
│   ├── services/
│   │   ├── cacheService.js         # Кэширование ответов внешних запросов в SQLite c in-memory fallback (реализовано)
│   │   ├── historyService.js       # Хранение и транзакционное слияние истории замеров в SQLite (реализовано)
│   │   ├── primaryAirService.js    # Основной источник — Open-Meteo (реализовано)
│   │   ├── backupAirService.js     # Резервный источник — OpenWeatherMap (HTTPS) (реализовано)
│   │   ├── aqiCalculator.js        # Расчёт индекса EAQI по европейской шкале (реализовано)
│   │   ├── geocodingService.js     # Геокодирование городов — Open-Meteo (реализовано)
│   │   └── timeUtils.js            # Утилиты времени: ISO-часы, Europe/Moscow (реализовано)
│   ├── tests/                      # Unit и интеграционные тесты (Jest)
│   │   ├── config/                 # db.test.js (реализовано)
│   │   ├── controllers/            # airController.test.js, searchController.test.js (реализовано)
│   │   ├── routes/                 # api.test.js (реализовано)
│   │   ├── services/               # aqiCalculator, backupAirService, cacheService, geocodingService,
│   │   │                           # historyService, primaryAirService, timeUtils (реализовано)
│   │   └── server.test.js          # Тесты CORS, 404 JSON, ping (реализовано)
│   ├── .env.example                # Шаблон переменных окружения
│   ├── cache.db                    # База данных SQLite (создаётся автоматически, игнорируется git)
│   ├── server.js                   # Точка входа: Express, CORS, Graceful Shutdown, 404/Error Middleware
│   └── package.json
└── SECRETS/                        # Документация архитектуры и планы (endpoints.txt, logic.txt)
```


## Установка зависимостей

Зависимости прописаны в `package.json`, поэтому достаточно выполнить одну команду в каждой папке (порядок не важен):

```bash
# Бэкенд (Express + SQLite + Axios + CORS + Dotenv + Nodemon)
cd server
npm install
cd ..

# Фронтенд (React + Vite)
cd frontend
npm install
cd ..
```

Если папки `node_modules` уже есть в `frontend/` и `server/` — зависимости установлены, шаг можно пропустить.

## Настройка окружения

Бэкенд читает настройки из переменных окружения. Файла `.env` в репозитории нет (он игнорируется git) — создайте его из шаблона:

```bash
cd server
copy .env.example .env
```

Переменные окружения (`server/.env`):

| Переменная         | Назначение                                                                     | Где используется              |
|--------------------|--------------------------------------------------------------------------------|-------------------------------|
| `PORT`             | Порт бэкенда (по умолчанию `3000`)                                             | `server.js`                   |
| `DB_PATH`          | Путь к файлу базы данных SQLite (по умолчанию `server/cache.db`)                | `config/db.js`                |
| `BACKUP_API_KEY`   | Ключ резервного источника данных (OpenWeatherMap)                              | `services/backupAirService.js` |
| `FRONTEND_URL`     | Адрес фронтенда для CORS (по умолчанию `http://localhost:5173`)                | `server.js` (белый список CORS) |
| `API_TIMEOUT_MS`   | Таймаут внешних сетевых запросов в мс (по умолчанию `1000`)     | `services/*AirService.js`, `services/geocodingService.js` |

> Примечание: ключ геокодера не нужен — `services/geocodingService.js` работает через бесплатный API Open-Meteo. Основной источник (`primaryAirService`) тоже не требует ключа.

## База данных (SQLite)

В проекте используется встроенная база данных **SQLite** (`sqlite3` + `sqlite`):
- **Файл базы**: по умолчанию создаётся в `server/cache.db` (при необходимости путь можно переопределить через `DB_PATH`). Каталог создаётся автоматически при отсутствии.
- **Режим WAL и надёжность**: включены `PRAGMA journal_mode = WAL` и `PRAGMA busy_timeout = 5000` для предотвращения взаимных блокировок базы при параллельных запросах.
- **Таблицы и индексы**:
  - `api_cache` — быстрый кэш ответов внешних API с поддержкой TTL и индексами по `expires_at` и `updated_at`.
  - `air_quality_history` — архив фактических замеров качества воздуха (до 7 суток) с сохранением координат и показателей загрязнителей. Вставки выполняются пакетно в рамках единой транзакции (`BEGIN TRANSACTION` / `COMMIT`).
- **Отказоустойчивость**: при отсутствии или недоступности файла БД сервисы автоматически деградируют во временный in-memory fallback без падения сервера.

## Запуск

Нужны **два терминала** — один для бека, второй для фронта.

### 1. Бэкенд

```bash
cd server
npm start        # или: node server.js
npm run dev      # с автоперезапуском при изменениях (nodemon)
```

Сервер поднимется на `http://localhost:3000` (или на порту из `PORT` в `server/.env`). Проверка: откройте в браузере `http://localhost:3000/ping` — должен вернуться JSON `{ "message": "Бэкенд на связи!" }`.

Доступные маршруты:

| Метод | Путь                               | Назначение                                  | Статус       |
|-------|------------------------------------|---------------------------------------------|--------------|
| GET   | `/ping`                            | Проверка доступности бэкенда               | реализован   |
| GET   | `/api/air` (`/api/air-quality`)    | Данные о качестве воздуха (`lat`, `lon`, опц. `source`) | реализован   |
| GET   | `/api/search`                      | Поиск населённых пунктов по названию (`q`)  | реализован   |

Параметры `/api/air` (`/api/air-quality`):
- `lat` и `lon` — обязательные координаты (числа от -90 до 90 и от -180 до 180).
- `source` (`auto` | `primary` | `backup` | `open-meteo` | `open-weather-map`) — опциональный источник (по умолчанию `auto`).
- При сбое источников автоматически задействуется устаревший кэш или архив БД (`used_source: "offline_database"`).

Параметры `/api/search`:
- `q` — поисковая строка (название города, от 1 до 100 символов).

Формат ошибок: все неизвестные маршруты и ошибки валидации возвращают стандартизированный JSON с соответствующим HTTP-кодом (400, 403, 404, 500).

### 2. Фронтенд

```bash
cd frontend
npm run dev
```

Откройте адрес из вывода (по умолчанию `http://localhost:5173`). Блок «Тест связи» на странице показывает ответ бэкенда — это подтверждает, что фронт и бек связаны (CORS настроен на бэкенде).

## Тестирование

### Бэкенд (Jest)

```bash
cd server
npm test              # разовый прогон тестов (jest)
npm run test:watch    # запуск в режиме watch (jest --watchAll)
npm run test:coverage # запуск с отчётом о покрытии кода (jest --coverage)
```

- **Все модули бэкенда полностью реализованы и протестированы (12 сьютов, 152 теста — 100% PASS)**:
  - `tests/config/db.test.js` — подключение к SQLite, WAL-режим, миграции таблиц и индексов, закрытие соединения.
  - `tests/services/primaryAirService.test.js` — получение данных качества воздуха из Open-Meteo.
  - `tests/services/backupAirService.test.js` — опрос резервного источника (OpenWeatherMap по HTTPS) и нормализация данных.
  - `tests/services/geocodingService.test.js` — геокодирование городов через Open-Meteo.
  - `tests/services/cacheService.test.js` — кэширование в SQLite и in-memory fallback при сбоях БД.
  - `tests/services/historyService.test.js` — транзакционное сохранение архива замеров и слияние исторических данных со свежими.
  - `tests/services/timeUtils.test.js` — форматирование времени в ISO-часы с учётом таймзоны `Europe/Moscow`.
  - `tests/services/aqiCalculator.test.js` — расчёт индекса EAQI по отдельным загрязнителям.
  - `tests/controllers/searchController.test.js` — валидация параметра `q` (включая лимит длины), кэширование геокодирования на 24 часа.
  - `tests/controllers/airController.test.js` — стратегия источников (`auto`/`primary`/`backup`), офлайн-резерв, кэш, архив.
  - `tests/routes/api.test.js` — интеграционные тесты контрактов маршрутов `/api/air` (`/api/air-quality`) и `/api/search`.
  - `tests/server.test.js` — проверка доступности `/ping`, обработка 404 в формате JSON, фильтрация CORS.

Покрытие кода контроллеров и роутов составляет **100%**.

### Фронтенд (Vitest)

```bash
cd frontend
npm test            # разовый прогон (vitest run)
npm run test:watch  # режим watch
```

Тесты фронтенда расположены в `frontend/tests/`:
- `tests/types.test.js` — классификация AQI / EAQI (12 тестов).
- `tests/utils/timeUtils.test.js` — утилиты группировки дат и 3-часовой сетки (19 тестов).
- `tests/components/Sidebar.test.jsx` — рендеринг карточек дней и часов (4 теста).
- `tests/components/CitySearch.test.jsx` — TDD-тесты поиска городов с геокодером и дебаунсом (8 тестов, RED-фаза).
