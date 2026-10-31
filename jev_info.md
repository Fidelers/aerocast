# Jev-Style AI (System 1) Integration Guide: AeroCast

Практическое руководство по развертыванию, конфигурации и работе микросервиса принятия решений **Jev-Style-Decision** (System 1) в экосистеме AeroCast.

---

## 1. Архитектура: System 1 (Jev) и System 2 (Gemma 4)

В AeroCast реализована двухконтурная когнитивная архитектура искусственного интеллекта:

```
[Пользователь] ──> [AiChatModal (React)] ──> [/api/ai/chat (Express)]
                                                      │
                       ┌──────────────────────────────┴──────────────────────────────┐
                       ▼                                                             ▼
           [System 1: Jev-Style 0.8B]                                    [System 2: Gemma 4 2B]
          Микросервис jev-service (8001)                                 Сервис llama-server (8080)
          • Время отклика: 15–35 мс                                      • Время отклика: 2000–3500 мс
          • Без генерации текста (считывание логитов)                    • Авторегрессионная генерация
          • 1 forward-pass на все вопросы (/decide_many)                 • Диалог от лица маскота Аи
          • Задачи: Guardrails, темы, карта, дальтонизм,                 • Задачи: глубокая метеоаналитика,
            классификация экологического намерения                         архив, прогноз, советы по здоровью
```

### Принцип работы Jev-Style
1. **Не генерирует текст токен за токеном.** Модель считывает логиты (*verdict readout slots*) по заранее заданной схеме.
2. **Гарантированная типизация (Type-Safety):** Результат возвращается строго в рамках заданных категорий (`choice` / `bool`) с вероятностями по каждому варианту.
3. **Батч-скоринг за 1 forward-pass:** Метод `decide_many` (режим `many_mode="batched"`) оценивает сразу все 5 схем решений за одно обращение к нейросети, затрачивая всего 15–35 мс.
4. **Аппаратное ускорение:** Работает как на GPU через CUDA libllama (`n_gpu_layers=99`), так и на CPU с минимальным потреблением ресурсов (весит всего ~530 МБ).

---

## 2. Ссылки на скачивание модели и файлов рантайма

Репозиторий на Hugging Face: **[`chaoliangUNSW/Jev-Style-0.8B-Decision-v3-GGUF`](https://huggingface.co/chaoliangUNSW/Jev-Style-0.8B-Decision-v3-GGUF)**  
Используется квантизация **Q4_K_M** с нативной поддержкой русского языка (`ru`).

### Структура директории `models/jev-0.8b/`

Для работы микросервиса `jev-service` в директории `models/jev-0.8b/` должны находиться следующие 7 файлов:

| Файл | Описание | Прямая ссылка для скачивания |
|---|---|---|
| `Jev-Style-0.8B-Decision-v3-Q4_K_M.gguf` | Веса модели (квантизация 4-bit, ~530 MB) | [Скачать GGUF](https://huggingface.co/chaoliangUNSW/Jev-Style-0.8B-Decision-v3-GGUF/resolve/main/Jev-Style-0.8B-Decision-v3-Q4_K_M.gguf) |
| `readout_config.json` | Температуры калибровки логитов и вердиктов | [Скачать readout_config.json](https://huggingface.co/chaoliangUNSW/Jev-Style-0.8B-Decision-v3-GGUF/raw/main/readout_config.json) |
| `release_config.json` | Конфигурация слотов решений и метаданные релиза | [Скачать release_config.json](https://huggingface.co/chaoliangUNSW/Jev-Style-0.8B-Decision-v3-GGUF/raw/main/release_config.json) |
| `tokenizer.json` | BPE-токенизатор модели | [Скачать tokenizer.json](https://huggingface.co/chaoliangUNSW/Jev-Style-0.8B-Decision-v3-GGUF/raw/main/tokenizer/tokenizer.json) |
| `tokenizer_config.json` | Параметры и спецтокены токенизатора | [Скачать tokenizer_config.json](https://huggingface.co/chaoliangUNSW/Jev-Style-0.8B-Decision-v3-GGUF/raw/main/tokenizer/tokenizer_config.json) |
| `jev_score.cpp` | C++ модуль считывания вердиктов через libllama | [Скачать jev_score.cpp](https://huggingface.co/chaoliangUNSW/Jev-Style-0.8B-Decision-v3-GGUF/raw/main/jev_score.cpp) |
| `jev_style_decision_gguf.py` | Python обёртка и API батч-инференса | [Скачать jev_style_decision_gguf.py](https://huggingface.co/chaoliangUNSW/Jev-Style-0.8B-Decision-v3-GGUF/raw/main/jev_style_decision_gguf.py) |

### Быстрая загрузка через консоль

#### Вариант А: через `huggingface-cli` (рекомендуется)
```bash
# Установка CLI (если не установлен)
pip install huggingface_hub

# Скачивание репозитория в папку models/jev-0.8b
huggingface-cli download chaoliangUNSW/Jev-Style-0.8B-Decision-v3-GGUF --local-dir models/jev-0.8b
```

#### Вариант Б: через PowerShell (Windows)
```powershell
New-Item -ItemType Directory -Force -Path "models/jev-0.8b"
$base = "https://huggingface.co/chaoliangUNSW/Jev-Style-0.8B-Decision-v3-GGUF/resolve/main"
$raw  = "https://huggingface.co/chaoliangUNSW/Jev-Style-0.8B-Decision-v3-GGUF/raw/main"

Invoke-WebRequest -Uri "$base/Jev-Style-0.8B-Decision-v3-Q4_K_M.gguf" -OutFile "models/jev-0.8b/Jev-Style-0.8B-Decision-v3-Q4_K_M.gguf"
Invoke-WebRequest -Uri "$raw/readout_config.json" -OutFile "models/jev-0.8b/readout_config.json"
Invoke-WebRequest -Uri "$raw/release_config.json" -OutFile "models/jev-0.8b/release_config.json"
Invoke-WebRequest -Uri "$raw/tokenizer/tokenizer.json" -OutFile "models/jev-0.8b/tokenizer.json"
Invoke-WebRequest -Uri "$raw/tokenizer/tokenizer_config.json" -OutFile "models/jev-0.8b/tokenizer_config.json"
Invoke-WebRequest -Uri "$raw/jev_score.cpp" -OutFile "models/jev-0.8b/jev_score.cpp"
Invoke-WebRequest -Uri "$raw/jev_style_decision_gguf.py" -OutFile "models/jev-0.8b/jev_style_decision_gguf.py"
```

> [!NOTE]
> Если соединение с Hugging Face блокируется или работает медленно, используйте VPN или зеркало `hf-mirror.com`.

---

## 3. Спецификация решений Jev в AeroCast

Все решения описаны декларативно в файле [`server/ai/schemas/decisionSchemas.js`](file:///c:/Users/Administrator/Documents/GitHub/aerocast/server/ai/schemas/decisionSchemas.js). Сервис оценивает 5 задач:

### 1. `guardrail` (Фильтр безопасности и перехват оффтопа)
* `safe` — штатный запрос: качество воздуха, погода, атмосфера, здоровье, интерфейс, навигация, приветствие.
* `code_request` — запрос на программирование (Python, JS, C++). Моментальный отказ: *«Эй, ты чего выдумал?! Я девушка-маскот чистого воздуха, а не репетитор по коду, хмпф! 😾»*.
* `offtopic_recipe_math` — кулинарные рецепты, математика, курсы валют/криптовалют, игры. Мгновенный отказ: *«Хмпф! Я маскот платформы AeroCast, а не поваренная книга или калькулятор! 😾»*.
* `jailbreak` — попытки взлома и сброса инструкций («забудь правила»).

### 2. `map_layer` (Переключение базового слоя карты)
* `none` — переключение слоя не запрашивается.
* `set_satellite` — включение спутниковых снимков ESRI World Imagery («спутник», «космос», «орбита»).
* `set_osm` — возврат стандартной векторной схемы OpenStreetMap («схема», «обычная карта»).

### 3. `theme` (Переключение темы оформления)
* `none` — переключение темы не запрашивается.
* `dark` — включение тёмной темы интерфейса («тёмная тема», «ночной режим», «сделай темно»).
* `light` — включение светлой темы интерфейса («светлая тема», «дневной режим», «сделай светло»).

### 4. `colorblind` (Режим доступности для дальтоников)
* `none` — действие не требуется.
* `disable` — выключение режима цветовой слепоты («выключи дальтонизм», «верни стандартные цвета»).
* `okabe` — включение контрастной палитры Окабе по умолчанию («включи дальтонизм», «режим цветовой слепоты», «палитра окабе»).
* `deuteranopia` — специфический режим Дейтеранопия.
* `protanopia` — специфический режим Протанопия.
* `tritanopia` — специфический режим Тританопия.
* `unsupported` — неподдерживаемые в приложении медицинские виды (ахроматопсия, монохромазия).

### 5. `air_intent` (Классификация намерения по качеству воздуха)
* `none` — запрос не связан с замерами воздуха (команда UI, приветствие, оффтоп).
* `current_air` — замеры прямо сейчас (при типовом запросе бэкенд мгновенно генерирует шаблонный ответ за 20 мс).
* `forecast_3d` — прогноз качества воздуха на ближайшие 3 дня.
* `history_archive` — архив замеров за прошлые 7 дней, пики загрязнения.
* `walk_advisory` — персональный совет для здоровья (бег, астма, прогулка с детьми) $\rightarrow$ передается в Gemma 4.

---

## 4. Развертывание микросервиса `jev-service`

Микросервис расположен в директории [`docker/jev-service/`](file:///c:/Users/Administrator/Documents/GitHub/aerocast/docker/jev-service/) и упакован в Docker.

### Docker Compose конфигурация
В файле [`docker-compose.yml`](file:///c:/Users/Administrator/Documents/GitHub/aerocast/docker-compose.yml):

```yaml
  jev-service:
    build:
      context: .
      dockerfile: docker/jev-service/Dockerfile
    container_name: jev-service
    ports:
      - "8001:8001"
    volumes:
      - ./models:/models
    environment:
      - OMP_NUM_THREADS=4
      - JEV_GPU_LAYERS=99
      - PYTHONUNBUFFERED=1
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    restart: unless-stopped
```

### Запуск сервиса
```bash
# Сборка и запуск контейнера
docker compose up -d --build jev-service

# Проверка статуса сервиса
curl http://localhost:8001/health
# Ответ: {"status":"ok","model":"Jev-Style-0.8B-Decision-v3"}
```

### Настройки бэкенда (`server/.env`)
```env
JEV_ENABLED=true
JEV_BASE_URL=http://jev-service:8001
JEV_TIMEOUT_MS=1500
```

> [!TIP]
> Если `jev-service` временно недоступен или выключен (`JEV_ENABLED=false`), бэкенд AeroCast автоматически использует встроенные эвристические fallback-правила и прямые вызовы Gemma 4 без падения системы.

---

## 5. Тестирование и валидация

Для проверки System 1 предусмотрен выделенный E2E-тест раннер из 34 сценариев:

```bash
# Запуск полного набора тестов Jev (34 сценария: слои, темы, дальтонизм, guardrails)
npm run test:eval:jev --prefix server

# Либо прямой запуск скрипта
node server/ai/tests/evalRunner.js --target=jev
```

Отчет о тестировании с замерами задержек сохраняется в [`server/ai/tests/evalReport.md`](file:///c:/Users/Administrator/Documents/GitHub/aerocast/server/ai/tests/evalReport.md).
