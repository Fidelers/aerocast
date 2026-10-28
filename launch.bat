@echo off
chcp 65001 >nul

:: Перейти в папку со скриптом
cd /d "%~dp0"

:: Определение доступной команды Docker Compose
set "COMPOSE_CMD="
docker compose version >nul 2>&1
if %errorlevel% equ 0 (
    set "COMPOSE_CMD=docker compose"
) else (
    docker-compose version >nul 2>&1
    if %errorlevel% equ 0 (
        set "COMPOSE_CMD=docker-compose"
    )
)

:: Обработка аргументов командной строки
set "ARG=%~1"
if not "%ARG%"=="" (
    if /i "%ARG%"=="start"         goto do_start
    if /i "%ARG%"=="up"            goto do_start
    if /i "%ARG%"=="stop"          goto do_stop
    if /i "%ARG%"=="down"          goto do_stop
    if /i "%ARG%"=="restart"       goto do_restart
    if /i "%ARG%"=="rebuild"       goto do_rebuild
    if /i "%ARG%"=="build"         goto do_rebuild
    if /i "%ARG%"=="logs"          goto do_logs
    if /i "%ARG%"=="status"        goto do_status
    if /i "%ARG%"=="ps"            goto do_status
    if /i "%ARG%"=="start-front"   goto do_start_front
    if /i "%ARG%"=="front-start"   goto do_start_front
    if /i "%ARG%"=="front"         goto do_start_front
    if /i "%ARG%"=="frontend"      goto do_start_front
    if /i "%ARG%"=="stop-front"    goto do_stop_front
    if /i "%ARG%"=="front-stop"    goto do_stop_front
    if /i "%ARG%"=="restart-front" goto do_restart_front
    if /i "%ARG%"=="all"           goto do_start_all
    if /i "%ARG%"=="start-all"     goto do_start_all
    if /i "%ARG%"=="stop-all"      goto do_stop_all
    if /i "%ARG%"=="help"          goto do_help
    if /i "%ARG%"=="/?"            goto do_help
    if /i "%ARG%"=="-h"            goto do_help

    echo [ОШИБКА] Неизвестный параметр: %ARG%
    echo Доступные команды: start, stop, restart, rebuild, logs, status, front, stop-front, all, stop-all
    echo.
    if /i not "%~2"=="--no-pause" pause
    exit /b 1
)

:menu
cls
echo ======================================================
echo               AEROCAST CONTROL MANAGER                
echo ======================================================
echo.
echo  [Docker - Бэкенд и LLM]
echo    1. Start       - Запустить контейнеры (up -d)
echo    2. Stop        - Остановить контейнеры (down)
echo    3. Restart     - Перезапустить контейнеры
echo    4. Rebuild     - Пересобрать и перезапустить
echo    5. Logs        - Просмотр логов Docker (real-time)
echo    6. Status      - Статус сервисов и фронтенда
echo.
echo  [Фронтенд - React / Vite]
echo    7. Start Front - Запустить фронтенд
echo    8. Stop Front  - Выключить фронтенд
echo    9. Restart F.  - Перезапустить фронтенд
echo.
echo  [Комплекс]
echo    A. Start All   - Запустить всё (Docker + Фронтенд)
echo    S. Stop All    - Остановить всё (Docker + Фронтенд)
echo    0. Exit        - Выход
echo.
echo ======================================================
set "choice="
set /p "choice=Выберите действие: "

if "%choice%"=="1" goto do_start
if "%choice%"=="2" goto do_stop
if "%choice%"=="3" goto do_restart
if "%choice%"=="4" goto do_rebuild
if "%choice%"=="5" goto do_logs
if "%choice%"=="6" goto do_status
if "%choice%"=="7" goto do_start_front
if "%choice%"=="8" goto do_stop_front
if "%choice%"=="9" goto do_restart_front
if /i "%choice%"=="A" goto do_start_all
if /i "%choice%"=="S" goto do_stop_all
if "%choice%"=="0" goto do_exit

echo.
echo Неверный выбор! Пожалуйста, выберите пункт из меню.
timeout /t 2 >nul
goto menu

:check_docker_available
if "%COMPOSE_CMD%"=="" (
    echo [ОШИБКА] Docker или Docker Compose не найдены в переменной PATH!
    echo Убедитесь, что Docker Desktop установлен.
    echo.
    goto finish
)
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ВНИМАНИЕ] Docker daemon не отвечает или не запущен!
    echo Убедитесь, что приложение Docker Desktop запущено.
    echo.
)
goto :eof

:do_start
cls
echo ======================================================
echo Запуск Docker контейнеров...
echo ======================================================
call :check_docker_available
%COMPOSE_CMD% up -d
echo.
echo Готово.
goto finish

:do_stop
cls
echo ======================================================
echo Остановка Docker контейнеров...
echo ======================================================
call :check_docker_available
%COMPOSE_CMD% down
echo.
echo Готово.
goto finish

:do_restart
cls
echo ======================================================
echo Перезапуск Docker контейнеров...
echo ======================================================
call :check_docker_available
%COMPOSE_CMD% restart
echo.
echo Готово.
goto finish

:do_rebuild
cls
echo ======================================================
echo Пересборка и запуск Docker контейнеров...
echo ======================================================
call :check_docker_available
echo [1/3] Остановка существующих контейнеров...
%COMPOSE_CMD% down
echo.
echo [2/3] Сборка образов...
%COMPOSE_CMD% build
if %errorlevel% neq 0 (
    echo.
    echo [ОШИБКА] Сборка завершилась с ошибкой!
    goto finish
)
echo.
echo [3/3] Запуск обновленных контейнеров...
%COMPOSE_CMD% up -d
echo.
echo Готово.
goto finish

:do_logs
cls
echo ======================================================
echo Просмотр логов Docker (Для выхода нажмите Ctrl+C)
echo ======================================================
call :check_docker_available
%COMPOSE_CMD% logs -f
goto finish

:do_status
cls
echo ======================================================
echo Статус сервисов Aerocast:
echo ======================================================
echo [Docker контейнеры]:
if not "%COMPOSE_CMD%"=="" (
    call :check_docker_available
    %COMPOSE_CMD% ps
) else (
    echo Docker Compose не доступен.
)
echo.
echo [Фронтенд - порт 5173]:
netstat -ano | findstr :5173 | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 (
    echo Фронтенд РАБОТАЕТ: http://localhost:5173
) else (
    echo Фронтенд НЕ запущен.
)
echo.
goto finish

:do_start_front
cls
echo ======================================================
echo Запуск фронтенда (React / Vite)...
echo ======================================================
netstat -ano | findstr :5173 | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 (
    echo [ВНИМАНИЕ] Фронтенд уже запущен на порту 5173!
    echo URL: http://localhost:5173
    goto finish
)

if not exist "%~dp0frontend\node_modules\" (
    echo [ИНФО] Папка node_modules не найдена. Установка зависимостей...
    cd /d "%~dp0frontend"
    call npm install
    cd /d "%~dp0"
    if %errorlevel% neq 0 (
        echo [ОШИБКА] Не удалось установить зависимости фронтенда!
        goto finish
    )
)

echo Запуск Vite в отдельном окне...
start "Aerocast Frontend" cmd /k "cd /d ""%~dp0frontend"" && title Aerocast Frontend && npm run dev"
echo.
echo Фронтенд успешно запущен!
echo Откройте в браузере: http://localhost:5173
goto finish

:do_stop_front
cls
echo ======================================================
echo Выключение фронтенда...
echo ======================================================
set "FOUND_FRONT="

netstat -ano | findstr :5173 | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 set "FOUND_FRONT=1"

tasklist /FI "WINDOWTITLE eq Aerocast Frontend*" 2>nul | findstr /i "cmd.exe node.exe" >nul 2>&1
if %errorlevel% equ 0 set "FOUND_FRONT=1"

if defined FOUND_FRONT (
    taskkill /FI "WINDOWTITLE eq Aerocast Frontend*" /T /F >nul 2>&1
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
        taskkill /F /T /PID %%a >nul 2>&1
    )
    echo Фронтенд успешно остановлен.
) else (
    echo Фронтенд не был запущен: порт 5173 свободен.
)
goto finish

:do_restart_front
cls
echo ======================================================
echo Перезапуск фронтенда...
echo ======================================================
echo Остановка фронтенда...
taskkill /FI "WINDOWTITLE eq Aerocast Frontend*" /T /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    taskkill /F /T /PID %%a >nul 2>&1
)
timeout /t 1 >nul
echo Запуск фронтенда...
start "Aerocast Frontend" cmd /k "cd /d ""%~dp0frontend"" && title Aerocast Frontend && npm run dev"
echo.
echo Фронтенд перезапущен: http://localhost:5173
goto finish

:do_start_all
cls
echo ======================================================
echo Запуск всей системы: Docker + Фронтенд
echo ======================================================
call :check_docker_available
echo [1/2] Запуск Docker контейнеров: Бэкенд + LLM...
%COMPOSE_CMD% up -d
echo.
echo [2/2] Запуск фронтенда...
netstat -ano | findstr :5173 | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 (
    echo Фронтенд уже запущен: http://localhost:5173
) else (
    start "Aerocast Frontend" cmd /k "cd /d ""%~dp0frontend"" && title Aerocast Frontend && npm run dev"
    echo Фронтенд запущен!
)
echo.
echo ======================================================
echo Сервисы запущены:
echo   Фронтенд: http://localhost:5173
echo   Бэкенд:   http://localhost:3000
echo   LLM:      http://localhost:8080
echo ======================================================
goto finish

:do_stop_all
cls
echo ======================================================
echo Остановка всей системы: Docker + Фронтенд
echo ======================================================
echo [1/2] Остановка Docker контейнеров...
call :check_docker_available
%COMPOSE_CMD% down
echo.
echo [2/2] Остановка фронтенда...
taskkill /FI "WINDOWTITLE eq Aerocast Frontend*" /T /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    taskkill /F /T /PID %%a >nul 2>&1
)
echo.
echo Все сервисы остановлены.
goto finish

:do_help
echo ======================================================
echo Использование: launch.bat [команда]
echo ======================================================
echo Запуск без параметров открывает интерактивное меню.
echo.
echo Команды Docker:
echo   start          - Запуск контейнеров в фоновом режиме (up -d)
echo   stop           - Остановка контейнеров (down)
echo   restart        - Перезапуск работающих контейнеров
echo   rebuild        - Пересборка образов и запуск (down, build, up -d)
echo   logs           - Просмотр логов Docker в реальном времени
echo   status         - Просмотр статуса Docker и фронтенда
echo.
echo Команды Фронтенда:
echo   front          - Запуск фронтенда (React / Vite)
echo   stop-front     - Выключение фронтенда
echo   restart-front  - Перезапуск фронтенда
echo.
echo Комплексные команды:
echo   all            - Запуск Docker и фронтенда
echo   stop-all       - Остановка Docker и фронтенда
echo ======================================================
goto do_exit

:finish
echo.
if "%ARG%"=="" (
    pause
    goto menu
) else (
    if /i not "%~2"=="--no-pause" pause
    goto do_exit
)

:do_exit
exit /b 0
