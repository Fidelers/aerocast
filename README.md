# AeroCast

> **AeroCast** — геоинформационная веб-платформа экологического мониторинга и прогнозирования химического состава атмосферного воздуха на 3 дня (с почасовым архивом на 7 дней, суммарно 11 дней данных) с двухконтурным локальным искусственным интеллектом (System 1 + System 2).

Проект предоставляет интерактивную карту качества воздуха с пространственной интерполяцией концентраций загрязнителей по всей территории России, графики динамики за 11 дней, подробные карточки газов и микрочастиц, голосовой ввод, а также персонажа-маскота **Аю** для консультаций и быстрой навигации.

---

## 🛠 Технологический стек

- **Фронтенд:**
  - **React 19** + **Vite 8** (быстрая сборка, React Fast Refresh, SPA).
  - **MapLibre GL 6:** аппаратный WebGL-рендеринг векторных и растровых слоев карты (OpenStreetMap и Спутниковый снимок).
  - **HTML5 Canvas Field Renderer & IDW:** интерполяция распределения качества воздуха методом обратно взвешенных расстояний (*Inverse Distance Weighting*) с маскированием строго по полигонам государственной границы РФ 2026 года.
  - **Интерактивные графики динамики:** визуализация временных рядов с выбором часа кликом по точке графика и переключением активных метрик.
  - **Доступность и темы:** Светлая / Тёмная темы, палитры для людей с цветовой слепотой (*Okabe-Ito, Дейтеранопия, Протанопия, Тританопия*).
  - **Голосовой ввод:** интеграция Web Speech API с автоматическим переключением на локальный модуль транскрипции Whisper.

- **Бэкенд:**
  - **Node.js (v20+)** + **Express 5** (RESTful API, CORS, обработка ошибок, Graceful Shutdown).
  - **SQLite (sqlite3 + sqlite):** кэш внешних API с поддержкой TTL, spatial-кэш регулярных сеток, журнал замеров качества воздуха, режим `WAL` (*Write-Ahead Logging*), транзакционные вставки и автоматический in-memory fallback при сбоях.
  - **Каскадная отказоустойчивость источников:** Основной (*Open-Meteo*) ➔ Резервный (*OpenWeatherMap Air Pollution API*) ➔ Офлайн-БД / Кэш.
  - **Геолокация:** поиск городов с автодополнением, GPS браузера и определение координат по IP (`/api/locate-me`).

- **Двухконтурный ИИ (Local AI System 1 & System 2):**
  - **System 1 (Jev-Style-0.8B):** сверхбыстрый (15–35 мс) классификатор без генерации текста (считывание вердиктов из логитов через CUDA C++ libllama) — Guardrails, смена слоев карты, тем интерфейса и палитр дальтонизма.
  - **System 2 (Gemma-4-E2B-it-Q4_K_M):** локальная LLM на `llama-server` (CUDA llama.cpp) — персонаж-маскот **Ая**, глубокий метеорологический анализ 11 дней, медицинские рекомендации и переход по городам.

- **DevOps и оркестрация:**
  - **Docker & Docker Compose:** единый стек (бэкенд, `jev-service`, `llama-server` с пробросом NVIDIA GPU).
  - **Менеджеры запуска:** интерактивные скрипты `launch.bat` (Windows) и `launch.sh` (Linux/macOS) для управления всеми компонентами.

- **Тестирование:**
  - **1 097 автоматических тестов (100% PASS):** 376 тестов бэкенда (Jest) + 721 тест фронтенда (Vitest).
  - **AI E2E Evaluation Suite:** 242 сквозных сценария валидации точности решений Jev и Gemma с замером задержек.

---

## 📋 Требования к окружению

- **Node.js** версии **20+** (LTS) и **npm**. Проверить: `node -v` и `npm -v`.
- *(Для ИИ-сервисов)* **Docker Desktop** (WSL2 на Windows) или Docker Engine + Docker Compose на Linux.
- *(Для GPU-ускорения ИИ)* Видеокарта NVIDIA с установленным драйвером и **NVIDIA Container Toolkit**.

---

## 📁 Структура проекта

```
aerocast/
├── frontend/                               # React-приложение (Vite)
│   ├── public/                             # Статика (favicon.svg, icons.svg)
│   ├── src/
│   │   ├── assets/                         # Графика, иконки и спрайты эмоций Аи
│   │   │   ├── AI/                         # Эмоции маскота: idle, think, alert, happy (webp, png)
│   │   │   └── icons/                      # SVG иконки: поиск, геолокация, спутник, слои, инфо
│   │   ├── components/
│   │   │   ├── AboutModal.jsx              # Окно «О проекте»: шкала EAQI, газы, ПДК, источники
│   │   │   ├── CitySearch.jsx              # Поиск города с автодополнением и дебаунсом
│   │   │   ├── DynamicsChart.jsx           # График динамики концентраций с кликом по точкам
│   │   │   ├── LayerSwitcher.jsx           # Переключатель подложек карты (OSM / Спутник)
│   │   │   ├── MapComponent.jsx            # Карта MapLibre GL, маркеры, растровое поле интерполяции
│   │   │   ├── PollutionDynamicsModal.jsx  # Модалка динамики: выбор метрик, графики, таймлайн
│   │   │   ├── RightAirPanel.jsx           # Правая панель: текущий AQI, раскрывающиеся карточки газов
│   │   │   ├── SettingsModal.jsx           # Настройки: Светлая/Тёмная тема, дальтонизм, режим маскота
│   │   │   ├── Sidebar.jsx                 # Сайдбар: календарь 11 дней, часы, режимы, геолокация
│   │   │   ├── Test.jsx                    # Отладочный компонент проверки связи (/ping)
│   │   │   └── AiChat/
│   │   │       ├── AiChatModal.jsx         # Окно диалога с Аей, история сообщений, голосовой ввод
│   │   │       └── AyaMascot.jsx           # Анимированный маскот Ая (цундере-маскот чистого воздуха)
│   │   ├── hooks/
│   │   │   └── useAirGrid.js               # Хук загрузки и кэширования регулярной макросетки РФ
│   │   ├── styles/                         # CSS-модули и стили компонентов
│   │   │   ├── mapStyle.js                 # Конфигурация слоев MapLibre GL (OSM + Satellite)
│   │   │   └── *.css                       # Стили окон, сайдбара, панели и тем
│   │   ├── utils/
│   │   │   ├── ayaPhrases.js               # Реплики и рандомные фразы маскота Аи
│   │   │   ├── canvasFieldRenderer.js      # Отрисовка цветового градиента поля на Canvas
│   │   │   ├── idwInterpolator.js          # Быстрая IDW-интерполяция сетки качества воздуха
│   │   │   ├── pollutantsInfo.js           # Описание, формулы, источники и ПДК 6 загрязнителей
│   │   │   ├── russiaBoundary2026.js       # Векторная полигональная маска границы РФ (JSON/JS)
│   │   │   └── timeUtils.js                # Утилиты времени, 3-часовой сетки и часового пояса
│   │   ├── App.jsx                         # Корневой координатор состояния и окон
│   │   ├── main.jsx                        # Точка входа React
│   │   └── types.js                        # Шкала EAQI/AQI, цвета, уровни и палитры дальтонизма
│   ├── tests/                              # 33 тестовых сьюта Vitest (721 тест, 100% PASS)
│   ├── vite.config.js
│   └── package.json
│
├── server/                                 # Бэкенд-приложение (Express + SQLite)
│   ├── ai/                                 # Модуль искусственного интеллекта (System 1 + System 2)
│   │   ├── config/                         # Конфигурация LLM и Jev (aiConfig.js, jevConfig.js)
│   │   ├── controllers/                    # aiController.js (обработка чата, Whisper-транскрипция)
│   │   ├── routes/                         # aiRoutes.js (/api/ai/chat, /transcribe, /status)
│   │   ├── schemas/                        # decisionSchemas.js (схемы классификаций решений Jev)
│   │   ├── services/
│   │   │   ├── aiRouter.js                 # Маршрутизация запросов между System 1 и System 2
│   │   │   ├── aiService.js                # Интеграция с llama-server, генерация ответов, Whisper
│   │   │   ├── jevClient.js                # Клиент взаимодействия с jev-service (FastAPI)
│   │   │   └── promptManager.js            # Промпты персонажа Аи, системный контекст и метеоанализ
│   │   ├── tests/                          # E2E Evaluation Suite (242 сценария: Jev + Gemma)
│   │   │   ├── evalRunner.js               # CLI-раннер тестов оценки качества ИИ
│   │   │   ├── evalDataset.json            # Полный объединенный тестовый датасет
│   │   │   └── evalReport.md               # Отчет оценки задержек и точности ИИ
│   │   └── index.js
│   ├── config/
│   │   └── db.js                           # Подключение к SQLite, режим WAL, миграции таблиц
│   ├── controllers/
│   │   ├── airController.js                # Логика /api/air, /api/air-quality и /api/locate-me
│   │   ├── gridAirController.js            # Логика макро- и микро-сеток пространственного покрытия
│   │   └── searchController.js             # Логика /api/search с геокодером и 24-часовым кэшем
│   ├── routes/
│   │   └── api.js                          # Маршрутизация основного API
│   ├── services/
│   │   ├── aqiCalculator.js                # Расчет европейского индекса EAQI по загрязнителям
│   │   ├── backupAirService.js             # Резервный источник OpenWeatherMap Air Pollution
│   │   ├── batchAirService.js              # Пакетное получение данных для координатных сеток
│   │   ├── cacheService.js                 # Кэширование ответов внешних API в SQLite
│   │   ├── geocodingService.js             # Геокодирование населенных пунктов через Open-Meteo
│   │   ├── historyService.js               # Управление 7-дневным архивом и слияние со свежими замерами
│   │   ├── primaryAirService.js            # Основной источник Open-Meteo
│   │   ├── spatialCacheService.js          # Кэширование пространственных макро/микро-сеток
│   │   ├── timeUtils.js                    # Форматирование и валидация ISO-времени (Europe/Moscow)
│   │   └── macroGridPoints550.json         # Координаты опорных точек сетки по всей России
│   ├── tests/                              # 17 сьютов Jest (376 тестов, 100% PASS)
│   ├── .env.example                        # Образец переменных окружения
│   ├── Dockerfile                          # Докеризация бэкенда
│   ├── server.js                           # Точка входа Express, CORS, shutdown handlers
│   └── package.json
│
├── docker/                                 # Докер-конфигурации микросервисов
│   └── jev-service/                        # System 1: C++ libllama + FastAPI микросервис
│       ├── Dockerfile
│       ├── server.py
│       └── requirements.txt
├── models/                                 # Директория весов локальных ИИ-моделей (GGUF)
├── SECRETS/                                # Внутренняя документация архитектуры
├── docker-compose.yml                      # Оркестрация: server, jev-service, llama-server
├── launch.bat                              # Менеджер управления проектом для Windows
├── launch.sh                               # Менеджер управления проектом для Linux / macOS
├── info_LLM.md                             # Полное руководство по System 2 (Gemma 4)
├── jev_info.md                             # Полное руководство по System 1 (Jev-Style)
└── README.md                               # Главная документация проекта
```

---

## ⚡ Быстрый старт

Управлять проектом можно тремя способами: через готовые скрипты управления (**Control Manager**), через **Docker Compose**, или **вручную через npm**.

### Способ 1: AeroCast Control Manager (Рекомендуемый)

В корне репозитория есть скрипты `launch.bat` (Windows) и `launch.sh` (Linux / macOS).

#### Интерактивное консольное меню:
- **Windows:** просто дважды кликните на `launch.bat` или запустите в PowerShell / CMD:
  ```cmd
  launch.bat
  ```
- **Linux / macOS:**
  ```bash
  chmod +x launch.sh
  ./launch.sh
  ```

#### Прямые команды запуска:
```bash
# Запустить весь стек (Docker контейнеры + React фронтенд)
launch.bat all             # (в Linux: ./launch.sh all)

# Запустить только Docker-сервисы (бэкенд, jev-service, llama-server)
launch.bat start

# Запустить только фронтенд на Vite (http://localhost:5173)
launch.bat front

# Посмотреть логи Docker в реальном времени
launch.bat logs

# Проверить статус всех сервисов
launch.bat status

# Остановить весь стек
launch.bat stop-all
```

---

### Способ 2: Полный стек в Docker Compose

Если вы планируете запускать проект вместе с локальными нейросетями:

1. Скачайте файлы моделей в папку `models/` согласно инструкциям в **[jev_info.md](file:///c:/Users/Administrator/Documents/GitHub/aerocast/jev_info.md)** и **[info_LLM.md](file:///c:/Users/Administrator/Documents/GitHub/aerocast/info_LLM.md)**.
2. Поднимите стек контейнеров:
   ```bash
   docker compose up --build
   ```
3. В отдельном терминале запустите фронтенд:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

Сервисы будут доступны по адресам:
- **Фронтенд:** `http://localhost:5173`
- **Бэкенд:** `http://localhost:3000`
- **Jev-Service (System 1):** `http://localhost:8001`
- **Llama-Server (System 2):** `http://localhost:8080`

---

### Способ 3: Ручной запуск для разработки (без Docker)

Если вы работаете над кодом фронтенда или бэкенда без запуска локальных нейросетей (все AI-запросы автоматически переходят в безопасный оффлайн-фоллбэк):

1. **Установка зависимостей:**
   ```bash
   # Бэкенд
   cd server
   npm install
   cd ..

   # Фронтенд
   cd frontend
   npm install
   cd ..
   ```

2. **Настройка окружения бэкенда:**
   ```bash
   cd server
   # В Windows:
   copy .env.example .env
   # В Linux / macOS:
   cp .env.example .env
   ```

3. **Запуск бэкенда (Терминал 1):**
   ```bash
   cd server
   npm run dev
   ```
   *Сервер запустится на `http://localhost:3000`.*

4. **Запуск фронтенда (Терминал 2):**
   ```bash
   cd frontend
   npm run dev
   ```
   *Фронтенд откроется на `http://localhost:5173`.*

---

## ⚙️ Настройка окружения (`server/.env`)

| Переменная | Назначение | Значение по умолчанию |
|---|---|---|
| `PORT` | Порт бэкенда Express | `3000` |
| `FRONTEND_URL` | Разрешенный адрес фронтенда для CORS | `http://localhost:5173` |
| `DB_PATH` | Путь к файлу базы данных SQLite | `server/data/cache.db` (или `server/cache.db`) |
| `API_TIMEOUT_MS` | Таймаут сетевых запросов к Open-Meteo и OpenWeather | `1000` (мс) |
| `BACKUP_API_KEY` | Персональный ключ OpenWeatherMap Air Pollution API | *опционально, см. инструкцию ниже* |
| `LLM_BASE_URL` | URL OpenAI-совместимого эндпоинта llama-server | `http://llama-server:8080/v1` (или `http://localhost:8080/v1`) |
| `LLM_API_KEY` | Токен авторизации LLM | `not-needed` |
| `LLM_MODEL` | Имя языковой модели | `gemma-4-E2B-it-Q4_K_M` |
| `LLM_MAX_TOKENS` | Максимальное число генерируемых токенов | `1500` |
| `LLM_TEMPERATURE` | Температура выборки генерации ответа | `0.8` |
| `LLM_TIMEOUT_MS` | Таймаут ожидания ответа языковой модели | `75000` (мс) |
| `LLM_MAX_CHAR_LIMIT` | Максимальная длина сообщения пользователя для ИИ | `1000` |
| `JEV_BASE_URL` | URL микросервиса быстрых решений Jev-Style | `http://localhost:8001` (или `http://jev-service:8001`) |
| `JEV_TIMEOUT_MS` | Таймаут обращения к System 1 | `3500` (мс) |

> [!NOTE]
> Основной источник данных качества воздуха (`primaryAirService`) и геокодер городов (`geocodingService`) работают через открытый бесплатный API Open-Meteo и **не требуют никаких API-ключей**.

---

### Как получить `BACKUP_API_KEY` (OpenWeatherMap)

Переменная `BACKUP_API_KEY` необходима для работы резервного провайдера качества воздуха (`services/backupAirService.js`) при недоступности Open-Meteo или запросе с `?source=backup`.

1. **Регистрация:** перейдите на [home.openweathermap.org/users/sign_up](https://home.openweathermap.org/users/sign_up) и создайте бесплатный аккаунт.
2. **Подтверждение почты (ОБЯЗАТЕЛЬНО):** подтвердите email по ссылке из входящего письма от OpenWeather, иначе ключ будет возвращать `401 Unauthorized`.
3. **Получение ключа:** перейдите в раздел **My API keys** ([home.openweathermap.org/api_keys](https://home.openweathermap.org/api_keys)) и скопируйте 32-значный ключ.
4. **Активация:** новым ключам OpenWeather требуется **от 10 до 30 минут** для распределения по серверам.
5. **Вставка в `.env`:** укажите ключ в `server/.env`:
   ```env
   BACKUP_API_KEY="ваш_32_значный_ключ"
   ```

---

## 🗄 База данных (SQLite)

- **Файл базы:** автоматически создается по пути `server/data/cache.db` (каталог создается автоматически).
- **Режим WAL:** активированы `PRAGMA journal_mode = WAL` и `PRAGMA busy_timeout = 5000` для максимального быстродействия и отсутствия взаимных блокировок при конкурентных запросах.
- **Таблицы:**
  - `api_cache` — быстрый кэш ответов внешних API с индексами по сроку жизни `expires_at`.
  - `air_quality_history` — почасовой архив фактических замеров за 7 дней с сохранением координат и концентраций загрязнителей. Вставки выполняются пакетами в рамках транзакции (`BEGIN TRANSACTION` / `COMMIT`).
  - Spatial-кэш пространственных сеток макро-покрытия РФ и локальных микро-сеток.
- **Отказоустойчивость:** в случае ошибки файловой системы сервис деградирует во временный in-memory кэш без падения сервера.

---

## 🔌 API Маршруты бэкенда

| Метод | Путь | Описание | Основные параметры |
|---|---|---|---|
| `GET` | `/ping` | Проверка доступности бэкенда | — |
| `GET` | `/api/air-quality` (алиас `/api/air`) | Почасовые данные качества воздуха за 11 дней | `lat`, `lon` (числа), `source` (`auto` \| `primary` \| `backup`) |
| `GET` | `/api/search` | Поиск городов и населенных пунктов | `q` (строка от 1 до 100 символов) |
| `GET` | `/api/locate-me` | Определение координат клиента по IP-адресу | — |
| `GET` | `/api/air-quality/grid/macro` | Сетка качества воздуха по опорным точкам РФ | — |
| `GET` | `/api/air-quality/grid/micro` | Локальная микро-сетка качества воздуха 5×5 | `lat`, `lon` |
| `GET` | `/api/air-quality/grid` | Унифицированный запрос сетки с выбором масштаба | `lat`, `lon`, `zoom` / `type` |
| `DELETE` | `/api/cache/grid` | Сброс пространственного кэша сеток | — |
| `POST` | `/api/ai/chat` | Диалог с ассистентом Аей и маршрутизация команд UI | `message`, `appContext` (история, город, метрики) |
| `POST` | `/api/ai/transcribe` | Преобразование речи в текст через Whisper | `audio` (base64-строка), `mimeType` |
| `GET` | `/api/ai/status` | Статус готовности сервисов System 1 и System 2 | — |

---

## 🧠 Двухконтурный ИИ (System 1 + System 2)

```
[Пользователь] ──> [AiChatModal (React)] ──> [/api/ai/chat (Express)]
                                                      │
                       ┌──────────────────────────────┴──────────────────────────────┐
                       ▼                                                             ▼
           [System 1: Jev-Style 0.8B]                                    [System 2: Gemma 4 2B]
          Микросервис jev-service (8001)                                 Сервис llama-server (8080)
          • Время отклика: 15–35 мс                                      • Время отклика: 2000–3500 мс
          • Без генерации текста (логиты)                                • Диалог от лица маскота Аи
          • Задачи: Guardrails, темы, карта,                             • Задачи: глубокая метеоаналитика,
            дальтонизм, фильтрация оффтопа                                 архив, прогноз, советы по здоровью
```

1. **System 1 (Jev-Style-0.8B-Decision-v3):**
   - Реализована на C++ libllama + FastAPI микросервисе в Docker.
   - Оценивает входной запрос за один forward-pass методом `decide_many`.
   - Мгновенно переключает слои карты (OSM/Спутник), темы (Светлая/Тёмная), палитры дальтонизма и отсекает запрещенный оффтоп (программирование, кулинария, математика, попытки взлома).
   - Подробнее: **[jev_info.md](file:///c:/Users/Administrator/Documents/GitHub/aerocast/jev_info.md)**.

2. **System 2 (gemma-4-E2B-it-Q4_K_M):**
   - Запускается в Docker через официальный образ `llama.cpp:server-cuda`.
   - Воплощает образ **Аи** — девушки-маскота чистого воздуха (создатель: Николаев Артём).
   - Анализирует архивные тренды, пиковые выбросы загрязнителей ($PM_{2.5}$, $PM_{10}$, $NO_2$, $SO_2$, $CO$, $O_3$), формирует медицинские рекомендации и осуществляет умный переход к городам на карте.
   - Подробнее: **[info_LLM.md](file:///c:/Users/Administrator/Documents/GitHub/aerocast/info_LLM.md)**.

---

## 🧪 Тестирование

Проект обладает всесторонним тестовым покрытием: более 1 000 тестов охватывают компоненты, утилиты, API, отказоустойчивость и точность искусственного интеллекта.

### 1. Тесты бэкенда (Jest — 17 сьютов, 376 тестов — 100% PASS)

```bash
cd server
npm test              # запуск всех тестов бэкенда
npm run test:watch    # запуск в режиме watch
npm run test:coverage # запуск с формированием отчета о покрытии
```

Покрытые модули бэкенда:
- `db.test.js` — инициализация SQLite, режим WAL, транзакции, миграции таблиц.
- `airController.test.js`, `gridAirController.test.js`, `searchController.test.js` — валидация параметров, каскадная стратегия источников, кэширование, IP-геолокация.
- `api.test.js`, `gridApi.test.js` — интеграционные контракты REST API.
- `primaryAirService.test.js`, `backupAirService.test.js` — нормализация данных Open-Meteo и OpenWeatherMap.
- `batchAirService.test.js`, `spatialCacheService.test.js` — генерация и кэширование регулярных сеток РФ.
- `aqiCalculator.test.js` — математический расчет интегрального индекса EAQI по худшему показателю.
- `historyService.test.js` — слияние 7-дневной истории с прогнозом и сохранение замеров.
- `timeUtils.test.js` — парсинг ISO-времени и временных поясов.
- `ai.test.js` — интеграционные тесты AI-модуля, fallback при недоступности нейросетей, транскрипция аудио.
- `server.test.js` — фильтрация CORS, обработка 404/500 JSON, `/ping`.

### 2. Тесты фронтенда (Vitest — 33 сьюта, 721 тест — 100% PASS)

```bash
cd frontend
npm test              # разовый прогон всех тестов
npm run test:watch    # интерактивный watch-режим
npm run test:coverage # отчет о покрытии v8
```

Покрытые модули фронтенда:
- `App.test.jsx`, `AppTimeSync.test.jsx` — интеграционная координация компонентов, реактивное автообновление времени по таймеру и `visibilitychange`.
- `MapComponent.test.jsx`, `MapComponentRaster.test.jsx`, `MapComponentCoverage.test.jsx` — рендеринг MapLibre GL, растровые слои интерполяции, маркеры, клики по карте.
- `Sidebar.test.jsx`, `SidebarCoverage.test.jsx`, `TodayAndCurrentTime.test.jsx` — выбор дат, часов, 3-часовой сетки, авто-выбор ближайшего времени, режимы маркеров.
- `RightAirPanel.test.jsx`, `RightAirPanelCoverage.test.jsx`, `RightAirPanelPinning.test.jsx` — индикатор EAQI со свойствами интерактивной кнопки, раскрывающиеся карточки газов, пиннинг панели.
- `PollutionDynamicsModal.test.jsx` — модальное окно динамики, переключение активных графиков кликом по карточкам загрязнителей, клик по точкам графика для смены времени.
- `AiChatModal.test.jsx`, `AiChatVoiceInput.test.jsx`, `AyaMascot.test.jsx` — диалог с Аей, анимации эмоций, голосовой ввод Web Speech API и MediaRecorder.
- `CitySearch.test.jsx`, `AboutModal.test.jsx`, `SettingsModal.test.jsx`, `LayerSwitcher.test.jsx`, `CoverageNotification.test.jsx`, `ForecastBadge.test.jsx`, `MobileLayout.test.jsx`.
- `idwInterpolator.test.js`, `canvasFieldRenderer.test.js` — алгоритм IDW-интерполяции и рендеринг тепловой карты на Canvas.
- `russiaBoundary2026.test.js` — проверка геометрии полигонов государственной границы РФ.
- `colorblindTypes.test.jsx`, `types.test.js`, `pollutantsInfo.test.js`, `timeUtils.test.js`, `mapStyle.test.js`, `EscapeHierarchy.test.jsx`.

### 3. Сквозная оценка ИИ (AI E2E Evaluation Suite — 242 сценария)

```bash
# Быстрая проверка System 1 (Jev-Style: Guardrails + UI-роутинг, 86 тестов):
npm run test:eval:jev --prefix server

# Проверка System 2 (Gemma 4: Метеоанализ + Персона Аи, 156 тестов):
npm run test:eval:gemma --prefix server

# Полный прогон всех 242 сценариев:
npm run test:eval --prefix server
```

---

## 🎨 Доступность и шкала качества воздуха (EAQI)

Классификация качества воздуха в AeroCast основана на официальной европейской шкале **European Air Quality Index (EAQI)**:

| Уровень | Статус | Стандартный цвет | Okabe-Ito (Дальтонизм) | Описание |
|---|---|---|---|---|
| 0 – 20 | **Отлично** | `#4CAF50` (Зеленый) | `#0072B2` (Синий) | Воздух идеально чистый, ограничений нет |
| 21 – 40 | **Хорошо** | `#8BC34A` (Салатовый) | `#56B4E9` (Голубой) | Качество приемлемо для большинства людей |
| 41 – 60 | **Удовлетворительно** | `#FFEB3B` (Желтый) | `#F0E442` (Песочный) | Чувствительным людям стоит снизить нагрузку |
| 61 – 80 | **Плохо** | `#FF9800` (Оранжевый) | `#E69F00` (Охра) | Загрязнение заметно, риск для дыхания |
| 81 – 100 | **Очень плохо** | `#F44336` (Красный) | `#D55E00` (Красно-оранжевый) | Не рекомендуется длительное пребывание на улице |
| > 100 | **Опасно** | `#D50000` (Темно-красный) | `#7B3294` (Фиолетовый) | Чрезвычайная ситуация, избегайте выхода наружу |

В настройках приложения доступны палитры:
- **Okabe-Ito** (универсальная контрастная палитра);
- **Дейтеранопия** (для восприятия при нарушении зеленых рецепторов);
- **Протанопия** (для восприятия при нарушении красных рецепторов);
- **Тританопия** (для восприятия при нарушении синих рецепторов).

---

## 📄 Лицензия

Проект разработан для открытого и свободного мониторинга окружающей среды. Распространяется на условиях лицензии **ISC**.
