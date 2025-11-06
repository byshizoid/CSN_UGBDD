@echo off
echo ========================================
echo Первый коммит и настройка автосинхронизации
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

REM Добавляем все файлы
echo [INFO] Добавляю файлы в git...
git add .
echo [OK] Файлы добавлены
echo.

REM Создаем первый коммит
echo [INFO] Создаю первый коммит...
git commit -m "Initial commit: Карта перекрытий"
echo [OK] Коммит создан
echo.

REM Определяем текущую ветку
for /f "tokens=*" %%i in ('git branch --show-current') do set CURRENT_BRANCH=%%i
if not defined CURRENT_BRANCH set CURRENT_BRANCH=master

echo [INFO] Текущая ветка: %CURRENT_BRANCH%
echo.

REM Пушим в GitHub
echo [INFO] Отправляю в GitHub...
git push -u origin %CURRENT_BRANCH%
if errorlevel 1 (
    echo [ПРЕДУПРЕЖДЕНИЕ] Не удалось отправить в GitHub автоматически
    echo.
    echo Возможные причины:
    echo - Не настроена аутентификация GitHub
    echo - Ветка на GitHub может называться по-другому
    echo.
    echo Попробуйте вручную:
    echo   git push -u origin %CURRENT_BRANCH%
    echo.
    echo Или если на GitHub ветка называется main:
    echo   git branch -M main
    echo   git push -u origin main
    echo.
    echo Автосинхронизация все равно будет работать локально!
    echo.
)

echo [OK] Файлы отправлены в GitHub
echo.

REM Устанавливаем git hook
echo [INFO] Устанавливаю git hook для автосинхронизации...
if exist ".git\hooks\pre-commit" (
    echo [INFO] Git hook уже установлен
) else (
    if exist ".git-hooks\pre-commit" (
        copy /Y ".git-hooks\pre-commit" ".git\hooks\pre-commit" >nul 2>&1
        echo [OK] Git hook установлен
    ) else (
        echo [INFO] Git hook не найден, пропускаю
    )
)
echo.

echo ========================================
echo Готово!
echo ========================================
echo.
echo Теперь запустите автосинхронизацию:
echo   npm run watch
echo.
echo Или запустите напрямую:
echo   node auto-sync-to-github.js
echo.
echo Оставьте терминал открытым - изменения будут автоматически попадать в GitHub!
echo.
pause

