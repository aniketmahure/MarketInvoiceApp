const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Safe local CSV path inside user's home directory
const csvPath = path.join(app.getPath('userData'), 'invoices.csv');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load your compiled Angular app (or load localhost URL during development)
  mainWindow.loadFile(path.join(__dirname, 'dist/market-invoice-app/browser/index.html'));
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

// --- IPC Handlers for CSV Operations ---

ipcMain.handle('get-invoices', () => {
  if (!fs.existsSync(csvPath)) return [];
  
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n');
  if (lines.length <= 1) return [];

  const rows = lines.slice(1); // Skip header
  return rows.map(row => {
    const [customer, amount, date] = row.split(',');
    return { customer, amount, date };
  });
});

ipcMain.handle('save-invoice', (event, invoice) => {
  const fileExists = fs.existsSync(csvPath);
  let line = `${invoice.customer},${invoice.amount},${invoice.date}\n`;
  
  if (!fileExists) {
    const header = 'Customer,Amount,Date\n';
    fs.writeFileSync(csvPath, header);
  }
  
  fs.appendFileSync(csvPath, line);
  return true;
});