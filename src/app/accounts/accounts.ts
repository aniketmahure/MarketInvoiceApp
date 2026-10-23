import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Invoice } from '../../service/invoice';
import { AddDetails } from '../add-details/add-details';
import { CreateAccount } from '../create-account/create-account';
import { Navbar } from '../navbar/navbar';

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [CommonModule, FormsModule, CreateAccount, AddDetails, Navbar],
  templateUrl: './accounts.html',
  styleUrls: ['./accounts.css']
})
export class Accounts implements OnInit {
  searchQuery = '';
  accounts: any[] = [];
  selectedAccount: any = null;
  invoices: any[] = [];
  allInvoices: any[] = [];
  fromDate = '';
  toDate = '';
  viewAll = false;
  totalBags = 0;
  totalAmount = 0;
  rate = 0;
  storageError = '';
  
  // Navigation state: 'home' | 'create' | 'details' | 'add'
  currentView = 'home'; 

  constructor(private invoiceService: Invoice) {}

  async ngOnInit() {
    await this.loadAccounts();
  }

  async loadAccounts() {
    try {
      this.accounts = await this.invoiceService.getAccounts(this.searchQuery);
      this.storageError = '';
    } catch (error) {
      this.accounts = [];
      this.storageError = this.errorMessage(error);
    }
  }

  async onSearch() {
    await this.loadAccounts();
  }

  goToCreate() {
    this.currentView = 'create';
  }

  async selectAccount(account: any) {
    if (this.selectedAccount?.accountId !== account.accountId) {
      this.fromDate = '';
      this.toDate = '';
    }
    this.selectedAccount = account;
    this.viewAll = false;
    try {
      await this.loadInvoicesData();
      this.storageError = '';
      this.currentView = 'details';
    } catch (error) {
      this.storageError = this.errorMessage(error);
    }
  }

  async loadInvoicesData() {
    this.allInvoices = await this.invoiceService.getInvoices(this.selectedAccount.accountId, this.viewAll);
    this.applyDateRange();
  }

  applyDateRange() {
    const startDate = this.fromDate ? this.parseDate(this.fromDate) : null;
    const endDate = this.toDate ? this.parseDate(this.toDate) : null;

    if ((this.fromDate && startDate === null) || (this.toDate && endDate === null) ||
        (startDate !== null && endDate !== null && startDate > endDate)) {
      this.invoices = [];
    } else {
      this.invoices = this.allInvoices.filter((invoice) => {
        const invoiceDate = this.parseDate(invoice.date);
        return invoiceDate !== null &&
          (startDate === null || invoiceDate >= startDate) &&
          (endDate === null || invoiceDate <= endDate);
      });
    }

    this.calculateTotals();
  }

  clearDateRange() {
    this.fromDate = '';
    this.toDate = '';
    this.applyDateRange();
  }

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

  async toggleViewAll() {
    this.viewAll = !this.viewAll;
    try {
      await this.loadInvoicesData();
      this.storageError = '';
    } catch (error) {
      this.storageError = this.errorMessage(error);
    }
  }

  calculateTotals() {
    this.totalBags = this.invoices.reduce((sum, inv) => sum + Number(inv.bags), 0);
    this.totalAmount = this.invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
  }

  goToAddDetails() {
    this.currentView = 'add';
  }

  printInvoice() {
    window.print();
  }

  async backToHome() {
    this.currentView = 'home';
    this.selectedAccount = null;
    await this.loadAccounts();
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}