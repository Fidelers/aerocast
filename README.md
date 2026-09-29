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
│   │   ├── assets/                 # Графика и иконки (hero.png, react.svg, vite.svg, icons/logo.svg)
│   │   ├── components/
│   │   │   ├── AboutModal.jsx      # Информационное окно: описание проекта, загрязнители, шкала EAQI и источники (реализовано)
│   │   │   ├── CitySearch.jsx      # Поиск города с автодополнением, дебаунсом и геокодированием (реализовано)
│   │   │   ├── Sidebar.jsx         # Боковая панель: выбор дней и часов, режимы, геолокация (реализовано)
│   │   │   ├── MapComponent.jsx    # Интерактивная карта Leaflet/OSM, маркеры качества воздуха (реализовано)
│   │   │   └── Test.jsx            # Проверка связи с бэкендом (/ping) (реализовано)
│   │   ├── styles/
│   │   │   ├── Sidebar.css         # Стили боковой панели
│   │   │   └── mapStyle.js         # Конфигурация тайлового слоя карты OpenStreetMap
│   │   ├── utils/
│   │   │   └── timeUtils.js        # Утилиты группировки времени по суткам и 3-часовой сетке (реализовано)
│   │   ├── App.jsx                 # Главный компонент (координация карты, сайдбара и модального окна)
│   │   ├── main.jsx                # Точка входа React
│   │   ├── types.js                # Классификация AQI: уровни, диапазоны, цвета, подписи (реализовано)
│   │   ├── App.css
│   │   └── index.css
│   ├── tests/                      # Unit и компонентные тесты (Vitest)
│   │   ├── App.test.jsx            # Интеграционные тесты взаимодействия компонентов
│   │   ├── components/             # AboutModal, CitySearch, MapComponent, Sidebar, Test
│   │   ├── utils/                  # timeUtils.test.js (группировка дат и 3-часовой сетки)
│   │   └── types.test.js           # Тесты классификации AQI / EAQI
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
│   ├── tests/                      # Unit и интеграционные тесты (Jest, 12 сьютов, 177 тестов, 100% PASS)
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
| `BACKUP_API_KEY`   | Ключ резервного источника (OpenWeatherMap, [инструкция ниже](#как-получить-backup_api_key-openweathermap)) | `services/backupAirService.js` |
| `FRONTEND_URL`     | Адрес фронтенда для CORS (по умолчанию `http://localhost:5173`)                | `server.js` (белый список CORS) |
| `API_TIMEOUT_MS`   | Таймаут внешних сетевых запросов в мс (по умолчанию `1000`)     | `services/*AirService.js`, `services/geocodingService.js` |

> Примечание: ключ геокодера не нужен — `services/geocodingService.js` работает через бесплатный API Open-Meteo. Основной источник (`primaryAirService`) также не требует ключа.

### Как получить BACKUP_API_KEY (OpenWeatherMap)

Переменная `BACKUP_API_KEY` необходима для работы резервного провайдера качества воздуха (`services/backupAirService.js`).

#### 1. Зачем нужен этот ключ
Aerocast построен по принципу высокой доступности и отказоустойчивости:
- **Основной источник (Primary)**: сервис [Open-Meteo](https://open-meteo.com/) — бесплатный, открытый, работает без авторизации.
- **Резервный источник (Backup)**: [OpenWeatherMap Air Pollution API](https://openweathermap.org/api/air-pollution) — подключается автоматически, если основной источник недоступен, возвращает сетевую ошибку или превышает лимит таймаута (`API_TIMEOUT_MS`), а также при явном запросе клиента с параметром `?source=backup` или `?source=open-weather-map`.
- Для выполнения запросов к API OpenWeatherMap обязательно требуется передавать персональный ключ авторизации в параметре `appid`.

#### 2. Стоимость и лимиты тарифа
- Для работы проекта используется стандартный **бесплатный тариф (Free Plan)** OpenWeather.
- Бесплатный тариф включает **60 запросов в минуту** и до **1 000 000 бесплатных запросов в месяц**.

#### 3. Пошаговая инструкция получения ключа

1. **Регистрация аккаунта OpenWeather**:
   - Перейдите на страницу создания аккаунта: [home.openweathermap.org/users/sign_up](https://home.openweathermap.org/users/sign_up) (или откройте [openweathermap.org](https://openweathermap.org/) и в правом верхнем углу нажмите **Sign In** ➔ **Create an Account**).
   - Заполните поля формы:
     - **Username**: имя пользователя (латинские буквы и цифры);
     - **Email**: ваш действующий почтовый ящик;
     - **Password** и **Repeat Password**: надёжный пароль (от 8 символов).
   - Установите обязательные согласия:
     - ☑ *I am 16 years old and over* (мне исполнилось 16 лет);
     - ☑ *I agree to the Terms and Conditions of service, Privacy Policy...* (согласие с условиями).
   - Пройдите капчу и нажмите кнопку **Create Account**.
   - При вопросе о сфере деятельности или целях использования выберите любой вариант (например, *Education/Student* или *Other*) и сохраните.

2. **Подтверждение адреса электронной почты (ОБЯЗАТЕЛЬНО!)**:
   - Откройте ваш почтовый ящик, указанный при регистрации.
   - Найдите входящее письмо от **OpenWeather** с темой *«Verify your email address»* (или проверьте папку «Спам», если письма нет во входящих).
   - Перейдите по ссылке или нажмите кнопку **Verify your email**.
   > [!IMPORTANT]
   > Если не подтвердить почту по ссылке из письма, ваш API-ключ не перейдёт в активное состояние и запросы будут отклоняться с ошибкой `401 Unauthorized`.

3. **Переход в раздел управления ключами (API Keys)**:
   - Авторизуйтесь на сайте [openweathermap.org](https://openweathermap.org/).
   - В верхнем правом углу нажмите на имя вашей учётной записи.
   - В выпадающем меню выберите пункт **My API keys** (прямая ссылка: [home.openweathermap.org/api_keys](https://home.openweathermap.org/api_keys)).

4. **Копирование или создание ключа**:
   - В таблице ключей уже присутствует сгенерированный системой ключ по умолчанию с именем `Default`.
   - Вы можете использовать его, либо создать отдельный именованный ключ для проекта:
     - В блоке справа **Create key** введите имя ключа (например, `aerocast-backup`);
     - Нажмите кнопку **Generate**;
   - В колонке **Key** скопируйте 32-значный ключ (шестнадцатеричная строка из букв и цифр, например `1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d`).

5. **Ожидание активации ключа на серверах OpenWeather**:
   > [!WARNING]
   > **Новые API-ключи активируются не мгновенно!** Процесс распределения нового ключа по серверам OpenWeather занимает **от 10 до 30 минут** (в редких случаях до 1–2 часов).
   > Если сразу после регистрации вы получаете ошибку `401 Unauthorized` с сообщением `{"cod":401, "message": "Invalid API key..."}`, это нормально — подождите 15–30 минут, после чего ключ заработает автоматически.

6. **Добавление ключа в конфигурацию проекта**:
   - Перейдите в каталог `server/` проекта.
   - Откройте файл `.env` (если файл ещё не создан, скопируйте его из образца: `copy .env.example .env` в Windows или `cp .env.example .env` в macOS/Linux).
   - Вставьте ваш ключ в переменную `BACKUP_API_KEY`:
     ```env
     BACKUP_API_KEY="1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d"
     ```
   - Сохраните файл.
   - Перезапустите бэкенд, если он уже был запущен (`npm run dev` или `npm start`).

#### 4. Проверка работоспособности ключа

Проверить, что ключ активирован и отдаёт корректные данные, можно следующими способами:

- **Способ 1: Прямой запрос к OpenWeather API через терминал (curl)**:
  ```bash
  curl "https://api.openweathermap.org/data/2.5/air_pollution/forecast?lat=55.75&lon=37.61&appid=ВАШ_КЛЮЧ"
  ```
  *(или откройте эту же ссылку в адресной строке любого браузера, заменив `ВАШ_КЛЮЧ` на ваш токен).*
  - **Успех**: вернётся статус `200 OK` и JSON-ответ с массивом прогноза `list`, включающим `components` (`pm2_5`, `pm10`, `no2`, `so2`, `co`, `o3`).
  - **Ключ ещё не активирован**: вернётся `{"cod":401, "message": "Invalid API key. Please see https://openweathermap.org/faq#error401 for more info."}` — подождите ещё немного.

- **Способ 2: Запрос через бэкенд Aerocast**:
  Запустите сервер (`cd server && npm run dev`) и перейдите в браузере по адресу:
  ```
  http://localhost:3000/api/air?lat=55.75&lon=37.61&source=backup
  ```
  В ответе должен вернуться структурированный JSON с полем `"used_source": "open-weather-map"`.

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

- **Все модули бэкенда полностью реализованы и протестированы (12 сьютов, 177 тестов — 100% PASS)**:
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
npm test                 # разовый прогон (vitest run)
npm run test:watch       # режим watch
npm run test:coverage    # отчёт о покрытии кода (v8)
```

Тесты фронтенда расположены в `frontend/tests/`:
- `tests/App.test.jsx` — интеграционные тесты координации компонентов, загрузки данных с бэкенда и модального окна.
- `tests/components/AboutModal.test.jsx` — информационное окно: расшифровка загрязнителей (PM2.5, PM10, NO2, SO2, CO, O3), шкала EAQI и источники данных.
- `tests/components/CitySearch.test.jsx` — поиск населенных пунктов, автодополнение подсказок, выбор города и дебаунс.
- `tests/components/MapComponent.test.jsx` — интерактивная карта, маркеры качества воздуха, переключение режимов визуализации и всплывающие подсказки.
- `tests/components/Sidebar.test.jsx` — боковая панель: выбор дней и часов, переключение режимов (цветовой, цифровой, комбо), геолокация, легенда AQI.
- `tests/components/Test.test.jsx` — отладочный компонент проверки связи и доступности бэкенда.
- `tests/utils/timeUtils.test.js` — утилиты группировки дат и 3-часовой сетки замеров.
- `tests/types.test.js` — классификация AQI / EAQI по уровням, числовым диапазонам, подписям и цветам.
