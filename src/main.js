const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Safe local CSV path inside user's home directory
const csvPath = path.join(app.getPath('userData'), 'invoices.csv');
const accountsPath = path.resolve('/softzer/invoices');
const accountCsvHeaders = [
  'recordType',
  'accountId',
  'name',
  'surname',
  'mobile',
  'address',
  'createdAt',
  'date',
  'rate',
  'bags',
  'weight',
  'amount'
];

function escapeCsv(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (quoted) {
      if (character === '"' && content[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = '';
      if (character === '\r' && content[index + 1] === '\n') index += 1;
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('The account CSV contains an unterminated quoted field.');
  row.push(field);
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function accountFolderName(name, accountId) {
  const safeName = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .replace(/\s+/g, '_');
  return `${safeName || 'account'}_${accountId}`;
}

function readAccountCsv(directory) {
  const filePath = path.join(directory, 'account.csv');
  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  const headers = rows.shift();
  if (!headers || headers.join(',') !== accountCsvHeaders.join(',')) {
    throw new Error(`Invalid account CSV format: ${filePath}`);
  }
  return rows.map((values) => Object.fromEntries(
    accountCsvHeaders.map((header, index) => [header, values[index] ?? ''])
  ));
}

function listAccountDirectories() {
  if (!fs.existsSync(accountsPath)) return [];
  return fs.readdirSync(accountsPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(accountsPath, entry.name))
    .filter((directory) => fs.existsSync(path.join(directory, 'account.csv')));
}

function findAccountDirectory(accountId) {
  if (typeof accountId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(accountId)) {
    throw new Error('Invalid account ID.');
  }

  for (const directory of listAccountDirectories()) {
    if (readAccountCsv(directory).some((record) =>
      record.recordType === 'account' && record.accountId === accountId
    )) {
      return directory;
    }
  }
  throw new Error(`Account ${accountId} was not found in ${accountsPath}.`);
}

function makeCsvRow(record) {
  return `${accountCsvHeaders.map((header) => escapeCsv(record[header])).join(',')}\n`;
}

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

ipcMain.handle('get-accounts', () => {
  return listAccountDirectories().flatMap((directory) => {
    const account = readAccountCsv(directory).find((record) => record.recordType === 'account');
    if (!account) throw new Error(`No account record found in ${directory}.`);

    return [{
      accountId: account.accountId,
      name: account.name,
      surname: account.surname,
      mobile: account.mobile,
      address: account.address,
      createdAt: account.createdAt,
      folderName: path.basename(directory),
      fileName: 'account.csv'
    }];
  });
});

ipcMain.handle('create-account', (event, data) => {
  if (!data || typeof data !== 'object' ||
      typeof data.name !== 'string' || !data.name.trim() ||
      typeof data.surname !== 'string' || !data.surname.trim() ||
      typeof data.address !== 'string' || !data.address.trim() ||
      typeof data.accountId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(data.accountId)) {
    throw new Error('A valid name, surname, address, and account ID are required.');
  }

  if (listAccountDirectories().some((directory) =>
    readAccountCsv(directory).some((record) =>
      record.recordType === 'account' && record.accountId === data.accountId
    )
  )) {
    throw new Error(`Account ID ${data.accountId} already exists.`);
  }

  fs.mkdirSync(accountsPath, { recursive: true });
  const directory = path.join(accountsPath, accountFolderName(data.name.trim(), data.accountId));
  fs.mkdirSync(directory);

  const account = {
    recordType: 'account',
    accountId: data.accountId,
    name: data.name.trim(),
    surname: data.surname.trim(),
    mobile: typeof data.mobile === 'string' ? data.mobile.trim() : '',
    address: data.address.trim(),
    createdAt: new Date().toISOString()
  };
  const filePath = path.join(directory, 'account.csv');
  fs.writeFileSync(
    filePath,
    `${accountCsvHeaders.join(',')}\n${makeCsvRow(account)}`,
    'utf8'
  );

  return {
    ...account,
    folderName: path.basename(directory),
    fileName: 'account.csv'
  };
});

ipcMain.handle('get-account-invoices', (event, accountId) => {
  return readAccountCsv(findAccountDirectory(accountId))
    .filter((record) => record.recordType === 'invoice')
    .map((record) => ({
      date: record.date,
      rate: Number(record.rate),
      bags: Number(record.bags),
      weight: Number(record.weight),
      amount: Number(record.amount)
    }));
});

ipcMain.handle('add-invoice-detail', (event, accountId, detail) => {
  if (!detail || typeof detail !== 'object' ||
      typeof detail.date !== 'string' || !detail.date.trim() ||
      ['rate', 'bags', 'weight', 'amount'].some((field) =>
        !Number.isFinite(Number(detail[field]))
      )) {
    throw new Error('A valid date, rate, bag count, weight, and amount are required.');
  }

  const directory = findAccountDirectory(accountId);
  const filePath = path.join(directory, 'account.csv');
  fs.appendFileSync(filePath, makeCsvRow({
    recordType: 'invoice',
    accountId,
    date: detail.date.trim(),
    rate: detail.rate,
    bags: detail.bags,
    weight: detail.weight,
    amount: detail.amount
  }), 'utf8');
});