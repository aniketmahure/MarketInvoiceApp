import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Invoice, type CustomerAccount } from '../../service/invoice';
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
  accounts: CustomerAccount[] = [];
  selectedAccount: any = null;
  invoices: any[] = [];
  allInvoices: any[] = [];
  fromDate = '';
  toDate = '';
  viewAll = false;
  totalBags = 0;
  totalAmount = 0;
  totalAdvanceAmount = 0;
  labourChangesPerBag = 0;
  advanceDate = this.todayInputDate();
  advanceAmount = 0;
  advanceError = '';
  advanceSuccess = '';
  rate = 0;
  storageError = '';
  printFromDate = '—';
  printToDate = '—';
  
  // Navigation state: 'home' | 'create' | 'details' | 'add'
  currentView = 'home'; 

  constructor(
    private invoiceService: Invoice,
    private changeDetector: ChangeDetectorRef
  ) {}

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

  async listAllAccounts() {
    this.searchQuery = '';
    await this.loadAccounts();
  }

  async deleteAccount(account: CustomerAccount) {
    const accountName = `${account.name} ${account.surname}`;
    const confirmed = window.confirm(
      `Delete ${accountName} and permanently delete all of this account's details and invoices?`
    );
    if (!confirmed) return;

    try {
      await this.invoiceService.deleteAccount(account.accountId);
      await this.loadAccounts();
    } catch (error) {
      this.storageError = this.errorMessage(error);
    }
  }

  goToCreate() {
    this.currentView = 'create';
  }

  async selectAccount(account: any) {
    if (this.selectedAccount?.accountId !== account.accountId) {
      this.fromDate = '';
      this.toDate = '';
      this.labourChangesPerBag = 0;
      this.printFromDate = '—';
      this.printToDate = '—';
    }
    this.selectedAccount = account;
    this.viewAll = false;
    this.advanceDate = this.todayInputDate();
    this.advanceAmount = 0;
    this.advanceError = '';
    this.advanceSuccess = '';
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
      this.invoices = this.allInvoices
        .filter((invoice) => {
          const invoiceDate = this.parseDate(invoice.date);
          return invoiceDate !== null &&
            (startDate === null || invoiceDate >= startDate) &&
            (endDate === null || invoiceDate <= endDate);
        })
        .sort((first, second) =>
          this.parseDate(first.date)! - this.parseDate(second.date)!
        );
    }

    this.calculateTotals();
    this.updatePrintDateRange();
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

  private formatDate(timestamp: number | null): string {
    if (timestamp === null) return '—';

    const date = new Date(timestamp);
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${date.getUTCFullYear()}`;
  }

  formatTableDate(value: string): string {
    if (!value.includes('-')) return value;
    return this.formatDate(this.parseDate(value));
  }

  private todayInputDate(): string {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${today.getFullYear()}-${month}-${day}`;
  }

  private updatePrintDateRange() {
    const invoiceDates = this.invoices
      .map((invoice) => this.parseDate(invoice.date))
      .filter((date): date is number => date !== null);

    this.printFromDate = invoiceDates.length
      ? this.formatDate(Math.min(...invoiceDates))
      : '—';
    this.printToDate = invoiceDates.length
      ? this.formatDate(Math.max(...invoiceDates))
      : '—';
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
    this.totalBags = this.invoices.reduce(
      (sum, inv) => sum + (inv.entryType === 'advance' ? 0 : Number(inv.bags) || 0),
      0
    );
    this.totalAmount = this.invoices.reduce(
      (sum, inv) => sum + (inv.entryType === 'advance' ? 0 : Number(inv.amount) || 0),
      0
    );
    this.totalAdvanceAmount = this.invoices.reduce(
      (sum, inv) => sum + (inv.entryType === 'advance' ? Number(inv.amount) || 0 : 0),
      0
    );
  }

  get totalLabourChanges(): number {
    return this.totalBags * (Number(this.labourChangesPerBag) || 0);
  }

  get netTotalAmount(): number {
    return this.totalAmount - this.totalLabourChanges - this.totalAdvanceAmount;
  }

  async recordAdvance() {
    if (this.parseDate(this.advanceDate) === null ||
        !Number.isFinite(Number(this.advanceAmount)) || Number(this.advanceAmount) <= 0) {
      this.advanceError = 'Please select a valid date and enter an advance amount greater than zero.';
      this.advanceSuccess = '';
      return;
    }

    this.advanceError = '';
    this.advanceSuccess = '';
    try {
      const date = this.formatTableDate(this.advanceDate);
      await this.invoiceService.addAdvanceDetail(
        this.selectedAccount.accountId,
        date,
        Number(this.advanceAmount)
      );
      await this.loadInvoicesData();
      this.advanceAmount = 0;
      this.advanceSuccess = 'Advance recorded successfully.';
      this.storageError = '';
    } catch (error) {
      this.advanceError = this.errorMessage(error);
    }
  }

  goToAddDetails() {
    this.currentView = 'add';
  }

  async backToDetails() {
    this.currentView = 'details';
    try {
      await this.loadInvoicesData();
      this.storageError = '';
    } catch (error) {
      this.storageError = this.errorMessage(error);
    } finally {
      this.changeDetector.markForCheck();
    }
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