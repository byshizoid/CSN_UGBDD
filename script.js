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
        // Пароль администратора (можно изменить)
        this.adminPassword = 'admin123';
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
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadSavedData();
    }

    setupEventListeners() {
        // Загрузка карты
        document.getElementById('mapInput').addEventListener('change', (e) => {
            this.handleMapUpload(e.target.files[0]);
        });

        // Добавление нового перекрытия
        document.getElementById('addClosureBtn').addEventListener('click', () => {
            this.addClosureItem();
        });

        // Сохранение и переход в режим просмотра
        document.getElementById('saveSetupBtn').addEventListener('click', () => {
            this.saveAndSwitchMode();
        });

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

        // Вход в режим администратора
        const adminBtn = document.getElementById('adminLoginBtn');
        if (adminBtn) {
            adminBtn.addEventListener('click', () => {
                this.requestAdminAccess();
            });
        }

        // Сохранение GitHub настроек
        const saveTokenBtn = document.getElementById('saveTokenBtn');
        if (saveTokenBtn) {
            saveTokenBtn.addEventListener('click', () => {
                this.saveGitHubConfig();
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
    }

    requestAdminAccess() {
        const password = prompt('Введите пароль администратора:');
        if (password === this.adminPassword) {
            this.isAdminMode = true;
            document.getElementById('setupSection').style.display = 'block';
            document.getElementById('adminAccess').style.display = 'none';
            document.getElementById('headerDescription').textContent = 'Режим администратора - загрузка данных';
            
            // Загружаем сохраненные настройки
            document.getElementById('repoOwner').value = this.githubConfig.owner;
            document.getElementById('repoName').value = this.githubConfig.repo;
            document.getElementById('githubToken').value = this.githubConfig.token;
            
            // Включаем автосохранение
            if (this.githubConfig.owner && this.githubConfig.repo && this.githubConfig.token) {
                this.autoSaveEnabled = true;
                this.setupAutoSave();
                document.getElementById('autoSaveStatus').style.display = 'block';
            }
        } else if (password !== null) {
            alert('Неверный пароль!');
        }
    }

    setupAutoSave() {
        // Автосохранение при изменении названий перекрытий
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('closure-name-input') && this.isAdminMode && this.autoSaveEnabled) {
                this.scheduleAutoSave();
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
        
        // Собираем текущие данные
        const dataToSave = {
            mapImage: this.mapImage,
            closures: []
        };
        
        // Собираем данные из всех перекрытий
        document.querySelectorAll('.closure-item').forEach((item, index) => {
            const number = index + 1;
            const nameInput = item.querySelector('.closure-name-input');
            const photoInput = item.querySelector('.closure-photo-input');
            
            if (!photoInput) return;
            
            const name = nameInput ? nameInput.value : `Перекрытие ${number}`;
            const closure = this.closures.find(c => c.number === parseInt(photoInput.dataset.number));
            
            if (closure && closure.photos && closure.photos.length > 0) {
                dataToSave.closures.push({
                    number: number,
                    name: name,
                    photos: closure.photos
                });
            }
        });
        
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

    saveGitHubConfig() {
        const owner = document.getElementById('repoOwner').value.trim();
        const repo = document.getElementById('repoName').value.trim();
        const token = document.getElementById('githubToken').value.trim();
        
        if (!owner || !repo || !token) {
            alert('Пожалуйста, заполните все поля!');
            return;
        }
        
        this.githubConfig = { owner, repo, token };
        localStorage.setItem('github_owner', owner);
        localStorage.setItem('github_repo', repo);
        localStorage.setItem('github_token', token);
        
        console.log('✅ Настройки GitHub сохранены:', {
            owner: owner,
            repo: repo,
            token: token ? '✅ (установлен)' : '❌'
        });
        
        // Включаем автосохранение если в режиме администратора
        if (this.isAdminMode) {
            this.autoSaveEnabled = true;
            this.setupAutoSave();
            console.log('✅ Автосохранение включено');
        }
        
        alert('Настройки GitHub сохранены! Автосохранение включено.');
    }

    handleMapUpload(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.mapImage = e.target.result;
            const preview = document.getElementById('mapPreview');
            preview.innerHTML = `<img src="${e.target.result}" alt="Карта">`;
            preview.style.display = 'block';
            
            // Автосохранение в GitHub
            if (this.isAdminMode && this.autoSaveEnabled) {
                this.scheduleAutoSave();
            }
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
            
            // Автосохранение в GitHub
            if (this.isAdminMode && this.autoSaveEnabled) {
                this.scheduleAutoSave();
            }
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
        
        // Автосохранение при добавлении перекрытия
        if (this.isAdminMode && this.autoSaveEnabled) {
            this.scheduleAutoSave();
        }
    }

    deleteClosure(number) {
        // Удаляем из массива
        this.closures = this.closures.filter(c => c.number !== parseInt(number));
        
        // Удаляем элемент из DOM
        const item = document.querySelector(`.closure-photo-input[data-number="${number}"]`).closest('.closure-item');
        if (item) {
            item.remove();
        }
        
        // Автосохранение при удалении перекрытия
        if (this.isAdminMode && this.autoSaveEnabled) {
            this.scheduleAutoSave();
        }
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
        
        // Автосохранение при удалении фото
        if (this.isAdminMode && this.autoSaveEnabled) {
            this.scheduleAutoSave();
        }
    }

    async saveAndSwitchMode() {
        // Собираем все данные
        const closures = [];
        document.querySelectorAll('.closure-item').forEach((item, index) => {
            const number = index + 1;
            const nameInput = item.querySelector('.closure-name-input');
            const photoInput = item.querySelector('.closure-photo-input');
            
            const name = nameInput ? nameInput.value : `Перекрытие ${number}`;
            const closure = this.closures.find(c => c.number === parseInt(photoInput.dataset.number));
            
            if (closure && closure.photos && closure.photos.length > 0) {
                closures.push({
                    number: number,
                    name: name,
                    photos: closure.photos
                });
            }
        });

        // Проверяем данные
        if (!this.mapImage) {
            alert('Пожалуйста, загрузите карту!');
            return;
        }

        if (closures.length === 0) {
            alert('Пожалуйста, загрузите хотя бы одно фото перекрытия!');
            return;
        }

        // Сохраняем данные
        this.closures = closures;
        this.mapImage = this.mapImage;
        
        // Сохраняем в IndexedDB
        await this.saveToDB();
        
        // Сохраняем в GitHub, если настроено
        if (this.githubConfig.owner && this.githubConfig.repo && this.githubConfig.token) {
            this.showAutoSaveIndicator('saving', '🔄 Сохраняется в GitHub...');
            
            try {
                const dataToSave = {
                    mapImage: this.mapImage,
                    closures: this.closures
                };
                await this.saveToGitHub(dataToSave);
                
                const commitUrl = `https://github.com/${this.githubConfig.owner}/${this.githubConfig.repo}/commits/master`;
                this.showAutoSaveIndicator('success', '✅ Сохранено в GitHub', commitUrl);
            } catch (e) {
                console.error('Ошибка сохранения в GitHub:', e);
                this.showAutoSaveIndicator('error', `❌ Ошибка: ${e.message}`);
            }
        }
        
        // Переключаем режим
        this.switchToViewMode();
    }

    switchToViewMode() {
        // Скрываем режим настройки (если администратор)
        if (this.isAdminMode) {
            document.getElementById('setupSection').style.display = 'none';
        }
        
        // Показываем режим просмотра
        const viewSection = document.getElementById('viewSection');
        viewSection.style.display = 'block';
        
        // Устанавливаем карту
        if (this.mapImage) {
            const mapImage = document.getElementById('mapImage');
            mapImage.src = this.mapImage;
            mapImage.style.display = 'block';
        }
        
        // Создаем кнопки перекрытий
        this.renderClosureButtons();
    }

    async saveAndSwitchMode() {
        if (!this.isAdminMode) return;
        
        // Собираем все данные
        const closures = [];
        document.querySelectorAll('.closure-item').forEach((item, index) => {
            const number = index + 1;
            const nameInput = item.querySelector('.closure-name-input');
            const photoInput = item.querySelector('.closure-photo-input');
            
            const name = nameInput ? nameInput.value : `Перекрытие ${number}`;
            const closure = this.closures.find(c => c.number === parseInt(photoInput.dataset.number));
            
            if (closure && closure.photos && closure.photos.length > 0) {
                closures.push({
                    number: number,
                    name: name,
                    photos: closure.photos
                });
            }
        });

        // Проверяем данные
        if (!this.mapImage) {
            alert('Пожалуйста, загрузите карту!');
            return;
        }

        if (closures.length === 0) {
            alert('Пожалуйста, загрузите хотя бы одно фото перекрытия!');
            return;
        }

        // Сохраняем данные
        this.closures = closures;
        
        // Сохраняем в IndexedDB и GitHub
        const dataToSave = {
            mapImage: this.mapImage,
            closures: this.closures
        };
        
        // Сохраняем локально
        await this.saveToDB();
        
        // Сохраняем в GitHub
        try {
            await this.saveToGitHub(dataToSave);
            const filesCount = dataToSave.closures.reduce((sum, c) => sum + (c.photos ? c.photos.length : 0), 0) + (dataToSave.mapImage ? 1 : 0);
            alert(`✅ Данные успешно сохранены в GitHub!\n\nСохранено:\n- Карта: ${dataToSave.mapImage ? 'Да' : 'Нет'}\n- Фото перекрытий: ${filesCount}\n- Все файлы в папке: photos/\n\nТеперь они доступны всем пользователям.`);
        } catch (e) {
            console.error('Ошибка сохранения в GitHub:', e);
            alert('⚠️ Данные сохранены локально, но не удалось сохранить в GitHub:\n' + e.message + '\n\nПроверьте настройки GitHub и убедитесь, что папка photos/ существует в репозитории.');
        }
        
        // Переключаем режим
        this.switchToViewMode();
    }

    renderClosureButtons() {
        const buttonsContainer = document.getElementById('closuresButtons');
        buttonsContainer.innerHTML = '';
        
        this.closures.forEach(closure => {
            const button = document.createElement('button');
            button.className = 'closure-button';
            button.textContent = closure.name;
            button.addEventListener('click', () => {
                this.showClosurePhoto(closure);
            });
            buttonsContainer.appendChild(button);
        });
    }

    showClosurePhoto(closure) {
        const modal = document.getElementById('photoModal');
        const modalTitle = document.getElementById('modalTitle');
        const photoGallery = document.getElementById('photoGallery');
        
        modalTitle.textContent = closure.name;
        this.currentClosure = closure;
        this.currentPhotoIndex = 0;
        
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
            
            photoItem.appendChild(img);
            photoGallery.appendChild(photoItem);
        });
        
        photoCounter.textContent = `${this.currentPhotoIndex + 1} / ${photos.length}`;
    }

    switchPhoto(direction) {
        if (!this.currentClosure) return;
        
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
        try {
            // Сначала пытаемся загрузить из GitHub (data.json)
            const loaded = await this.loadFromGitHub();
            
            if (!loaded) {
                // Если не получилось, пробуем из IndexedDB
                const data = await DBHelper.load('closures_data');
                
                if (data && data.closures && data.closures.length > 0) {
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
                    
                    // Автоматически показываем режим просмотра
                    this.switchToViewMode();
                }
            }
        } catch (e) {
            console.error('Ошибка загрузки:', e);
        }
    }

    async loadFromGitHub() {
        try {
            // Загружаем data.json из репозитория
            const response = await fetch('data.json?t=' + Date.now());
            if (!response.ok) throw new Error('Файл не найден');
            
            const data = await response.json();
            
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
                
                // Автоматически показываем режим просмотра
                this.switchToViewMode();
                return true;
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
        
        // Сохраняем JSON с путями к файлам
        console.log('💾 Сохраняю data.json...');
        const jsonData = JSON.stringify(data, null, 2);
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
}

// Инициализация приложения
let app = null;

document.addEventListener('DOMContentLoaded', () => {
    app = new ClosuresApp();
});
