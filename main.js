const { app, BrowserWindow } = require('electron');
const path = require('path');

// Запускаем сервер
require('./server.js');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'SonyChat',
    icon: path.join(__dirname, 'public', 'icon.png'),
    autoHideMenuBar: true,
    backgroundColor: '#4a90d9',
    webPreferences: {
      nodeIntegration: false
    }
  });

  // Ждём 2 секунды, пока сервер запустится
  setTimeout(function() {
    win.loadURL('http://localhost:3000');
  }, 2000);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', function() {
  app.quit();
});