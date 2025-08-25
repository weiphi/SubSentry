const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';
const DatabaseService = require('../src/services/database.js');
const OpenAI = require('openai');

let mainWindow;
let tray;
let database;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    show: false,
    resizable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    titleBarStyle: 'default'
  });

  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../build/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // if (isDev) {
  //   mainWindow.webContents.openDevTools();
  // }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function createTray() {
  // Use the PNG tray icon file
  const iconPath = isDev 
    ? path.join(__dirname, 'assets/trayicon-16x16.png')
    : path.join(process.resourcesPath, 'app.asar.unpacked/public/assets/trayicon-16x16.png');
  
  console.log('Loading tray icon from:', iconPath);
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true);
  
  tray = new Tray(icon);
  
  // Set initial tooltip and context menu
  tray.setToolTip('SubSentry - Subscription Tracker');
  updateContextMenu('gray', 0, 0);

  tray.on('click', () => {
    if (mainWindow === null) {
      createWindow();
    }
    
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  // Check if app was launched at login
  const loginItemSettings = app.getLoginItemSettings();
  const wasAutoLaunched = loginItemSettings.wasOpenedAtLogin;
  
  // Initialize database
  database = new DatabaseService();
  
  // Set up IPC handlers
  setupIpcHandlers();
  
  // Configure auto-launch on first run
  configureAutoLaunch();
  
  createWindow();
  createTray();
  
  // If auto-launched, keep window hidden and show notification
  if (wasAutoLaunched) {
    console.log('SubSentry started automatically at login');
  } else {
    // Manual launch - could show window if desired, but keeping it hidden for consistency
    console.log('SubSentry started manually');
  }
  
  // Initial tray icon color update
  updateTrayIconColor();
  
  // Update tray icon color every hour
  setInterval(() => {
    updateTrayIconColor();
  }, 60 * 60 * 1000); // 1 hour
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Keep app running in menu bar even when all windows closed
});

app.on('before-quit', () => {
  app.isQuiting = true;
});

// macOS dock icon hiding
if (process.platform === 'darwin') {
  app.dock.hide();
}

// Auto-launch configuration
function configureAutoLaunch() {
  // Enable auto-launch by default on first run
  const loginItemSettings = app.getLoginItemSettings();
  
  if (!loginItemSettings.wasOpenedAtLogin && !loginItemSettings.openAtLogin) {
    // First time running - enable auto-launch
    app.setLoginItemSettings({
      openAtLogin: true,
      name: 'SubSentry'
    });
    console.log('Auto-launch enabled for SubSentry');
  }
}

function setAutoLaunch(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    name: 'SubSentry'
  });
  console.log(`Auto-launch ${enabled ? 'enabled' : 'disabled'} for SubSentry`);
}

function getAutoLaunchStatus() {
  return app.getLoginItemSettings().openAtLogin;
}

// IPC handlers for database operations
function setupIpcHandlers() {
  // Get all services
  ipcMain.handle('get-all-services', async () => {
    try {
      // Auto-update past renewal dates before returning services
      database.autoUpdatePastRenewalDates();
      return database.getAllServices();
    } catch (error) {
      console.error('Error getting all services:', error);
      throw error;
    }
  });

  // Add a new service
  ipcMain.handle('add-service', async (event, serviceData) => {
    try {
      const result = database.addService(serviceData);
      
      // Update tray icon color based on new renewal dates
      updateTrayIconColor();
      
      return result;
    } catch (error) {
      console.error('Error adding service:', error);
      throw error;
    }
  });

  // Update a service
  ipcMain.handle('update-service', async (event, serviceId, updates) => {
    try {
      const result = database.updateService(serviceId, updates);
      
      // Update tray icon color
      updateTrayIconColor();
      
      return result;
    } catch (error) {
      console.error('Error updating service:', error);
      throw error;
    }
  });

  // Delete a service
  ipcMain.handle('delete-service', async (event, serviceId) => {
    try {
      const result = database.deleteService(serviceId);
      
      // Update tray icon color
      updateTrayIconColor();
      
      return result;
    } catch (error) {
      console.error('Error deleting service:', error);
      throw error;
    }
  });

  // Get monthly totals
  ipcMain.handle('get-monthly-totals', async () => {
    try {
      return database.getMonthlyTotals();
    } catch (error) {
      console.error('Error getting monthly totals:', error);
      throw error;
    }
  });

  // Search services
  ipcMain.handle('search-services', async (event, query) => {
    try {
      return database.searchServices(query);
    } catch (error) {
      console.error('Error searching services:', error);
      throw error;
    }
  });

  // Update renewal date to next occurrence
  ipcMain.handle('update-renewal-date', async (event, serviceId) => {
    try {
      const result = database.updateRenewalDate(serviceId);
      
      // Update tray icon color
      updateTrayIconColor();
      
      return result;
    } catch (error) {
      console.error('Error updating renewal date:', error);
      throw error;
    }
  });

  // Auto-update all past renewal dates
  ipcMain.handle('auto-update-renewal-dates', async () => {
    try {
      const updatedServices = database.autoUpdatePastRenewalDates();
      
      // Update tray icon color
      updateTrayIconColor();
      
      return updatedServices;
    } catch (error) {
      console.error('Error auto-updating renewal dates:', error);
      throw error;
    }
  });

  // Parse natural language input using OpenAI
  ipcMain.handle('parse-natural-language', async (event, { inputText, apiKey }) => {
    try {
      const openai = new OpenAI({ apiKey });

      const prompt = `
Parse the following subscription service text and extract structured data. 
Return ONLY a valid JSON object with these exact fields:
- name: string (service name)
- cost: number (numeric value only)
- currency: string ("USD" or "EUR" only)
- renewalDate: string (YYYY-MM-DD format, absolute dates only, no relative dates)
- frequency: string ("monthly" or "annual" only)
- tags: string (hashtags if mentioned, empty string if none)

Input: "${inputText}"

Rules:
- Only accept absolute dates (specific dates, not "next month" or "in 30 days")
- If currency is not specified, assume USD
- Extract hashtags from the text if present
- If information is missing or unclear, return null for that field
- Return only the JSON object, no explanations

Example output format:
{
  "name": "Netflix",
  "cost": 15.99,
  "currency": "USD",
  "renewalDate": "2025-06-15",
  "frequency": "monthly",
  "tags": "#entertainment #streaming"
}
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a subscription service data parser. Return only valid JSON objects with the specified structure."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.1
      });

      const responseText = completion.choices[0]?.message?.content?.trim();
      
      if (!responseText) {
        throw new Error('No response from OpenAI');
      }

      // Parse the JSON response
      const parsedData = JSON.parse(responseText);
      
      // Validate required fields
      const requiredFields = ['name', 'cost', 'currency', 'renewalDate', 'frequency'];
      const missingFields = requiredFields.filter(field => 
        parsedData[field] === null || parsedData[field] === undefined || parsedData[field] === ''
      );
      
      if (missingFields.length > 0) {
        throw new Error(`Could not parse: ${missingFields.join(', ')} missing or unclear`);
      }

      // Validate data types and values
      if (typeof parsedData.name !== 'string') {
        throw new Error('Service name must be text');
      }
      
      if (typeof parsedData.cost !== 'number' || parsedData.cost <= 0) {
        throw new Error('Cost must be a positive number');
      }
      
      if (!['USD', 'EUR'].includes(parsedData.currency)) {
        throw new Error('Currency must be USD or EUR');
      }
      
      if (!['monthly', 'annual'].includes(parsedData.frequency)) {
        throw new Error('Frequency must be monthly or annual');
      }
      
      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(parsedData.renewalDate)) {
        throw new Error('Renewal date must be in YYYY-MM-DD format');
      }
      
      // Check if date is in the future
      const renewalDate = new Date(parsedData.renewalDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (renewalDate < today) {
        throw new Error('Renewal date cannot be in the past');
      }
      
      // Ensure tags is a string
      if (parsedData.tags === null || parsedData.tags === undefined) {
        parsedData.tags = '';
      }
      
      return {
        name: parsedData.name.trim(),
        cost: parsedData.cost,
        currency: parsedData.currency,
        renewalDate: parsedData.renewalDate,
        frequency: parsedData.frequency,
        tags: parsedData.tags.toString().trim(),
        status: 'active'
      };
      
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Sorry, couldn\'t parse that. Please try rephrasing or use the manual form.');
      }
      
      if (error.message.includes('Could not parse') || 
          error.message.includes('must be') || 
          error.message.includes('cannot be')) {
        throw error;
      }
      
      console.error('NLP parsing error:', error);
      throw new Error('Sorry, couldn\'t parse that. Please try again or use the manual form.');
    }
  });

  // Auto-launch settings
  ipcMain.handle('get-auto-launch-status', async () => {
    try {
      return getAutoLaunchStatus();
    } catch (error) {
      console.error('Error getting auto-launch status:', error);
      return false;
    }
  });

  ipcMain.handle('set-auto-launch', async (event, enabled) => {
    try {
      setAutoLaunch(enabled);
      return true;
    } catch (error) {
      console.error('Error setting auto-launch:', error);
      throw error;
    }
  });
}

// Update tray icon color based on renewal dates
function updateTrayIconColor() {
  if (!database || !tray) return;
  
  try {
    const renewingSoon = database.getServicesRenewingSoon();
    
    let iconColor = 'gray'; // default
    let tooltipText = 'SubSentry - Subscription Tracker';
    
    // Check for services renewing very soon (2 days or less)
    const verySoon = renewingSoon.filter(service => {
      const renewalDate = new Date(service.renewal_date);
      const now = new Date();
      const timeDiff = renewalDate.getTime() - now.getTime();
      const daysUntil = Math.ceil(timeDiff / (1000 * 3600 * 24));
      return daysUntil <= 2;
    });
    
    if (verySoon.length > 0) {
      iconColor = 'red';
      tooltipText = `⚠️ ${verySoon.length} subscription${verySoon.length > 1 ? 's' : ''} renewing in ≤2 days!`;
    } else if (renewingSoon.length > 0) {
      iconColor = 'yellow';
      tooltipText = `⚡ ${renewingSoon.length} subscription${renewingSoon.length > 1 ? 's' : ''} renewing soon`;
    }
    
    // Update tray icon based on color
    updateTrayIcon(iconColor);
    
    // Update tooltip and context menu
    tray.setToolTip(tooltipText);
    updateContextMenu(iconColor, renewingSoon.length, verySoon.length);
    
    console.log(`Tray status updated to: ${iconColor} (${renewingSoon.length} services renewing soon, ${verySoon.length} very soon)`);
    
  } catch (error) {
    console.error('Error updating tray icon color:', error);
  }
}

// Update tray icon with PNG files
function updateTrayIcon(color) {
  if (!tray) return;
  
  const iconFileName = `trayicon-${color}-16x16.png`;
  const iconPath = isDev 
    ? path.join(__dirname, 'assets', iconFileName)
    : path.join(process.resourcesPath, 'app.asar.unpacked/public/assets', iconFileName);
  
  // Fallback to default icon if colored version doesn't exist
  const fallbackPath = isDev 
    ? path.join(__dirname, 'assets/trayicon-16x16.png')
    : path.join(process.resourcesPath, 'app.asar.unpacked/public/assets/trayicon-16x16.png');
  
  const fs = require('fs');
  const finalPath = fs.existsSync(iconPath) ? iconPath : fallbackPath;
  
  try {
    const icon = nativeImage.createFromPath(finalPath);
    icon.setTemplateImage(color === 'gray'); // Only use template for gray icon
    tray.setImage(icon);
  } catch (error) {
    console.error('Error updating tray icon:', error);
  }
}

function updateContextMenu(status, renewingSoonCount, verySoonCount) {
  if (!tray) return;
  
  let statusLabel = '✅ All good';
  if (verySoonCount > 0) {
    statusLabel = `🔴 ${verySoonCount} renewal${verySoonCount > 1 ? 's' : ''} ≤2 days!`;
  } else if (renewingSoonCount > 0) {
    statusLabel = `🟡 ${renewingSoonCount} renewal${renewingSoonCount > 1 ? 's' : ''} soon`;
  }
  
  const autoLaunchEnabled = getAutoLaunchStatus();
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: statusLabel,
      enabled: false
    },
    {
      type: 'separator'
    },
    {
      label: 'Quick Add Service',
      type: 'normal',
      click: () => {
        console.log('Quick add clicked');
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Open SubSentry',
      type: 'normal',
      click: () => {
        if (mainWindow === null) {
          createWindow();
        }
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      type: 'separator'
    },
    {
      label: autoLaunchEnabled ? 'Disable Auto-Launch' : 'Enable Auto-Launch',
      type: 'normal',
      click: () => {
        setAutoLaunch(!autoLaunchEnabled);
        // Update the context menu to reflect the change
        updateContextMenu(status, renewingSoonCount, verySoonCount);
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Quit',
      type: 'normal',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

// Clean up database connection on app quit
app.on('before-quit', () => {
  app.isQuiting = true;
  if (database) {
    database.close();
  }
});