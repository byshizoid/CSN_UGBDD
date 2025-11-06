@echo off
echo ========================================
echo Настройка автоматической синхронизации с GitHub
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

REM Проверяем, что мы в git репозитории
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Это не git репозиторий!
    echo.
    echo Инициализирую git репозиторий...
    git init
    echo.
    echo Теперь нужно настроить remote:
    echo git remote add origin https://github.com/ваш-username/ваш-репозиторий.git
    echo.
    echo Или если remote уже существует:
    echo git remote set-url origin https://github.com/ваш-username/ваш-репозиторий.git
    pause
    exit /b 1
)

echo [OK] Git репозиторий найден

REM Проверяем существующий remote
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo [INFO] Remote origin не настроен
    echo [INFO] Чтобы настроить, выполните:
    echo    git remote add origin https://github.com/ваш-username/ваш-репозиторий.git
) else (
    echo [OK] Remote origin уже настроен
    git remote get-url origin
)

REM Устанавливаем git hook для автоматического коммита
if exist ".git\hooks\pre-commit" (
    echo [INFO] Git hook уже установлен
) else (
    echo [INFO] Устанавливаю git hook...
    copy /Y ".git-hooks\pre-commit" ".git\hooks\pre-commit" >nul 2>&1
    if exist ".git\hooks\pre-commit" (
        echo [OK] Git hook установлен
    ) else (
        echo [ОШИБКА] Не удалось установить git hook
    )
)

echo.
echo ========================================
echo Настройка завершена!
echo ========================================
echo.
echo Теперь при сохранении файлов в Cursor:
echo - Изменения автоматически коммитятся в Git
echo - Коммиты автоматически пушатся в GitHub
echo.
echo Запустите скрипт отслеживания:
echo   npm run watch
echo.
echo Или запустите напрямую:
echo   node auto-sync-to-github.js
echo.
pause

