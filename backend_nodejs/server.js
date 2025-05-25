const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Визначаємо базовий шлях для даних
// Якщо RENDER_DISK_MOUNT_PATH встановлено (тобто, ми на Render з диском), використовуємо його.
// Інакше (локально), використовуємо папку 'data' всередині __dirname.
const dataDirectoryPath = process.env.RENDER_DISK_MOUNT_PATH || path.join(__dirname, 'data');
const configurationsFilePath = path.join(dataDirectoryPath, 'configurations.json');
const defaultConfigsBackupPath = path.join(__dirname, 'default_configs_backup.json');

// Створюємо директорію для даних, ЯКЩО її немає (це важливо і для Render, і для локального запуску, якщо папки 'data' немає)
if (!fs.existsSync(dataDirectoryPath)) {
    try {
        fs.mkdirSync(dataDirectoryPath, { recursive: true });
        console.log(`Створено директорію для даних: ${dataDirectoryPath}`);
    } catch (e) {
        console.error("Помилка створення директорії для даних:", e);
    }
}

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend_web')));
console.log(`Роздача статичних файлів з: ${path.join(__dirname, '..', 'frontend_web')}`);

const readConfigurationsFromFile = () => {
  try {
    if (!fs.existsSync(configurationsFilePath)) {
      console.warn(`Файл ${configurationsFilePath} не знайдено.`);
      if (fs.existsSync(defaultConfigsBackupPath)) {
        console.log(`Спроба скопіювати конфігурації з ${defaultConfigsBackupPath} до ${configurationsFilePath}`);
        const defaultConfigsText = fs.readFileSync(defaultConfigsBackupPath, 'utf8');
        if (defaultConfigsText.trim() === "") {
            console.warn("Файл резервної копії порожній. Створюється порожній configurations.json.");
            writeConfigurationsToFile([]);
            return [];
        }
        const defaultConfigs = JSON.parse(defaultConfigsText);
        writeConfigurationsToFile(defaultConfigs); 
        console.log("Конфігурації успішно скопійовано з резервної копії.");
        return defaultConfigs;
      } else {
        console.warn(`Файл резервної копії ${defaultConfigsBackupPath} не знайдено. Створюється порожній ${configurationsFilePath}.`);
        writeConfigurationsToFile([]);
        return [];
      }
    }
    const data = fs.readFileSync(configurationsFilePath, 'utf8');
    if (data.trim() === "") {
        console.warn(`Файл ${configurationsFilePath} порожній. Спроба відновити з бекапу.`);
        if (fs.existsSync(defaultConfigsBackupPath)) {
            const defaultConfigsText = fs.readFileSync(defaultConfigsBackupPath, 'utf8');
             if (defaultConfigsText.trim() === "") { writeConfigurationsToFile([]); return []; }
            const defaultConfigs = JSON.parse(defaultConfigsText);
            writeConfigurationsToFile(defaultConfigs);
            return defaultConfigs;
        } else { writeConfigurationsToFile([]); return []; }
    }
    const configs = JSON.parse(data);
    return Array.isArray(configs) ? configs : [];
  } catch (error) {
    console.error("Критична помилка читання або парсингу файлу конфігурацій:", error);
    try {
        if (fs.existsSync(defaultConfigsBackupPath)) {
            console.warn(`Аварійне відновлення з ${defaultConfigsBackupPath} через помилку.`);
            const defaultConfigsText = fs.readFileSync(defaultConfigsBackupPath, 'utf8');
            if (defaultConfigsText.trim() === "") { writeConfigurationsToFile([]); return [];}
            const defaultConfigs = JSON.parse(defaultConfigsText);
            writeConfigurationsToFile(defaultConfigs); 
            return defaultConfigs;
        }
    } catch (backupError) {
        console.error("Помилка аварійного відновлення з резервної копії:", backupError);
    }
    return []; 
  }
};

const writeConfigurationsToFile = (configurations) => {
  try {
    const jsonData = JSON.stringify(configurations, null, 2);
    fs.writeFileSync(configurationsFilePath, jsonData, 'utf8');
    console.log(`Конфігурації успішно записані у файл: ${configurationsFilePath}`);
  } catch (error) {
    console.error(`Помилка запису файлу конфігурацій у ${configurationsFilePath}:`, error);
  }
};

app.get('/api/configurations', (req, res) => {
  const configurations = readConfigurationsFromFile();
  res.status(200).json(configurations);
});

app.get('/api/configurations/active', (req, res) => {
  const configurations = readConfigurationsFromFile();
  let activeConfig = configurations.find(config => config.isActive === true);
  if (!activeConfig && configurations.length > 0) {
    activeConfig = configurations[0]; 
  } else if (configurations.length === 0) {
     const fallbackConfig = { id:"fallback_empty", name:"Немає конфігурацій", mode:"user_static", colors:[{r:128,g:128,b:128}], brightness:50, speed:0, params:{}, isActive:true, is_deletable:false};
     return res.status(200).json(fallbackConfig);
  }
  if (activeConfig) {
    res.status(200).json(activeConfig);
  } else { 
    const fallbackConfig = { id:"fallback_critical", name:"Fallback Помилка", mode:"user_static", colors:[{r:255,g:0,b:0}], brightness:100, speed:0, params:{}, isActive:true, is_deletable:false};
    res.status(500).json(fallbackConfig);
  }
});

app.post('/api/configurations', (req, res) => {
  const configurations = readConfigurationsFromFile();
  const body = req.body;
  const newConfig = {
    id: "user_" + Date.now().toString(),
    name: body.name ? body.name.trim() : 'Нова Конфігурація',
    mode: body.mode || 'user_static',
    colors: (Array.isArray(body.colors) && body.colors.length > 0) ? body.colors.map(c => ({r:Math.min(255,Math.max(0,parseInt(c.r,10)||0)), g:Math.min(255,Math.max(0,parseInt(c.g,10)||0)), b:Math.min(255,Math.max(0,parseInt(c.b,10)||0))})) : [{r:255,g:255,b:255}],
    brightness: parseInt(body.brightness, 10) || 150,
    speed: parseInt(body.speed, 10) || 100,
    params: (typeof body.params === 'object' && body.params !== null) ? body.params : {},
    is_deletable: true, 
    isActive: false,
  };
  if (!newConfig.name) return res.status(400).json({ message: "Назва є обов'язковою." });
  if (newConfig.mode === 'user_gradient' && newConfig.colors.length < 2) {
    return res.status(400).json({ message: "Градієнт потребує мінімум 2 кольори." });
  }
  configurations.push(newConfig);
  writeConfigurationsToFile(configurations);
  res.status(201).json(newConfig);
});
    
app.put('/api/configurations/:id', (req, res) => {
  const configIdToUpdate = req.params.id;
  let configurations = readConfigurationsFromFile();
  const configIndex = configurations.findIndex(config => config.id === configIdToUpdate);
  if (configIndex === -1) return res.status(404).json({ message: `Конфігурація ${configIdToUpdate} не знайдена.` });
  const originalConfig = configurations[configIndex];
  if (originalConfig.is_deletable === false) {
      return res.status(403).json({ message: "Пресетні конфігурації не можна редагувати."});
  }
  const body = req.body;
  const updatedConfig = {
    ...originalConfig,
    name: (body.name !== undefined && body.name.trim() !== "") ? body.name.trim() : originalConfig.name,
    mode: body.mode !== undefined ? body.mode : originalConfig.mode,
    colors: (Array.isArray(body.colors) && body.colors.length > 0) ? 
            body.colors.map(c => ({r:Math.min(255,Math.max(0,parseInt(c.r,10)||0)), g:Math.min(255,Math.max(0,parseInt(c.g,10)||0)), b:Math.min(255,Math.max(0,parseInt(c.b,10)||0))})) 
            : originalConfig.colors,
    brightness: body.brightness !== undefined ? parseInt(body.brightness, 10) : originalConfig.brightness,
    speed: body.speed !== undefined ? parseInt(body.speed, 10) : originalConfig.speed,
    params: (body.params !== undefined && typeof body.params === 'object') ? body.params : originalConfig.params, 
  };
  if (updatedConfig.mode === 'user_gradient' && (!updatedConfig.colors || updatedConfig.colors.length < 2)) {
    return res.status(400).json({ message: "Градієнт потребує мінімум 2 кольори." });
  } else if (updatedConfig.mode !== 'user_gradient' && (!updatedConfig.colors || updatedConfig.colors.length === 0)){
      updatedConfig.colors = [{r:255,g:255,b:255}]; 
  }
  configurations[configIndex] = updatedConfig;
  writeConfigurationsToFile(configurations);
  res.status(200).json(updatedConfig);
});

app.delete('/api/configurations/:id', (req, res) => {
  const configIdToDelete = req.params.id;
  let configurations = readConfigurationsFromFile();
  const configToDelete = configurations.find(c => c.id === configIdToDelete);
  if (!configToDelete) return res.status(404).json({ message: `Конфігурація ${configIdToDelete} не знайдена.` });
  if (configToDelete.is_deletable === false) {
      return res.status(403).json({message: "Пресетні конфігурації не можна видаляти."});
  }
  const wasActive = configToDelete.isActive;
  configurations = configurations.filter(config => config.id !== configIdToDelete);
  if (wasActive && configurations.length > 0) {
    if (!configurations.some(c => c.isActive)) configurations[0].isActive = true;
  } else if (configurations.length > 0 && !configurations.some(c => c.isActive)) {
    configurations[0].isActive = true;
  }
  writeConfigurationsToFile(configurations);
  res.status(200).json({ message: `Конфігурація ${configIdToDelete} видалена.` });
});

app.put('/api/configurations/activate/:id', (req, res) => {
  const configIdToActivate = req.params.id;
  let configurations = readConfigurationsFromFile();
  let activatedConfig = null;
  let found = false;
  configurations = configurations.map(config => {
    config.isActive = (config.id === configIdToActivate);
    if (config.isActive) { activatedConfig = config; found = true; }
    return config;
  });
  if (found) { writeConfigurationsToFile(configurations); res.status(200).json(activatedConfig); }
  else { res.status(404).json({ message: `Конфігурація ${configIdToActivate} не знайдена.` }); }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Бекенд сервер запущено на порту ${PORT}`);
  console.log(`Шлях до файлу конфігурацій: ${configurationsFilePath}`);
  if (!process.env.RENDER_DISK_MOUNT_PATH) {
    console.warn("УВАГА: Змінна середовища RENDER_DISK_MOUNT_PATH не встановлена. Файл конфігурацій буде зберігатися локально в папці 'data'.");
  }
});
