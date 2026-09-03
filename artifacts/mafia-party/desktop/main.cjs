const { app, BrowserWindow, dialog } = require('electron');
const path = require('node:path');

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 360,
    minHeight: 640,
    backgroundColor: '#151329',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.loadFile(path.join(__dirname, '..', 'dist', 'public', 'index.html')).catch((error) => {
    dialog.showErrorBox('Mafia Party', `تعذر تشغيل اللعبة:\n${error.message}`);
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});