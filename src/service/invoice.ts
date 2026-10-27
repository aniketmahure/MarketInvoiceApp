import { Injectable } from '@angular/core';

export interface CustomerAccount {
  accountId: string;
  name: string;
  surname: string;
  mobile: string;
  address: string;
  fileName: string;
  folderName: string;
  createdAt: string;
}

export interface InvoiceDetail {
  date: string;
  rate: number;
  bags: number;
  weight: number;
  amount: number;
}

@Injectable({
  providedIn: 'root'
})
export class Invoice {
  async getAccounts(query = ''): Promise<CustomerAccount[]> {
    const accounts: CustomerAccount[] = window.api?.getAccounts
      ? await window.api.getAccounts()
      : JSON.parse(localStorage.getItem('market_accounts') || '[]');
    if (!query) return accounts;
    const normalizedQuery = query.toLowerCase();
    return accounts.filter((account) =>
      account.name.toLowerCase().includes(normalizedQuery) ||
      account.surname.toLowerCase().includes(normalizedQuery) ||
      account.accountId.toLowerCase().includes(normalizedQuery)
    );
  }

  async createAccount(data: { name: string; surname: string; mobile?: string; address: string }): Promise<CustomerAccount> {
    const accountId = 'ACC-' + Math.floor(1000 + Math.random() * 9000);
    const newAccount = {
      accountId,
      name: data.name,
      surname: data.surname,
      mobile: data.mobile || '',
      address: data.address,
      folderName: `${data.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${accountId}`,
      fileName: 'account.csv',
      createdAt: new Date().toISOString()
    };
    if (window.api?.createAccount) {
      return window.api.createAccount(newAccount);
    }

    const accounts = JSON.parse(localStorage.getItem('market_accounts') || '[]');
    accounts.push(newAccount);
    localStorage.setItem('market_accounts', JSON.stringify(accounts));
    return newAccount;
  }

  async deleteAccount(accountId: string): Promise<void> {
    if (window.api?.deleteAccount) {
      await window.api.deleteAccount(accountId);
      return;
    }

    const accounts: CustomerAccount[] = JSON.parse(localStorage.getItem('market_accounts') || '[]');
    localStorage.setItem(
      'market_accounts',
      JSON.stringify(accounts.filter((account) => account.accountId !== accountId))
    );
    localStorage.removeItem(`invoices_${accountId}`);
  }

  async getInvoices(accountId: string, viewAll = false): Promise<InvoiceDetail[]> {
    const allInvoices: InvoiceDetail[] = window.api?.getAccountInvoices
      ? await window.api.getAccountInvoices(accountId)
      : JSON.parse(localStorage.getItem(`invoices_${accountId}`) || '[]');
    if (viewAll) return allInvoices;
    
    // Filter last 6 months by default
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    return allInvoices.filter((invoice) => {
      const [day, month, year] = invoice.date.split('/').map(Number);
      const invoiceDate = new Date(year, month - 1, day);
      return !Number.isNaN(invoiceDate.getTime()) && invoiceDate >= sixMonthsAgo;
    });
  }

  async addInvoiceDetail(accountId: string, detail: InvoiceDetail): Promise<void> {
    if (window.api?.addInvoiceDetail) {
      await window.api.addInvoiceDetail(accountId, detail);
      return;
    }

    const key = `invoices_${accountId}`;
    const invoices = JSON.parse(localStorage.getItem(key) || '[]');
    invoices.push(detail);
    localStorage.setItem(key, JSON.stringify(invoices));
  }

  async getCompanyHeader(): Promise<string[]> {
    // If running in Electron, fetch from local file via IPC
    if (window.api && window.api.getCompanyHeader) {
      console.log("Fetching company header from Electron IPC");
      return await window.api.getCompanyHeader();
    }
    // Fallback for browser testing
    return [
      "D.S. Green Chilli Suppliers",
      "Shree Gajanan Prasanna",
      "At Post Kachurwahi, Tah. Ramtek, Dist Nagpur",
      "Ph: 9561069363 | License No: 1234524-25"
    ];
  }
}
