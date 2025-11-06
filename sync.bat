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

REM Отправляем в GitHub
echo [Шаг 3/3] Отправляю в GitHub...
git push origin %CURRENT_BRANCH%
if errorlevel 1 (
    echo [ОШИБКА] Не удалось отправить в GitHub!
    echo.
    echo Возможные причины:
    echo - Токен не настроен или истек
    echo - Нет подключения к интернету
    echo - Ветка не настроена
    echo.
    echo Попробуйте:
    echo   git push -u origin %CURRENT_BRANCH%
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

