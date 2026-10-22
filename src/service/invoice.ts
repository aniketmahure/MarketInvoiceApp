import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class Invoice {
    // Mock or Electron IPC bridge methods
  async getAccounts(query: string = '') {
    // In Electron, this calls window.api.getAccounts(query)
    const accounts = JSON.parse(localStorage.getItem('market_accounts') || '[]');
    if (!query) return accounts;
    const q = query.toLowerCase();
    return accounts.filter((acc: any) => 
      acc.name.toLowerCase().includes(q) || 
      acc.surname.toLowerCase().includes(q) || 
      acc.accountId.toLowerCase().includes(q)
    );
  }

  async createAccount(data: { name: string; surname: string; mobile?: string }) {
    const accounts = JSON.parse(localStorage.getItem('market_accounts') || '[]');
    const accountId = 'ACC-' + Math.floor(1000 + Math.random() * 9000);
    const newAccount = {
      accountId,
      name: data.name,
      surname: data.surname,
      mobile: data.mobile || '',
      fileName: `${data.name}_${accountId}.csv`,
      createdAt: new Date().toISOString()
    };
    accounts.push(newAccount);
    localStorage.setItem('market_accounts', JSON.stringify(accounts));
    return newAccount;
  }

  async getInvoices(accountId: string, viewAll: boolean = false) {
    const allInvoices = JSON.parse(localStorage.getItem(`invoices_${accountId}`) || '[]');
    if (viewAll) return allInvoices;
    
    // Filter last 6 months by default
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    return allInvoices.filter((inv: any) => {
      const [day, month, year] = inv.date.split('/');
      const invDate = new Date(`${year}-${month}-${day}`);
      return invDate >= sixMonthsAgo;
    });
  }

  async addInvoiceDetail(accountId: string, detail: { date: string; rate: number; bags: number; weight: number; amount: number }) {
    const key = `invoices_${accountId}`;
    const invoices = JSON.parse(localStorage.getItem(key) || '[]');
    invoices.push(detail);
    localStorage.setItem(key, JSON.stringify(invoices));
  }
}
