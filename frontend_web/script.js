console.log("SCRIPT.JS HAS BEEN LOADED AND IS EXECUTING!"); // Перший рядок для перевірки

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded event fired. Initializing UI elements.");

    const iroDefined = typeof iro !== 'undefined';
    if (!iroDefined) {
        console.error("FATAL ERROR: iro.js library not loaded! Check path to lib/iro.min.js in index.html and file existence.");
        const body = document.querySelector('body');
        if (body) {
            const errorDiv = document.createElement('div');
            errorDiv.textContent = "Критична помилка: бібліотека для вибору кольору (iro.js) не завантажена. Функціонал сайту буде обмежений.";
            errorDiv.style.color = 'red'; errorDiv.style.textAlign = 'center'; errorDiv.style.padding = '20px';
            body.innerHTML = ''; // Очистимо тіло, щоб показати тільки помилку
            body.appendChild(errorDiv);
        }
        return; 
    }
    console.log("iro.js library successfully found.");

    const API_BASE_URL = '';
    const configForm = document.getElementById('configForm');
    const configIdInput = document.getElementById('configId');
    const configNameInput = document.getElementById('configName');
    const userModeSelect = document.getElementById('userModeSelect');
    
    const userColorsSection = document.getElementById('userColorsSection');
    const userColorsLabel = document.getElementById('userColorsLabel');
    const userColorInputsContainer = document.getElementById('userColorInputsContainer');
    const addUserColorBtn = document.getElementById('addUserColorBtn');
    const MAX_USER_COLORS = 3;

    const brightnessInput = document.getElementById('brightness');
    const brightnessValueDisplay = document.getElementById('brightnessVal');
    const speedInput = document.getElementById('speed');
    const speedValueDisplay = document.getElementById('speedVal');
    
    const clearFormButton = document.getElementById('clearFormBtn');
    const configurationsList = document.getElementById('configurationsList');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    
    let singleColorPickerInstance = null; 
    const FRONTEND_POLL_INTERVAL = 3500; 
    let currentConfigsCache = []; 
    let pollingIntervalId = null; 

    if (!configForm || !userModeSelect || !userColorInputsContainer || !configurationsList) {
        console.error("Один або декілька ключових DOM елементів форми або списку не знайдено! Перевірте ID в HTML.");
        showTemporaryMessage("Помилка ініціалізації інтерфейсу. Деякі елементи не знайдено.", "error", 10000);
        // return; // Розкоментуйте, якщо хочете зупинити виконання при відсутності ключових елементів
    }

    function applyTheme(themeName) {
        document.body.className = ''; 
        document.body.classList.add(themeName);
        localStorage.setItem('theme', themeName);
        console.log(`Theme changed to: ${themeName}`);
        if (singleColorPickerInstance && singleColorPickerInstance.el && iroDefined) {
            singleColorPickerInstance.setOptions({
                 borderColor: getComputedStyle(document.documentElement).getPropertyValue('--input-border-color').trim() || "#4f4f4f"
            });
        }
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            if (document.body.classList.contains('dark-theme')) {
                applyTheme('light-theme');
            } else {
                applyTheme('dark-theme');
            }
        });
    }
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) applyTheme(savedTheme);
    else applyTheme('dark-theme');
    
    const navLinks = document.querySelectorAll('.main-nav .nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            navLinks.forEach(nav => nav.classList.remove('active-nav'));
            this.classList.add('active-nav');
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            if (targetSection) {
                targetSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    function hexToRgbObj(hex) {
        if (!hex || typeof hex !== 'string') return { r: 0, g: 0, b: 0 };
        let r = 0, g = 0, b = 0;
        hex = hex.toString().replace(/^#/, '');
        if (hex.length === 3) { r = parseInt(hex[0]+hex[0],16); g = parseInt(hex[1]+hex[1],16); b = parseInt(hex[2]+hex[2],16); }
        else if (hex.length === 6) { r = parseInt(hex.substring(0,2),16); g = parseInt(hex.substring(2,4),16); b = parseInt(hex.substring(4,6),16); }
        return {r: isNaN(r)?0:r, g: isNaN(g)?0:g, b: isNaN(b)?0:b};
    }

    function rgbToHex(r = 0, g = 0, b = 0) {
        const toHex = c => (c === undefined || c === null ? 0 : c).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
    }
    
    function ensureSingleColorPickerDOM() {
        if (!userColorInputsContainer) { console.error("ensureSingleColorPickerDOM: userColorInputsContainer is null"); return null; }
        const pickerContainerId = 'dynamicSingleColorPickerContainer';
        let pickerDiv = document.getElementById(pickerContainerId);
        if (!pickerDiv) {
            pickerDiv = document.createElement('div');
            pickerDiv.id = pickerContainerId;
            pickerDiv.style.margin = '10px auto'; 
            pickerDiv.style.width = '100%'; 
            pickerDiv.style.maxWidth = '220px';
            userColorInputsContainer.appendChild(pickerDiv);
        }
        return pickerDiv;
    }

    function initOrUpdateSingleColorPicker(initialRgb = {r:255, g:165, b:70}) {
        if (!iroDefined) return;
        const pickerDiv = ensureSingleColorPickerDOM();
        if (!pickerDiv) { console.error("initOrUpdateSingleColorPicker: pickerDiv is null, cannot init iro.js"); return; }

        const currentBorderColor = getComputedStyle(document.documentElement).getPropertyValue('--input-border-color').trim() || "#4f4f4f";

        if (singleColorPickerInstance && singleColorPickerInstance.el && document.body.contains(singleColorPickerInstance.el.parentNode)) {
            singleColorPickerInstance.off('color:change', handleSingleColorPickerUIUpdate); 
            singleColorPickerInstance.setOptions({ color: initialRgb, borderColor: currentBorderColor });
        } else {
             if (singleColorPickerInstance && singleColorPickerInstance.base) singleColorPickerInstance.base.remove(); 
             pickerDiv.innerHTML = ''; 
             try {
                singleColorPickerInstance = new iro.ColorPicker(pickerDiv, {
                    width: 200, color: initialRgb, borderWidth: 1,
                    borderColor: currentBorderColor, layoutDirection: 'vertical',
                    padding: 4, handleRadius: 7,
                    layout: [{ component: iro.ui.Wheel, options: {wheelLightness: true, width:180} }, { component: iro.ui.Slider, options: {sliderType:'value', sliderSize: 20} }]
                });
             } catch(e) { console.error("Error creating iro.ColorPicker:", e); if(pickerDiv) pickerDiv.textContent = "Picker error"; singleColorPickerInstance = null;}
        }
        if (singleColorPickerInstance) {
            singleColorPickerInstance.on('color:change', handleSingleColorPickerUIUpdate);
            handleSingleColorPickerUIUpdate(singleColorPickerInstance.color); 
        }
    }
    
    function handleSingleColorPickerUIUpdate(color) {
        if (!color || !color.rgb) return;
        console.log("Single iro.js color changed:", color.rgbString);
    }

    function updateUserColorInputsUI(modeToSet, colorsToLoad = []) {
        const currentMode = modeToSet || (userModeSelect ? userModeSelect.value : 'user_static');
        console.log(`updateUserColorInputsUI called for mode: ${currentMode}`);
        
        if (!userColorsSection || !userColorsLabel || !addUserColorBtn || !userColorInputsContainer) {
            console.error("DOM elements for color UI missing in updateUserColorInputsUI");
            return;
        }

        userColorInputsContainer.innerHTML = ''; 
        addUserColorBtn.style.display = 'none';   
        userColorsSection.style.display = 'block'; 

        if (currentMode === 'user_static' || currentMode === 'user_breath' || currentMode === 'user_twinkle') {
            userColorsLabel.textContent = 'Основний колір:';
            const initialColor = (Array.isArray(colorsToLoad) && colorsToLoad.length > 0 && colorsToLoad[0]) ? 
                                colorsToLoad[0] : {r:255, g:165, b:70}; 
            initOrUpdateSingleColorPicker(initialColor);
        } else if (currentMode === 'user_gradient') {
            if (singleColorPickerInstance && singleColorPickerInstance.el && singleColorPickerInstance.el.parentNode) {
                 const pickerContainerDOM = document.getElementById('dynamicSingleColorPickerContainer');
                 if (pickerContainerDOM) pickerContainerDOM.innerHTML = ''; // Очистити контейнер пікера
                 // singleColorPickerInstance.base.remove(); // Не викликати, якщо елемент вже видалено
                 singleColorPickerInstance = null; // Скинути екземпляр
            }
            userColorsLabel.textContent = `Кольори градієнту (2-${MAX_USER_COLORS}):`;
            addUserColorBtn.style.display = 'inline-block';
            const initialGradientColors = (Array.isArray(colorsToLoad) && colorsToLoad.length >= 2) ? 
                                          colorsToLoad : [{r:255,g:0,b:0}, {r:0,g:0,b:255}]; 
            initialGradientColors.slice(0, MAX_USER_COLORS).forEach(color => addGradientColorInputUI(rgbToHex(color.r, color.g, color.b)));
            updateAddColorButtonStateUI();
        } else { 
            userColorsLabel.textContent = 'Кольори:';
            userColorInputsContainer.innerHTML = '<p class="preset-info">Для цього режиму кольори визначені у пресеті.</p>';
        }
    }

    function addGradientColorInputUI(hexColor = '#00FF00') {
        if (!userColorInputsContainer || !addUserColorBtn) return;
        if (userColorInputsContainer.querySelectorAll('.gradient-color-item').length >= MAX_USER_COLORS) {
            showTemporaryMessage(`Максимум ${MAX_USER_COLORS} кольори.`, "warn"); return;
        }
        const itemDiv = document.createElement('div');
        itemDiv.className = 'color-input-item gradient-color-item';
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = hexColor;
        itemDiv.appendChild(colorInput);
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-small btn-remove-color';
        removeBtn.textContent = '×';
        removeBtn.title = "Видалити колір";
        removeBtn.onclick = () => { 
            if (userColorInputsContainer.querySelectorAll('.gradient-color-item').length > 2) {
                itemDiv.remove(); updateAddColorButtonStateUI();
            } else { showTemporaryMessage("Для градієнту потрібно мінімум 2 кольори.", "warn"); }
        };
        itemDiv.appendChild(removeBtn);
        userColorInputsContainer.appendChild(itemDiv);
        updateAddColorButtonStateUI();
    }
    
    function updateAddColorButtonStateUI(){
        if (!addUserColorBtn || !userColorInputsContainer) return;
        const numCurrentColors = userColorInputsContainer.querySelectorAll('.gradient-color-item').length;
        addUserColorBtn.disabled = numCurrentColors >= MAX_USER_COLORS;
        const removeButtons = userColorInputsContainer.querySelectorAll('.btn-remove-color');
        removeButtons.forEach(btn => { btn.style.display = numCurrentColors > 2 ? 'inline-flex' : 'none'; });
    }

    if(userModeSelect) userModeSelect.addEventListener('change', () => updateUserColorInputsUI(userModeSelect.value));
    if(addUserColorBtn) addUserColorBtn.addEventListener('click', () => addGradientColorInputUI());
    
    if(brightnessInput && brightnessValueDisplay) brightnessInput.addEventListener('input', () => brightnessValueDisplay.textContent = brightnessInput.value);
    if(speedInput && speedValueDisplay) speedInput.addEventListener('input', () => speedValueDisplay.textContent = speedInput.value);

    function escapeHtml(unsafe) { 
        if (typeof unsafe !== 'string') return String(unsafe);
        return unsafe.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]);
    }
    async function loadAndDisplayConfigurations(forceRender = false) { 
        if (!configurationsList) { console.error("configurationsList не знайдено!"); return; }
        if (!forceRender && configurationsList.children.length > 0 && !configurationsList.querySelector('.loading-placeholder') && !configurationsList.querySelector('.no-configs-placeholder')) {
            const existingPlaceholder = configurationsList.querySelector('.loading-placeholder');
            if (!existingPlaceholder) {}
        } else { configurationsList.innerHTML = '<li class="loading-placeholder">Завантаження...</li>'; }
        try {
            const response = await fetch(`${API_BASE_URL}/api/configurations`);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            const newConfigs = await response.json();
            const newConfigsString = JSON.stringify(newConfigs); const cachedConfigsString = JSON.stringify(currentConfigsCache);
            if (!forceRender && newConfigsString === cachedConfigsString) {
                if (configurationsList.querySelector('.loading-placeholder') && currentConfigsCache.length > 0) {
                     if(currentConfigsCache.length > 0) renderConfigurationsList(currentConfigsCache);
                     else configurationsList.innerHTML = ''; 
                } return;
            }
            currentConfigsCache = JSON.parse(newConfigsString); renderConfigurationsList(newConfigs);
        } catch (error) { if (configurationsList) configurationsList.innerHTML = `<li>Помилка: ${error.message}</li>`; }
    }
    function renderConfigurationsList(configs) { 
        if (!configurationsList) return;
        configurationsList.innerHTML = '';
        if (!configs || configs.length === 0) {
            configurationsList.innerHTML = '<li class="no-configs-placeholder">Немає конфігурацій.</li>'; return;
        }
        configs.forEach(config => {
            const li = document.createElement('li'); li.dataset.configId = config.id;
            if (config.isActive) li.classList.add('active-config');
            let colorsSummary = '';
            if (Array.isArray(config.colors) && config.colors.length > 0) {
                colorsSummary = config.colors.map(c => `(${c.r},${c.g},${c.b})`).join('→');
                if (colorsSummary.length > 25) colorsSummary = colorsSummary.substring(0,22) + '...';
            } else if (config.color_r !== undefined) { colorsSummary = `(${config.color_r},${config.color_g},${config.color_b})`; }
            const paramsSummary = config.params && Object.keys(config.params).length > 0 && JSON.stringify(config.params) !== '{}' ? `Парам.: ${escapeHtml(JSON.stringify(config.params).substring(0,15))}...` : '';
            li.innerHTML = `
                <div class="details">
                    <strong>${escapeHtml(config.name)}</strong>
                    <span>${escapeHtml(config.mode.replace(/^(user_|effect_)/, ''))} | Я:${config.brightness} | Ш:${config.speed}
                    ${colorsSummary ? ` | К: ${escapeHtml(colorsSummary)}` : ''}
                    ${paramsSummary ? ` | ${escapeHtml(paramsSummary)}` : ''}
                    ${config.isActive ? '<strong class="active-badge"> (АКТИВНА)</strong>' : ''}</span>
                </div>
                <div class="actions">
                    <button class="btn activate-btn" data-action-id="${config.id}" title="Активувати" ${config.isActive ? 'disabled' : ''}>🚀</button>
                    ${(config.is_deletable !== false && (!config.id || config.id.startsWith("user_"))) ? `<button class="btn edit-btn" data-action-id="${config.id}" title="Редагувати">✏️</button>` : '<button class="btn" disabled style="visibility:hidden; width:40px;">✏️</button>'}
                    ${(config.is_deletable !== false && (!config.id || config.id.startsWith("user_"))) ? `<button class="btn delete-btn" data-action-id="${config.id}" title="Видалити">🗑️</button>` : '<button class="btn" disabled style="visibility:hidden; width:40px;">🗑️</button>'}
                </div>`;
            configurationsList.appendChild(li);
        });
     }
    
    if (configForm) {
        configForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            console.log("Форма відправлена!");
            const currentConfigId = configIdInput.value;
            let colorsArray = [];
            const mode = userModeSelect.value;

            if (mode === 'user_static' || mode === 'user_breath' || mode === 'user_twinkle') {
                if (singleColorPickerInstance && singleColorPickerInstance.color) {
                    const rgb = singleColorPickerInstance.color.rgb;
                    colorsArray.push({r: rgb.r, g: rgb.g, b: rgb.b});
                } else { colorsArray.push({r: 255, g: 0, b: 0}); console.error("Не вдалося отримати колір з iro.js");}
            } else if (mode === 'user_gradient') {
                const colorPickersHTML = userColorInputsContainer.querySelectorAll('input[type="color"]');
                colorPickersHTML.forEach(picker => colorsArray.push(hexToRgbObj(picker.value)));
                if (colorsArray.length < 2 || colorsArray.length > MAX_USER_COLORS) {
                    showTemporaryMessage(`Для градієнту потрібно від 2 до ${MAX_USER_COLORS} кольорів.`, "error"); return;
                }
            }

            const formData = {
                name: configNameInput.value.trim(), mode: mode, colors: colorsArray,
                brightness: parseInt(brightnessInput.value, 10), speed: parseInt(speedInput.value, 10),
                params: {}, is_deletable: true 
            };

            if (!formData.name) { showTemporaryMessage("Назва не може бути порожньою!", "error"); configNameInput.focus(); return; }
            let url = `${API_BASE_URL}/api/configurations`;
            let method = 'POST';
            if (currentConfigId && currentConfigId.startsWith("user_")) { url += `/${currentConfigId}`; method = 'PUT'; }
            else if (currentConfigId) { showTemporaryMessage("Пресетні конфігурації не можна редагувати.", "warn"); return; }
            
            console.log("ВІДПРАВКА ДАНИХ:", JSON.stringify(formData));
            try {
                const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
                const responseData = await response.json();
                if (!response.ok) throw new Error(responseData.message || `HTTP ${response.status}`);
                showTemporaryMessage(`Конфігурація "${escapeHtml(formData.name)}" ${currentConfigId ? 'оновлена' : 'створена'}!`, "success");
                resetFormFields(); loadAndDisplayConfigurations(true);
            } catch (error) { showTemporaryMessage(`Помилка: ${error.message}`, "error"); }
        });
    }
    
    if (configurationsList) { 
        configurationsList.addEventListener('click', async function(event) {
            const targetButton = event.target.closest('button');
            if (!targetButton) return;
            const actionId = targetButton.dataset.actionId;
            if (!actionId) return;

            if (targetButton.classList.contains('activate-btn')) {
                if (targetButton.disabled) return;
                try {
                    const response = await fetch(`${API_BASE_URL}/api/configurations/activate/${actionId}`, { method: 'PUT' });
                    const responseData = await response.json();
                    if (!response.ok) throw new Error(responseData.message || `HTTP ${response.status}`);
                    showTemporaryMessage(`"${escapeHtml(responseData.name)}" активована.`, "success", 2000);
                    loadAndDisplayConfigurations(true);
                } catch (error) { showTemporaryMessage(`Помилка активації: ${error.message}`, "error"); }
            } else if (targetButton.classList.contains('edit-btn')) {
                 if (!actionId.startsWith("user_")) { showTemporaryMessage("Пресетні конфігурації не можна редагувати.", "warn"); return; }
                try {
                    const response = await fetch(`${API_BASE_URL}/api/configurations`);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const configs = await response.json();
                    const configToEdit = configs.find(c => c.id === actionId);
                    if (configToEdit) {
                        configIdInput.value = configToEdit.id;
                        configNameInput.value = configToEdit.name;
                        userModeSelect.value = configToEdit.mode;
                        updateUserColorInputsUI(configToEdit.mode, configToEdit.colors); 
                        
                        brightnessInput.value = configToEdit.brightness;
                        brightnessValueDisplay.textContent = configToEdit.brightness;
                        speedInput.value = configToEdit.speed;
                        speedValueDisplay.textContent = configToEdit.speed;
                        if (configForm) configForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    } else { showTemporaryMessage("Не знайдено.", "error"); }
                } catch (error) { showTemporaryMessage(`Помилка: ${error.message}`, "error"); }
            } else if (targetButton.classList.contains('delete-btn')) {
                 if (!actionId.startsWith("user_")) { showTemporaryMessage("Пресетні конфігурації не можна видаляти.", "warn"); return; }
                const itemLi = targetButton.closest('li');
                const itemName = itemLi?.querySelector('.details strong')?.textContent || actionId;
                if (confirm(`Видалити "${escapeHtml(itemName)}"?`)) {
                    try {
                        const response = await fetch(`${API_BASE_URL}/api/configurations/${actionId}`, { method: 'DELETE' });
                        const responseData = await response.json();
                        if (!response.ok) throw new Error(responseData.message || `HTTP ${response.status}`);
                        showTemporaryMessage(responseData.message || "Видалено.", "success");
                        loadAndDisplayConfigurations(true);
                    } catch (error) { showTemporaryMessage(`Помилка: ${error.message}`, "error");}
                }
            }
        });
    }
    
    if (clearFormButton) clearFormButton.addEventListener('click', resetFormFields);

    function resetFormFields() {
        if (configForm) configForm.reset();
        if (configIdInput) configIdInput.value = '';
        if (brightnessInput) brightnessInput.value = 150;
        if (brightnessValueDisplay) brightnessValueDisplay.textContent = "150";
        if (speedInput) speedInput.value = 100;
        if (speedValueDisplay) speedValueDisplay.textContent = "100";
        if (userModeSelect) {
            userModeSelect.value = "user_static";
            updateUserColorInputsUI("user_static"); 
        }
    }

    function showTemporaryMessage(message, type = "info", duration = 3500) {
        const existingMessage = document.querySelector('.temp-message');
        if(existingMessage) existingMessage.remove();
        const messageDiv = document.createElement('div');
        messageDiv.className = `temp-message ${type}`;
        messageDiv.textContent = message;
        Object.assign(messageDiv.style, { /* ... стилі з попередньої відповіді ... */ 
            position: 'fixed', top: '10px', left: '50%', transform: 'translateX(-50%)',
            padding: '10px 20px', borderRadius: 'var(--border-radius)', zIndex: '10001',
            boxShadow: '0 3px 10px rgba(0,0,0,0.2)', opacity: '0',
            transition: 'opacity 0.3s ease, top 0.3s ease', fontSize: '0.9em', fontWeight: '500',
            textAlign: 'center', minWidth: '220px', maxWidth: 'calc(100% - 30px)'
        });
        if (type === "success") { messageDiv.style.backgroundColor = "var(--success-color)"; messageDiv.style.color = "#fff"; }
        else if (type === "error") { messageDiv.style.backgroundColor = "var(--danger-color)"; messageDiv.style.color = "#fff"; }
        else if (type === "warn") { messageDiv.style.backgroundColor = "var(--secondary-color)"; messageDiv.style.color = "#fff"; }
        else { messageDiv.style.backgroundColor = "var(--primary-color)"; messageDiv.style.color = "#fff"; }
        document.body.appendChild(messageDiv);
        setTimeout(() => { messageDiv.style.opacity = '1'; messageDiv.style.top = '20px'; }, 50);
        setTimeout(() => {
            messageDiv.style.opacity = '0'; messageDiv.style.top = '0px';
            setTimeout(() => { if (messageDiv.parentNode) messageDiv.parentNode.removeChild(messageDiv); }, 300);
        }, duration);
     }
    
    loadAndDisplayConfigurations(true);
    if(userModeSelect) updateUserColorInputsUI(userModeSelect.value);

    if (pollingIntervalId) clearInterval(pollingIntervalId);
    pollingIntervalId = setInterval(() => {
        loadAndDisplayConfigurations(); 
    }, FRONTEND_POLL_INTERVAL);
});
