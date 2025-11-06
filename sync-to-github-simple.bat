@echo off
chcp 65001 >nul
echo ========================================
echo   Синхронизация с GitHub
echo ========================================
echo.

REM Проверяем наличие git
git --version >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Git не установлен!
    pause
    exit /b 1
)

echo [Шаг 1/3] Добавляю все файлы...
git add .
echo [OK] Файлы добавлены
echo.

echo [Шаг 2/3] Создаю коммит...
git commit -m "Обновление: %date% %time%"
if errorlevel 1 (
    echo [INFO] Нет изменений для коммита или коммит уже создан
)
echo.

echo [Шаг 3/3] Отправляю в GitHub...
REM Определяем текущую ветку
for /f "tokens=*" %%i in ('git branch --show-current') do set CURRENT_BRANCH=%%i
if "%CURRENT_BRANCH%"=="master" (
    echo [INFO] Текущая ветка: master, но на GitHub используется main
    echo [INFO] Переключаюсь на main и отправляю туда...
    git checkout -b main 2>nul
    git push -u origin main
) else (
    git push
)

if errorlevel 1 (
    echo.
    echo [ОШИБКА] Не удалось отправить в GitHub!
    echo.
    echo Возможные причины:
    echo - Токен не настроен или истек
    echo - Нет подключения к интернету
    echo.
    echo Решение:
    echo 1. Запустите: force-git-auth.bat (для обновления токена)
    echo 2. Или попробуйте снова: git push
    echo.
    pause
    exit /b 1
)

echo.
echo [OK] Все файлы синхронизированы с GitHub!
echo.
echo Проверьте репозиторий: https://github.com/byshizoid/CSN_UGBDD
echo.
pause

