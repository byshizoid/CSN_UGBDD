@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
echo ========================================
echo   Принудительный запрос токена
echo ========================================
echo.

REM Проверяем наличие git
git --version >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Git не установлен!
    pause
    exit /b 1
)

echo [INFO] Удаляю сохраненные учетные данные GitHub из всех мест...
echo.

REM Определяем username из remote
for /f "tokens=*" %%i in ('git remote get-url origin') do set REPO_URL=%%i
for /f "tokens=2 delims=/" %%a in ("%REPO_URL%") do set USERNAME=%%a
set USERNAME=!USERNAME:https:=!
if "%USERNAME%"=="" set USERNAME=byshizoid

echo [INFO] Username: %USERNAME%
echo [INFO] Repo URL: %REPO_URL%
echo.

REM Шаг 1: Удаляем из файла .git-credentials
echo [Шаг 1/4] Удаляю из файла .git-credentials...
if exist "%USERPROFILE%\.git-credentials" (
    echo [INFO] Найден файл: %USERPROFILE%\.git-credentials
    powershell -Command "$content = Get-Content '%USERPROFILE%\.git-credentials' -ErrorAction SilentlyContinue; if ($content) { $filtered = $content | Where-Object { $_ -notmatch 'github.com' }; if ($filtered -and $filtered.Count -gt 0) { $filtered | Set-Content '%USERPROFILE%\.git-credentials' -Encoding UTF8; Write-Host 'Удалены строки с github.com' } else { Remove-Item '%USERPROFILE%\.git-credentials' -Force; Write-Host 'Файл удален (не осталось других записей)' } } else { Write-Host 'Файл пуст' }"
    echo [OK] Файл обработан
) else (
    echo [INFO] Файл .git-credentials не найден
)
echo.

REM Шаг 2: Удаляем из Windows Credential Manager
echo [Шаг 2/4] Удаляю из Windows Credential Manager...
for /f "tokens=*" %%i in ('git remote get-url origin') do set REPO_HOST=%%i
set REPO_HOST=!REPO_HOST:https://=!
set REPO_HOST=!REPO_HOST:http://=!
for /f "tokens=1 delims=/" %%a in ("!REPO_HOST!") do set REPO_HOST=%%a

echo [INFO] Удаляю учетные данные для: git:https://!REPO_HOST!
cmdkey /list | findstr "git:" >nul 2>&1
if errorlevel 0 (
    cmdkey /delete:git:https://!REPO_HOST! 2>nul
    echo [OK] Удалено из Windows Credential Manager
) else (
    echo [INFO] Учетные данные не найдены в Windows Credential Manager
)
echo.

REM Шаг 3: Очищаем Git credential cache
echo [Шаг 3/4] Очищаю Git credential cache...
git credential-cache exit 2>nul
echo [OK] Credential cache очищен
echo.

REM Шаг 4: Используем git credential reject для всех мест
echo [Шаг 4/4] Принудительно отклоняю сохраненные учетные данные...
echo protocol=https > "%TEMP%\git-cred-reject.txt"
echo host=github.com >> "%TEMP%\git-cred-reject.txt"
echo. >> "%TEMP%\git-cred-reject.txt"
git credential reject < "%TEMP%\git-cred-reject.txt" 2>nul
del "%TEMP%\git-cred-reject.txt" 2>nul
echo [OK] Учетные данные отклонены
echo.

REM Проверяем, нет ли токена в URL
echo [ПРОВЕРКА] Проверяю URL репозитория...
echo %REPO_URL% | findstr /C:"@" >nul
if not errorlevel 1 (
    echo [ПРЕДУПРЕЖДЕНИЕ] Токен встроен в URL!
    echo [INFO] Удаляю токен из URL...
    git remote set-url origin https://github.com/%USERNAME%/CSN_UGBDD.git
    echo [OK] URL очищен
) else (
    echo [OK] URL не содержит токен
)
echo.

echo ========================================
echo   Готово! Учетные данные удалены
echo ========================================
echo.
echo Теперь при следующем push Git запросит учетные данные.
echo.
echo При запросе введите:
echo - Username: %USERNAME%
echo - Password: ваш Personal Access Token (НЕ пароль!)
echo.
echo ВАЖНО: В поле "Password" вставляйте токен, а не пароль!
echo.

set /p choice="Выполнить push сейчас (Git запросит токен)? (y/n): "
if /i "%choice%"=="y" (
    echo.
    echo [INFO] Выполняю push...
    echo [INFO] Ожидаю ввода токена...
    echo.
    git push
    if errorlevel 1 (
        echo.
        echo [ПРЕДУПРЕЖДЕНИЕ] Push не удался или токен не был запрошен.
        echo.
        echo Возможные причины:
        echo 1. Токен все еще сохранен в другом месте
        echo 2. Git использует другой credential helper
        echo.
        echo Попробуйте:
        echo 1. Создать новый токен в GitHub
        echo 2. Вручную ввести токен в URL (см. update-git-token.bat)
        echo.
    ) else (
        echo.
        echo [OK] Push успешен!
        echo [INFO] Токен был сохранен автоматически.
    )
)

echo.
pause

