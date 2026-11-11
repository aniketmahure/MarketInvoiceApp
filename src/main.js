const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const dataDirectory = path.join(app.getPath('documents'), 'MarketInvoiceApp');
const csvPath = path.join(dataDirectory, 'invoices.csv');
const accountsPath = path.join(dataDirectory, 'accounts');
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
  'amount',
  'labourChargePerBag'
];
const legacyAccountCsvHeaders = accountCsvHeaders.slice(0, -1);

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
  if (!headers ||
      (headers.join(',') !== accountCsvHeaders.join(',') &&
       headers.join(',') !== legacyAccountCsvHeaders.join(','))) {
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

function writeAccountCsv(directory, records) {
  fs.writeFileSync(
    path.join(directory, 'account.csv'),
    `${accountCsvHeaders.join(',')}\n${records.map(makeCsvRow).join('')}`,
    'utf8'
  );
}

function dateTimestamp(value) {
  if (typeof value !== 'string') return null;
  const parts = value.includes('/')
    ? value.split('/').reverse()
    : value.split('-');
  if (parts.length !== 3 || parts.some((part) => !/^\d+$/.test(part))) return null;

  const [year, month, day] = parts.map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? timestamp
    : null;
}

function assertDateAllowed(records, date) {
  const timestamp = dateTimestamp(date);
  if (timestamp === null) throw new Error('A valid invoice date is required.');

  const lastClosure = [...records].reverse()
    .find((record) => record.recordType === 'closure');
  if (!lastClosure) return;

  const closureTimestamp = dateTimestamp(lastClosure.date);
  if (closureTimestamp === null) throw new Error('The saved closure date is invalid.');
  if (timestamp < closureTimestamp) {
    throw new Error('New details cannot be dated before the latest closure.');
  }
}

function assertLabourRateAllowed(records, labourChargePerBag) {
  if (!Number.isFinite(Number(labourChargePerBag)) || Number(labourChargePerBag) < 0) {
    throw new Error('Labour charges per bag must be a valid amount of zero or more.');
  }

  const lastClosureIndex = records.reduce(
    (lastIndex, record, index) => record.recordType === 'closure' ? index : lastIndex,
    -1
  );
  const existingRate = records.slice(lastClosureIndex + 1)
    .find((record) => record.labourChargePerBag !== '')?.labourChargePerBag;
  if (existingRate !== undefined && Number(existingRate) !== Number(labourChargePerBag)) {
    throw new Error('Save the labour charge for this period before adding details.');
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../dist/market-invoice-app/browser/index.html'));
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
  fs.mkdirSync(dataDirectory, { recursive: true });
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

ipcMain.handle('delete-account', (event, accountId) => {
  const directory = findAccountDirectory(accountId);
  fs.rmSync(directory, { recursive: true });
});

ipcMain.handle('get-account-invoices', (event, accountId) => {
  return readAccountCsv(findAccountDirectory(accountId))
    .map((record, recordId) => ({ record, recordId }))
    .filter(({ record }) =>
      record.recordType === 'invoice' ||
      record.recordType === 'advance' ||
      record.recordType === 'closure' ||
      record.recordType === 'labour'
    )
    .map(({ record, recordId }) => ({
      recordId,
      date: record.date,
      ...(record.recordType === 'closure' || record.recordType === 'labour'
        ? { entryType: record.recordType }
        : {}),
      rate: record.recordType === 'advance' ? '-' : Number(record.rate),
      bags: record.recordType === 'advance' ? '-' : Number(record.bags),
      weight: record.recordType === 'advance' ? '-' : Number(record.weight),
      amount: record.recordType === 'closure' ? 0 : Number(record.amount),
      ...(record.labourChargePerBag !== ''
        ? { labourChargePerBag: Number(record.labourChargePerBag) }
        : {})
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
  const records = readAccountCsv(directory);
  const labourChargePerBag = detail.labourChargePerBag ?? 7;
  assertDateAllowed(records, detail.date.trim());
  assertLabourRateAllowed(records, labourChargePerBag);
  records.push({
    recordType: 'invoice',
    accountId,
    date: detail.date.trim(),
    rate: detail.rate,
    bags: detail.bags,
    weight: detail.weight,
    amount: detail.amount,
    labourChargePerBag
  });
  writeAccountCsv(directory, records);
});

ipcMain.handle('add-advance-detail', (event, accountId, detail) => {
  if (!detail || typeof detail !== 'object' ||
      typeof detail.date !== 'string' || !detail.date.trim() ||
      !Number.isFinite(Number(detail.amount)) || Number(detail.amount) <= 0 ||
      !Number.isFinite(Number(detail.labourChargePerBag ?? 7)) ||
      Number(detail.labourChargePerBag ?? 7) < 0) {
    throw new Error('A valid advance date and amount greater than zero are required.');
  }

  const directory = findAccountDirectory(accountId);
  const records = readAccountCsv(directory);
  const labourChargePerBag = detail.labourChargePerBag ?? 7;
  assertDateAllowed(records, detail.date.trim());
  assertLabourRateAllowed(records, labourChargePerBag);
  records.push({
    recordType: 'advance',
    accountId,
    date: detail.date.trim(),
    rate: '-',
    bags: '-',
    weight: '-',
    amount: detail.amount,
    labourChargePerBag
  });
  writeAccountCsv(directory, records);
});

ipcMain.handle('add-closure-detail', (event, accountId, detail) => {
  if (!detail || typeof detail !== 'object' ||
      typeof detail.date !== 'string' || !detail.date.trim() ||
      !Number.isFinite(Number(detail.labourChargePerBag)) ||
      Number(detail.labourChargePerBag) < 0) {
    throw new Error('A valid closure date and labour charge are required.');
  }

  const directory = findAccountDirectory(accountId);
  const records = readAccountCsv(directory);
  const lastClosureIndex = records.reduce(
    (lastIndex, record, index) => record.recordType === 'closure' ? index : lastIndex,
    -1
  );
  const activeRecords = records.slice(lastClosureIndex + 1)
    .filter((record) => record.recordType === 'invoice' || record.recordType === 'advance');
  if (activeRecords.length === 0) {
    throw new Error('Add at least one invoice or advance before closing this period.');
  }

  const closureDate = detail.date.trim();
  const closureTimestamp = dateTimestamp(closureDate);
  if (closureTimestamp === null) throw new Error('A valid closure date is required.');
  assertDateAllowed(records, closureDate);
  const latestEntryDate = activeRecords.reduce((latest, record) => {
    const entryDate = dateTimestamp(record.date);
    if (entryDate === null) throw new Error('A saved invoice date is invalid.');
    return Math.max(latest, entryDate);
  }, 0);
  if (closureTimestamp < latestEntryDate) {
    throw new Error('The closure date cannot be before the latest invoice or advance.');
  }

  assertLabourRateAllowed(records, detail.labourChargePerBag);
  records.push({
    recordType: 'closure',
    accountId,
    date: closureDate,
    labourChargePerBag: detail.labourChargePerBag
  });
  writeAccountCsv(directory, records);
});

ipcMain.handle('update-current-period-labour-charge', (event, accountId, labourChargePerBag) => {
  if (!Number.isFinite(Number(labourChargePerBag)) || Number(labourChargePerBag) < 0) {
    throw new Error('Labour charges per bag must be a valid amount of zero or more.');
  }

  const directory = findAccountDirectory(accountId);
  const records = readAccountCsv(directory);
  const lastClosureIndex = records.reduce(
    (lastIndex, record, index) => record.recordType === 'closure' ? index : lastIndex,
    -1
  );
  const currentPeriod = records.slice(lastClosureIndex + 1)
    .filter((record) =>
      record.recordType === 'invoice' ||
      record.recordType === 'advance' ||
      record.recordType === 'labour'
    );
  let updatedDetails = false;
  for (const record of currentPeriod) {
    record.labourChargePerBag = labourChargePerBag;
    if (record.recordType !== 'labour') updatedDetails = true;
  }
  if (!updatedDetails && !currentPeriod.some((record) => record.recordType === 'labour')) {
    records.push({
      recordType: 'labour',
      accountId,
      date: '',
      labourChargePerBag
    });
  }
  writeAccountCsv(directory, records);
});

ipcMain.handle('delete-invoice-detail', (event, accountId, recordId) => {
  if (!Number.isInteger(recordId) || recordId < 0) {
    throw new Error('A valid invoice record ID is required.');
  }

  const directory = findAccountDirectory(accountId);
  const records = readAccountCsv(directory);
  const record = records[recordId];
  if (!record || record.accountId !== accountId ||
      (record.recordType !== 'invoice' && record.recordType !== 'advance')) {
    throw new Error('The selected invoice record was not found.');
  }

  records.splice(recordId, 1);
  writeAccountCsv(directory, records);
});