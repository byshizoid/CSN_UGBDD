// Скрипт для автоматической синхронизации изменений с GitHub
// Запускается через file watcher при изменении файлов

const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

const WATCH_FILES = ['index.html', 'style.css', 'script.js'];
const GIT_COMMAND = 'git';
let lastCommitTime = 0;
const COMMIT_DELAY = 10000; // 10 секунд задержки перед коммитом
const MIN_COMMIT_INTERVAL = 30000; // Минимум 30 секунд между коммитами

let changeTimer = null;
let isCommitting = false;
let changedFiles = new Set();

function checkGitStatus(callback) {
    // Проверяем, есть ли реальные изменения в Git
    exec(`${GIT_COMMAND} status --porcelain`, (error, stdout, stderr) => {
        if (error) {
            callback(false);
            return;
        }
        
        const hasChanges = stdout.trim().length > 0;
        callback(hasChanges);
    });
}

function gitCommitAndPush() {
    const now = Date.now();
    
    // Проверяем, не слишком ли часто коммитим
    if (now - lastCommitTime < MIN_COMMIT_INTERVAL) {
        console.log('⏳ Слишком частые изменения, пропускаю...');
        return;
    }
    
    // Проверяем, не идет ли уже коммит
    if (isCommitting) {
        console.log('⏳ Коммит уже выполняется, пропускаю...');
        return;
    }
    
    isCommitting = true;
    
    // Проверяем реальные изменения перед коммитом
    checkGitStatus((hasChanges) => {
        if (!hasChanges) {
            console.log('ℹ️ Нет изменений в Git, пропускаю коммит');
            isCommitting = false;
            changedFiles.clear();
            return;
        }
        
        lastCommitTime = now;
        console.log('🔄 Обнаружены изменения, коммитим в GitHub...');
        console.log('📝 Измененные файлы:', Array.from(changedFiles).join(', '));
        
        // Добавляем все изменения
        exec(`${GIT_COMMAND} add .`, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ Ошибка git add:', error);
                isCommitting = false;
                return;
            }
            
            // Коммитим
            const commitMessage = `Auto-sync: ${new Date().toLocaleString('ru-RU')}`;
            exec(`${GIT_COMMAND} commit -m "${commitMessage}"`, (error, stdout, stderr) => {
                if (error) {
                    // Если нет изменений, это нормально
                    if (error.message.includes('nothing to commit')) {
                        console.log('ℹ️ Нет изменений для коммита');
                        isCommitting = false;
                        changedFiles.clear();
                        return;
                    }
                    console.error('❌ Ошибка git commit:', error);
                    isCommitting = false;
                    return;
                }
                
                console.log('✅ Коммит создан:', commitMessage);
                
                // Пушим в GitHub
                exec(`${GIT_COMMAND} push`, (error, stdout, stderr) => {
                    isCommitting = false;
                    changedFiles.clear();
                    
                    if (error) {
                        console.error('❌ Ошибка git push:', error);
                        return;
                    }
                    
                    console.log('✅ Изменения отправлены в GitHub!');
                });
            });
        });
    });
}

// Функция для отслеживания изменений файлов
function watchFiles() {
    console.log('👀 Начинаю отслеживание изменений файлов...');
    console.log('📁 Отслеживаемые файлы:', WATCH_FILES.join(', '));
    
    WATCH_FILES.forEach(file => {
        const filePath = path.join(__dirname, file);
        
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️ Файл ${file} не найден, пропускаю`);
            return;
        }
        
        fs.watchFile(filePath, { interval: 2000 }, (curr, prev) => {
            // Проверяем, что файл действительно изменился (время модификации)
            if (curr.mtime !== prev.mtime && curr.mtime.getTime() > prev.mtime.getTime()) {
                changedFiles.add(file);
                
                // Отменяем предыдущий таймер
                if (changeTimer) {
                    clearTimeout(changeTimer);
                }
                
                // Устанавливаем новый таймер (задержка перед коммитом)
                changeTimer = setTimeout(() => {
                    changeTimer = null;
                    gitCommitAndPush();
                }, COMMIT_DELAY);
            }
        });
    });
    
    console.log('✅ Отслеживание запущено. Изменения будут автоматически коммититься в GitHub.');
}

// Проверяем, что мы в git репозитории
exec(`${GIT_COMMAND} rev-parse --git-dir`, (error, stdout, stderr) => {
    if (error) {
        console.error('❌ Ошибка: Это не git репозиторий!');
        console.log('💡 Инициализируйте git репозиторий:');
        console.log('   git init');
        console.log('   git remote add origin https://github.com/ваш-username/ваш-репозиторий.git');
        process.exit(1);
    }
    
    // Запускаем отслеживание
    watchFiles();
});

// Обработка завершения процесса
process.on('SIGINT', () => {
    console.log('\n👋 Останавливаю отслеживание...');
    process.exit(0);
});

