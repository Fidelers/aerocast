# aerocast

Проект карты химического состава воздуха и прогнозирования на 3 дня.

Стек: **React (Vite)** — фронтенд, **Express** — бэкенд, оба на Node.js.

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
└── server/                         # Серверная часть (Express)
    ├── config/
    │   └── db.js                   # Подключение к БД (заготовка)
    ├── controllers/
    │   ├── airController.js        # Логика /api/air: стратегия источников, кэш, история (заготовка, TDD-тесты написаны)
    │   └── searchController.js     # Логика /api/search: геокодер (заготовка, TDD-тесты написаны)
    ├── routes/
    │   └── api.js                  # Регистрация маршрутов API (/ping, /api/air)
    ├── services/
    │   ├── cacheService.js         # Кэширование ответов внешних запросов (заготовка)
    │   ├── historyService.js       # Хранение и история замеров (заготовка)
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
    ├── server.js                   # Точка входа: Express, CORS
    └── package.json
```


## Установка зависимостей

Зависимости прописаны в `package.json`, поэтому достаточно выполнить одну команду в каждой папке (порядок не важен):

```bash
# Бэкенд (Express + CORS)
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

Переменные из `server/.env.example`:

| Переменная         | Назначение                                                | Где используется              |
|--------------------|-----------------------------------------------------------|-------------------------------|
| `PORT`             | Порт бэкенда (по умолчанию `3000`)                        | `server.js`                   |
| `BACKUP_API_KEY`   | Ключ резервного источника данных (OpenWeatherMap)         | `services/backupAirService.js` |
| `FRONTEND_URL`     | Адрес фронтенда для CORS (по умолчанию http://localhost:5173) | резерв — пока CORS открыт для всех |

> Примечание: ключ геокодера не нужен — `services/geocodingService.js` работает через бесплатный API Open-Meteo. Основной источник (`primaryAirService`) тоже не требует ключа.

## Запуск

Нужны **два терминала** — один для бека, второй для фронта.

### 1. Бэкенд

```bash
cd server
npm start        # или: node server.js
npm run dev      # с автоперезапуском при изменениях (требуется nodemon)
```

Сервер поднимется на `http://localhost:3000` (или на порту из `PORT` в `server/.env`). Проверка: откройте в браузере `http://localhost:3000/ping` — должен вернуться JSON `{ "message": "Бэкенд на связи!" }`.

Доступные маршруты:

| Метод | Путь          | Назначение                                  | Статус                                             |
|-------|---------------|---------------------------------------------|----------------------------------------------------|
| GET   | `/ping`       | Проверка, что сервер работает               | реализован                                         |
| GET   | `/api/air`    | Данные о качестве воздуха (`lat`, `lon`, опц. `source`) | зарегистрирован, пока отдаёт 501-заглушку (контроллер не реализован) |

Когда `/api/air` будет реализован: параметры `lat` и `lon` — обязательные, `source` (`auto` | `primary` | `backup`) — опциональный (по умолчанию `auto`).

### 2. Фронтенд

```bash
cd frontend
npm run dev
```

Откройте адрес из вывода (по умолчанию `http://localhost:5173`). Блок «Тест связи» на странице показывает ответ бэкенда — это подтверждает, что фронт и бек связаны (CORS настроен на бэкенде).

## Тестирование

Тесты пишутся в стиле TDD — часть из них опережает реализацию и сейчас падает (это ожидаемо, пока соответствующие сервисы и контроллеры не реализованы).

### Бэкенд (Jest)

```bash
cd server
npm test       # jest в режиме watch (перезапуск при изменениях)
npx jest       # разовый прогон без watch
```

Покрыты: контроллеры (`airController`, `searchController`, `timeUtils`), маршруты (`api`) и сервисы (`aqiCalculator`, `backupAirService`, `cacheService`, `geocodingService`, `historyService`, `primaryAirService`). Сейчас проходят тесты реализованных модулей (`primaryAirService`, `geocodingService`, `timeUtils`).

### Фронтенд (Vitest)

```bash
cd frontend
npm test            # разовый прогон (vitest run)
npm run test:watch  # режим watch
```

Тесты `src/types.test.js` (классификация AQI) проходят — 10 тестов.
