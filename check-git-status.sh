#!/bin/bash

echo "========================================"
echo "Проверка статуса Git репозитория"
echo "========================================"
echo ""

# Проверяем наличие git
if ! command -v git &> /dev/null; then
    echo "[ОШИБКА] Git не установлен!"
    echo "Установите Git: sudo apt-get install git (Linux) или brew install git (Mac)"
    exit 1
fi

echo "[OK] Git установлен"
echo ""

# Проверяем, что мы в git репозитории
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "[ОШИБКА] Это не git репозиторий!"
    echo ""
    echo "Инициализирую git репозиторий..."
    git init
    echo ""
    echo "Теперь настройте remote:"
    echo "  git remote add origin https://github.com/ваш-username/ваш-репозиторий.git"
    exit 1
fi

echo "[OK] Git репозиторий найден"
echo ""

# Проверяем существующий remote
echo "Проверка remote origin:"
if git remote get-url origin > /dev/null 2>&1; then
    echo "[OK] Remote origin настроен:"
    git remote get-url origin
    echo ""
    echo "Если нужно изменить URL:"
    echo "  git remote set-url origin https://github.com/новый-username/новый-репозиторий.git"
else
    echo "[INFO] Remote origin не настроен"
    echo "[INFO] Настройте remote:"
    echo "  git remote add origin https://github.com/ваш-username/ваш-репозиторий.git"
fi
echo ""

# Проверяем статус
echo "Текущий статус:"
git status
echo ""

