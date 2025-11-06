@echo off
chcp 65001 >nul
echo ========================================
echo   Обновление токена GitHub
echo ========================================
echo.

REM Проверяем наличие git
git --version >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Git не установлен!
    pause
    exit /b 1
)

echo [INFO] Если токен не запрашивается, возможно он уже сохранен.
echo [INFO] Если push не работает, нужно обновить токен.
echo.

REM Проверяем remote
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Remote origin не настроен!
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('git remote get-url origin') do set REPO_URL=%%i

echo [INFO] Репозиторий: %REPO_URL%
echo.

REM Извлекаем username из URL
for /f "tokens=2 delims=/" %%a in ("%REPO_URL%") do set USERNAME=%%a
set USERNAME=!USERNAME:https:=!
if "%USERNAME%"=="" set USERNAME=byshizoid

echo ========================================
echo   Вариант 1: Удалить сохраненные учетные данные
echo ========================================
echo.
echo Это заставит Git запросить токен заново при следующем push.
echo.
set /p choice1="Удалить сохраненные учетные данные? (y/n): "

if /i "%choice1%"=="y" (
    echo.
    echo [INFO] Удаляю сохраненные учетные данные...
    
    REM Удаляем из файла .git-credentials (если credential.helper=store)
    if exist "%USERPROFILE%\.git-credentials" (
        echo [INFO] Найден файл с учетными данными: %USERPROFILE%\.git-credentials
        echo [INFO] Удаляю строку с github.com...
        powershell -Command "(Get-Content '%USERPROFILE%\.git-credentials') | Where-Object { $_ -notmatch 'github.com' } | Set-Content '%USERPROFILE%\.git-credentials.tmp'"
        if exist "%USERPROFILE%\.git-credentials.tmp" (
            move /Y "%USERPROFILE%\.git-credentials.tmp" "%USERPROFILE%\.git-credentials"
        )
        echo [OK] Учетные данные GitHub удалены
    )
    
    REM Очищаем credential cache
    git credential-cache exit 2>nul
    git credential reject 2>nul <<< "protocol=https`nhost=github.com`n"
    
    echo [OK] Учетные данные удалены
    echo.
    echo Теперь при следующем push Git запросит токен заново.
    echo.
)

echo ========================================
echo   Вариант 2: Ввести токен в URL
echo ========================================
echo.
echo Можно добавить токен прямо в URL репозитория.
echo ВНИМАНИЕ: Токен будет виден в .git/config
echo.
set /p choice2="Добавить токен в URL? (y/n): "

if /i "%choice2%"=="y" (
    echo.
    set /p GITHUB_TOKEN="Введите ваш Personal Access Token: "
    if "%GITHUB_TOKEN%"=="" (
        echo [ОШИБКА] Токен не введен!
        pause
        exit /b 1
    )
    
    REM Обновляем remote URL с токеном
    git remote set-url origin https://%GITHUB_TOKEN%@github.com/%USERNAME%/CSN_UGBDD.git
    echo [OK] Токен добавлен в URL репозитория
    echo.
    echo Теперь можно использовать git push без запроса токена.
    echo.
)

echo ========================================
echo   Вариант 3: Использовать SSH ключ
echo ========================================
echo.
echo Можно настроить SSH ключ для аутентификации без токена.
echo Это более безопасный способ.
echo.
set /p choice3="Показать инструкцию по SSH? (y/n): "

if /i "%choice3%"=="y" (
    echo.
    echo Инструкция:
    echo 1. Создайте SSH ключ: ssh-keygen -t ed25519 -C "ваш-email@example.com"
    echo 2. Добавьте ключ в GitHub: Settings ^> SSH and GPG keys ^> New SSH key
    echo 3. Измените remote на SSH:
    echo    git remote set-url origin git@github.com:%USERNAME%/CSN_UGBDD.git
    echo.
)

echo ========================================
echo   Тестирование
echo ========================================
echo.
set /p choice4="Протестировать push? (y/n): "

if /i "%choice4%"=="y" (
    echo.
    echo [INFO] Выполняю тестовый push...
    git push
    if errorlevel 1 (
        echo.
        echo [ОШИБКА] Push не удался!
        echo.
        echo Если Git запросил учетные данные:
        echo - Username: %USERNAME%
        echo - Password: вставьте Personal Access Token
        echo.
    ) else (
        echo.
        echo [OK] Push успешен!
        echo.
    )
)

echo.
pause

