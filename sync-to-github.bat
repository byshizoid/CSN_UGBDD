@echo off
chcp 65001 >nul
echo ========================================
echo   Ручная синхронизация с GitHub
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

REM Определяем текущую ветку
for /f "tokens=*" %%i in ('git branch --show-current') do set CURRENT_BRANCH=%%i
if not defined CURRENT_BRANCH set CURRENT_BRANCH=master

echo [INFO] Текущая ветка: %CURRENT_BRANCH%
echo.

REM Добавляем все файлы
echo [Шаг 1/3] Добавляю все файлы в Git...
git add .
if errorlevel 1 (
    echo [ОШИБКА] Не удалось добавить файлы!
    pause
    exit /b 1
)
echo [OK] Файлы добавлены
echo.

REM Проверяем, есть ли что коммитить
git diff --cached --quiet
if errorlevel 1 (
    echo [Шаг 2/3] Создаю коммит...
    git commit -m "Обновление: %date% %time%"
    if errorlevel 1 (
        echo [ОШИБКА] Не удалось создать коммит!
        pause
        exit /b 1
    )
    echo [OK] Коммит создан
) else (
    echo [INFO] Нет изменений для коммита
    echo.
    
    REM Проверяем, есть ли коммиты для push
    git rev-parse --verify HEAD >nul 2>&1
    if errorlevel 1 (
        echo [ПРЕДУПРЕЖДЕНИЕ] Нет коммитов в репозитории!
        echo.
        echo Создаю первый коммит...
        git commit -m "Initial commit: Карта перекрытий"
        if errorlevel 1 (
            echo [ОШИБКА] Не удалось создать коммит!
            pause
            exit /b 1
        )
        echo [OK] Первый коммит создан
    )
)
echo.

REM Пушим в GitHub
echo [Шаг 3/3] Отправляю изменения в GitHub...

REM Проверяем, установлен ли upstream
git rev-parse --abbrev-ref --symbolic-full-name @{u} >nul 2>&1
if errorlevel 1 (
    echo [INFO] Устанавливаю upstream для ветки %CURRENT_BRANCH%...
    git push -u origin %CURRENT_BRANCH%
) else (
    echo [INFO] Upstream уже установлен, отправляю изменения...
    git push
)

if errorlevel 1 (
    echo [ОШИБКА] Не удалось отправить в GitHub!
    echo.
    echo Возможные причины:
    echo - Не настроена аутентификация GitHub
    echo - Неверный токен доступа
    echo - Репозиторий не существует
    echo.
    echo Проверьте:
    echo 1. Настройки аутентификации GitHub
    echo 2. Существует ли репозиторий: %REPO_URL%
    echo 3. Правильность имени ветки (%CURRENT_BRANCH%)
    echo.
    echo Если это первый push, попробуйте:
    echo   git push -u origin %CURRENT_BRANCH%
    echo.
    pause
    exit /b 1
)

echo.
echo [OK] Все файлы успешно синхронизированы с GitHub!
echo.
echo Проверьте репозиторий: %REPO_URL%
echo.

pause

