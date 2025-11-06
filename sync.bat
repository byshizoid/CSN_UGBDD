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

REM Определяем текущую ветку
for /f "tokens=*" %%i in ('git branch --show-current') do set CURRENT_BRANCH=%%i
if not defined CURRENT_BRANCH set CURRENT_BRANCH=main

echo [INFO] Текущая ветка: %CURRENT_BRANCH%
echo.

REM Добавляем все файлы
echo [Шаг 1/3] Добавляю файлы...
git add .
if errorlevel 1 (
    echo [ОШИБКА] Не удалось добавить файлы!
    pause
    exit /b 1
)
echo [OK] Файлы добавлены
echo.

REM Создаем коммит
echo [Шаг 2/3] Создаю коммит...
git commit -m "Обновление: %date% %time%"
if errorlevel 1 (
    echo [INFO] Нет изменений для коммита
) else (
    echo [OK] Коммит создан
)
echo.

REM Получаем изменения с GitHub (если есть)
echo [Шаг 3/4] Получаю изменения с GitHub...
git fetch origin
if errorlevel 1 (
    echo [ПРЕДУПРЕЖДЕНИЕ] Не удалось получить изменения с GitHub
    echo.
)

REM Проверяем, есть ли удаленные изменения
git status | findstr "Your branch and" >nul 2>&1
if errorlevel 0 (
    echo [INFO] Обнаружены изменения на GitHub, синхронизирую...
    git pull origin %CURRENT_BRANCH% --no-rebase
    if errorlevel 1 (
        echo [ПРЕДУПРЕЖДЕНИЕ] Конфликты при слиянии. Попробуйте решить вручную.
        echo.
    ) else (
        echo [OK] Изменения синхронизированы
        echo.
    )
)

REM Отправляем в GitHub
echo [Шаг 4/4] Отправляю в GitHub...
git push origin %CURRENT_BRANCH%
if errorlevel 1 (
    echo [ОШИБКА] Не удалось отправить в GitHub!
    echo.
    echo Возможные причины:
    echo - Токен не настроен или истек
    echo - Нет подключения к интернету
    echo - Конфликты при слиянии
    echo.
    echo Попробуйте вручную:
    echo   git pull origin %CURRENT_BRANCH%
    echo   git push origin %CURRENT_BRANCH%
    echo.
    echo Или если нужно принудительно (осторожно!):
    echo   git push origin %CURRENT_BRANCH% --force
    echo.
    pause
    exit /b 1
)

echo.
echo [OK] Изменения успешно отправлены в GitHub!
echo.
echo Репозиторий: https://github.com/byshizoid/CSN_UGBDD
echo.
pause

