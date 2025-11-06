@echo off
chcp 65001 >nul
echo ========================================
echo   Настройка аутентификации GitHub
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

echo ========================================
echo   Инструкция по настройке аутентификации
echo ========================================
echo.
echo Для синхронизации с GitHub нужен Personal Access Token (PAT)
echo.
echo 📝 ШАГ 1: Создайте токен на GitHub:
echo.
echo 1. Откройте: https://github.com/settings/tokens
echo 2. Нажмите "Generate new token" ^> "Generate new token (classic)"
echo 3. Заполните:
echo    - Note: "Для синхронизации CSN_UGBDD"
echo    - Expiration: выберите срок (например, 90 дней)
echo    - Scopes: выберите "repo" (полный доступ)
echo 4. Нажмите "Generate token"
echo 5. СКОПИРУЙТЕ токен (он больше не будет показан!)
echo.
echo 📝 ШАГ 2: Настройте Git для сохранения токена:
echo.
echo Выберите способ:
echo.
echo [1] Сохранить токен для этого репозитория
echo [2] Сохранить токен для всех репозиториев
echo [3] Пропустить (вводить токен каждый раз)
echo.
set /p choice="Ваш выбор (1/2/3): "

if "%choice%"=="1" (
    echo.
    echo Настраиваю credential helper для этого репозитория...
    git config credential.helper store
    echo [OK] Токен будет сохранен для этого репозитория
) else if "%choice%"=="2" (
    echo.
    echo Настраиваю credential helper для всех репозиториев...
    git config --global credential.helper store
    echo [OK] Токен будет сохранен для всех репозиториев
) else (
    echo.
    echo [INFO] Пропущено. При каждом push нужно будет вводить токен.
)

echo.
echo ========================================
echo   Тестирование синхронизации
echo ========================================
echo.
echo Теперь попробуйте синхронизировать файлы:
echo.
echo   sync-to-github.bat
echo.
echo Или вручную:
echo   git add .
echo   git commit -m "Test commit"
echo   git push
echo.
echo При первом push Git спросит:
echo - Username: ваш username на GitHub (например: byshizoid)
echo - Password: вставьте Personal Access Token (НЕ пароль!)
echo.
echo После первого ввода токен сохранится автоматически.
echo.

pause

