#!/usr/bin/env bash

# Определение директории скрипта
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Цвета для вывода в терминал
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Определение команды Docker Compose
COMPOSE_CMD=""
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
fi

# Проверка доступности Docker daemon
check_docker() {
    if [ -z "$COMPOSE_CMD" ]; then
        echo -e "${RED}[ОШИБКА] Docker Compose не найден в системе!${NC}"
        echo "Убедитесь, что Docker установлен и добавлен в PATH."
        return 1
    fi

    if ! docker info >/dev/null 2>&1; then
        echo -e "${YELLOW}[ВНИМАНИЕ] Docker daemon не запущен или нет прав доступа!${NC}"
        echo "Попробуйте запустить: sudo systemctl start docker"
        echo "Или добавьте пользователя в группу docker: sudo usermod -aG docker \$USER"
        echo ""
    fi
    return 0
}

# Проверка, занят ли порт
is_port_in_use() {
    local port="$1"
    if command -v ss >/dev/null 2>&1; then
        ss -tuln 2>/dev/null | grep -q ":$port " && return 0
    elif command -v lsof >/dev/null 2>&1; then
        lsof -i ":$port" >/dev/null 2>&1 && return 0
    elif command -v fuser >/dev/null 2>&1; then
        fuser "$port/tcp" >/dev/null 2>&1 && return 0
    elif command -v netstat >/dev/null 2>&1; then
        netstat -tuln 2>/dev/null | grep -q ":$port " && return 0
    fi

    # Fallback через node если системных утилит нет
    if command -v node >/dev/null 2>&1; then
        node -e "const s = require('net').createServer(); s.once('error', () => process.exit(0)); s.once('listening', () => { s.close(); process.exit(1); }); s.listen($port);" >/dev/null 2>&1
        return $?
    fi

    return 1
}

# Действия Docker
do_start() {
    clear
    echo -e "${CYAN}======================================================${NC}"
    echo -e "${CYAN}Запуск Docker контейнеров...${NC}"
    echo -e "${CYAN}======================================================${NC}"
    check_docker || return 1
    $COMPOSE_CMD up -d
    echo -e "\n${GREEN}Готово.${NC}"
}

do_stop() {
    clear
    echo -e "${CYAN}======================================================${NC}"
    echo -e "${CYAN}Остановка Docker контейнеров...${NC}"
    echo -e "${CYAN}======================================================${NC}"
    check_docker || return 1
    $COMPOSE_CMD down
    echo -e "\n${GREEN}Готово.${NC}"
}

do_restart() {
    clear
    echo -e "${CYAN}======================================================${NC}"
    echo -e "${CYAN}Перезапуск Docker контейнеров...${NC}"
    echo -e "${CYAN}======================================================${NC}"
    check_docker || return 1
    $COMPOSE_CMD restart
    echo -e "\n${GREEN}Готово.${NC}"
}

do_rebuild() {
    clear
    echo -e "${CYAN}======================================================${NC}"
    echo -e "${CYAN}Пересборка и запуск Docker контейнеров...${NC}"
    echo -e "${CYAN}======================================================${NC}"
    check_docker || return 1
    echo -e "${BOLD}[1/3] Остановка существующих контейнеров...${NC}"
    $COMPOSE_CMD down
    echo -e "\n${BOLD}[2/3] Сборка образов...${NC}"
    if ! $COMPOSE_CMD build; then
        echo -e "\n${RED}[ОШИБКА] Сборка завершилась с ошибкой!${NC}"
        return 1
    fi
    echo -e "\n${BOLD}[3/3] Запуск обновленных контейнеров...${NC}"
    $COMPOSE_CMD up -d
    echo -e "\n${GREEN}Готово.${NC}"
}

do_logs() {
    clear
    echo -e "${CYAN}======================================================${NC}"
    echo -e "${CYAN}Просмотр логов Docker (Ctrl+C для выхода)${NC}"
    echo -e "${CYAN}======================================================${NC}"
    check_docker || return 1
    $COMPOSE_CMD logs -f
}

do_status() {
    clear
    echo -e "${CYAN}======================================================${NC}"
    echo -e "${CYAN}Статус сервисов Aerocast:${NC}"
    echo -e "${CYAN}======================================================${NC}"
    echo -e "${BOLD}[Docker контейнеры]:${NC}"
    if [ -n "$COMPOSE_CMD" ]; then
        check_docker
        $COMPOSE_CMD ps
    else
        echo -e "${RED}Docker Compose не установлен.${NC}"
    fi

    echo -e "\n${BOLD}[Фронтенд - порт 5173]:${NC}"
    if is_port_in_use 5173; then
        echo -e "${GREEN}Фронтенд РАБОТАЕТ: http://localhost:5173${NC}"
    else
        echo -e "${YELLOW}Фронтенд НЕ запущен.${NC}"
    fi
    echo ""
}

# Действия Фронтенда
do_start_front() {
    clear
    echo -e "${CYAN}======================================================${NC}"
    echo -e "${CYAN}Запуск фронтенда (React / Vite)...${NC}"
    echo -e "${CYAN}======================================================${NC}"

    if is_port_in_use 5173; then
        echo -e "${YELLOW}[ВНИМАНИЕ] Фронтенд уже запущен на порту 5173!${NC}"
        echo -e "URL: ${BOLD}http://localhost:5173${NC}"
        return 0
    fi

    if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
        echo -e "${YELLOW}[ИНФО] Папка node_modules не найдена. Установка зависимостей...${NC}"
        (cd "$SCRIPT_DIR/frontend" && npm install)
        if [ $? -ne 0 ]; then
            echo -e "${RED}[ОШИБКА] Не удалось установить зависимости фронтенда!${NC}"
            return 1
        fi
    fi

    echo "Запуск Vite в фоновом режиме..."
    cd "$SCRIPT_DIR/frontend"
    nohup npm run dev > "$SCRIPT_DIR/frontend.log" 2>&1 &
    local front_pid=$!
    echo "$front_pid" > "$SCRIPT_DIR/.frontend.pid"
    cd "$SCRIPT_DIR"

    sleep 1
    if kill -0 "$front_pid" 2>/dev/null; then
        echo -e "\n${GREEN}Фронтенд успешно запущен (PID: $front_pid)!${NC}"
        echo -e "Логи пишутся в файл: ${BOLD}frontend.log${NC}"
        echo -e "Откройте в браузере: ${BOLD}http://localhost:5173${NC}"
    else
        echo -e "\n${RED}[ОШИБКА] Не удалось запустить фронтенд. Логи (frontend.log):${NC}"
        cat "$SCRIPT_DIR/frontend.log"
    fi
}

do_stop_front() {
    clear
    echo -e "${CYAN}======================================================${NC}"
    echo -e "${CYAN}Выключение фронтенда...${NC}"
    echo -e "${CYAN}======================================================${NC}"
    local stopped=0
    local pid_file="$SCRIPT_DIR/.frontend.pid"

    # 1. Остановка по сохраненному PID
    if [ -f "$pid_file" ]; then
        local pid
        pid=$(cat "$pid_file" 2>/dev/null)
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
            sleep 1
            if kill -0 "$pid" 2>/dev/null; then
                kill -9 "$pid" 2>/dev/null || true
            fi
            stopped=1
        fi
        rm -f "$pid_file"
    fi

    # 2. Остановка по занятому порту 5173
    if command -v fuser >/dev/null 2>&1; then
        if fuser 5173/tcp >/dev/null 2>&1; then
            fuser -k -9 5173/tcp >/dev/null 2>&1 || true
            stopped=1
        fi
    elif command -v lsof >/dev/null 2>&1; then
        local pids
        pids=$(lsof -ti:5173 2>/dev/null)
        if [ -n "$pids" ]; then
            kill -9 $pids 2>/dev/null || true
            stopped=1
        fi
    fi

    # 3. Fallback: pkill
    if pkill -f "node.*vite" 2>/dev/null; then
        stopped=1
    fi

    if [ $stopped -eq 1 ]; then
        echo -e "${GREEN}Фронтенд успешно остановлен.${NC}"
    else
        echo -e "${YELLOW}Фронтенд не был запущен: порт 5173 свободен.${NC}"
    fi
}

do_restart_front() {
    do_stop_front
    sleep 1
    do_start_front
}

do_logs_front() {
    clear
    echo -e "${CYAN}======================================================${NC}"
    echo -e "${CYAN}Просмотр логов фронтенда (frontend.log, Ctrl+C для выхода)${NC}"
    echo -e "${CYAN}======================================================${NC}"
    if [ -f "$SCRIPT_DIR/frontend.log" ]; then
        tail -f "$SCRIPT_DIR/frontend.log"
    else
        echo -e "${YELLOW}Файл frontend.log пока не создан.${NC}"
    fi
}

# Комплексные команды
do_start_all() {
    clear
    echo -e "${CYAN}======================================================${NC}"
    echo -e "${CYAN}Запуск всей системы: Docker + Фронтенд${NC}"
    echo -e "${CYAN}======================================================${NC}"
    check_docker || return 1
    echo -e "${BOLD}[1/2] Запуск Docker контейнеров (Бэкенд + LLM)...${NC}"
    $COMPOSE_CMD up -d
    echo ""
    echo -e "${BOLD}[2/2] Запуск фронтенда...${NC}"
    if is_port_in_use 5173; then
        echo -e "${YELLOW}Фронтенд уже запущен: http://localhost:5173${NC}"
    else
        cd "$SCRIPT_DIR/frontend"
        nohup npm run dev > "$SCRIPT_DIR/frontend.log" 2>&1 &
        echo $! > "$SCRIPT_DIR/.frontend.pid"
        cd "$SCRIPT_DIR"
        echo -e "${GREEN}Фронтенд запущен!${NC}"
    fi
    echo -e "\n${CYAN}======================================================${NC}"
    echo -e "${GREEN}Все сервисы запущены:${NC}"
    echo -e "  Фронтенд: ${BOLD}http://localhost:5173${NC}"
    echo -e "  Бэкенд:   ${BOLD}http://localhost:3000${NC}"
    echo -e "  LLM:      ${BOLD}http://localhost:8080${NC}"
    echo -e "${CYAN}======================================================${NC}"
}

do_stop_all() {
    clear
    echo -e "${CYAN}======================================================${NC}"
    echo -e "${CYAN}Остановка всей системы: Docker + Фронтенд${NC}"
    echo -e "${CYAN}======================================================${NC}"
    echo -e "${BOLD}[1/2] Остановка Docker контейнеров...${NC}"
    check_docker
    $COMPOSE_CMD down
    echo ""
    echo -e "${BOLD}[2/2] Остановка фронтенда...${NC}"
    do_stop_front
    echo -e "\n${GREEN}Все сервисы остановлены.${NC}"
}

do_help() {
    echo -e "${CYAN}======================================================${NC}"
    echo -e "${BOLD}Использование:${NC} ./launch.sh [команда]"
    echo -e "${CYAN}======================================================${NC}"
    echo "Запуск без параметров открывает интерактивное меню."
    echo ""
    echo -e "${BOLD}Команды Docker:${NC}"
    echo "  start          - Запуск контейнеров в фоновом режиме (up -d)"
    echo "  stop           - Остановка контейнеров (down)"
    echo "  restart        - Перезапуск работающих контейнеров"
    echo "  rebuild        - Пересборка образов и запуск (down, build, up -d)"
    echo "  logs           - Просмотр логов Docker в реальном времени"
    echo "  status         - Просмотр статуса Docker и фронтенда"
    echo ""
    echo -e "${BOLD}Команды Фронтенда:${NC}"
    echo "  front          - Запуск фронтенда (React / Vite)"
    echo "  stop-front     - Выключение фронтенда"
    echo "  restart-front  - Перезапуск фронтенда"
    echo "  logs-front     - Просмотр логов фронтенда"
    echo ""
    echo -e "${BOLD}Комплексные команды:${NC}"
    echo "  all            - Запуск Docker и фронтенда"
    echo "  stop-all       - Остановка Docker и фронтенда"
    echo -e "${CYAN}======================================================${NC}"
}

# Обработка аргументов командной строки
if [ $# -gt 0 ]; then
    case "$1" in
        start|up)             do_start ;;
        stop|down)            do_stop ;;
        restart)              do_restart ;;
        rebuild|build)        do_rebuild ;;
        logs)                 do_logs ;;
        status|ps)            do_status ;;
        start-front|front-start|front|frontend) do_start_front ;;
        stop-front|front-stop) do_stop_front ;;
        restart-front)        do_restart_front ;;
        logs-front)           do_logs_front ;;
        all|start-all)        do_start_all ;;
        stop-all)             do_stop_all ;;
        help|-h|--help)       do_help ;;
        *)
            echo -e "${RED}[ОШИБКА] Неизвестный параметр: $1${NC}"
            echo "Доступные команды: start, stop, restart, rebuild, logs, status, front, stop-front, all, stop-all"
            exit 1
            ;;
    esac
    exit 0
fi

# Интерактивное меню
while true; do
    clear
    echo -e "${CYAN}======================================================${NC}"
    echo -e "${BOLD}               AEROCAST CONTROL MANAGER                ${NC}"
    echo -e "${CYAN}======================================================${NC}"
    echo ""
    echo -e "${BOLD} [Docker - Бэкенд и LLM]${NC}"
    echo "   1. Start       - Запустить контейнеры (up -d)"
    echo "   2. Stop        - Остановить контейнеры (down)"
    echo "   3. Restart     - Перезапустить контейнеры"
    echo "   4. Rebuild     - Пересобрать и перезапустить"
    echo "   5. Logs        - Просмотр логов Docker (real-time)"
    echo "   6. Status      - Статус сервисов и фронтенда"
    echo ""
    echo -e "${BOLD} [Фронтенд - React / Vite]${NC}"
    echo "   7. Start Front - Запустить фронтенд"
    echo "   8. Stop Front  - Выключить фронтенд"
    echo "   9. Restart F.  - Перезапустить фронтенд"
    echo "   L. Logs Front  - Просмотр логов фронтенда"
    echo ""
    echo -e "${BOLD} [Комплекс]${NC}"
    echo "   A. Start All   - Запустить всё (Docker + Фронтенд)"
    echo "   S. Stop All    - Остановить всё (Docker + Фронтенд)"
    echo "   0. Exit        - Выход"
    echo ""
    echo -e "${CYAN}======================================================${NC}"
    read -rp "Выберите действие: " choice

    case "$choice" in
        1) do_start ;;
        2) do_stop ;;
        3) do_restart ;;
        4) do_rebuild ;;
        5) do_logs ;;
        6) do_status ;;
        7) do_start_front ;;
        8) do_stop_front ;;
        9) do_restart_front ;;
        l|L) do_logs_front ;;
        a|A) do_start_all ;;
        s|S) do_stop_all ;;
        0|q|Q)
            echo "Выход..."
            exit 0
            ;;
        *)
            echo -e "\n${RED}Неверный выбор! Пожалуйста, выберите пункт из меню.${NC}"
            sleep 2
            continue
            ;;
    esac

    echo ""
    read -rp "Нажмите Enter для возврата в меню..." _
done
