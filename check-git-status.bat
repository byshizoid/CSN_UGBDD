@echo off
echo ========================================
echo Проверка статуса Git репозитория
echo ========================================
echo.

REM Проверяем наличие git
git --version >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Git не установлен!
    echo Установите Git с https://git-scm.com/
    pause
    exit /b 1
)

echo [OK] Git установлен
echo.

REM Проверяем, что мы в git репозитории
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Это не git репозиторий!
    echo.
    echo Инициализирую git репозиторий...
    git init
    echo.
    echo Теперь настройте remote:
    echo   git remote add origin https://github.com/ваш-username/ваш-репозиторий.git
    pause
    exit /b 1
)

echo [OK] Git репозиторий найден
echo.

REM Проверяем существующий remote
echo Проверка remote origin:
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo [INFO] Remote origin не настроен
    echo [INFO] Настройте remote:
    echo   git remote add origin https://github.com/ваш-username/ваш-репозиторий.git
) else (
    echo [OK] Remote origin настроен:
    git remote get-url origin
    echo.
    echo Если нужно изменить URL:
    echo   git remote set-url origin https://github.com/новый-username/новый-репозиторий.git
)
echo.

REM Проверяем статус
echo Текущий статус:
git status
echo.

pause

