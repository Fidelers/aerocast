# LLM Configuration Guide: gemma-4-E2B-it-Q4_K_M

Этот документ содержит руководство по настройке локальной LLM для проекта AeroCast.

## 1. Локальная модель: gemma-4-E2B-it-Q4_K_M
Для проекта используется модель **gemma-4-E2B-it-Q4_K_M** (квантизация Q4_K_M), которая оптимизирована для работы на железе среднего уровня и обладает высокой стабильностью при работе с русским языком.

### Загрузка модели
1. Создайте папку `models/` в корне проекта.
2. Скачайте файл модели по ссылке ниже с впн:
   [Скачать gemma-4-E2B-it-Q4_K_M.gguf](https://huggingface.co/lmstudio-community/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q4_K_M.gguf?download=true)
3. Переместите скачанный файл в папку `models/`.
4. Убедитесь, что файл называется **точно**: `gemma-4-E2B-it-Q4_K_M.gguf`.

## 2. Настройка Docker
Проект использует Docker Compose для оркестрации бэкенда и `llama-server`.

### Требования
*   **Docker Desktop** (с включенным WSL2 на Windows).
*   **NVIDIA Driver** (установлен на хосте).
*   **NVIDIA Container Toolkit** (необходим для проброса GPU в контейнер).

### Требования на Arch-based linux

*   sudo pacman -S docker docker-compose
*   sudo systemctl enable --now docker
*   sudo pacman -S nvidia nvidia-utils        # или nvidia-open nvidia-utils
*   sudo pacman -S nvidia-container-toolkit
*   sudo nvidia-ctk runtime configure --runtime=docker
*   sudo systemctl restart docker

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
   LLM_MODEL=gemma-4-E2B-it-Q4_K_M
   LLM_MAX_TOKENS=2000
   LLM_TEMPERATURE=0.2
   LLM_TIMEOUT_MS=75000
   LLM_MAX_HISTORY=4
   ```
3. В файле `docker-compose.yml` убедитесь что указано `/models/gemma-4-E2B-it-Q4_K_M.gguf`, или чёткое название файла вашей модели если используйте другую


## 4. Запуск проекта
Выполните команду в корне проекта:
```bash
docker compose up --build
```
Или используйте .bat файлы
Эти же файлы используются для остальных функций соответственно

### Устранение проблем
*   **Модель не загружается:** Проверьте наличие файла в `models/` и правильность названия.
*   **Ошибка sqlite3:** Если сервер падает с ошибкой `sqlite3`, выполните `docker compose build --no-cache`, чтобы принудительно пересобрать бинарные зависимости внутри контейнера.
*   Какие-то библиотеки npm могут не поставится с включенным ВПН
