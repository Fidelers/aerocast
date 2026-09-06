# aerocast

Проект карты химического состава воздуха и прогнозирования на 3 дня.

Стек: **React (Vite)** — фронтенд, **Express** — бэкенд, оба на Node.js.

## Требования

- **Node.js** версии **20.19+** (рекомендуется последняя LTS) и **npm**.
- Проверить версии: `node -v` и `npm -v`.

## Структура проекта

```
aerocast/
├── frontend/                       # React-приложение (Vite)
│   └── src/
│       ├── components/             # React-компоненты
│       ├── App.jsx
│       └── main.jsx
└── server/                         # Express-бэкенд
    ├── config/
    │   └── db.js                   # настройки подключения к БД
    ├── controllers/
    │   └── airController.js        # логика обработки запросов
    ├── routes/
    │   └── api.js                  # маршруты /api/*
    ├── services/
    │   ├── dbService.js            # работа с PostgreSQL (SQL-запросы)
    │   ├── gridService.js          # расчёт сетки координат
    │   └── owmService.js           # внешнее API OpenWeatherMap
    ├── tests/                      # unit-тесты (по слоям кода)
    │   ├── controllers/
    │   │   └── airController.test.js
    │   ├── routes/
    │   │   └── api.test.js
    │   └── services/
    │       ├── dbService.test.js
    │       ├── gridService.test.js
    │       └── owmService.test.js
    ├── .env.example                # шаблон переменных окружения
    ├── server.js                   # точка входа
    └── package.json
```

Архитектура сервера: запрос приходит в `routes/api.js` → контроллер (`controllers/`) → сервисы (`services/`): БД, расчёт сетки точек и внешнее API.

## Установка зависимостей

### Быстрый способ

Все модули уже прописаны в `package.json`, поэтому достаточно выполнить одну команду в каждой папке (порядок не важен):

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

Если вы уже видели папку `node_modules` в `frontend/` и `server/` — зависимости установлены, шаг можно пропустить.

### Установка модулей вручную

Можно поставить каждый модуль явно. Бэкенд — папка `server/`:

```bash
cd server
npm install express
npm install cors
cd ..
```

Фронтенд — папка `frontend/`. Основные зависимости (React):

```bash
cd frontend
npm install react react-dom
cd ..
```

## Настройка окружения (переменные)

Бэкенд читает настройки из переменных окружения (порт, БД PostgreSQL и др.). Файла `.env` в репозитории нет — создайте его из шаблона:

```bash
cd server
copy .env.example .env
```

Откройте `server/.env` и заполните как минимум параметры подключения к PostgreSQL (`DB_USER`, `DB_PASSWORD`, `DB_NAME`). Порт бэкенда задаёт `PORT` (по умолчанию `3000`). Ключ шифрования `ENCRYPTION_KEY` можно сгенерировать командой `openssl rand -hex 32`.

## Запуск

Нужны **два терминала** — один для бека, второй для фронта.

### 1. Бэкенд

```bash
cd server
node server.js
```

Сервер поднимется на `http://localhost:3000` (или на порту из `PORT` в `server/.env`). Проверить: откройте в браузере `http://localhost:3000/ping` — должен вернуться JSON `{ "message": "Бэкенд на связи!" }`.

Доступные маршруты:

| Метод | Путь          | Назначение                     |
|-------|---------------|--------------------------------|
| GET   | `/ping`       | Проверка, что сервер работает  |
| GET   | `/api/air`    | Данные о качестве воздуха      |

`GET /api/air` сейчас — заглушка (отвечает `501`), логика ещё в разработке.

### 2. Фронтенд

В другом терминале:

```bash
cd frontend
npm run dev
```

Откройте в браузере адрес из вывода (по умолчанию `http://localhost:5173`). На странице блок «Тест связи» должен показать ответ бэкенда — это подтверждает, что фронт и бек связаны. CORS на бэкенде уже настроен.

## Тестирование (unit-тесты)

Место под unit-тесты подготовлено на бэкенде — папка `server/tests/`. Файлы тестов разложены по слоям кода, к которому относятся:

| Файл                                              | Что тестируется                                |
|---------------------------------------------------|------------------------------------------------|
| `server/tests/routes/api.test.js`                 | Маршруты (`routes/api.js`)                     |
| `server/tests/controllers/airController.test.js`  | Контроллер (`controllers/airController.js`)    |
| `server/tests/services/dbService.test.js`         | Сервис работы с БД (`services/dbService.js`)   |
| `server/tests/services/gridService.test.js`       | Расчёт сетки точек (`services/gridService.js`) |
| `server/tests/services/owmService.test.js`        | Внешнее API (`services/owmService.js`)         |

Запуск тестов из папки `server/`:

```bash
cd server
npm test
```

> Сейчас в `server/package.json` скрипт `test` — заглушка, а сами тестовые файлы пустые. Команда заработает после подключения тест-раннера (например, Jest) и написания проверок.


