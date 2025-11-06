const DB_NAME = 'ClosuresDB';
const DB_VERSION = 1;
const STORE_NAME = 'closures';

// IndexedDB helper
class DBHelper {
    static async openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
        });
    }

    static async save(key, data) {
        try {
            const db = await this.openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.put(data, key);
                
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
            });
        } catch (e) {
            console.error('Ошибка сохранения:', e);
            throw e;
        }
    }

    static async load(key) {
        try {
            const db = await this.openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(key);
                
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
            });
        } catch (e) {
            console.error('Ошибка загрузки:', e);
            return null;
        }
    }
}

class ClosuresApp {
    constructor() {
        this.closures = [];
        this.mapImage = null;
        this.currentClosureNumber = 1;
        this.isSetupMode = false;
        this.isAdminMode = false;
        this.currentClosure = null;
        this.currentPhotoIndex = 0;
        this.currentEditingClosureNumber = null;
        // Состояние зума
        this.photoZoom = {
            scale: 1,
            isDragging: false,
            startX: 0,
            startY: 0,
            translateX: 0,
            translateY: 0
        };
        // Пароль администратора (хранится локально, не в коде)
        // Если пароль не установлен, нужно установить его при первом входе
        this.adminPassword = localStorage.getItem('admin_password');
        // Настройки GitHub (загружаются из localStorage)
        this.githubConfig = {
            owner: localStorage.getItem('github_owner') || '',
            repo: localStorage.getItem('github_repo') || '',
            token: localStorage.getItem('github_token') || ''
        };
        // Автосохранение
        this.autoSaveEnabled = false;
        this.autoSaveTimer = null;
        this.autoSaveDelay = 3000; // 3 секунды задержки
        
        // Система сопровождений
        this.escorts = []; // Список сопровождений
        this.currentEscortId = null; // ID текущего сопровождения
        this.currentEscortName = null; // Название текущего сопровождения
        
        // Проверка активного коммита для всех пользователей
        this.updateCheckInterval = null;
        
        this.init();
    }

    init() {
        console.log('🚀 Инициализация приложения...');
        console.log('🔍 Проверка DOM:', {
            adminBtn: document.getElementById('adminLoginBtn'),
            setupSection: document.getElementById('setupSection'),
            adminAccess: document.getElementById('adminAccess')
        });
        this.setupEventListeners();
        this.loadSavedData();
        
        // Запускаем проверку активного коммита для всех пользователей
        this.startUpdateStatusChecker();
        
        console.log('✅ Инициализация завершена');
    }

    setupEventListeners() {
        console.log('🔧 Настройка обработчиков событий...');
        // Загрузка карты
        const mapInput = document.getElementById('mapInput');
        if (mapInput) {
            mapInput.addEventListener('change', (e) => {
                this.handleMapUpload(e.target.files[0]);
            });
        } else {
            console.warn('⚠️ mapInput не найден');
        }

        // Добавление нового перекрытия
        document.getElementById('addClosureBtn').addEventListener('click', () => {
            this.addClosureItem();
        });

        // Сохранение и переход в режим просмотра
        const saveSetupBtn = document.getElementById('saveSetupBtn');
        if (saveSetupBtn) {
            saveSetupBtn.addEventListener('click', () => {
                console.log('🔘 Кнопка "Сохранить и начать работу" нажата');
                this.saveAndSwitchMode();
            });
        } else {
            console.error('❌ Кнопка saveSetupBtn не найдена!');
        }

        // Модальное окно
        document.querySelector('.close').addEventListener('click', () => {
            this.closeModal();
        });

        window.addEventListener('click', (e) => {
            const modal = document.getElementById('photoModal');
            if (e.target === modal) {
                this.closeModal();
            }
        });

        // Динамические обработчики для загрузки фото перекрытий
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('closure-photo-input')) {
                this.handleClosurePhotoUpload(e.target);
            }
        });

        // Динамические обработчики для удаления перекрытий
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-closure-btn')) {
                this.deleteClosure(e.target.dataset.number);
            }
        });
        
        // Глобальные обработчики для перетаскивания увеличенных фото
        document.addEventListener('mousemove', (e) => {
            if (this.photoZoom.isDragging && this.photoZoom.scale > 1) {
                const currentImg = document.querySelector('.photo-item:not([style*="display: none"]) .photo-img');
                if (currentImg) {
                    this.photoZoom.translateX = e.clientX - this.photoZoom.startX;
                    this.photoZoom.translateY = e.clientY - this.photoZoom.startY;
                    this.applyPhotoTransform(currentImg);
                }
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (this.photoZoom.isDragging) {
                this.photoZoom.isDragging = false;
                const currentImg = document.querySelector('.photo-item:not([style*="display: none"]) .photo-img');
                if (currentImg) {
                    currentImg.style.cursor = this.photoZoom.scale > 1 ? 'grab' : 'zoom-in';
                }
            }
        });

        // Вход в режим администратора
        const adminBtn = document.getElementById('adminLoginBtn');
        console.log('🔍 Поиск кнопки adminLoginBtn:', adminBtn);
        if (adminBtn) {
            console.log('✅ Кнопка найдена, добавляем обработчик');
            adminBtn.addEventListener('click', (e) => {
                console.log('🔐 Кнопка администратора нажата', e);
                e.preventDefault();
                e.stopPropagation();
                try {
                    this.requestAdminAccess();
                } catch (error) {
                    console.error('❌ Ошибка при вызове requestAdminAccess:', error);
                    alert('Ошибка: ' + error.message);
                }
            });
            // Также пробуем через onclick на случай проблем с addEventListener
            adminBtn.onclick = (e) => {
                console.log('🔐 Кнопка администратора нажата (onclick)', e);
                e.preventDefault();
                e.stopPropagation();
                try {
                    this.requestAdminAccess();
                } catch (error) {
                    console.error('❌ Ошибка при вызове requestAdminAccess:', error);
                    alert('Ошибка: ' + error.message);
                }
                return false;
            };
        } else {
            console.error('❌ Кнопка adminLoginBtn не найдена!');
            console.error('🔍 Все кнопки на странице:', document.querySelectorAll('button'));
            console.error('🔍 Все элементы с id:', document.querySelectorAll('[id]'));
        }

        // Сохранение GitHub настроек
        const saveTokenBtn = document.getElementById('saveTokenBtn');
        if (saveTokenBtn) {
            saveTokenBtn.addEventListener('click', () => {
                this.saveGitHubConfig();
            });
        }

        // Управление сопровождениями
        const createEscortBtn = document.getElementById('createEscortBtn');
        if (createEscortBtn) {
            createEscortBtn.addEventListener('click', () => {
                this.createNewEscort();
            });
        }

        const adminEscortSelect = document.getElementById('adminEscortSelect');
        if (adminEscortSelect) {
            adminEscortSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.loadEscortForEditing(e.target.value);
                }
            });
        }

        const escortSelect = document.getElementById('escortSelect');
        if (escortSelect) {
            escortSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.loadEscortForViewing(e.target.value);
                }
            });
        }

        // Редактирование названия сопровождения
        const editEscortNameBtn = document.getElementById('editEscortNameBtn');
        if (editEscortNameBtn) {
            editEscortNameBtn.addEventListener('click', () => {
                this.startEditingEscortName();
            });
        }

        const saveEscortNameBtn = document.getElementById('saveEscortNameBtn');
        if (saveEscortNameBtn) {
            saveEscortNameBtn.addEventListener('click', () => {
                this.saveEscortName();
            });
        }

        const cancelEscortNameBtn = document.getElementById('cancelEscortNameBtn');
        if (cancelEscortNameBtn) {
            cancelEscortNameBtn.addEventListener('click', () => {
                this.cancelEditingEscortName();
            });
        }

        // Навигация по фото
        document.getElementById('prevPhoto').addEventListener('click', () => {
            this.switchPhoto('prev');
        });

        document.getElementById('nextPhoto').addEventListener('click', () => {
            this.switchPhoto('next');
        });

        // Клавиатурная навигация
        document.addEventListener('keydown', (e) => {
            const modal = document.getElementById('photoModal');
            if (!modal.classList.contains('show')) return;
            
            if (e.key === 'ArrowLeft') {
                this.switchPhoto('prev');
            } else if (e.key === 'ArrowRight') {
                this.switchPhoto('next');
            } else if (e.key === 'Escape') {
                this.closeModal();
            }
        });

        // Редактирование фото в режиме администратора
        document.getElementById('replacePhotoBtn').addEventListener('click', () => {
            document.getElementById('replacePhotoInput').click();
        });

        document.getElementById('replacePhotoInput').addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.replaceCurrentPhoto(e.target.files[0]);
            }
        });

        document.getElementById('deletePhotoBtn').addEventListener('click', () => {
            if (confirm('Вы уверены, что хотите удалить это фото?')) {
                this.deleteCurrentPhoto();
            }
        });

        // Редактирование названия перекрытия
        document.getElementById('editTitleBtn').addEventListener('click', () => {
            this.startEditingTitle();
        });

        document.getElementById('saveTitleBtn').addEventListener('click', () => {
            this.saveTitle();
        });

        document.getElementById('modalTitleInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveTitle();
            } else if (e.key === 'Escape') {
                this.cancelEditingTitle();
            }
        });

        // Добавление фото к перекрытию
        document.getElementById('addPhotoBtn').addEventListener('click', () => {
            document.getElementById('addPhotoInput').click();
        });

        document.getElementById('addPhotoInput').addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                this.addPhotosToClosure(Array.from(e.target.files));
            }
        });
    }

    async requestAdminAccess() {
        console.log('🔐 requestAdminAccess вызван');
        console.log('📋 Текущая конфигурация:', {
            owner: this.githubConfig.owner,
            repo: this.githubConfig.repo,
            hasToken: !!this.githubConfig.token
        });
        console.log('🔍 this:', this);
        console.log('🔍 this.isAdminMode:', this.isAdminMode);
        
        // Проверяем, есть ли GitHub токен (это и есть пароль администратора)
        if (!this.githubConfig.token) {
            console.log('⚠️ Токен не найден, показываем форму настройки');
            // Показываем форму настройки
            const setupSection = document.getElementById('setupSection');
            const adminAccess = document.getElementById('adminAccess');
            
            if (setupSection) {
                setupSection.style.display = 'block';
            } else {
                console.error('❌ Элемент setupSection не найден!');
            }
            
            if (adminAccess) {
                adminAccess.style.display = 'none';
            } else {
                console.error('❌ Элемент adminAccess не найден!');
            }
            
            const headerDesc = document.getElementById('headerDescription');
            if (headerDesc) {
                headerDesc.textContent = 'Настройка GitHub для режима администратора';
            }
            
            // Заполняем поля, если что-то есть
            const repoOwner = document.getElementById('repoOwner');
            const repoName = document.getElementById('repoName');
            if (repoOwner) repoOwner.value = this.githubConfig.owner;
            if (repoName) repoName.value = this.githubConfig.repo;
            return;
        }
        
        // Проверяем токен, пытаясь получить информацию о репозитории
        try {
            const isValid = await this.verifyGitHubToken();
            if (isValid) {
                this.isAdminMode = true;
                this.enableAdminMode();
            } else {
                alert('Неверный GitHub токен! Проверьте токен в настройках.');
                // Показываем форму для исправления
                document.getElementById('setupSection').style.display = 'block';
                document.getElementById('adminAccess').style.display = 'none';
            }
        } catch (error) {
            alert('Ошибка проверки токена: ' + error.message);
            // Показываем форму для исправления
            document.getElementById('setupSection').style.display = 'block';
            document.getElementById('adminAccess').style.display = 'none';
        }
    }

    async verifyGitHubToken() {
        if (!this.githubConfig.owner || !this.githubConfig.repo || !this.githubConfig.token) {
            return false;
        }

        try {
            const response = await fetch(
                `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}`,
                {
                    headers: {
                        'Authorization': `token ${this.githubConfig.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            return response.ok;
        } catch (e) {
            console.error('Ошибка проверки токена:', e);
            return false;
        }
    }

    enableAdminMode() {
        document.getElementById('setupSection').style.display = 'block';
        document.getElementById('adminAccess').style.display = 'none';
        document.getElementById('headerDescription').textContent = 'Режим администратора - загрузка данных';
        
        // Загружаем сохраненные настройки
        document.getElementById('repoOwner').value = this.githubConfig.owner;
        document.getElementById('repoName').value = this.githubConfig.repo;
        document.getElementById('githubToken').value = this.githubConfig.token;
        
        // Автосохранение отключено - сохранение только при нажатии "Сохранить и начать работу"
        // Настраиваем только локальное сохранение
        if (this.githubConfig.owner && this.githubConfig.repo && this.githubConfig.token) {
            this.autoSaveEnabled = false; // Отключаем автосохранение в GitHub
            this.setupAutoSave(); // Настраиваем только локальное сохранение
            document.getElementById('autoSaveStatus').style.display = 'none'; // Скрываем статус автосохранения
            
            // Загружаем список сопровождений из GitHub для выбора
            this.loadEscortsList();
        }
    }

    async loadEscortsList() {
        // Загружаем список сопровождений из GitHub
        try {
            const response = await fetch('data.json?t=' + Date.now());
            if (response.ok) {
                const allData = await response.json();
                if (allData.escorts) {
                    this.escorts = Object.values(allData.escorts);
                    this.updateEscortSelectors();
                } else if (allData.closures) {
                    // Старая структура - создаем одно сопровождение
                    const defaultEscort = {
                        id: 'default',
                        name: 'Сопровождение по умолчанию',
                        mapImage: allData.mapImage,
                        closures: allData.closures
                    };
                    this.escorts = [defaultEscort];
                    if (!this.currentEscortId) {
                        this.currentEscortId = 'default';
                        this.currentEscortName = defaultEscort.name;
                    }
                    this.updateEscortSelectors();
                }
            }
        } catch (e) {
            console.log('Не удалось загрузить список сопровождений:', e);
            // Если нет сопровождений, создаем пустой список
            if (this.escorts.length === 0) {
                this.updateEscortSelectors();
            }
        }
    }


    setupAutoSave() {
        // Автосохранение отключено - сохранение только при нажатии "Сохранить и начать работу"
        // Оставляем только локальное сохранение при изменении названий
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('closure-name-input') && this.isAdminMode) {
                // Сохраняем только локально, не в GitHub
                this.saveToDB();
            }
        });
    }

    scheduleAutoSave() {
        // Отменяем предыдущий таймер
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }
        
        // Устанавливаем новый таймер
        this.autoSaveTimer = setTimeout(() => {
            this.autoSaveToGitHub();
        }, this.autoSaveDelay);
    }

    async autoSaveToGitHub() {
        console.log('🔄 autoSaveToGitHub вызван');
        console.log('isAdminMode:', this.isAdminMode);
        console.log('autoSaveEnabled:', this.autoSaveEnabled);
        console.log('githubConfig:', {
            owner: this.githubConfig.owner ? '✅' : '❌',
            repo: this.githubConfig.repo ? '✅' : '❌',
            token: this.githubConfig.token ? '✅' : '❌'
        });
        
        if (!this.isAdminMode) {
            console.log('❌ Не в режиме администратора');
            return;
        }
        
        if (!this.autoSaveEnabled) {
            console.log('❌ Автосохранение не включено');
            return;
        }
        
        if (!this.githubConfig.owner || !this.githubConfig.repo || !this.githubConfig.token) {
            console.log('❌ Настройки GitHub не заполнены');
            console.log('Пожалуйста, заполните настройки GitHub в режиме администратора');
            return;
        }
        
        // Собираем текущие данные из массива closures
        const dataToSave = {
            mapImage: this.mapImage,
            closures: this.closures.map(closure => ({
                number: closure.number,
                name: closure.name,
                photos: closure.photos || []
            })).filter(closure => closure.photos && closure.photos.length > 0)
        };
        
        console.log('📦 Данные для сохранения:', {
            hasMap: !!dataToSave.mapImage,
            closuresCount: dataToSave.closures.length
        });
        
        // Проверяем, есть ли что сохранять
        if (!dataToSave.mapImage && dataToSave.closures.length === 0) {
            console.log('ℹ️ Нет данных для сохранения');
            return;
        }
        
        // Показываем статус "Сохраняется..."
        this.showAutoSaveIndicator('saving', '🔄 Сохраняется в GitHub...');
        
        try {
            console.log('📤 Начинаю сохранение в GitHub...');
            const result = await this.saveToGitHub(dataToSave);
            console.log('✅ Автосохранение в GitHub выполнено', result);
            
            // Показываем статус "Сохранено" с ссылкой на коммит
            const commitUrl = `https://github.com/${this.githubConfig.owner}/${this.githubConfig.repo}/commits/master`;
            this.showAutoSaveIndicator('success', '✅ Сохранено в GitHub', commitUrl);
        } catch (e) {
            console.error('❌ Ошибка автосохранения:', e);
            console.error('Детали ошибки:', {
                message: e.message,
                stack: e.stack
            });
            this.showAutoSaveIndicator('error', `❌ Ошибка: ${e.message}`);
        }
    }

    showAutoSaveIndicator(status = 'success', message = '💾 Автосохранено', linkUrl = null) {
        let indicator = document.getElementById('autoSaveIndicator');
        
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'autoSaveIndicator';
            indicator.className = 'auto-save-indicator';
            document.body.appendChild(indicator);
        }
        
        // Устанавливаем класс статуса
        indicator.className = `auto-save-indicator auto-save-${status}`;
        
        // Формируем содержимое
        if (linkUrl && status === 'success') {
            indicator.innerHTML = `
                <span>${message}</span>
                <a href="${linkUrl}" target="_blank" class="indicator-link" title="Открыть коммит в GitHub">🔗</a>
                <span class="indicator-time">${new Date().toLocaleTimeString('ru-RU')}</span>
            `;
        } else {
            indicator.innerHTML = `
                <span>${message}</span>
                ${status === 'success' ? `<span class="indicator-time">${new Date().toLocaleTimeString('ru-RU')}</span>` : ''}
            `;
        }
        
        indicator.style.display = 'flex';
        
        // Автоматически скрываем через определенное время
        const hideDelay = status === 'error' ? 5000 : (status === 'saving' ? 0 : 4000);
        if (hideDelay > 0) {
            setTimeout(() => {
                const indicator = document.getElementById('autoSaveIndicator');
                if (indicator && indicator.style.display !== 'none') {
                    indicator.style.display = 'none';
                }
            }, hideDelay);
        }
    }

    async saveGitHubConfig() {
        const owner = document.getElementById('repoOwner').value.trim();
        const repo = document.getElementById('repoName').value.trim();
        const token = document.getElementById('githubToken').value.trim();
        
        if (!owner || !repo || !token) {
            alert('Пожалуйста, заполните все поля!');
            return;
        }
        
        // Проверяем токен перед сохранением
        try {
            const response = await fetch(
                `https://api.github.com/repos/${owner}/${repo}`,
                {
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            
            if (!response.ok) {
                alert('Неверный токен или нет доступа к репозиторию!\n\nПроверьте:\n- Правильность токена\n- Права доступа к репозиторию\n- Название репозитория');
                return;
            }
            
            // Токен валидный, сохраняем
            this.githubConfig = { owner, repo, token };
            localStorage.setItem('github_owner', owner);
            localStorage.setItem('github_repo', repo);
            localStorage.setItem('github_token', token);
            
            console.log('✅ Настройки GitHub сохранены:', {
                owner: owner,
                repo: repo,
                token: token ? '✅ (установлен)' : '❌'
            });
            
            // Автоматически включаем режим администратора
            this.isAdminMode = true;
            this.enableAdminMode();
            
            // Настройки сохранены, автосохранение отключено
            // Сохранение в GitHub будет только при нажатии "Сохранить и начать работу"
            this.autoSaveEnabled = false; // Отключаем автосохранение
            this.setupAutoSave(); // Настраиваем только локальное сохранение
            document.getElementById('autoSaveStatus').style.display = 'none'; // Скрываем статус автосохранения
            
            alert('✅ Настройки сохранены! Режим администратора включен.\n\nВсе изменения будут сохранены в GitHub только после нажатия кнопки "Сохранить и начать работу".');
        } catch (error) {
            console.error('Ошибка проверки токена:', error);
            alert('Ошибка проверки токена: ' + error.message);
        }
    }

    handleMapUpload(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.mapImage = e.target.result;
            const preview = document.getElementById('mapPreview');
            preview.innerHTML = `<img src="${e.target.result}" alt="Карта">`;
            preview.style.display = 'block';
            
            // Сохранение только локально (в IndexedDB), не в GitHub
            // GitHub будет сохранен только при нажатии "Сохранить и начать работу"
            this.saveToDB();
        };
        reader.readAsDataURL(file);
    }

    handleClosurePhotoUpload(input) {
        const files = Array.from(input.files);
        if (files.length === 0) return;

        const number = input.dataset.number;
        const name = document.querySelector(`.closure-name-input[data-number="${number}"]`).value || `Перекрытие ${number}`;
        
        // Загружаем все файлы
        const loadPromises = files.map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });
        });

        Promise.all(loadPromises).then(photos => {
            let closure = this.closures.find(c => c.number === parseInt(number));
            
            if (closure) {
                // Добавляем новые фото к существующим
                closure.photos = [...(closure.photos || []), ...photos];
            } else {
                closure = {
                    number: parseInt(number),
                    name: name,
                    photos: photos
                };
                this.closures.push(closure);
            }

            // Обновляем превью
            this.updateClosurePreview(number, closure.photos);
            
            // Сохранение только локально (в IndexedDB), не в GitHub
            // GitHub будет сохранен только при нажатии "Сохранить и начать работу"
            this.saveToDB();
        });
    }

    updateClosurePreview(number, photos) {
        const preview = document.querySelector(`.closure-photo-input[data-number="${number}"]`).closest('.closure-item').querySelector('.closure-preview');
        
        if (photos && photos.length > 0) {
            preview.innerHTML = `
                <div class="preview-gallery">
                    ${photos.map((photo, index) => `
                        <div class="preview-item">
                            <img src="${photo}" alt="Фото ${index + 1}">
                            <span class="preview-number">${index + 1}</span>
                            <button class="delete-photo-btn" data-number="${number}" data-index="${index}" title="Удалить фото">×</button>
                        </div>
                    `).join('')}
                </div>
            `;
            preview.classList.add('show');
            
            // Добавляем обработчики для кнопок удаления
            preview.querySelectorAll('.delete-photo-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const closureNumber = btn.dataset.number;
                    const photoIndex = parseInt(btn.dataset.index);
                    this.deletePhotoFromClosure(closureNumber, photoIndex);
                });
            });
        } else {
            preview.innerHTML = '';
            preview.classList.remove('show');
        }
    }

    addClosureItem() {
        this.currentClosureNumber++;
        const number = this.currentClosureNumber;
        
        const closuresList = document.getElementById('closuresList');
        const closureItem = document.createElement('div');
        closureItem.className = 'closure-item';
        closureItem.innerHTML = `
            <label class="upload-label">
                <div class="upload-box-small">
                    <span class="upload-icon">📷</span>
                    <span class="upload-text">Добавить фото</span>
                </div>
                <input type="file" class="closure-photo-input" accept="image/*" multiple data-number="${number}" hidden>
            </label>
            <div class="closure-info">
                <input type="text" class="closure-name-input" placeholder="Перекрытие ${number}" value="Перекрытие ${number}" data-number="${number}">
                <div class="closure-preview"></div>
                <button class="btn btn-danger delete-closure-btn" data-number="${number}">Удалить</button>
            </div>
        `;
        closuresList.appendChild(closureItem);
        
        // Сохранение только локально (в IndexedDB), не в GitHub
        // GitHub будет сохранен только при нажатии "Сохранить и начать работу"
        this.saveToDB();
    }

    deleteClosure(number) {
        // Удаляем из массива
        this.closures = this.closures.filter(c => c.number !== parseInt(number));
        
        // Удаляем элемент из DOM
        const item = document.querySelector(`.closure-photo-input[data-number="${number}"]`).closest('.closure-item');
        if (item) {
            item.remove();
        }
        
        // Сохранение только локально (в IndexedDB), не в GitHub
        // GitHub будет сохранен только при нажатии "Сохранить и начать работу"
        this.saveToDB();
    }

    deletePhotoFromClosure(closureNumber, photoIndex) {
        const closure = this.closures.find(c => c.number === parseInt(closureNumber));
        
        if (!closure || !closure.photos || photoIndex >= closure.photos.length) {
            return;
        }
        
        // Удаляем фото из массива
        closure.photos.splice(photoIndex, 1);
        
        // Если фото больше нет, удаляем перекрытие
        if (closure.photos.length === 0) {
            this.closures = this.closures.filter(c => c.number !== parseInt(closureNumber));
            const item = document.querySelector(`.closure-photo-input[data-number="${closureNumber}"]`)?.closest('.closure-item');
            if (item) {
                const preview = item.querySelector('.closure-preview');
                if (preview) {
                    preview.innerHTML = '';
                    preview.classList.remove('show');
                }
            }
        } else {
            // Обновляем превью
            this.updateClosurePreview(closureNumber, closure.photos);
        }
        
        // Сохранение только локально (в IndexedDB), не в GitHub
        // GitHub будет сохранен только при нажатии "Сохранить и начать работу"
        this.saveToDB();
    }

    switchToViewMode() {
        console.log('👁️ Переключение в режим просмотра...');
        console.log('📊 Данные:', {
            closuresCount: this.closures.length,
            hasMapImage: !!this.mapImage
        });
        
        // Скрываем режим настройки (если администратор)
        if (this.isAdminMode) {
            const setupSection = document.getElementById('setupSection');
            if (setupSection) {
                setupSection.style.display = 'none';
            }
        }
        
        // Показываем режим просмотра
        const viewSection = document.getElementById('viewSection');
        if (!viewSection) {
            console.error('❌ Элемент viewSection не найден!');
            return;
        }
        viewSection.style.display = 'block';
        
        // Обновляем селекторы сопровождений
        this.updateEscortSelectors();
        
        // Устанавливаем карту
        if (this.mapImage) {
            const mapImage = document.getElementById('mapImage');
            if (mapImage) {
                mapImage.src = this.mapImage;
                mapImage.style.display = 'block';
                console.log('✅ Карта установлена:', this.mapImage);
            } else {
                console.error('❌ Элемент mapImage не найден!');
            }
        } else {
            console.warn('⚠️ Карта не загружена');
        }
        
        // Создаем кнопки перекрытий
        this.renderClosureButtons();
    }

    showLoadingOverlay(message = 'Идёт загрузка данных') {
        const overlay = document.getElementById('loadingOverlay');
        const messageElement = overlay?.querySelector('.loading-message');
        if (overlay) {
            if (messageElement) {
                messageElement.textContent = message;
            }
            overlay.style.display = 'flex';
            overlay.style.zIndex = '999999';
            overlay.style.pointerEvents = 'all';
            
            // Блокируем прокрутку страницы
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
            document.body.style.height = '100%';
            
            // Добавляем класс для полной блокировки всех элементов
            document.body.classList.add('loading-active');
            
            // Блокируем все взаимодействия со страницей
            document.body.style.pointerEvents = 'none';
            overlay.style.pointerEvents = 'all';
            
            // Блокируем все события клавиатуры и мыши на уровне документа
            this.blockAllInteractions();
            
            console.log('🔒 Интерфейс заблокирован');
        }
    }
    
    blockAllInteractions() {
        // Блокируем все клики и взаимодействия
        const blockEvent = (e) => {
            // Разрешаем события только для самого оверлея
            const overlay = document.getElementById('loadingOverlay');
            if (overlay && overlay.contains(e.target)) {
                return; // Разрешаем события внутри оверлея
            }
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        };
        
        // Сохраняем обработчики для последующего удаления
        if (!this.blockHandlers) {
            this.blockHandlers = {
                click: blockEvent,
                mousedown: blockEvent,
                mouseup: blockEvent,
                touchstart: blockEvent,
                touchmove: blockEvent,
                touchend: blockEvent,
                keydown: (e) => {
                    // Разрешаем только Escape для отладки (можно убрать)
                    if (e.key === 'Escape' && e.ctrlKey) {
                        return; // Ctrl+Escape для принудительной разблокировки (только для отладки)
                    }
                    return blockEvent(e);
                },
                keyup: blockEvent,
                scroll: blockEvent,
                wheel: blockEvent,
                contextmenu: blockEvent,
                dragstart: blockEvent,
                drag: blockEvent,
                drop: blockEvent
            };
            
            // Добавляем обработчики на document и window
            Object.keys(this.blockHandlers).forEach(eventType => {
                document.addEventListener(eventType, this.blockHandlers[eventType], { capture: true, passive: false });
                window.addEventListener(eventType, this.blockHandlers[eventType], { capture: true, passive: false });
            });
        }
    }
    
    unblockAllInteractions() {
        // Удаляем блокирующие обработчики
        if (this.blockHandlers) {
            Object.keys(this.blockHandlers).forEach(eventType => {
                document.removeEventListener(eventType, this.blockHandlers[eventType], { capture: true });
                window.removeEventListener(eventType, this.blockHandlers[eventType], { capture: true });
            });
            this.blockHandlers = null;
        }
    }

    hideLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.style.pointerEvents = 'none';
            overlay.style.zIndex = '';
            
            // Убираем класс блокировки
            document.body.classList.remove('loading-active');
            
            // Восстанавливаем прокрутку страницы и взаимодействия
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.height = '';
            document.body.style.pointerEvents = '';
            
            // Разблокируем все события
            this.unblockAllInteractions();
            
            console.log('🔓 Интерфейс разблокирован');
        }
    }

    /**
     * Проверяет наличие активного коммита на GitHub
     * Читает файл updating.json с GitHub Pages (через fetch)
     * Если файл существует и isUpdating: true - показывает табличку
     * Если файл не существует - скрывает табличку
     */
    async checkUpdateStatus() {
        try {
            // Читаем файл updating.json с GitHub (через GitHub Pages)
            const response = await fetch('updating.json?t=' + Date.now());
            if (response.ok) {
                const status = await response.json();
                if (status.isUpdating) {
                    // Файл существует и коммит активен - показываем табличку всем пользователям
                    // Для администратора не показываем, так как у него свой оверлей во время сохранения
                    if (!this.isAdminMode) {
                        const overlay = document.getElementById('loadingOverlay');
                        if (overlay) {
                            const currentDisplay = window.getComputedStyle(overlay).display;
                            if (currentDisplay === 'none') {
                                this.showLoadingOverlay('Идёт обновление данных на сервере...\nСайт временно недоступен');
                            }
                        }
                    }
                    return true;
                }
            } else if (response.status === 404) {
                // Файл не существует (404) - коммит завершен или не идет
                // Это нормальная ситуация, не логируем как ошибку
                if (!this.isAdminMode) {
                    const overlay = document.getElementById('loadingOverlay');
                    if (overlay && window.getComputedStyle(overlay).display !== 'none') {
                        console.log('🔓 Коммит завершен - разблокируем интерфейс');
                        this.hideLoadingOverlay();
                    }
                }
            }
        } catch (e) {
            // Игнорируем ошибки сети (404 - это нормально, файл просто не существует)
            // Не логируем в консоль, чтобы не спамить
            if (!this.isAdminMode) {
                this.hideLoadingOverlay();
            }
        }
        return false;
    }

    /**
     * Запускает периодическую проверку статуса обновления
     */
    startUpdateStatusChecker() {
        // Проверяем сразу при загрузке
        this.checkUpdateStatus();
        
        // Проверяем каждые 2 секунды
        this.updateCheckInterval = setInterval(() => {
            this.checkUpdateStatus();
        }, 2000);
    }

    /**
     * Останавливает проверку статуса обновления
     */
    stopUpdateStatusChecker() {
        if (this.updateCheckInterval) {
            clearInterval(this.updateCheckInterval);
            this.updateCheckInterval = null;
        }
    }

    /**
     * Создает файл статуса обновления в GitHub
     */
    async createUpdateStatusFile() {
        if (!this.githubConfig.owner || !this.githubConfig.repo || !this.githubConfig.token) {
            return;
        }

        try {
            const statusData = JSON.stringify({ 
                isUpdating: true, 
                timestamp: Date.now(),
                message: 'Идёт обновление данных на сервере'
            }, null, 2);
            const content = btoa(unescape(encodeURIComponent(statusData)));
            
            // Проверяем, существует ли файл
            let sha = null;
            try {
                const getResponse = await fetch(
                    `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/updating.json`,
                    {
                        headers: {
                            'Authorization': `token ${this.githubConfig.token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }
                );
                if (getResponse.ok) {
                    const fileData = await getResponse.json();
                    sha = fileData.sha;
                }
            } catch (e) {
                // Файл не существует, создадим новый
            }

            const response = await fetch(
                `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/updating.json`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${this.githubConfig.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: 'Обновление данных - начало',
                        content: content,
                        sha: sha
                    })
                }
            );
            
            if (response.ok) {
                console.log('✅ Создан файл статуса обновления');
            } else {
                console.warn('⚠️ Не удалось создать файл статуса обновления');
            }
        } catch (e) {
            console.warn('⚠️ Ошибка создания файла статуса обновления:', e);
        }
    }

    /**
     * Удаляет файл статуса обновления из GitHub
     */
    async deleteUpdateStatusFile() {
        if (!this.githubConfig.owner || !this.githubConfig.repo || !this.githubConfig.token) {
            return;
        }

        try {
            // Получаем SHA файла
            const getResponse = await fetch(
                `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/updating.json`,
                {
                    headers: {
                        'Authorization': `token ${this.githubConfig.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (getResponse.ok) {
                const fileData = await getResponse.json();
                const sha = fileData.sha;

                // Удаляем файл
                const deleteResponse = await fetch(
                    `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/updating.json`,
                    {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `token ${this.githubConfig.token}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            message: 'Обновление данных - завершено',
                            sha: sha
                        })
                    }
                );
                
                if (deleteResponse.ok) {
                    console.log('✅ Удален файл статуса обновления');
                } else {
                    console.warn('⚠️ Не удалось удалить файл статуса обновления');
                }
            }
        } catch (e) {
            console.warn('⚠️ Ошибка удаления файла статуса обновления:', e);
        }
    }

    async saveAndSwitchMode() {
        console.log('💾 saveAndSwitchMode вызвана');
        console.log('🔍 isAdminMode:', this.isAdminMode);
        
        if (!this.isAdminMode) {
            console.error('❌ Не в режиме администратора!');
            alert('Ошибка: вы не в режиме администратора!');
            return;
        }
        
        // Убеждаемся, что есть текущее сопровождение
        if (!this.currentEscortId) {
            this.currentEscortId = 'default';
            this.currentEscortName = this.currentEscortName || 'Сопровождение по умолчанию';
        }
        
        // Собираем все данные
        const closures = [];
        const closureItems = document.querySelectorAll('.closure-item');
        console.log('📋 Найдено элементов перекрытий:', closureItems.length);
        
        closureItems.forEach((item, index) => {
            const nameInput = item.querySelector('.closure-name-input');
            const photoInput = item.querySelector('.closure-photo-input');
            
            if (!photoInput) {
                console.warn('⚠️ Не найден photoInput для элемента', index);
                return;
            }
            
            const closureNumber = parseInt(photoInput.dataset.number);
            const name = nameInput ? nameInput.value.trim() : `Перекрытие ${closureNumber}`;
            const closure = this.closures.find(c => c.number === closureNumber);
            
            console.log(`🔍 Перекрытие ${closureNumber}:`, {
                name,
                hasClosure: !!closure,
                photosCount: closure?.photos?.length || 0
            });
            
            if (closure && closure.photos && closure.photos.length > 0) {
                closures.push({
                    number: closureNumber,
                    name: name,
                    photos: closure.photos
                });
            }
        });

        console.log('✅ Собрано перекрытий:', closures.length);

        // Проверяем данные
        if (!this.mapImage) {
            alert('Пожалуйста, загрузите карту!');
            return;
        }

        if (closures.length === 0) {
            alert('Пожалуйста, загрузите хотя бы одно фото перекрытия!');
            return;
        }

        // Показываем оверлей загрузки
        this.showLoadingOverlay('Подготовка данных...');

        try {
            // Создаем файл статуса обновления для всех пользователей (показываем что идет коммит)
            await this.createUpdateStatusFile();
            
            // Сохраняем данные
            this.closures = closures;
            
            // Сохраняем в IndexedDB и GitHub
            const dataToSave = {
                mapImage: this.mapImage,
                closures: this.closures
            };
            
            console.log('💾 Сохранение данных...');
            this.showLoadingOverlay('Сохранение локально...');
            
            // Сохраняем локально
            await this.saveToDB();
            
            // Сохраняем в GitHub
            try {
                console.log('📤 Сохранение в GitHub...');
                this.showLoadingOverlay('Загрузка файлов в GitHub...');
                
                await this.saveToGitHub(dataToSave);
                
                const filesCount = dataToSave.closures.reduce((sum, c) => sum + (c.photos ? c.photos.length : 0), 0) + (dataToSave.mapImage ? 1 : 0);
                
                // Удаляем файл статуса обновления (коммит завершен)
                await this.deleteUpdateStatusFile();
                
                // Скрываем оверлей перед показом сообщения
                this.hideLoadingOverlay();
                
                alert(`✅ Данные успешно сохранены в GitHub!\n\nСохранено:\n- Карта: ${dataToSave.mapImage ? 'Да' : 'Нет'}\n- Фото перекрытий: ${filesCount}\n- Все файлы в папке: photos/\n\nТеперь они доступны всем пользователям.`);
            } catch (e) {
                console.error('❌ Ошибка сохранения в GitHub:', e);
                // Удаляем файл статуса даже при ошибке
                await this.deleteUpdateStatusFile();
                this.hideLoadingOverlay();
                alert('⚠️ Данные сохранены локально, но не удалось сохранить в GitHub:\n' + e.message + '\n\nПроверьте настройки GitHub и убедитесь, что папка photos/ существует в репозитории.');
            }
            
            // Переключаем режим
            console.log('👁️ Переключение в режим просмотра...');
            this.switchToViewMode();
        } catch (e) {
            console.error('❌ Общая ошибка при сохранении:', e);
            // Удаляем файл статуса при общей ошибке
            await this.deleteUpdateStatusFile();
            this.hideLoadingOverlay();
            alert('Ошибка при сохранении данных: ' + e.message);
        }
    }

    renderClosureButtons() {
        console.log('🔘 renderClosureButtons вызван, перекрытий:', this.closures.length);
        const buttonsContainer = document.getElementById('closuresButtons');
        if (!buttonsContainer) {
            console.error('❌ Элемент closuresButtons не найден!');
            return;
        }
        
        buttonsContainer.innerHTML = '';
        
        if (this.closures.length === 0) {
            console.warn('⚠️ Нет перекрытий для отображения');
            return;
        }
        
        this.closures.forEach(closure => {
            const button = document.createElement('button');
            button.className = 'closure-button';
            button.textContent = closure.name || `Перекрытие ${closure.number}`;
            button.addEventListener('click', () => {
                this.showClosurePhoto(closure.number);
            });
            buttonsContainer.appendChild(button);
        });
        
        console.log('✅ Кнопки перекрытий созданы:', this.closures.length);
    }

    showClosurePhoto(closureNumber) {
        const closure = this.closures.find(c => c.number === closureNumber);
        if (!closure || !closure.photos || closure.photos.length === 0) {
            alert('Нет фото для этого перекрытия');
            return;
        }

        const modal = document.getElementById('photoModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalTitleInput = document.getElementById('modalTitleInput');
        const editTitleBtn = document.getElementById('editTitleBtn');
        const saveTitleBtn = document.getElementById('saveTitleBtn');
        const adminControls = document.getElementById('adminPhotoControls');
        
        modalTitle.textContent = closure.name;
        modalTitleInput.value = closure.name;
        this.currentClosure = closure;
        this.currentPhotoIndex = 0;
        
        // Показываем кнопки редактирования только в режиме администратора
        if (this.isAdminMode) {
            adminControls.style.display = 'flex';
            editTitleBtn.style.display = 'inline-block';
            // Сохраняем номер перекрытия для редактирования
            this.currentEditingClosureNumber = closureNumber;
        } else {
            adminControls.style.display = 'none';
            editTitleBtn.style.display = 'none';
            saveTitleBtn.style.display = 'none';
            modalTitleInput.style.display = 'none';
            modalTitle.style.display = 'block';
        }
        
        // Отображаем галерею фото
        this.renderPhotoGallery(closure.photos);
        
        modal.classList.add('show');
    }

    renderPhotoGallery(photos) {
        const photoGallery = document.getElementById('photoGallery');
        const photoCounter = document.getElementById('photoCounter');
        const prevBtn = document.getElementById('prevPhoto');
        const nextBtn = document.getElementById('nextPhoto');
        
        photoGallery.innerHTML = '';
        
        // Показываем/скрываем кнопки навигации
        if (photos.length > 1) {
            prevBtn.style.display = 'flex';
            nextBtn.style.display = 'flex';
        } else {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        }
        
        photos.forEach((photo, index) => {
            const photoItem = document.createElement('div');
            photoItem.className = 'photo-item';
            photoItem.style.display = index === this.currentPhotoIndex ? 'flex' : 'none';
            
            const img = document.createElement('img');
            img.src = photo;
            img.alt = `Фото ${index + 1}`;
            img.className = 'photo-img';
            img.style.cursor = 'zoom-in';
            img.style.transition = 'transform 0.3s ease';
            
            // Обработка ошибок загрузки
            img.onerror = () => {
                console.error('Ошибка загрузки фото:', photo);
                img.alt = 'Ошибка загрузки фото';
                img.style.border = '2px solid red';
                img.style.padding = '20px';
                img.style.background = '#fff';
            };
            
            img.onload = () => {
                console.log('Фото загружено:', photo);
            };
            
            // Зум двойным кликом
            img.addEventListener('dblclick', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.togglePhotoZoom(img, photoItem);
            });
            
            // Зум колесиком мыши
            img.addEventListener('wheel', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                this.zoomPhoto(img, photoItem, delta, e.clientX, e.clientY);
            }, { passive: false });
            
            // Перетаскивание увеличенного изображения
            img.addEventListener('mousedown', (e) => {
                if (this.photoZoom.scale > 1) {
                    e.preventDefault();
                    this.photoZoom.isDragging = true;
                    this.photoZoom.startX = e.clientX - this.photoZoom.translateX;
                    this.photoZoom.startY = e.clientY - this.photoZoom.translateY;
                    img.style.cursor = 'grabbing';
                }
            });
            
            // Touch события для мобильных устройств
            img.addEventListener('touchstart', (e) => {
                if (this.photoZoom.scale > 1 && e.touches.length === 1) {
                    e.preventDefault();
                    this.photoZoom.isDragging = true;
                    this.photoZoom.startX = e.touches[0].clientX - this.photoZoom.translateX;
                    this.photoZoom.startY = e.touches[0].clientY - this.photoZoom.translateY;
                }
            }, { passive: false });
            
            img.addEventListener('touchmove', (e) => {
                if (this.photoZoom.isDragging && this.photoZoom.scale > 1 && e.touches.length === 1) {
                    e.preventDefault();
                    this.photoZoom.translateX = e.touches[0].clientX - this.photoZoom.startX;
                    this.photoZoom.translateY = e.touches[0].clientY - this.photoZoom.startY;
                    this.applyPhotoTransform(img);
                }
            }, { passive: false });
            
            img.addEventListener('touchend', () => {
                if (this.photoZoom.isDragging) {
                    this.photoZoom.isDragging = false;
                }
            });
            
            photoItem.appendChild(img);
            photoGallery.appendChild(photoItem);
        });
        
        photoCounter.textContent = `${this.currentPhotoIndex + 1} / ${photos.length}`;
    }

    togglePhotoZoom(img, container) {
        if (this.photoZoom.scale === 1) {
            // Увеличиваем
            this.photoZoom.scale = 2.5;
            this.photoZoom.translateX = 0;
            this.photoZoom.translateY = 0;
            img.style.cursor = 'grab';
        } else {
            // Сбрасываем
            this.photoZoom.scale = 1;
            this.photoZoom.translateX = 0;
            this.photoZoom.translateY = 0;
            img.style.cursor = 'zoom-in';
        }
        this.applyPhotoTransform(img);
    }

    zoomPhoto(img, container, delta, centerX, centerY) {
        const oldScale = this.photoZoom.scale;
        this.photoZoom.scale = Math.max(1, Math.min(5, this.photoZoom.scale + delta));
        
        // Если масштаб увеличился, центрируем на точке клика
        if (this.photoZoom.scale > 1 && oldScale === 1) {
            const rect = img.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            this.photoZoom.translateX = (containerRect.left + containerRect.width / 2 - centerX) * (this.photoZoom.scale - 1);
            this.photoZoom.translateY = (containerRect.top + containerRect.height / 2 - centerY) * (this.photoZoom.scale - 1);
        }
        
        if (this.photoZoom.scale > 1) {
            img.style.cursor = 'grab';
        } else {
            img.style.cursor = 'zoom-in';
            this.photoZoom.translateX = 0;
            this.photoZoom.translateY = 0;
        }
        
        this.applyPhotoTransform(img);
    }

    applyPhotoTransform(img) {
        img.style.transform = `scale(${this.photoZoom.scale}) translate(${this.photoZoom.translateX / this.photoZoom.scale}px, ${this.photoZoom.translateY / this.photoZoom.scale}px)`;
        img.style.transformOrigin = 'center center';
    }

    resetPhotoZoom() {
        this.photoZoom.scale = 1;
        this.photoZoom.translateX = 0;
        this.photoZoom.translateY = 0;
        this.photoZoom.isDragging = false;
        const imgs = document.querySelectorAll('.photo-img');
        imgs.forEach(img => {
            img.style.transform = 'scale(1) translate(0, 0)';
            img.style.cursor = 'zoom-in';
        });
    }

    switchPhoto(direction) {
        if (!this.currentClosure) return;
        
        // Сбрасываем зум при переключении фото
        this.resetPhotoZoom();
        
        const photos = this.currentClosure.photos;
        if (direction === 'next') {
            this.currentPhotoIndex = (this.currentPhotoIndex + 1) % photos.length;
        } else {
            this.currentPhotoIndex = (this.currentPhotoIndex - 1 + photos.length) % photos.length;
        }
        
        this.renderPhotoGallery(photos);
    }

    closeModal() {
        const modal = document.getElementById('photoModal');
        modal.classList.remove('show');
        this.currentClosure = null;
        this.currentPhotoIndex = 0;
        this.currentEditingClosureNumber = null;
        // Сбрасываем зум при закрытии
        this.resetPhotoZoom();
        // Очищаем input для замены фото
        document.getElementById('replacePhotoInput').value = '';
        document.getElementById('addPhotoInput').value = '';
        // Сбрасываем режим редактирования названия
        if (this.cancelEditingTitle) {
            this.cancelEditingTitle();
        }
    }

    replaceCurrentPhoto(file) {
        if (!this.isAdminMode || !this.currentClosure || !this.currentEditingClosureNumber) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const newPhoto = e.target.result;
            
            // Заменяем текущее фото
            this.currentClosure.photos[this.currentPhotoIndex] = newPhoto;
            
            // Обновляем массив closures
            const closure = this.closures.find(c => c.number === this.currentEditingClosureNumber);
            if (closure) {
                closure.photos[this.currentPhotoIndex] = newPhoto;
            }
            
            // Обновляем отображение галереи
            this.renderPhotoGallery(this.currentClosure.photos);
            
            // Сохранение только локально (в IndexedDB), не в GitHub
            // GitHub будет сохранен только при нажатии "Сохранить и начать работу"
            this.saveToDB();
            
            alert('Фото заменено! Изменения будут сохранены в GitHub после нажатия "Сохранить и начать работу".');
        };
        reader.readAsDataURL(file);
    }

    deleteCurrentPhoto() {
        if (!this.isAdminMode || !this.currentClosure || !this.currentEditingClosureNumber) {
            return;
        }

        // Удаляем фото из массива
        this.currentClosure.photos.splice(this.currentPhotoIndex, 1);
        
        // Обновляем массив closures
        const closure = this.closures.find(c => c.number === this.currentEditingClosureNumber);
        if (closure) {
            closure.photos.splice(this.currentPhotoIndex, 1);
        }
        
        // Если фото больше нет, закрываем модальное окно
        if (this.currentClosure.photos.length === 0) {
            alert('Все фото удалены. Модальное окно будет закрыто.');
            this.closeModal();
            // Обновляем кнопки перекрытий
            this.renderClosureButtons();
            return;
        }
        
        // Если удалили последнее фото, переходим на предыдущее
        if (this.currentPhotoIndex >= this.currentClosure.photos.length) {
            this.currentPhotoIndex = this.currentClosure.photos.length - 1;
        }
        
        // Обновляем отображение галереи
        this.renderPhotoGallery(this.currentClosure.photos);
        
        // Обновляем кнопки перекрытий (если фото закончились, кнопка должна исчезнуть)
        this.renderClosureButtons();
        
        // Сохранение только локально (в IndexedDB), не в GitHub
        // GitHub будет сохранен только при нажатии "Сохранить и начать работу"
        this.saveToDB();
    }

    startEditingTitle() {
        const modalTitle = document.getElementById('modalTitle');
        const modalTitleInput = document.getElementById('modalTitleInput');
        const editTitleBtn = document.getElementById('editTitleBtn');
        const saveTitleBtn = document.getElementById('saveTitleBtn');

        modalTitle.style.display = 'none';
        modalTitleInput.style.display = 'block';
        editTitleBtn.style.display = 'none';
        saveTitleBtn.style.display = 'inline-block';
        modalTitleInput.focus();
        modalTitleInput.select();
    }

    cancelEditingTitle() {
        const modalTitle = document.getElementById('modalTitle');
        const modalTitleInput = document.getElementById('modalTitleInput');
        const editTitleBtn = document.getElementById('editTitleBtn');
        const saveTitleBtn = document.getElementById('saveTitleBtn');

        // Восстанавливаем исходное значение
        if (this.currentClosure) {
            modalTitleInput.value = this.currentClosure.name;
        }

        modalTitle.style.display = 'block';
        modalTitleInput.style.display = 'none';
        editTitleBtn.style.display = 'inline-block';
        saveTitleBtn.style.display = 'none';
    }

    saveTitle() {
        if (!this.isAdminMode || !this.currentClosure || !this.currentEditingClosureNumber) {
            return;
        }

        const modalTitle = document.getElementById('modalTitle');
        const modalTitleInput = document.getElementById('modalTitleInput');
        const editTitleBtn = document.getElementById('editTitleBtn');
        const saveTitleBtn = document.getElementById('saveTitleBtn');
        const newName = modalTitleInput.value.trim();

        if (!newName) {
            alert('Название не может быть пустым!');
            return;
        }

        // Обновляем название
        this.currentClosure.name = newName;
        modalTitle.textContent = newName;

        // Обновляем в массиве closures
        const closure = this.closures.find(c => c.number === this.currentEditingClosureNumber);
        if (closure) {
            closure.name = newName;
        }

        // Обновляем кнопку перекрытия
        this.renderClosureButtons();

        // Скрываем поле ввода
        modalTitle.style.display = 'block';
        modalTitleInput.style.display = 'none';
        editTitleBtn.style.display = 'inline-block';
        saveTitleBtn.style.display = 'none';

        // Сохранение только локально (в IndexedDB), не в GitHub
        // GitHub будет сохранен только при нажатии "Сохранить и начать работу"
        this.saveToDB();
    }

    addPhotosToClosure(files) {
        if (!this.isAdminMode || !this.currentClosure || !this.currentEditingClosureNumber) {
            return;
        }

        // Загружаем все файлы
        const loadPromises = files.map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });
        });

        Promise.all(loadPromises).then(photos => {
            // Добавляем новые фото к существующим
            this.currentClosure.photos = [...this.currentClosure.photos, ...photos];

            // Обновляем в массиве closures
            const closure = this.closures.find(c => c.number === this.currentEditingClosureNumber);
            if (closure) {
                closure.photos = [...closure.photos, ...photos];
            }

            // Обновляем отображение галереи
            this.renderPhotoGallery(this.currentClosure.photos);

            // Переключаемся на последнее добавленное фото
            this.currentPhotoIndex = this.currentClosure.photos.length - 1;
            this.renderPhotoGallery(this.currentClosure.photos);

            // Сохранение только локально (в IndexedDB), не в GitHub
            // GitHub будет сохранен только при нажатии "Сохранить и начать работу"
            this.saveToDB();

            // Очищаем input
            document.getElementById('addPhotoInput').value = '';

            alert(`Добавлено ${photos.length} фото! Изменения будут сохранены в GitHub после нажатия "Сохранить и начать работу".`);
        });
    }

    async saveToDB() {
        const data = {
            mapImage: this.mapImage,
            closures: this.closures
        };
        
        try {
            await DBHelper.save('closures_data', data);
            console.log('Данные сохранены');
        } catch (e) {
            console.error('Ошибка сохранения:', e);
        }
    }

    async loadSavedData() {
        console.log('📥 Загрузка сохраненных данных...');
        try {
            // Сначала пытаемся загрузить из GitHub (data.json)
            const loaded = await this.loadFromGitHub();
            console.log('📥 Результат загрузки из GitHub:', loaded);
            
            if (!loaded) {
                console.log('📥 Пробуем загрузить из IndexedDB...');
                // Если не получилось, пробуем из IndexedDB
                const data = await DBHelper.load('closures_data');
                console.log('📥 Данные из IndexedDB:', data);
                
                if (data && data.closures && data.closures.length > 0) {
                    console.log('✅ Найдены данные в IndexedDB, загружаем...');
                    // Мигрируем старые данные (если было одно фото)
                    this.closures = data.closures.map(closure => {
                        if (closure.photo && !closure.photos) {
                            return {
                                ...closure,
                                photos: [closure.photo]
                            };
                        }
                        return closure;
                    });
                    this.mapImage = data.mapImage;
                    
                    // Если нет сопровождений, создаем одно по умолчанию
                    if (this.escorts.length === 0) {
                        this.escorts = [{
                            id: 'default',
                            name: 'Сопровождение по умолчанию',
                            mapImage: data.mapImage,
                            closures: this.closures
                        }];
                        this.currentEscortId = 'default';
                        this.currentEscortName = 'Сопровождение по умолчанию';
                        console.log('✅ Создано сопровождение по умолчанию');
                    }
                    
                    console.log('✅ Загружено перекрытий:', this.closures.length);
                    console.log('✅ Карта загружена:', !!this.mapImage);
                    console.log('✅ Сопровождений:', this.escorts.length);
                    
                    // Обновляем селекторы после загрузки данных
                    this.updateEscortSelectors();
                    
                    // Автоматически показываем режим просмотра
                    this.switchToViewMode();
                } else {
                    console.log('⚠️ Данные не найдены ни в GitHub, ни в IndexedDB');
                }
            }
        } catch (e) {
            console.error('❌ Ошибка загрузки:', e);
        }
    }

    async loadFromGitHub() {
        try {
            // Загружаем data.json из репозитория
            const response = await fetch('data.json?t=' + Date.now());
            if (!response.ok) throw new Error('Файл не найден');
            
            const allData = await response.json();
            
            // Проверяем, новая ли структура (с сопровождениями) или старая
            let data;
            if (allData.escorts && typeof allData.escorts === 'object') {
                // Новая структура с сопровождениями
                this.escorts = Object.values(allData.escorts);
                const defaultEscortId = allData.defaultEscort || Object.keys(allData.escorts)[0];
                data = allData.escorts[defaultEscortId];
                this.currentEscortId = defaultEscortId;
                this.currentEscortName = data?.name || defaultEscortId;
                
                // Обновляем селекторы сопровождений
                this.updateEscortSelectors();
            } else if (allData.closures) {
                // Старая структура (обратная совместимость)
                data = allData;
                // Создаем одно сопровождение по умолчанию
                const defaultEscort = {
                    id: 'default',
                    name: 'Сопровождение по умолчанию',
                    mapImage: data.mapImage,
                    closures: data.closures
                };
                this.escorts = [defaultEscort];
                this.currentEscortId = 'default';
                this.currentEscortName = defaultEscort.name;
                // Обновляем селекторы сопровождений
                this.updateEscortSelectors();
            } else {
                return false;
            }
            
            if (data && data.closures && data.closures.length > 0) {
                // Преобразуем пути к файлам в полные URL для GitHub Pages
                // Используем текущий домен (работает и для GitHub Pages, и для кастомного домена)
                const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
                
                // Загружаем карту
                if (data.mapImage) {
                    if (data.mapImage.startsWith('photos/')) {
                        this.mapImage = baseUrl + data.mapImage;
                    } else if (data.mapImage.startsWith('data:')) {
                        this.mapImage = data.mapImage; // base64
                    } else if (data.mapImage.startsWith('http')) {
                        this.mapImage = data.mapImage; // Уже полный URL
                    } else {
                        this.mapImage = baseUrl + data.mapImage;
                    }
                }
                
                // Загружаем фото перекрытий
                this.closures = data.closures.map(closure => {
                    if (closure.photo && !closure.photos) {
                        // Старый формат - одно фото
                        let photo = closure.photo;
                        if (photo.startsWith('photos/')) {
                            photo = baseUrl + photo;
                        } else if (!photo.startsWith('http') && !photo.startsWith('data:')) {
                            photo = baseUrl + photo;
                        }
                        return {
                            ...closure,
                            photos: [photo]
                        };
                    }
                    
                    if (closure.photos) {
                        // Новый формат - массив фото
                        closure.photos = closure.photos.map(photo => {
                            if (photo.startsWith('photos/')) {
                                return baseUrl + photo;
                            } else if (photo.startsWith('http')) {
                                return photo; // Уже полный URL
                            } else if (photo.startsWith('data:')) {
                                return photo; // base64
                            } else {
                                return baseUrl + photo;
                            }
                        });
                    }
                    
                    return closure;
                });
                
                // Сохраняем в IndexedDB для кеша (с полными URL)
                const dataToCache = {
                    mapImage: this.mapImage,
                    closures: this.closures
                };
                await DBHelper.save('closures_data', dataToCache);
                
                // Обновляем селекторы после загрузки данных
                this.updateEscortSelectors();
                
                // Автоматически показываем режим просмотра
                this.switchToViewMode();
                return true;
            } else {
                // Данные есть, но нет перекрытий
                return false;
            }
        } catch (e) {
            console.log('Не удалось загрузить из GitHub, пробуем локальный кеш:', e);
            return false;
        }
    }

    async saveToGitHub(data) {
        console.log('📤 saveToGitHub вызван');
        
        if (!this.githubConfig.owner || !this.githubConfig.repo || !this.githubConfig.token) {
            const error = 'Настройки GitHub не заполнены! Укажите данные в режиме администратора.';
            console.error('❌', error);
            throw new Error(error);
        }
        
        console.log('✅ Настройки GitHub проверены');
        
        // Сохраняем карту и фото как отдельные файлы
        const filesToSave = [];
        
        // Сохраняем карту
        if (data.mapImage) {
            const mapFileName = `map_${Date.now()}.png`;
            const mapData = data.mapImage.split(',')[1]; // Убираем data:image/png;base64,
            filesToSave.push({
                path: `photos/${mapFileName}`,
                content: mapData,
                type: 'map'
            });
            data.mapImage = `photos/${mapFileName}`; // Заменяем base64 на путь
        }
        
        // Сохраняем фото перекрытий
        let photoIndex = 0;
        for (const closure of data.closures) {
            if (closure.photos) {
                const closurePhotos = [];
                for (let i = 0; i < closure.photos.length; i++) {
                    const photo = closure.photos[i];
                    if (photo.startsWith('data:')) {
                        // Это base64 фото, нужно сохранить
                        const photoFileName = `closure_${closure.number}_${i + 1}_${Date.now()}.jpg`;
                        const photoData = photo.split(',')[1]; // Убираем data:image/jpeg;base64,
                        filesToSave.push({
                            path: `photos/${photoFileName}`,
                            content: photoData,
                            type: 'photo'
                        });
                        closurePhotos.push(`photos/${photoFileName}`);
                    } else {
                        // Уже путь к файлу
                        closurePhotos.push(photo);
                    }
                }
                closure.photos = closurePhotos;
            }
        }
        
        // Сохраняем все файлы в GitHub
        let savedFiles = [];
        for (const file of filesToSave) {
            try {
                await this.saveFileToGitHub(file.path, file.content);
                savedFiles.push(file.path);
                console.log(`✅ Файл сохранен: ${file.path}`);
            } catch (e) {
                console.error(`❌ Ошибка сохранения ${file.path}:`, e);
                throw new Error(`Не удалось сохранить файл ${file.path}: ${e.message}`);
            }
        }
        
        if (savedFiles.length > 0) {
            console.log(`Всего сохранено файлов: ${savedFiles.length}`);
            console.log('Пути сохраненных файлов:', savedFiles);
        }
        
        // Загружаем текущий data.json для сохранения структуры сопровождений
        let allEscortsData = {};
        let defaultEscortId = this.currentEscortId || 'default';
        
        try {
            const response = await fetch('data.json?t=' + Date.now());
            if (response.ok) {
                const existingData = await response.json();
                if (existingData.escorts) {
                    allEscortsData = existingData.escorts;
                    defaultEscortId = existingData.defaultEscort || this.currentEscortId || defaultEscortId;
                } else if (existingData.closures) {
                    // Старая структура - создаем сопровождение по умолчанию
                    allEscortsData['default'] = {
                        id: 'default',
                        name: 'Сопровождение по умолчанию',
                        mapImage: existingData.mapImage,
                        closures: existingData.closures
                    };
                    defaultEscortId = 'default';
                }
            }
        } catch (e) {
            console.log('Не удалось загрузить существующие данные, создаем новые');
        }
        
        // Обновляем или создаем текущее сопровождение
        const escortId = this.currentEscortId || 'default';
        const escortName = this.currentEscortName || 'Сопровождение по умолчанию';
        
        allEscortsData[escortId] = {
            id: escortId,
            name: escortName,
            mapImage: data.mapImage,
            closures: data.closures
        };
        
        // Обновляем список сопровождений в классе
        this.escorts = Object.values(allEscortsData);
        this.currentEscortId = escortId;
        this.currentEscortName = escortName;
        
        // Сохраняем JSON с путями к файлам и структурой сопровождений
        console.log('💾 Сохраняю data.json...');
        const jsonData = JSON.stringify({
            escorts: allEscortsData,
            defaultEscort: escortId
        }, null, 2);
        let sha = null;
        
        try {
            console.log('🔍 Проверяю существование data.json...');
            const getResponse = await fetch(
                `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/data.json`,
                {
                    headers: {
                        'Authorization': `token ${this.githubConfig.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            
            if (getResponse.ok) {
                const fileData = await getResponse.json();
                sha = fileData.sha;
                console.log('✅ Файл data.json существует, получен SHA для обновления');
            } else {
                console.log('ℹ️ Файл data.json не существует, будет создан новый');
            }
        } catch (e) {
            console.log('ℹ️ Файл data.json не существует, будет создан новый');
        }
        
        const content = btoa(unescape(encodeURIComponent(jsonData)));
        
        console.log('📤 Отправляю data.json в GitHub...');
        const response = await fetch(
            `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/data.json`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.githubConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: 'Обновление данных карты перекрытий',
                    content: content,
                    sha: sha
                })
            }
        );
        
        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { message: errorText };
            }
            console.error('❌ Ошибка сохранения data.json:', {
                status: response.status,
                statusText: response.statusText,
                error: errorData
            });
            throw new Error(errorData.message || `Ошибка сохранения: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('✅ data.json успешно сохранен в GitHub:', result.commit.html_url);
        return result;
    }

    async saveFileToGitHub(path, base64Content) {
        console.log(`📤 Сохранение файла: ${path}`);
        
        // Проверяем, существует ли файл (для обновления нужен SHA)
        let sha = null;
        try {
            const getResponse = await fetch(
                `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${path}`,
                {
                    headers: {
                        'Authorization': `token ${this.githubConfig.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            
            if (getResponse.ok) {
                const fileData = await getResponse.json();
                sha = fileData.sha;
                console.log(`ℹ️ Файл ${path} существует, будет обновлен`);
            } else {
                console.log(`ℹ️ Файл ${path} не существует, будет создан новый`);
            }
        } catch (e) {
            console.log(`ℹ️ Файл ${path} не существует, будет создан новый`);
        }
        
        const response = await fetch(
            `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/${path}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.githubConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Добавление файла ${path}`,
                    content: base64Content,
                    sha: sha // Если null, создаст новый файл
                })
            }
        );
        
        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { message: errorText };
            }
            console.error(`❌ Ошибка сохранения файла ${path}:`, {
                status: response.status,
                statusText: response.statusText,
                error: errorData
            });
            throw new Error(errorData.message || `Ошибка сохранения файла ${path}: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log(`✅ Файл сохранен в GitHub: ${result.content.html_url}`);
        return result;
    }

    updateEscortSelectors() {
        const escortSelect = document.getElementById('escortSelect');
        const adminEscortSelect = document.getElementById('adminEscortSelect');
        
        const updateSelect = (select) => {
            if (!select) return;
            select.innerHTML = '';
            
            if (this.escorts.length === 0) {
                select.innerHTML = '<option value="">Нет сопровождений</option>';
                return;
            }
            
            this.escorts.forEach(escort => {
                const option = document.createElement('option');
                option.value = escort.id;
                option.textContent = escort.name || escort.id;
                if (escort.id === this.currentEscortId) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        };
        
        updateSelect(escortSelect);
        updateSelect(adminEscortSelect);
        
        // Показываем селектор сопровождений в режиме просмотра (если есть хотя бы одно сопровождение)
        const escortSelector = document.getElementById('escortSelector');
        if (escortSelector && this.escorts.length > 0) {
            escortSelector.style.display = 'block';
        } else if (escortSelector) {
            escortSelector.style.display = 'none';
        }
        
        // Показываем управление сопровождениями в режиме администратора
        if (this.isAdminMode) {
            const escortManagement = document.getElementById('escortManagement');
            if (escortManagement) {
                escortManagement.style.display = 'block';
            }
            
            // Показываем название текущего сопровождения
            if (this.currentEscortName) {
                const currentEscortName = document.getElementById('currentEscortName');
                const currentEscortNameText = document.getElementById('currentEscortNameText');
                const editEscortNameForm = document.getElementById('editEscortNameForm');
                if (currentEscortName && currentEscortNameText) {
                    currentEscortNameText.textContent = this.currentEscortName;
                    currentEscortName.style.display = 'block';
                    // Скрываем форму редактирования, если она была открыта
                    if (editEscortNameForm) {
                        editEscortNameForm.style.display = 'none';
                    }
                }
            }
        } else {
            // Скрываем управление сопровождениями, если не админ
            const escortManagement = document.getElementById('escortManagement');
            if (escortManagement) {
                escortManagement.style.display = 'none';
            }
        }
    }

    createNewEscort() {
        const name = prompt('Введите название нового сопровождения:');
        if (!name || name.trim() === '') {
            alert('Название не может быть пустым!');
            return;
        }
        
        const escortId = 'escort_' + Date.now();
        const newEscort = {
            id: escortId,
            name: name.trim(),
            mapImage: null,
            closures: []
        };
        
        this.escorts.push(newEscort);
        this.currentEscortId = escortId;
        this.currentEscortName = newEscort.name;
        
        // Очищаем текущие данные для нового сопровождения
        this.mapImage = null;
        this.closures = [];
        this.currentClosureNumber = 1;
        
        // Очищаем форму
        const mapPreview = document.getElementById('mapPreview');
        if (mapPreview) {
            mapPreview.innerHTML = '';
            mapPreview.style.display = 'none';
        }
        const closuresList = document.getElementById('closuresList');
        if (closuresList) {
            closuresList.innerHTML = '';
        }
        
        // Обновляем селекторы
        this.updateEscortSelectors();
        
        // Показываем сообщение
        alert(`Создано новое сопровождение "${newEscort.name}". Загрузите карту и фото перекрытий.`);
    }

    async loadEscortForEditing(escortId) {
        if (!this.isAdminMode) return;
        
        // Загружаем данные сопровождения
        const escort = this.escorts.find(e => e.id === escortId);
        if (!escort) {
            alert('Сопровождение не найдено!');
            return;
        }
        
        this.currentEscortId = escortId;
        this.currentEscortName = escort.name;
        
        // Преобразуем пути в base64 для редактирования
        const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
        
        // Загружаем карту
        if (escort.mapImage) {
            if (escort.mapImage.startsWith('photos/')) {
                try {
                    const response = await fetch(baseUrl + escort.mapImage);
                    const blob = await response.blob();
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        this.mapImage = e.target.result;
                        const preview = document.getElementById('mapPreview');
                        if (preview) {
                            preview.innerHTML = `<img src="${e.target.result}" alt="Карта">`;
                            preview.style.display = 'block';
                        }
                    };
                    reader.readAsDataURL(blob);
                } catch (e) {
                    console.error('Ошибка загрузки карты:', e);
                }
            } else {
                this.mapImage = escort.mapImage;
                const preview = document.getElementById('mapPreview');
                if (preview) {
                    preview.innerHTML = `<img src="${escort.mapImage}" alt="Карта">`;
                    preview.style.display = 'block';
                }
            }
        } else {
            this.mapImage = null;
            const preview = document.getElementById('mapPreview');
            if (preview) {
                preview.innerHTML = '';
                preview.style.display = 'none';
            }
        }
        
        // Загружаем перекрытия
        this.closures = [];
        this.currentClosureNumber = 1;
        
        const closuresList = document.getElementById('closuresList');
        if (closuresList) {
            closuresList.innerHTML = '';
        }
        
        for (const closure of escort.closures || []) {
            this.currentClosureNumber = Math.max(this.currentClosureNumber, closure.number + 1);
            
            // Загружаем фото как base64
            const photos = [];
            for (const photoPath of closure.photos || []) {
                if (photoPath.startsWith('photos/')) {
                    try {
                        const response = await fetch(baseUrl + photoPath);
                        const blob = await response.blob();
                        const reader = new FileReader();
                        const photoPromise = new Promise((resolve) => {
                            reader.onload = (e) => resolve(e.target.result);
                            reader.onerror = () => resolve(null);
                            reader.readAsDataURL(blob);
                        });
                        const photo = await photoPromise;
                        if (photo) photos.push(photo);
                    } catch (e) {
                        console.error('Ошибка загрузки фото:', e);
                    }
                } else {
                    photos.push(photoPath);
                }
            }
            
            this.closures.push({
                number: closure.number,
                name: closure.name,
                photos: photos
            });
            
            // Создаем элемент в DOM
            if (closuresList) {
                const closureItem = document.createElement('div');
                closureItem.className = 'closure-item';
                closureItem.innerHTML = `
                    <label class="upload-label">
                        <div class="upload-box-small">
                            <span class="upload-icon">📷</span>
                            <span class="upload-text">Добавить фото</span>
                        </div>
                        <input type="file" class="closure-photo-input" accept="image/*" multiple data-number="${closure.number}" hidden>
                    </label>
                    <div class="closure-info">
                        <input type="text" class="closure-name-input" placeholder="Перекрытие ${closure.number}" value="${closure.name}" data-number="${closure.number}">
                        <div class="closure-preview"></div>
                        <button class="btn btn-danger delete-closure-btn" data-number="${closure.number}">Удалить</button>
                    </div>
                `;
                closuresList.appendChild(closureItem);
                
                // Обновляем превью
                this.updateClosurePreview(closure.number, photos);
            }
        }
        
        // Обновляем селекторы
        this.updateEscortSelectors();
        
        alert(`Загружено сопровождение "${escort.name}" для редактирования.`);
    }

    async loadEscortForViewing(escortId) {
        // Загружаем данные сопровождения из GitHub
        try {
            const response = await fetch('data.json?t=' + Date.now());
            if (!response.ok) throw new Error('Файл не найден');
            
            const allData = await response.json();
            
            if (!allData.escorts || !allData.escorts[escortId]) {
                alert('Сопровождение не найдено!');
                return;
            }
            
            const escort = allData.escorts[escortId];
            this.currentEscortId = escortId;
            this.currentEscortName = escort.name;
            
            // Преобразуем пути в полные URL
            const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
            
            // Загружаем карту
            if (escort.mapImage) {
                if (escort.mapImage.startsWith('photos/')) {
                    this.mapImage = baseUrl + escort.mapImage;
                } else if (escort.mapImage.startsWith('http')) {
                    this.mapImage = escort.mapImage;
                } else {
                    this.mapImage = baseUrl + escort.mapImage;
                }
            } else {
                this.mapImage = null;
            }
            
            // Загружаем перекрытия
            this.closures = (escort.closures || []).map(closure => {
                if (closure.photos) {
                    closure.photos = closure.photos.map(photo => {
                        if (photo.startsWith('photos/')) {
                            return baseUrl + photo;
                        } else if (photo.startsWith('http')) {
                            return photo;
                        } else {
                            return baseUrl + photo;
                        }
                    });
                }
                return closure;
            });
            
            // Переключаемся в режим просмотра
            this.switchToViewMode();
            
        } catch (e) {
            console.error('Ошибка загрузки сопровождения:', e);
            alert('Ошибка загрузки сопровождения: ' + e.message);
        }
    }

    startEditingEscortName() {
        const escortNameInput = document.getElementById('escortNameInput');
        const escortNameDisplay = document.querySelector('.escort-name-display');
        const editEscortNameForm = document.getElementById('editEscortNameForm');
        
        if (escortNameInput && escortNameDisplay && editEscortNameForm) {
            escortNameInput.value = this.currentEscortName || '';
            escortNameDisplay.style.display = 'none';
            editEscortNameForm.style.display = 'block';
            escortNameInput.focus();
            escortNameInput.select();
        }
    }

    cancelEditingEscortName() {
        const escortNameDisplay = document.querySelector('.escort-name-display');
        const editEscortNameForm = document.getElementById('editEscortNameForm');
        
        if (escortNameDisplay && editEscortNameForm) {
            editEscortNameForm.style.display = 'none';
            escortNameDisplay.style.display = 'flex';
        }
    }

    async saveEscortName() {
        const escortNameInput = document.getElementById('escortNameInput');
        if (!escortNameInput) return;
        
        const newName = escortNameInput.value.trim();
        if (!newName) {
            alert('Название не может быть пустым!');
            return;
        }
        
        if (newName === this.currentEscortName) {
            // Название не изменилось, просто закрываем форму
            this.cancelEditingEscortName();
            return;
        }
        
        // Обновляем название в текущем сопровождении
        const escort = this.escorts.find(e => e.id === this.currentEscortId);
        if (escort) {
            escort.name = newName;
            this.currentEscortName = newName;
        }
        
        // Обновляем отображение
        const currentEscortNameText = document.getElementById('currentEscortNameText');
        if (currentEscortNameText) {
            currentEscortNameText.textContent = newName;
        }
        
        // Обновляем селекторы
        this.updateEscortSelectors();
        
        // Сохраняем в GitHub, если есть настройки
        if (this.githubConfig.owner && this.githubConfig.repo && this.githubConfig.token) {
            try {
                // Загружаем текущие данные
                const response = await fetch('data.json?t=' + Date.now());
                let allEscortsData = {};
                let defaultEscortId = this.currentEscortId || 'default';
                
                if (response.ok) {
                    const existingData = await response.json();
                    if (existingData.escorts) {
                        allEscortsData = existingData.escorts;
                        defaultEscortId = existingData.defaultEscort || this.currentEscortId || defaultEscortId;
                    }
                }
                
                // Обновляем название сопровождения
                if (allEscortsData[this.currentEscortId]) {
                    allEscortsData[this.currentEscortId].name = newName;
                }
                
                // Сохраняем в GitHub
                const jsonData = JSON.stringify({
                    escorts: allEscortsData,
                    defaultEscort: defaultEscortId
                }, null, 2);
                
                let sha = null;
                try {
                    const getResponse = await fetch(
                        `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/data.json`,
                        {
                            headers: {
                                'Authorization': `token ${this.githubConfig.token}`,
                                'Accept': 'application/vnd.github.v3+json'
                            }
                        }
                    );
                    
                    if (getResponse.ok) {
                        const fileData = await getResponse.json();
                        sha = fileData.sha;
                    }
                } catch (e) {
                    console.log('Файл не существует, будет создан новый');
                }
                
                const content = btoa(unescape(encodeURIComponent(jsonData)));
                
                const saveResponse = await fetch(
                    `https://api.github.com/repos/${this.githubConfig.owner}/${this.githubConfig.repo}/contents/data.json`,
                    {
                        method: 'PUT',
                        headers: {
                            'Authorization': `token ${this.githubConfig.token}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            message: `Изменение названия сопровождения: ${newName}`,
                            content: content,
                            sha: sha
                        })
                    }
                );
                
                if (saveResponse.ok) {
                    console.log('✅ Название сопровождения сохранено в GitHub');
                    alert(`✅ Название сопровождения изменено на "${newName}" и сохранено в GitHub!`);
                } else {
                    throw new Error('Ошибка сохранения в GitHub');
                }
            } catch (e) {
                console.error('Ошибка сохранения названия:', e);
                alert('⚠️ Название изменено локально, но не удалось сохранить в GitHub: ' + e.message);
            }
        } else {
            alert(`✅ Название сопровождения изменено на "${newName}". Для сохранения в GitHub укажите настройки GitHub.`);
        }
        
        // Закрываем форму редактирования
        this.cancelEditingEscortName();
    }
}

// Инициализация приложения
let app = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM загружен, создаем приложение...');
    try {
        app = new ClosuresApp();
        console.log('✅ Приложение создано:', app);
        
        // Дополнительная проверка кнопки после загрузки
        setTimeout(() => {
            const adminBtn = document.getElementById('adminLoginBtn');
            console.log('🔍 Проверка кнопки через 1 секунду:', adminBtn);
            if (adminBtn) {
                console.log('✅ Кнопка существует');
                // Тестовый клик для проверки
                console.log('🧪 Тестируем прямой вызов...');
                adminBtn.addEventListener('test', () => {
                    console.log('✅ Тест работает');
                });
            } else {
                console.error('❌ Кнопка все еще не найдена!');
            }
        }, 1000);
    } catch (error) {
        console.error('❌ Ошибка при создании приложения:', error);
        alert('Ошибка инициализации: ' + error.message);
    }
});
