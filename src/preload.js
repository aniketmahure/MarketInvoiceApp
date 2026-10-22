const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getInvoices: () => ipcRenderer.invoke('get-invoices'),
  saveInvoice: (invoice) => ipcRenderer.invoke('save-invoice', invoice)
});