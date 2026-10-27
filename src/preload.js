const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  createAccount: (data) => ipcRenderer.invoke('create-account', data),
  deleteAccount: (accountId) => ipcRenderer.invoke('delete-account', accountId),
  getAccountInvoices: (accountId) => ipcRenderer.invoke('get-account-invoices', accountId),
  addInvoiceDetail: (accountId, detail) => ipcRenderer.invoke('add-invoice-detail', accountId, detail),
  getInvoices: () => ipcRenderer.invoke('get-invoices'),
  saveInvoice: (invoice) => ipcRenderer.invoke('save-invoice', invoice),
  getCompanyHeader: () => ipcRenderer.invoke('get-company-header')
});