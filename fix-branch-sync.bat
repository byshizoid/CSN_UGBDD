@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
echo ========================================
echo   Исправление синхронизации веток
echo ========================================
echo.

REM Проверяем наличие git
git --version >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Git не установлен!
    pause
    exit /b 1
)

echo [INFO] Проблема: локальная ветка master и удаленная main имеют разные истории.
echo [INFO] Решение: объединим локальные изменения с main на GitHub.
echo.

REM Определяем текущую ветку
for /f "tokens=*" %%i in ('git branch --show-current') do set CURRENT_BRANCH=%%i
echo [INFO] Текущая ветка: %CURRENT_BRANCH%
echo.

REM Сохраняем все изменения
echo [Шаг 1/4] Сохраняю все текущие изменения...
git add .
git commit -m "Сохранение перед синхронизацией веток" 2>nul
echo [OK] Изменения сохранены
echo.

REM Получаем информацию о удаленных ветках
echo [Шаг 2/4] Получаю информацию о ветках на GitHub...
git fetch origin
echo [OK] Информация получена
echo.

REM Создаем резервную копию текущей ветки
echo [Шаг 3/4] Создаю резервную копию текущей ветки...
git branch backup-%CURRENT_BRANCH%-%date:~-4,4%%date:~-10,2%%date:~-7,2% 2>nul
echo [OK] Резервная копия создана
echo.

REM Переключаемся на main или создаем ее
echo [Шаг 4/4] Синхронизирую с веткой main...
git checkout -b main 2>nul
if errorlevel 1 (
    git checkout main 2>nul
    if errorlevel 1 (
        echo [INFO] Создаю новую ветку main...
        git checkout -b main
    )
)

REM Объединяем с удаленной main (если она существует)
echo [INFO] Объединяю с удаленной веткой main...
git merge origin/main --allow-unrelated-histories -m "Объединение веток master и main" 2>nul
if errorlevel 1 (
    echo [INFO] Удаленная ветка main пуста или не существует, продолжаю...
)

REM Добавляем все изменения из текущей директории
git add .
git commit -m "Объединение локальных изменений" 2>nul

REM Отправляем в GitHub
echo [INFO] Отправляю изменения в GitHub...
git push -u origin main --force
if errorlevel 1 (
    echo.
    echo [ПРЕДУПРЕЖДЕНИЕ] Не удалось отправить автоматически.
    echo.
    echo Возможные причины:
    echo - Проблемы с аутентификацией (запустите force-git-auth.bat)
    echo - Нет прав на запись в репозиторий
    echo.
    echo Попробуйте вручную:
    echo   git push -u origin main --force
    echo.
    pause
    exit /b 1
)

echo [OK] Изменения успешно отправлены в main!
echo.

REM Настраиваем upstream
git branch --set-upstream-to=origin/main main 2>nul

REM Удаляем старую ветку master (опционально)
echo.
set /p DELETE_MASTER="Удалить старую ветку master? (y/n): "
if /i "!DELETE_MASTER!"=="y" (
    git branch -D master 2>nul
    echo [OK] Ветка master удалена
)

echo.
echo ========================================
echo   Готово!
echo ========================================
echo.
echo Теперь ваша локальная ветка синхронизирована с main на GitHub.
echo Текущая ветка: main
echo.
echo В дальнейшем используйте:
echo   git push
echo.
echo Или запускайте: sync-to-github-simple.bat
echo.
pause

