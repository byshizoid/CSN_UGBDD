#!/bin/bash

echo "========================================"
echo "Настройка автоматической синхронизации с GitHub"
echo "========================================"
echo ""

# Проверяем наличие git
if ! command -v git &> /dev/null; then
    echo "[ОШИБКА] Git не установлен!"
    echo "Установите Git: sudo apt-get install git (Linux) или brew install git (Mac)"
    exit 1
fi

echo "[OK] Git установлен"

# Проверяем, что мы в git репозитории
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "[ОШИБКА] Это не git репозиторий!"
    echo ""
    echo "Инициализирую git репозиторий..."
    git init
    echo ""
    echo "Теперь нужно настроить remote:"
    echo "git remote add origin https://github.com/ваш-username/ваш-репозиторий.git"
    echo ""
    echo "Или если remote уже существует:"
    echo "git remote set-url origin https://github.com/ваш-username/ваш-репозиторий.git"
    exit 1
fi

echo "[OK] Git репозиторий найден"

# Проверяем существующий remote
if git remote get-url origin > /dev/null 2>&1; then
    echo "[OK] Remote origin уже настроен:"
    git remote get-url origin
else
    echo "[INFO] Remote origin не настроен"
    echo "[INFO] Чтобы настроить, выполните:"
    echo "   git remote add origin https://github.com/ваш-username/ваш-репозиторий.git"
fi

# Устанавливаем git hook для автоматического коммита
if [ -f ".git/hooks/pre-commit" ]; then
    echo "[INFO] Git hook уже установлен"
else
    echo "[INFO] Устанавливаю git hook..."
    cp .git-hooks/pre-commit .git/hooks/pre-commit
    chmod +x .git/hooks/pre-commit
    echo "[OK] Git hook установлен"
fi

echo ""
echo "========================================"
echo "Настройка завершена!"
echo "========================================"
echo ""
echo "Теперь при сохранении файлов в Cursor:"
echo "- Изменения автоматически коммитятся в Git"
echo "- Коммиты автоматически пушатся в GitHub"
echo ""
echo "Запустите скрипт отслеживания:"
echo "  npm run watch"
echo ""
echo "Или запустите напрямую:"
echo "  node auto-sync-to-github.js"
echo ""

