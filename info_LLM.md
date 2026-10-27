# LLM Configuration Guide: Qwen 2.5 3B

Этот документ содержит руководство по настройке локальной LLM для проекта AeroCast.

## 1. Локальная модель: Qwen 2.5 3B Instruct
Для проекта используется модель **Qwen 2.5 3B Instruct** (квантизация Q4_K_M), которая оптимизирована для работы на железе среднего уровня (например, GTX 1660 Super) и обладает высокой стабильностью при работе с русским языком.

### Загрузка модели
1. Создайте папку `models/` в корне проекта.
2. Скачайте файл модели по ссылке ниже с впн:
   [Скачать Qwen2.5-3B-Instruct-Q4_K_M.gguf](https://huggingface.co/lmstudio-community/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf)
3. Переместите скачанный файл в папку `models/`.
4. Убедитесь, что файл называется **точно**: `Qwen2.5-3B-Instruct-Q4_K_M.gguf`.

## 2. Настройка Docker
Проект использует Docker Compose для оркестрации бэкенда и `llama-server`.

### Требования
*   **Docker Desktop** (с включенным WSL2 на Windows).
*   **NVIDIA Driver** (установлен на хосте).
*   **NVIDIA Container Toolkit** (необходим для проброса GPU в контейнер).

### Настройка
Убедитесь, что в корне проекта находятся:
*   `docker-compose.yml` (настроен на использование `./models` и GPU).
*   `server/Dockerfile` (настроен на пересборку `sqlite3` под Linux).

## 3. Настройка ИИ (Backend)
Все параметры ИИ вынесены в переменные окружения.

1. Перейдите в `server/` и создайте файл `.env`:
   ```bash
   cp .env.example .env
   ```
2. Убедитесь, что в `.env` указаны верные настройки:
   ```env
   LLM_BASE_URL=http://llama-server:8080/v1
   LLM_API_KEY=not-needed
   LLM_MODEL=qwen2.5-3b
   LLM_MAX_TOKENS=2000
   LLM_TEMPERATURE=0.2
   LLM_TIMEOUT_MS=75000
   LLM_MAX_HISTORY=4
   ```

## 4. Запуск проекта
Выполните команду в корне проекта:
```bash
docker compose up --build
```

### Устранение проблем
*   **Модель не загружается:** Проверьте наличие файла в `models/` и правильность названия.
*   **Ошибка sqlite3:** Если сервер падает с ошибкой `sqlite3`, выполните `docker compose build --no-cache`, чтобы принудительно пересобрать бинарные зависимости внутри контейнера.
