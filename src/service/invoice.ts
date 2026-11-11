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
  rate?: number | '-';
  bags?: number | '-';
  weight?: number | '-';
  amount?: number;
  labourChargePerBag?: number;
  entryType?: 'advance' | 'closure' | 'labour';
  recordId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class Invoice {
  private parseDate(value: string): number | null {
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

  private assertDateAllowed(records: InvoiceDetail[], date: string): void {
    const dateTimestamp = this.parseDate(date);
    if (dateTimestamp === null) throw new Error('A valid invoice date is required.');

    const lastClosure = [...records].reverse().find((record) => record.entryType === 'closure');
    if (!lastClosure) return;

    const closureTimestamp = this.parseDate(lastClosure.date);
    if (closureTimestamp === null) throw new Error('The saved closure date is invalid.');
    if (dateTimestamp < closureTimestamp) {
      throw new Error('New details cannot be dated before the latest closure.');
    }
  }

  private assertLabourRateAllowed(records: InvoiceDetail[], labourChargePerBag: number): void {
    if (!Number.isFinite(labourChargePerBag) || labourChargePerBag < 0) {
      throw new Error('Labour charges per bag must be a valid amount of zero or more.');
    }

    const lastClosureIndex = records.reduce(
      (lastIndex, record, index) => record.entryType === 'closure' ? index : lastIndex,
      -1
    );
    const existingRate = records.slice(lastClosureIndex + 1)
      .reverse()
      .find((record) => Number.isFinite(record.labourChargePerBag))
      ?.labourChargePerBag;
    if (existingRate !== undefined && existingRate !== labourChargePerBag) {
      throw new Error('Save the labour charge for this period before adding details.');
    }
  }

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
      : (JSON.parse(localStorage.getItem(`invoices_${accountId}`) || '[]') as InvoiceDetail[])
        .map((invoice, recordId) => ({ ...invoice, recordId }));
    if (viewAll) return allInvoices;
    
    // Filter last 6 months by default
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    return allInvoices.filter((invoice) => {
      const invoiceDate = this.parseDate(invoice.date);
      return invoiceDate !== null && invoiceDate >= Date.UTC(
        sixMonthsAgo.getFullYear(),
        sixMonthsAgo.getMonth(),
        sixMonthsAgo.getDate()
      );
    });
  }

  async addInvoiceDetail(accountId: string, detail: InvoiceDetail): Promise<void> {
    const labourChargePerBag = detail.labourChargePerBag ?? 7;
    if (window.api?.addInvoiceDetail) {
      await window.api.addInvoiceDetail(accountId, { ...detail, labourChargePerBag });
      return;
    }

    const key = `invoices_${accountId}`;
    const invoices: InvoiceDetail[] = JSON.parse(localStorage.getItem(key) || '[]');
    this.assertDateAllowed(invoices, detail.date);
    this.assertLabourRateAllowed(invoices, labourChargePerBag);
    invoices.push({ ...detail, labourChargePerBag });
    localStorage.setItem(key, JSON.stringify(invoices));
  }

  async addAdvanceDetail(
    accountId: string,
    date: string,
    amount: number,
    labourChargePerBag = 7
  ): Promise<void> {
    if (window.api?.addAdvanceDetail) {
      await window.api.addAdvanceDetail(accountId, { date, amount, labourChargePerBag });
      return;
    }

    const key = `invoices_${accountId}`;
    const invoices: InvoiceDetail[] = JSON.parse(localStorage.getItem(key) || '[]');
    this.assertDateAllowed(invoices, date);
    this.assertLabourRateAllowed(invoices, labourChargePerBag);
    invoices.push({
      entryType: 'advance',
      date,
      rate: '-',
      bags: '-',
      weight: '-',
      amount,
      labourChargePerBag
    });
    localStorage.setItem(key, JSON.stringify(invoices));
  }

  async addClosureDetail(accountId: string, date: string, labourChargePerBag = 7): Promise<void> {
    if (window.api?.addClosureDetail) {
      await window.api.addClosureDetail(accountId, { date, labourChargePerBag });
      return;
    }

    const key = `invoices_${accountId}`;
    const invoices: InvoiceDetail[] = JSON.parse(localStorage.getItem(key) || '[]');
    const lastClosureIndex = invoices.reduce(
      (lastIndex, record, index) => record.entryType === 'closure' ? index : lastIndex,
      -1
    );
    const activeRecords = invoices.slice(lastClosureIndex + 1)
      .filter((record) => record.entryType === undefined || record.entryType === 'advance');
    if (activeRecords.length === 0) {
      throw new Error('Add at least one invoice or advance before closing this period.');
    }

    const closureTimestamp = this.parseDate(date);
    if (closureTimestamp === null) throw new Error('A valid closure date is required.');
    this.assertDateAllowed(invoices, date);
    const latestEntryDate = activeRecords.reduce((latest, record) => {
      const entryDate = this.parseDate(record.date);
      if (entryDate === null) throw new Error('A saved invoice date is invalid.');
      return Math.max(latest, entryDate);
    }, 0);
    if (closureTimestamp < latestEntryDate) {
      throw new Error('The closure date cannot be before the latest invoice or advance.');
    }

    this.assertLabourRateAllowed(invoices, labourChargePerBag);
    invoices.push({ entryType: 'closure', date, labourChargePerBag });
    localStorage.setItem(key, JSON.stringify(invoices));
  }

  async updateCurrentPeriodLabourCharge(accountId: string, labourChargePerBag: number): Promise<void> {
    if (!Number.isFinite(labourChargePerBag) || labourChargePerBag < 0) {
      throw new Error('Labour charges per bag must be a valid amount of zero or more.');
    }
    if (window.api?.updateCurrentPeriodLabourCharge) {
      await window.api.updateCurrentPeriodLabourCharge(accountId, labourChargePerBag);
      return;
    }

    const key = `invoices_${accountId}`;
    const invoices: InvoiceDetail[] = JSON.parse(localStorage.getItem(key) || '[]');
    const lastClosureIndex = invoices.reduce(
      (lastIndex, record, index) => record.entryType === 'closure' ? index : lastIndex,
      -1
    );
    const currentPeriod = invoices.slice(lastClosureIndex + 1);
    let updatedDetails = false;
    for (const record of currentPeriod) {
      if (record.entryType === 'labour') {
        record.labourChargePerBag = labourChargePerBag;
      } else {
        record.labourChargePerBag = labourChargePerBag;
        updatedDetails = true;
      }
    }
    if (!updatedDetails && !currentPeriod.some((record) => record.entryType === 'labour')) {
      invoices.push({
        entryType: 'labour',
        date: '',
        labourChargePerBag
      });
    }
    localStorage.setItem(key, JSON.stringify(invoices));
  }

  async deleteInvoiceDetail(accountId: string, recordId: number): Promise<void> {
    if (window.api?.deleteInvoiceDetail) {
      await window.api.deleteInvoiceDetail(accountId, recordId);
      return;
    }

    const key = `invoices_${accountId}`;
    const invoices: InvoiceDetail[] = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Number.isInteger(recordId) || recordId < 0 || recordId >= invoices.length ||
        invoices[recordId].entryType === 'closure') {
      throw new Error('The selected invoice record was not found.');
    }

    invoices.splice(recordId, 1);
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
