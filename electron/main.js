/**
 * main.js — Electron entry for SpareTrack
 * Starts Flask, waits for it, opens BrowserWindow.
 * Works offline — no internet required.
 */

const { app, BrowserWindow, shell, ipcMain, dialog, Menu } = require('electron');
const path   = require('path');
const http   = require('http');
const { spawn } = require('child_process');

let mainWindow   = null;
let flaskProcess = null;
const PORT = 5000;

function resolvePath(...p) {
  return app.isPackaged
    ? path.join(process.resourcesPath, ...p)
    : path.join(__dirname, '..', ...p);
}

function waitForFlask(retries = 60, ms = 500) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const check = () => {
      n++;
      const req = http.get(`http://localhost:${PORT}/`, res => { res.resume(); resolve(); });
      req.on('error', () => { if (n >= retries) return reject(new Error('Flask start timeout')); setTimeout(check, ms); });
      req.setTimeout(400, () => req.destroy());
    };
    check();
  });
}

function startFlask() {
  const dir = resolvePath('backend');
  const fs  = require('fs');
  const candidates = [
    path.join(dir, 'venv', 'bin', 'python3'),
    path.join(dir, 'venv', 'Scripts', 'python.exe'),
    'python3', 'python',
  ];
  const py = candidates.find(c => { try { return require('fs').existsSync(c); } catch { return false; } }) || 'python3';

  flaskProcess = spawn(py, ['app.py'], {
    cwd: dir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FLASK_PORT: String(PORT), PYTHONUNBUFFERED: '1' }
  });
  flaskProcess.stdout.on('data', d => console.log('[Flask]', d.toString().trim()));
  flaskProcess.stderr.on('data', d => {
    const s = d.toString().trim();
    if (!s.includes('WARNING') && !s.includes('INFO')) console.error('[Flask ERR]', s);
  });
  flaskProcess.on('error', err => {
    dialog.showErrorBox('Python / Flask Error',
      `Could not start the server.\n${err.message}\n\n` +
      'Ensure Python 3 is installed and run:\n  pip install flask flask-cors reportlab openpyxl');
  });
  flaskProcess.on('close', (code, signal) => {
    console.log(`[Flask] exited code=${code} signal=${signal}`);
  });
}

function killFlask() {
  if (!flaskProcess) return;
  try {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(flaskProcess.pid), '/f', '/t']);
    else flaskProcess.kill('SIGTERM');
  } catch(_) {}
  flaskProcess = null;
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'New Bill',      accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.executeJavaScript("navigateTo('billing')") },
        { label: 'Customers',     accelerator: 'CmdOrCtrl+K', click: () => mainWindow?.webContents.executeJavaScript("navigateTo('customers')") },
        { type: 'separator' },
        { label: 'Download Backup', click: () => shell.openExternal(`http://localhost:${PORT}/backup`) },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Dashboard',  click: () => mainWindow?.webContents.executeJavaScript("navigateTo('dashboard')") },
        { label: 'Reports',    click: () => mainWindow?.webContents.executeJavaScript("navigateTo('reports')") },
        { label: 'Pending',    click: () => mainWindow?.webContents.executeJavaScript("navigateTo('pending')") },
        { type: 'separator' },
        { role: 'reload' }, { role: 'toggleDevTools' }, { role: 'resetZoom' },
        { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { role: 'window', submenu: [{ role: 'minimize' }, { role: 'zoom' }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900,
    minWidth: 1024, minHeight: 650,
    title: 'SpareTrack',
    backgroundColor: '#f8faff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' } : {}),
  });

  buildMenu();
  mainWindow.loadURL(`http://localhost:${PORT}/`);
  mainWindow.once('ready-to-show', () => { mainWindow.show(); mainWindow.focus(); });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  mainWindow.on('closed', () => { mainWindow = null; });
}

// IPC
ipcMain.handle('get-version',      () => app.getVersion());
ipcMain.handle('get-flask-status', () => new Promise(resolve => {
  http.get(`http://localhost:${PORT}/`, res => { res.resume(); resolve({ running: true }); })
      .on('error', () => resolve({ running: false }));
}));
ipcMain.on('open-external', (_, url) => shell.openExternal(url));

app.whenReady().then(async () => {
  startFlask();
  try   { await waitForFlask(); console.log('[Electron] Flask ready'); }
  catch (e) { console.warn('[Electron] Flask wait timed out, loading anyway'); }
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on('window-all-closed', () => { killFlask(); if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', killFlask);
app.on('will-quit',   killFlask);
