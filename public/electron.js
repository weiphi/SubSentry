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
    ? path.join(__dirname, 'assets/SubSentry-Icon-16.png')
    : path.join(process.resourcesPath, 'assets/SubSentry-Icon-16.png');
  
  console.log('Loading tray icon from:', iconPath);
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(false);
  
  tray = new Tray(icon);
  
  // Set initial tooltip and context menu
  tray.setToolTip('SubSentry - Subscription Tracker\nDrag receipt screenshots here!');
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

  // Add drag and drop support
  tray.on('drop-files', async (event, files) => {
    console.log('Files dropped on tray:', files);
    
    if (files.length === 0) return;
    
    const filePath = files[0]; // Take the first file
    
    // Validate file type
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
    const fileExtension = path.extname(filePath).toLowerCase();
    
    if (!allowedExtensions.includes(fileExtension)) {
      // Show error and open main window
      openMainWindowWithError('Please drop a PNG, JPEG, or WEBP image file');
      return;
    }
    
    // Show processing feedback with spinning loading icon
    tray.setToolTip('Processing screenshot...');
    
    // Cycle through loading1.png, loading2.png, loading3.png, loading4.png
    let frameIndex = 1;
    const spinInterval = setInterval(() => {
      const loadingIconPath = isDev 
        ? path.join(__dirname, `assets/loading${frameIndex}.png`)
        : path.join(process.resourcesPath, `assets/loading${frameIndex}.png`);
      
      const loadingIcon = nativeImage.createFromPath(loadingIconPath);
      loadingIcon.setTemplateImage(true);
      tray.setImage(loadingIcon);
      
      frameIndex = frameIndex === 4 ? 1 : frameIndex + 1;
    }, 500);
    
    try {
      // Process the dropped image
      await processDroppedImage(filePath);
    } catch (error) {
      console.error('Error processing dropped image:', error);
      openMainWindowWithError('Failed to process screenshot: ' + error.message);
    } finally {
      // Stop spinning animation
      clearInterval(spinInterval);
      
      // Restore normal icon and tooltip
      const normalIconPath = isDev 
        ? path.join(__dirname, 'assets/SubSentry-Icon-16.png')
        : path.join(process.resourcesPath, 'assets/SubSentry-Icon-16.png');
      
      const normalIcon = nativeImage.createFromPath(normalIconPath);
      normalIcon.setTemplateImage(false);
      tray.setImage(normalIcon);
      tray.setToolTip('SubSentry - Subscription Tracker\nDrag receipt screenshots here!');
    }
  });

  // Enable drag and drop
  tray.on('dragenter', () => {
    tray.setToolTip('Drop screenshot to process...');
  });

  tray.on('dragleave', () => {
    tray.setToolTip('SubSentry - Subscription Tracker\nDrag receipt screenshots here!');
  });
}

// Helper function to process dropped images
async function processDroppedImage(filePath) {
  try {
    // Check if we have a stored API key
    const apiKey = database.getSetting('openai_api_key');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please set it in Settings first.');
    }

    // Convert file to base64 data URL
    const fs = require('fs');
    const fileBuffer = fs.readFileSync(filePath);
    const mimeType = getMimeTypeFromExtension(path.extname(filePath));
    const base64Data = fileBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    console.log('Processing dropped image with OpenAI...');
    
    // Use the existing screenshot parsing logic
    const parsedData = await parseScreenshotData(dataUrl, apiKey);
    
    // Open main window with parsed data
    openMainWindowWithParsedData(parsedData);
    
  } catch (error) {
    throw error;
  }
}

// Helper function to get MIME type from file extension
function getMimeTypeFromExtension(ext) {
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp'
  };
  return mimeTypes[ext.toLowerCase()] || 'image/png';
}

// Helper function to parse screenshot data (extracted from existing handler)
async function parseScreenshotData(imageDataUrl, apiKey) {
  const openai = new OpenAI({ apiKey });

  const prompt = `
You are analyzing a subscription service receipt or email screenshot. Extract structured data and return ONLY a valid JSON object with these exact fields:
- name: string (service name)
- cost: number (numeric value only, no currency symbols)
- currency: string ("USD" or "EUR" only)
- renewalDate: string (YYYY-MM-DD format, absolute dates only, no relative dates)
- frequency: string ("monthly" or "annual" only)
- tags: string (hashtags if mentioned, empty string if none)

Rules:
- Look for service names, subscription costs, billing dates, renewal dates, and billing frequency
- If currency is not specified, assume USD
- Extract hashtags from the text if present
- Only accept absolute dates (specific dates, not "next month" or "in 30 days")
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
    model: "gpt-4.1",
    messages: [
      {
        role: "system",
        content: "You are a subscription service data parser. Return only valid JSON objects with the specified structure."
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt
          },
          {
            type: "image_url",
            image_url: {
              url: imageDataUrl
            }
          }
        ]
      }
    ],
    max_tokens: 300,
    temperature: 0.1
  });

  const responseText = completion.choices[0]?.message?.content?.trim();
  
  if (!responseText) {
    throw new Error('No response from OpenAI');
  }

  // Parse the JSON response
  const parsedData = JSON.parse(responseText);
  
  // Apply the same validation and defaults as the main handler
  const requiredFields = ['name', 'cost', 'currency', 'renewalDate', 'frequency'];
  const missingFields = requiredFields.filter(field => 
    parsedData[field] === null || parsedData[field] === undefined || parsedData[field] === ''
  );
  
  if (missingFields.length > 0) {
    // Provide defaults for missing fields when possible
    if (missingFields.includes('frequency')) {
      parsedData.frequency = 'monthly';
      console.log('Processing: Frequency unclear, defaulting to monthly');
    }
    if (missingFields.includes('currency')) {
      parsedData.currency = 'USD';
      console.log('Processing: Currency unclear, defaulting to USD');
    }
    
    // Only throw error for truly critical missing fields
    const criticalFields = missingFields.filter(field => !['frequency', 'currency', 'tags'].includes(field));
    if (criticalFields.length > 0) {
      throw new Error(`Could not determine ${criticalFields.join(', ')} from screenshot`);
    }
  }

  // Validate and process the data (same logic as existing handler)
  if (typeof parsedData.name !== 'string') {
    throw new Error('Service name must be text');
  }
  
  if (typeof parsedData.cost !== 'number' || parsedData.cost <= 0) {
    throw new Error('Cost must be a positive number');
  }
  
  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(parsedData.renewalDate)) {
    throw new Error('Renewal date must be in YYYY-MM-DD format');
  }
  
  // Handle past dates
  const renewalDate = new Date(parsedData.renewalDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (renewalDate < today) {
    const nextRenewalDate = new Date(renewalDate);
    
    if (parsedData.frequency === 'monthly') {
      while (nextRenewalDate < today) {
        nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
      }
    } else if (parsedData.frequency === 'annual') {
      while (nextRenewalDate < today) {
        nextRenewalDate.setFullYear(nextRenewalDate.getFullYear() + 1);
      }
    }
    
    parsedData.renewalDate = nextRenewalDate.toISOString().split('T')[0];
    console.log(`Updated past renewal date to next occurrence: ${parsedData.renewalDate}`);
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
}

// Helper function to open main window with parsed data
function openMainWindowWithParsedData(parsedData) {
  if (mainWindow === null) {
    createWindow();
  }
  mainWindow.show();
  mainWindow.focus();
  
  // Send the parsed data to the renderer process
  mainWindow.webContents.send('show-add-service-with-data', parsedData);
}

// Helper function to open main window with error
function openMainWindowWithError(errorMessage) {
  if (mainWindow === null) {
    createWindow();
  }
  mainWindow.show();
  mainWindow.focus();
  
  // Send error to the renderer process
  mainWindow.webContents.send('show-add-service-with-error', errorMessage);
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
        // Provide defaults for missing fields when possible, only fail for critical ones
        if (missingFields.includes('frequency')) {
          parsedData.frequency = 'monthly';
          console.log('Processing: Frequency unclear, defaulting to monthly');
        }
        if (missingFields.includes('currency')) {
          parsedData.currency = 'USD';
          console.log('Processing: Currency unclear, defaulting to USD');
        }
        
        // Only throw error for truly critical missing fields
        const criticalFields = missingFields.filter(field => !['frequency', 'currency', 'tags'].includes(field));
        if (criticalFields.length > 0) {
          throw new Error(`Could not determine ${criticalFields.join(', ')} from input`);
        }
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
        // For screenshot processing, calculate next renewal date based on frequency
        const nextRenewalDate = new Date(renewalDate);
        
        if (parsedData.frequency === 'monthly') {
          // Add months until we get a future date
          while (nextRenewalDate < today) {
            nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
          }
        } else if (parsedData.frequency === 'annual') {
          // Add years until we get a future date
          while (nextRenewalDate < today) {
            nextRenewalDate.setFullYear(nextRenewalDate.getFullYear() + 1);
          }
        }
        
        // Update the renewal date to the calculated future date
        parsedData.renewalDate = nextRenewalDate.toISOString().split('T')[0];
        
        console.log(`Updated past renewal date to next occurrence: ${parsedData.renewalDate}`);
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

  // Parse screenshot using OpenAI Vision API
  ipcMain.handle('parse-screenshot', async (event, { imageDataUrl, apiKey }) => {
    try {
      const openai = new OpenAI({ apiKey });

      const prompt = `
You are analyzing a subscription service receipt or email screenshot. Extract structured data and return ONLY a valid JSON object with these exact fields:
- name: string (service name)
- cost: number (numeric value only, no currency symbols)
- currency: string ("USD" or "EUR" only)
- renewalDate: string (YYYY-MM-DD format, absolute dates only, no relative dates)
- frequency: string ("monthly" or "annual" only)
- tags: string (hashtags if mentioned, empty string if none)

Rules:
- Look for service names, subscription costs, billing dates, renewal dates, and billing frequency
- If currency is not specified, assume USD
- Extract hashtags from the text if present
- Only accept absolute dates (specific dates, not "next month" or "in 30 days")
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
        model: "gpt-4.1", // Using GPT-4 with vision capabilities
        messages: [
          {
            role: "system",
            content: "You are a subscription service data parser. Return only valid JSON objects with the specified structure."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              },
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl
                }
              }
            ]
          }
        ],
        max_tokens: 300,
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
        // Provide defaults for missing fields when possible, only fail for critical ones
        if (missingFields.includes('frequency')) {
          parsedData.frequency = 'monthly';
          console.log('Processing: Frequency unclear, defaulting to monthly');
        }
        if (missingFields.includes('currency')) {
          parsedData.currency = 'USD';
          console.log('Processing: Currency unclear, defaulting to USD');
        }
        
        // Only throw error for truly critical missing fields
        const criticalFields = missingFields.filter(field => !['frequency', 'currency', 'tags'].includes(field));
        if (criticalFields.length > 0) {
          throw new Error(`Could not determine ${criticalFields.join(', ')} from input`);
        }
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
        // For screenshot processing, calculate next renewal date based on frequency
        const nextRenewalDate = new Date(renewalDate);
        
        if (parsedData.frequency === 'monthly') {
          // Add months until we get a future date
          while (nextRenewalDate < today) {
            nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
          }
        } else if (parsedData.frequency === 'annual') {
          // Add years until we get a future date
          while (nextRenewalDate < today) {
            nextRenewalDate.setFullYear(nextRenewalDate.getFullYear() + 1);
          }
        }
        
        // Update the renewal date to the calculated future date
        parsedData.renewalDate = nextRenewalDate.toISOString().split('T')[0];
        
        console.log(`Updated past renewal date to next occurrence: ${parsedData.renewalDate}`);
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
        throw new Error('Sorry, couldn\'t parse that screenshot. Please try the natural language input instead.');
      }
      
      if (error.message.includes('Could not parse') || 
          error.message.includes('must be') || 
          error.message.includes('cannot be')) {
        throw error;
      }
      
      console.error('Screenshot parsing error:', error);
      throw new Error('Sorry, couldn\'t parse that screenshot. Please try again or use the natural language input.');
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

  // Settings IPC handlers
  ipcMain.handle('get-setting', async (event, key) => {
    try {
      return database.getSetting(key);
    } catch (error) {
      console.error('Error getting setting:', error);
      return null;
    }
  });

  ipcMain.handle('set-setting', async (event, key, value) => {
    try {
      return database.setSetting(key, value);
    } catch (error) {
      console.error('Error setting setting:', error);
      throw error;
    }
  });

  ipcMain.handle('delete-setting', async (event, key) => {
    try {
      return database.deleteSetting(key);
    } catch (error) {
      console.error('Error deleting setting:', error);
      throw error;
    }
  });

  ipcMain.handle('get-all-settings', async () => {
    try {
      return database.getAllSettings();
    } catch (error) {
      console.error('Error getting all settings:', error);
      return {};
    }
  });

  // Test API key with haiku generation
  ipcMain.handle('test-api-key', async (event, apiKey) => {
    try {
      const openai = new OpenAI({ apiKey });

      const completion = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          {
            role: "user",
            content: "Write a haiku about subscriptions"
          }
        ],
        max_tokens: 100,
        temperature: 0.7
      });

      const haiku = completion.choices[0]?.message?.content?.trim();
      
      if (!haiku) {
        throw new Error('No response from OpenAI');
      }

      return { haiku };
      
    } catch (error) {
      console.error('API key test error:', error);
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
  
  // Always use the SubSentry icon regardless of color for now
  // TODO: Create SubSentry-Alert-16.png, SubSentry-Danger-16.png for colored states
  const iconPath = isDev 
    ? path.join(__dirname, 'assets/SubSentry-Icon-16.png')
    : path.join(process.resourcesPath, 'assets/SubSentry-Icon-16.png');
  
  try {
    const icon = nativeImage.createFromPath(iconPath);
    icon.setTemplateImage(false); // Disable template image to show actual colors
    tray.setImage(icon);
  } catch (error) {
    console.error('Error updating tray icon:', error);
  }
}

function updateContextMenu(status, renewingSoonCount, verySoonCount) {
  if (!tray) return;
  
  // Get next 5 active services ordered by renewal date
  const allServices = database ? database.getAllServices() : [];
  const activeServices = allServices.filter(service => service.status === 'active');
  const next5Services = activeServices.slice(0, 5);
  
  // Create menu items for the next 5 services
  const serviceMenuItems = [];
  
  next5Services.forEach(service => {
    // Calculate days until renewal
    const renewalDate = new Date(service.renewal_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    renewalDate.setHours(0, 0, 0, 0);
    
    const timeDiff = renewalDate.getTime() - today.getTime();
    const daysUntil = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    // Format the label
    const dayText = daysUntil === 1 ? 'day' : 'days';
    const label = `${service.name} (${daysUntil} ${dayText})`;
    
    serviceMenuItems.push({
      label: label,
      enabled: false
    });
  });
  
  // Add separator after service items if there are any
  if (serviceMenuItems.length > 0) {
    serviceMenuItems.push({
      type: 'separator'
    });
  }
  
  const autoLaunchEnabled = getAutoLaunchStatus();
  
  const contextMenu = Menu.buildFromTemplate([
    ...serviceMenuItems,
    {
      label: 'Quick Add Service',
      type: 'normal',
      click: () => {
        console.log('Quick add clicked');
        if (mainWindow === null) {
          createWindow();
        }
        mainWindow.show();
        mainWindow.focus();
        // Send IPC message to show Add New Service dialog
        mainWindow.webContents.send('show-add-service-dialog');
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
      label: 'Settings',
      type: 'normal',
      click: () => {
        if (mainWindow === null) {
          createWindow();
        }
        mainWindow.show();
        mainWindow.focus();
        // Send IPC message to show settings page
        mainWindow.webContents.send('show-settings');
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