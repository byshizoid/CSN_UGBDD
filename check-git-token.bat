@echo off
chcp 65001 >nul
echo ========================================
echo   Проверка сохраненного токена
echo ========================================
echo.

REM Проверяем наличие git
git --version >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Git не установлен!
    pause
    exit /b 1
)

echo [INFO] Проверяю, где хранится токен...
echo.

REM Проверяем файл .git-credentials
if exist "%USERPROFILE%\.git-credentials" (
    echo [НАЙДЕНО] Файл с учетными данными: %USERPROFILE%\.git-credentials
    echo.
    echo Содержимое (только для GitHub):
    powershell -Command "$content = Get-Content '%USERPROFILE%\.git-credentials'; $github = $content | Where-Object { $_ -match 'github.com' }; if ($github) { $github -replace ':(.*?)@', ':****@' } else { Write-Host 'Токен GitHub не найден' }"
    echo.
    echo [INFO] Токен уже сохранен в файле, поэтому Git не запрашивает его.
    echo [INFO] Git автоматически использует этот токен при push.
    echo.
) else (
    echo [INFO] Файл .git-credentials не найден
    echo [INFO] Токен не сохранен, Git будет запрашивать его при каждом push.
    echo.
)

REM Проверяем remote URL
for /f "tokens=*" %%i in ('git remote get-url origin') do set REPO_URL=%%i
echo [INFO] Remote URL: %REPO_URL%
echo.

if "%REPO_URL%"=="" (
    echo [ПРЕДУПРЕЖДЕНИЕ] Remote origin не настроен!
    pause
    exit /b 1
)

REM Проверяем, есть ли токен в URL
echo %REPO_URL% | findstr /C:"@" >nul
if errorlevel 1 (
    echo [INFO] Токен не встроен в URL (это нормально)
) else (
    echo [ПРЕДУПРЕЖДЕНИЕ] Токен встроен в URL!
    echo [INFO] Это небезопасно, так как токен будет виден в .git/config
)

echo.
echo ========================================
echo   Что делать дальше?
echo ========================================
echo.
echo Если токен не работает или нужно обновить:
echo 1. Запустите: force-git-auth.bat (удалить старый токен)
echo 2. При следующем push Git запросит новый токен
echo 3. Введите ваш Personal Access Token вместо пароля
echo.
echo Если нужно создать новый токен:
echo 1. Откройте: https://github.com/settings/tokens
echo 2. Нажмите "Generate new token (classic)"
echo 3. Выберите права: repo (для работы с репозиториями)
echo 4. Скопируйте токен и используйте его при запросе
echo.

set /p choice="Показать полный путь к файлу с токеном? (y/n): "
if /i "%choice%"=="y" (
    echo.
    echo Полный путь: %USERPROFILE%\.git-credentials
    echo.
    set /p choice2="Открыть файл в блокноте? (y/n): "
    if /i "%choice2%"=="y" (
        notepad "%USERPROFILE%\.git-credentials"
    )
)

echo.
pause

