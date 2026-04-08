import {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
} from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import Store from 'electron-store';
import { AppSettings, DEFAULT_SETTINGS } from './types';
import { stateManager } from './state';
import { wsClient } from './ws-client';
import { startFileWatcher, stopFileWatcher } from './file-watcher';

const store = new Store<{ settings: AppSettings }>({
  name: 'ed-companion',
  defaults: { settings: DEFAULT_SETTINGS },
});

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function getSettings(): AppSettings {
  return store.get('settings', DEFAULT_SETTINGS);
}

function saveSettings(s: AppSettings): void {
  store.set('settings', s);
}

function autoDetectJournalPath(): string {
  const userProfile = process.env.USERPROFILE || process.env.HOME || '';
  const candidates = [
    path.join(userProfile, 'Saved Games', 'Frontier Developments', 'Elite Dangerous'),
    path.join(userProfile, 'AppData', 'Local', 'Frontier Developments', 'Elite Dangerous', 'Logs'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return '';
}

function createWindow(): void {
  const settings = getSettings();
  const { x, y, w, h } = settings.windowBounds;

  mainWindow = new BrowserWindow({
    x,
    y,
    width: w,
    height: h,
    minWidth: 360,
    minHeight: 480,
    frame: false,
    transparent: false,
    alwaysOnTop: settings.alwaysOnTop,
    opacity: settings.opacity,
    backgroundColor: '#050810',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    titleBarStyle: 'hidden',
  });

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const rendererPath = path.join(process.resourcesPath, 'renderer', 'index.html');
    mainWindow.loadFile(rendererPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow!.show();
  });

  mainWindow.on('moved', saveBounds);
  mainWindow.on('resized', saveBounds);

  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow!.hide();
  });
}

function saveBounds(): void {
  if (!mainWindow) return;
  const [x, y] = mainWindow.getPosition();
  const [w, h] = mainWindow.getSize();
  const settings = getSettings();
  saveSettings({ ...settings, windowBounds: { x, y, w, h } });
}

function createTray(): void {
  // Create a simple 16x16 icon programmatically if no icon file
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.ico');
  let icon: Electron.NativeImage;
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
  } else {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('ED Companion');

  const menu = Menu.buildFromTemplate([
    {
      label: 'Show/Hide',
      click: () => {
        if (mainWindow?.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow?.show();
          mainWindow?.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.exit(0);
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
}

function setupIPC(): void {
  ipcMain.handle('settings:get', () => getSettings());

  ipcMain.handle('settings:set', (_event, settings: AppSettings) => {
    saveSettings(settings);
    applySettings(settings);
  });

  ipcMain.handle('settings:test-ws', async (_event, url: string, secret: string) => {
    return wsClient.testConnection(url, secret);
  });

  ipcMain.handle('settings:detect-path', () => {
    return autoDetectJournalPath();
  });

  ipcMain.handle('settings:verify-path', (_event, p: string) => {
    return fs.existsSync(p);
  });

  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:close', () => mainWindow?.hide());
}

function applySettings(settings: AppSettings): void {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(settings.alwaysOnTop);
    mainWindow.setOpacity(settings.opacity);
  }

  // Restart file watcher with new path
  stopFileWatcher();
  if (settings.journalPath) {
    startFileWatcher(settings);
  }

  // Reconnect WS with new config
  wsClient.configure(settings.wsEnabled, settings.wsUrl, settings.wsSecret);
}

app.whenReady().then(() => {
  const settings = getSettings();

  // Auto-detect journal path on first run
  if (!settings.journalPath) {
    const detected = autoDetectJournalPath();
    if (detected) {
      saveSettings({ ...settings, journalPath: detected });
    }
  }

  createWindow();
  createTray();
  setupIPC();

  // Subscribe to state changes → push to renderer
  stateManager.onChange((state) => {
    mainWindow?.webContents.send('ed:state-update', state);
    wsClient.scheduleStateUpdate();
  });

  // Subscribe to WS status → push to renderer
  wsClient.onStatusChange((status) => {
    mainWindow?.webContents.send('ed:ws-status', status);
  });

  const currentSettings = getSettings();
  applySettings(currentSettings);
});

app.on('window-all-closed', () => {
  // Don't quit on window close (tray app)
});

app.on('before-quit', () => {
  stopFileWatcher();
  wsClient.destroy();
});
