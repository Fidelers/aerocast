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
│   │   │   ├── Sidebar.jsx         # Боковая панель: поиск, переключатели (заготовка)
│   │   │   └── MapComponent.jsx    # Карта и отрисовка данных (заготовка)
│   │   ├── styles/
│   │   │   └── Sidebar.css         # Стили боковой панели (заготовка)
│   │   ├── App.jsx                 # Главный компонент
│   │   ├── main.jsx                # Точка входа React
│   │   ├── types.js                # Классификация AQI: уровни, подписи, цвета (реализовано)
│   │   ├── types.test.js           # Тесты types.js (Vitest)
│   │   ├── App.css
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── server/                         # Серверная часть (Express + SQLite)
    ├── config/
    │   └── db.js                   # Подключение к SQLite (cache.db), миграции таблиц (реализовано)
    ├── controllers/
    │   ├── airController.js        # Логика /api/air: стратегия источников, кэш, история (заготовка, TDD-тесты написаны)
    │   └── searchController.js     # Логика /api/search: геокодер с кэшированием (заготовка, TDD-тесты написаны)
    ├── routes/npx jest --coverage
    │   └── api.js                  # Регистрация маршрутов API (/ping, /api/air)
    ├── services/
    │   ├── cacheService.js         # Кэширование ответов внешних запросов в SQLite c in-memory fallback (реализовано)
    │   ├── historyService.js       # Хранение и слияние истории замеров в SQLite (реализовано)
    │   ├── primaryAirService.js    # Основной источник — Open-Meteo (реализовано)
    │   ├── backupAirService.js     # Резервный источник — OpenWeatherMap (реализовано)
    │   ├── aqiCalculator.js        # Расчёт индекса EAQI (заготовка)
    │   ├── geocodingService.js     # Геокодирование городов — Open-Meteo (реализовано)
    │   └── timeUtils.js            # Утилиты времени: ISO-часы, Europe/Moscow (реализовано)
    ├── tests/                      # Unit-тесты (Jest), стиль TDD
    │   ├── controllers/            # airController, searchController, timeUtils
    │   ├── routes/                 # api
    │   └── services/               # aqiCalculator, backupAirService, cacheService,
    │                               # geocodingService, historyService, primaryAirService
    ├── .env.example                # Шаблон переменных окружения
    ├── cache.db                    # База данных SQLite (создаётся автоматически, игнорируется git)
    ├── server.js                   # Точка входа: Express, CORS
    └── package.json
```


## Установка зависимостей

Зависимости прописаны в `package.json`, поэтому достаточно выполнить одну команду в каждой папке (порядок не важен):

```bash
# Бэкенд (Express + SQLite + Axios + CORS)
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
| `FRONTEND_URL`     | Адрес фронтенда для CORS (по умолчанию `http://localhost:5173`)                | резерв — пока CORS открыт для всех |

> Примечание: ключ геокодера не нужен — `services/geocodingService.js` работает через бесплатный API Open-Meteo. Основной источник (`primaryAirService`) тоже не требует ключа.

## База данных (SQLite)

В проекте используется встроенная база данных **SQLite** (`sqlite3` + `sqlite`):
- **Файл базы**: по умолчанию создаётся в `server/cache.db` (при необходимости путь можно переопределить через `DB_PATH`).
- **Таблицы**:
  - `api_cache` — быстрый кэш ответов внешних API с поддержкой TTL и автоматической очисткой записей старше 7 суток.
  - `air_quality_history` — архив фактических замеров качества воздуха (до 7 суток) с сохранением координат и показателей загрязнителей.
- **Отказоустойчивость**: при отсутствии или недоступности файла БД сервисы автоматически деградируют во временный in-memory fallback без падения сервера.

## Запуск

Нужны **два терминала** — один для бека, второй для фронта.

### 1. Бэкенд

```bash
cd server
npm start        # или: node server.js
npm run dev      # с автоперезапуском при изменениях (требуется nodemon)
```

Сервер поднимется на `http://localhost:3000` (или на порту из `PORT` в `server/.env`). Проверка: откройте в браузере `http://localhost:3000/ping` — должен вернуться JSON `{ "message": "Бэкенд на связи!" }`.

Доступные и разрабатываемые маршруты:

| Метод | Путь          | Назначение                                  | Статус                                             |
|-------|---------------|---------------------------------------------|----------------------------------------------------|
| GET   | `/ping`       | Проверка, что сервер работает               | реализован                                         |
| GET   | `/api/air`    | Данные о качестве воздуха (`lat`, `lon`, опц. `source`) | зарегистрирован, пока отдаёт 501-заглушку (контроллер в разработке) |
| GET   | `/api/search` | Поиск населённых пунктов по названию (`q`)  | в разработке (TDD-тесты написаны)                  |

Параметры `/api/air`: `lat` и `lon` — обязательные координаты, `source` (`auto` | `primary` | `backup`) — опциональный источник (по умолчанию `auto`).  
Параметры `/api/search`: `q` — поисковая строка (название города).

### 2. Фронтенд

```bash
cd frontend
npm run dev
```

Откройте адрес из вывода (по умолчанию `http://localhost:5173`). Блок «Тест связи» на странице показывает ответ бэкенда — это подтверждает, что фронт и бек связаны (CORS настроен на бэкенде).

## Тестирование

Тесты пишутся в стиле TDD — часть из них опережает реализацию и проверяет контракты ещё не завершённых модулей.

### Бэкенд (Jest)

```bash
cd server
npm test       # jest в режиме watch (перезапуск при изменениях)
npx jest       # разовый прогон без watch
```

- **Успешно проходят тесты реализованных модулей**:
  - `tests/services/primaryAirService.test.js` — получение данных качества воздуха из Open-Meteo.
  - `tests/services/geocodingService.test.js` — геокодирование городов через Open-Meteo.
  - `tests/services/cacheService.test.js` — кэширование в SQLite и fallback.
  - `tests/services/historyService.test.js` — сохранение архива замеров и слияние данных.
  - `tests/controllers/timeUtils.test.js` — форматирование времени в часовом поясе `Europe/Moscow`.
- **В разработке (TDD)**:
  - `tests/services/aqiCalculator.test.js`, `tests/services/backupAirService.test.js`, `tests/controllers/airController.test.js`, `tests/controllers/searchController.test.js`, `tests/routes/api.test.js`.

### Фронтенд (Vitest)

```bash
cd frontend
npm test            # разовый прогон (vitest run)
npm run test:watch  # режим watch
```

Тесты `src/types.test.js` (классификация AQI / EAQI) проходят — 10 тестов.
