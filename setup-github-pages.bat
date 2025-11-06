@echo off
chcp 65001 >nul
echo ========================================
echo   Настройка GitHub Pages
echo ========================================
echo.

REM Проверяем наличие git
git --version >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Git не установлен!
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
    echo   git remote add origin https://github.com/ваш-username/ваш-репозиторий.git
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('git remote get-url origin') do set REPO_URL=%%i
echo [OK] Remote origin: %REPO_URL%
echo.

setlocal enabledelayedexpansion

REM Определяем username и repo из URL
for /f "tokens=2 delims=/" %%a in ("%REPO_URL%") do set USERNAME=%%a
for /f "tokens=3 delims=/" %%b in ("%REPO_URL%") do set REPO=%%b
set REPO=!REPO:.git=!

echo [INFO] Username: %USERNAME%
echo [INFO] Repository: %REPO%
echo.

REM Проверяем текущую ветку
for /f "tokens=*" %%i in ('git branch --show-current') do set CURRENT_BRANCH=%%i
if not defined CURRENT_BRANCH set CURRENT_BRANCH=master

echo [INFO] Текущая ветка: %CURRENT_BRANCH%
echo.

REM Проверяем, есть ли коммиты
git rev-parse --verify HEAD >nul 2>&1
if errorlevel 1 (
    echo [ПРЕДУПРЕЖДЕНИЕ] Нет коммитов в репозитории!
    echo.
    echo Сначала нужно сделать первый коммит:
    echo   git add .
    echo   git commit -m "Initial commit"
    echo   git push -u origin %CURRENT_BRANCH%
    echo.
    pause
    exit /b 1
)

echo [OK] Репозиторий содержит коммиты
echo.

echo ========================================
echo   Инструкция по настройке GitHub Pages
echo ========================================
echo.
echo 1. Откройте ваш репозиторий на GitHub:
echo    %REPO_URL%
echo.
echo 2. Нажмите на вкладку "Settings" (Настройки)
echo.
echo 3. В левом меню найдите раздел "Pages"
echo    (или "Pages" в разделе "Code and automation")
echo.
echo 4. В разделе "Source" выберите:
echo    - Branch: %CURRENT_BRANCH%
echo    - Folder: / (root)
echo.
echo 5. Нажмите "Save" (Сохранить)
echo.
echo 6. Подождите 1-2 минуты
echo.
echo 7. Ваш сайт будет доступен по адресу:
echo    https://%USERNAME%.github.io/%REPO%
echo.
echo ========================================
echo.

REM Проверяем, есть ли index.html
if exist index.html (
    echo [OK] Файл index.html найден
) else (
    echo [ПРЕДУПРЕЖДЕНИЕ] Файл index.html не найден!
    echo GitHub Pages требует файл index.html в корне репозитория.
)

echo.
echo Нажмите любую клавишу, чтобы открыть репозиторий в браузере...
pause >nul

REM Открываем репозиторий в браузере
start "" "%REPO_URL%"

echo.
echo [INFO] Открыт репозиторий в браузере
echo [INFO] Следуйте инструкциям выше для настройки GitHub Pages
echo.

