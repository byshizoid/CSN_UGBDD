@echo off
chcp 65001 >nul
echo ========================================
echo   Проверка синхронизации с GitHub
echo ========================================
echo.

REM Проверяем наличие git
git --version >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Git не установлен!
    echo.
    pause
    exit /b 1
)

echo [OK] Git установлен
echo.

REM Проверяем remote
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Remote origin не настроен!
    echo.
    echo Настройте remote:
    echo   git remote add origin https://github.com/byshizoid/CSN_UGBDD.git
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('git remote get-url origin') do set REPO_URL=%%i
echo [OK] Remote origin: %REPO_URL%
echo.

REM Проверяем статус
echo [INFO] Текущий статус Git:
git status --short
echo.

REM Проверяем, есть ли коммиты
git rev-parse --verify HEAD >nul 2>&1
if errorlevel 1 (
    echo [ПРЕДУПРЕЖДЕНИЕ] Нет коммитов в репозитории!
    echo.
    echo Для синхронизации кода нужно сделать первый коммит:
    echo   git commit -m "Initial commit"
    echo   git push -u origin master
    echo.
) else (
    echo [OK] Есть коммиты в репозитории
    echo.
    
    REM Проверяем, есть ли изменения
    git diff --quiet
    if errorlevel 1 (
        echo [INFO] Есть незакоммиченные изменения
        echo.
    ) else (
        echo [INFO] Нет незакоммиченных изменений
        echo.
    )
)

REM Проверяем, запущен ли скрипт автосинхронизации
echo [INFO] Проверка скрипта автосинхронизации:
tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /I /N "node.exe" >nul
if errorlevel 1 (
    echo [ПРЕДУПРЕЖДЕНИЕ] Скрипт автосинхронизации не запущен!
    echo.
    echo Для автоматической синхронизации кода запустите:
    echo   npm run watch
    echo.
) else (
    echo [OK] Node.js процесс найден (возможно, скрипт запущен)
    echo.
)

echo ========================================
echo   Проверка настроек GitHub в браузере
echo ========================================
echo.
echo Для сохранения данных (фото, карта) через GitHub API:
echo 1. Откройте сайт в браузере
echo 2. Войдите в режим администратора (пароль: admin123)
echo 3. Убедитесь, что заполнены поля:
echo    - Имя пользователя GitHub
echo    - Название репозитория
echo    - GitHub Personal Access Token
echo 4. Нажмите "Сохранить настройки"
echo.
echo Откройте консоль браузера (F12) для просмотра ошибок
echo.

pause

