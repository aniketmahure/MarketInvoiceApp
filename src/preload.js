const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  createAccount: (data) => ipcRenderer.invoke('create-account', data),
  deleteAccount: (accountId) => ipcRenderer.invoke('delete-account', accountId),
  getAccountInvoices: (accountId) => ipcRenderer.invoke('get-account-invoices', accountId),
  addInvoiceDetail: (accountId, detail) => ipcRenderer.invoke('add-invoice-detail', accountId, detail),
  addAdvanceDetail: (accountId, detail) => ipcRenderer.invoke('add-advance-detail', accountId, detail),
  deleteInvoiceDetail: (accountId, recordId) => ipcRenderer.invoke('delete-invoice-detail', accountId, recordId),
  getInvoices: () => ipcRenderer.invoke('get-invoices'),
  saveInvoice: (invoice) => ipcRenderer.invoke('save-invoice', invoice),
  getCompanyHeader: () => ipcRenderer.invoke('get-company-header')
});