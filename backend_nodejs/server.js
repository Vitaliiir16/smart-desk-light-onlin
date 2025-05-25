const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const RENDER_DISK_PATH = process.env.RENDER_DISK_MOUNT_PATH || path.join(__dirname, 'data');
const configurationsFilePath = path.join(RENDER_DISK_PATH, 'configurations.json');
const defaultConfigsBackupPath = path.join(__dirname, 'default_configs_backup.json'); // Шлях до резервної копії

// Перевірка та створення директорії для постійного сховища на Render
if (process.env.RENDER_DISK_MOUNT_PATH && !fs.existsSync(RENDER_DISK_PATH)) {
    try {
        fs.mkdirSync(RENDER_DISK_PATH, { recursive: true });
        console.log(`Створено директорію для постійного сховища: ${RENDER_DISK_PATH}`);
    } catch (e) {
        console.error("Помилка створення директорії для постійного сховища:", e);
    }
}

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Роздача статичних файлів фронтенду
app.use(express.static(path.join(__dirname, '..', 'frontend_web')));
console.log(`Роздача статичних файлів з: ${path.join(__dirname, '..', 'frontend_web')}`);


const readConfigurationsFromFile = () => {
  try {
    if (!fs.existsSync(configurationsFilePath)) {
      console.warn(`Файл ${configurationsFilePath} не знайдено.`);
      if (fs.existsSync(defaultConfigsBackupPath)) {
        console.log(`Спроба відновити конфігурації з ${defaultConfigsBackupPath}`);
        const defaultConfigsText = fs.readFileSync(defaultConfigsBackupPath, 'utf8');
        const defaultConfigs = JSON.parse(defaultConfigsText);
        writeConfigurationsToFile(defaultConfigs); 
        console.log("Конфігурації відновлено з резервної копії.");
        return defaultConfigs;
      } else {
        console.warn(`Файл резервної копії ${defaultConfigsBackupPath} не знайдено. Створюється порожній configurations.json.`);
        writeConfigurationsToFile([]);
        return [];
      }
    }
    const data = fs.readFileSync(configurationsFilePath, 'utf8');
    const configs = JSON.parse(data);
    return Array.isArray(configs) ? configs : [];
  } catch (error) {
    console.error("Помилка читання або парсингу файлу конфігурацій:", error);
    // Спроба відновити з бекапу при помилці парсингу
    try {
        if (fs.existsSync(defaultConfigsBackupPath)) {
            console.warn(`Помилка парсингу configurations.json. Спроба відновити з ${defaultConfigsBackupPath}`);
            const defaultConfigsText = fs.readFileSync(defaultConfigsBackupPath, 'utf8');
            const defaultConfigs = JSON.parse(defaultConfigsText);
            writeConfigurationsToFile(defaultConfigs); // Перезаписуємо пошкоджений файл
            console.log("Конфігурації відновлено з резервної копії після помилки парсингу.");
            return defaultConfigs;
        }
    } catch (backupError) {
        console.error("Помилка відновлення з резервної копії:", backupError);
    }
    return []; 
  }
};

const writeConfigurationsToFile = (configurations) => {
  try {
    const jsonData = JSON.stringify(configurations, null, 2);
    fs.writeFileSync(configurationsFilePath, jsonData, 'utf8');
    console.log("Конфігурації успішно записані у файл.");
  } catch (error) {
    console.error("Помилка запису файлу конфігурацій:", error);
  }
};

app.get('/api/configurations', (req, res) => {
  console.log("GET /api/configurations - запит отримано");
  const configurations = readConfigurationsFromFile();
  res.status(200).json(configurations);
});

app.get('/api/configurations/active', (req, res) => {
  console.log("GET /api/configurations/active - запит отримано");
  const configurations = readConfigurationsFromFile();
  let activeConfig = configurations.find(config => config.isActive === true);

  if (!activeConfig && configurations.length > 0) {
    console.warn("Активна конфігурація не була явно встановлена, повертаємо першу зі списку.");
    activeConfig = configurations[0]; 
  } else if (configurations.length === 0) { // Якщо список конфігурацій порожній
     console.warn("Список конфігурацій порожній. Повертаємо fallback.");
     const fallbackConfig = { id:"fallback_empty", name:"Помилка: Немає конфігурацій", mode:"user_static", colors:[{r:128,g:128,b:128}], brightness:50, speed:0, params:{}, isActive:true, is_deletable:false};
     return res.status(200).json(fallbackConfig); // Повертаємо, щоб ESP не залишився без нічого
  }
  
  if (activeConfig) {
    res.status(200).json(activeConfig);
  } else { 
    // Цей випадок тепер малоймовірний через логіку вище, але залишаємо як крайній fallback
    console.error("Критична помилка: не вдалося визначити активну конфігурацію.");
    const fallbackConfig = { id:"fallback_critical", name:"Критична Помилка Fallback", mode:"user_static", colors:[{r:255,g:0,b:0}], brightness:100, speed:0, params:{}, isActive:true, is_deletable:false};
    res.status(500).json(fallbackConfig);
  }
});

app.post('/api/configurations', (req, res) => {
  console.log("POST /api/configurations - запит отримано, тіло:", req.body);
  const configurations = readConfigurationsFromFile();
  const body = req.body;
  
  const newConfig = {
    id: "user_" + Date.now().toString(),
    name: body.name ? body.name.trim() : 'Нова Користувацька Конфігурація',
    mode: body.mode || 'user_static',
    colors: [], 
    brightness: parseInt(body.brightness, 10) || 150,
    speed: parseInt(body.speed, 10) || 100,
    params: (typeof body.params === 'object' && body.params !== null) ? body.params : {}, // Завжди об'єкт
    is_deletable: true, 
    isActive: false,
  };

  if (!newConfig.name) {
    return res.status(400).json({ message: "Назва конфігурації є обов'язковою." });
  }

  if (Array.isArray(body.colors) && body.colors.length > 0) {
    newConfig.colors = body.colors.map(c => ({
        r: Math.min(255, Math.max(0, parseInt(c.r, 10) || 0)),
        g: Math.min(255, Math.max(0, parseInt(c.g, 10) || 0)),
        b: Math.min(255, Math.max(0, parseInt(c.b, 10) || 0))
    }));
  } else { 
    newConfig.colors = [{r:255, g:255, b:255}]; // Білий колір за замовчуванням, якщо масив не надано
  }
  
  if (newConfig.mode === 'user_gradient' && newConfig.colors.length < 2) {
    return res.status(400).json({ message: "Режим 'Градієнт' потребує щонайменше 2 кольори." });
  }

  configurations.push(newConfig);
  writeConfigurationsToFile(configurations);
  console.log("Створено нову конфігурацію:", newConfig);
  res.status(201).json(newConfig);
});
    
app.put('/api/configurations/:id', (req, res) => {
  const configIdToUpdate = req.params.id;
  console.log(`PUT /api/configurations/${configIdToUpdate} - запит отримано, тіло:`, req.body);
  let configurations = readConfigurationsFromFile();
  const configIndex = configurations.findIndex(config => config.id === configIdToUpdate);

  if (configIndex === -1) {
    return res.status(404).json({ message: `Конфігурація з ID ${configIdToUpdate} не знайдена.` });
  }

  const originalConfig = configurations[configIndex];

  // Забороняємо редагувати пресети (is_deletable: false)
  if (originalConfig.is_deletable === false) {
      return res.status(403).json({ message: "Попередньо налаштовані (пресетні) конфігурації не можна редагувати."});
  }

  const body = req.body;
  const updatedConfig = {
    ...originalConfig, // Зберігаємо isActive та is_deletable з оригіналу
    name: (body.name !== undefined && body.name.trim() !== "") ? body.name.trim() : originalConfig.name,
    mode: body.mode !== undefined ? body.mode : originalConfig.mode,
    colors: (Array.isArray(body.colors) && body.colors.length > 0) ? 
            body.colors.map(c => ({
                r: Math.min(255, Math.max(0, parseInt(c.r,10)||0)), 
                g: Math.min(255, Math.max(0, parseInt(c.g,10)||0)), 
                b: Math.min(255, Math.max(0, parseInt(c.b,10)||0))
            })) 
            : originalConfig.colors,
    brightness: body.brightness !== undefined ? parseInt(body.brightness, 10) : originalConfig.brightness,
    speed: body.speed !== undefined ? parseInt(body.speed, 10) : originalConfig.speed,
    params: (body.params !== undefined && typeof body.params === 'object') ? body.params : originalConfig.params, 
  };
  
  if (updatedConfig.mode === 'user_gradient') {
    if (!updatedConfig.colors || updatedConfig.colors.length < 2) {
        return res.status(400).json({ message: "Режим 'Градієнт' потребує щонайменше 2 кольори." });
    }
  } else { // Для інших користувацьких режимів, що використовують один колір
    if (!updatedConfig.colors || updatedConfig.colors.length === 0) {
        // Якщо масив кольорів порожній, а режим НЕ градієнт, встановлюємо один дефолтний колір
        updatedConfig.colors = [{r:255,g:255,b:255}]; 
    }
  }

  configurations[configIndex] = updatedConfig;
  writeConfigurationsToFile(configurations);
  console.log("Оновлено конфігурацію:", updatedConfig);
  res.status(200).json(updatedConfig);
});

app.delete('/api/configurations/:id', (req, res) => {
  const configIdToDelete = req.params.id;
  console.log(`DELETE /api/configurations/${configIdToDelete} - запит отримано`);
  let configurations = readConfigurationsFromFile();
  const configToDelete = configurations.find(c => c.id === configIdToDelete);

  if (!configToDelete) {
    return res.status(404).json({ message: `Конфігурація з ID ${configIdToDelete} не знайдена.` });
  }
  if (configToDelete.is_deletable === false) {
      return res.status(403).json({message: "Попередньо налаштовані (пресетні) конфігурації не можна видаляти."});
  }
  
  const wasActive = configToDelete.isActive;
  configurations = configurations.filter(config => config.id !== configIdToDelete);

  if (wasActive && configurations.length > 0) {
    if (!configurations.some(c => c.isActive)) {
        configurations[0].isActive = true; // Робимо першу активною, якщо видалена була активною
        console.log(`Після видалення активної, нова активна: ${configurations[0].name}`);
    }
  } else if (configurations.length > 0 && !configurations.some(c => c.isActive)) {
    // Якщо після видалення неактивної не залишилося жодної активної (малоймовірно, але можливо)
    configurations[0].isActive = true;
    console.log(`Активних не було, встановлено першу як активну: ${configurations[0].name}`);
  }

  writeConfigurationsToFile(configurations);
  console.log(`Конфігурацію ${configIdToDelete} видалено.`);
  res.status(200).json({ message: `Конфігурація з ID ${configIdToDelete} успішно видалена.` });
});

app.put('/api/configurations/activate/:id', (req, res) => {
  const configIdToActivate = req.params.id;
  console.log(`PUT /api/configurations/activate/${configIdToActivate} - запит отримано`);
  let configurations = readConfigurationsFromFile();
  let activatedConfig = null;
  let found = false;

  configurations = configurations.map(config => {
    config.isActive = (config.id === configIdToActivate);
    if (config.isActive) { 
        activatedConfig = config; 
        found = true; 
        console.log(`Активовано конфігурацію: ${config.name} (ID: ${config.id})`);
    }
    return config;
  });

  if (found) {
    writeConfigurationsToFile(configurations);
    res.status(200).json(activatedConfig);
  } else {
    console.warn(`Конфігурація з ID ${configIdToActivate} не знайдена для активації.`);
    res.status(404).json({ message: `Конфігурація з ID ${configIdToActivate} не знайдена.` });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`========================================================================`);
  console.log(`✨ Сервер Розумної Підсвітки (V3) запущено! ✨`);
  console.log(`Слухаю на порту: ${PORT}`);
  console.log(`Веб-інтерфейс доступний за адресою: http://localhost:${PORT}`);
  console.log(`Для доступу з ESP8266 та інших пристроїв у мережі використовуйте IP вашого комп'ютера.`);
  console.log(`========================================================================`);
});