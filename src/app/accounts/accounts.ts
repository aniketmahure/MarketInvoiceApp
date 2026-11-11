import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Invoice, type CustomerAccount, type InvoiceDetail } from '../../service/invoice';
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
  invoices: InvoiceDetail[] = [];
  allInvoices: InvoiceDetail[] = [];
  closurePeriods: InvoiceDetail[][] = [];
  closurePeriodIndex = -1;
  selectedClosureYear = 'all';
  totalBags = 0;
  totalAmount = 0;
  totalAdvanceAmount = 0;
  labourChangesPerBag = 7;
  savedLabourChargePerBag: number | null = null;
  advanceDate = this.todayInputDate();
  advanceAmount = 0;
  advanceError = '';
  advanceSuccess = '';
  closureError = '';
  labourError = '';
  labourSuccess = '';
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
      this.labourChangesPerBag = 7;
      this.savedLabourChargePerBag = null;
      this.printFromDate = '—';
      this.printToDate = '—';
      this.closurePeriodIndex = -1;
    }
    this.selectedAccount = account;
    this.selectedClosureYear = 'all';
    this.advanceDate = this.todayInputDate();
    this.advanceAmount = 0;
    this.advanceError = '';
    this.advanceSuccess = '';
    this.closureError = '';
    try {
      await this.loadInvoicesData();
      this.storageError = '';
      this.currentView = 'details';
    } catch (error) {
      this.storageError = this.errorMessage(error);
    }
  }

  async loadInvoicesData() {
    this.allInvoices = await this.invoiceService.getInvoices(this.selectedAccount.accountId, true);
    this.rebuildClosurePeriods();
    this.loadSelectedPeriodLabourCharge();
    this.applySelectedPeriod();
  }

  applySelectedPeriod() {
    const periodEntries = this.visibleClosurePeriods[this.closurePeriodIndex] ?? [];
    this.invoices = periodEntries
      .filter((invoice) => invoice.entryType !== 'labour')
      .sort((first, second) => {
        const dateOrder = (this.parseDate(first.date) ?? 0) -
          (this.parseDate(second.date) ?? 0);
        return dateOrder || (first.recordId ?? 0) - (second.recordId ?? 0);
      });

    this.calculateTotals();
    this.updatePrintDateRange();
  }

  get closureYears(): string[] {
    return [...new Set(this.allInvoices
      .filter((invoice) => invoice.entryType === 'closure')
      .map((invoice) => {
        const timestamp = this.parseDate(invoice.date);
        return timestamp === null ? '' : String(new Date(timestamp).getUTCFullYear());
      })
      .filter(Boolean))]
      .sort((first, second) => Number(second) - Number(first));
  }

  get visibleClosurePeriods(): InvoiceDetail[][] {
    if (this.selectedClosureYear === 'all') return this.closurePeriods;
    return this.closurePeriods.filter((period) => {
      const closure = period.find((record) => record.entryType === 'closure');
      if (!closure) return false;
      const timestamp = this.parseDate(closure.date);
      return timestamp !== null &&
        String(new Date(timestamp).getUTCFullYear()) === this.selectedClosureYear;
    });
  }

  selectClosureYear(year: string) {
    this.selectedClosureYear = year;
    this.closurePeriodIndex = this.visibleClosurePeriods.length - 1;
    this.loadSelectedPeriodLabourCharge();
    this.applySelectedPeriod();
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

  private rebuildClosurePeriods() {
    const records = [...this.allInvoices].sort((first, second) => {
      if (first.recordId !== undefined && second.recordId !== undefined) {
        return first.recordId - second.recordId;
      }
      return (this.parseDate(first.date) ?? 0) - (this.parseDate(second.date) ?? 0);
    });
    const periods: InvoiceDetail[][] = [];
    let activePeriod: InvoiceDetail[] = [];

    for (const record of records) {
      if (record.entryType === 'closure') {
        activePeriod.push(record);
        periods.push(activePeriod);
        activePeriod = [];
      } else {
        activePeriod.push(record);
      }
    }

    periods.push(activePeriod);
    this.closurePeriods = periods;
    if (this.closurePeriodIndex < 0 ||
        this.closurePeriodIndex >= this.visibleClosurePeriods.length) {
      this.closurePeriodIndex = this.visibleClosurePeriods.length - 1;
    } else {
      this.closurePeriodIndex = Math.min(
        this.closurePeriodIndex,
        this.visibleClosurePeriods.length - 1
      );
    }
  }

  private loadSelectedPeriodLabourCharge() {
    const period = this.visibleClosurePeriods[this.closurePeriodIndex] ?? [];
    this.savedLabourChargePerBag = [...period].reverse()
      .find((record) => Number.isFinite(record.labourChargePerBag))
      ?.labourChargePerBag ?? null;
    this.labourChangesPerBag = this.savedLabourChargePerBag ?? 7;
  }

  get canEditLabourCharge(): boolean {
    return this.selectedClosureYear === 'all' &&
      this.closurePeriodIndex === this.visibleClosurePeriods.length - 1;
  }

  async onLabourChargeCommit() {
    const labourChargePerBag = Number(this.labourChangesPerBag);
    if (!this.canEditLabourCharge || !Number.isFinite(labourChargePerBag) ||
        labourChargePerBag < 0) {
      this.labourError = 'Enter a valid labour charge of zero or more for the current period.';
      this.labourSuccess = '';
      this.labourChangesPerBag = this.savedLabourChargePerBag ?? 7;
      return;
    }

    if (this.savedLabourChargePerBag === labourChargePerBag) return;
    if (this.savedLabourChargePerBag !== null &&
        !window.confirm('Do you want to make changes in Labour charges?')) {
      this.labourChangesPerBag = this.savedLabourChargePerBag;
      this.labourError = '';
      this.labourSuccess = '';
      return;
    }

    this.labourError = '';
    this.labourSuccess = '';
    try {
      await this.invoiceService.updateCurrentPeriodLabourCharge(
        this.selectedAccount.accountId,
        labourChargePerBag
      );
      await this.loadInvoicesData();
      this.labourSuccess = 'Labour charge saved for this period.';
      this.storageError = '';
    } catch (error) {
      this.labourError = this.errorMessage(error);
      this.labourChangesPerBag = this.savedLabourChargePerBag ?? 7;
    } finally {
      this.changeDetector.markForCheck();
    }
  }

  get canNavigateToPreviousPeriod(): boolean {
    return this.closurePeriodIndex > 0;
  }

  get canNavigateToNextPeriod(): boolean {
    return this.closurePeriodIndex >= 0 &&
      this.closurePeriodIndex < this.visibleClosurePeriods.length - 1;
  }

  get canCloseCurrentPeriod(): boolean {
    const period = this.visibleClosurePeriods[this.closurePeriodIndex] ?? [];
    return this.canEditLabourCharge &&
      !period.some((record) => record.entryType === 'closure') &&
      period.some((record) => record.entryType === undefined || record.entryType === 'advance');
  }

  get closurePeriodLabel(): string {
    return `Period ${Math.max(this.closurePeriodIndex + 1, 1)} of ${Math.max(this.visibleClosurePeriods.length, 1)}`;
  }

  previousClosurePeriod() {
    if (!this.canNavigateToPreviousPeriod) return;
    this.closurePeriodIndex -= 1;
    this.loadSelectedPeriodLabourCharge();
    this.applySelectedPeriod();
  }

  nextClosurePeriod() {
    if (!this.canNavigateToNextPeriod) return;
    this.closurePeriodIndex += 1;
    this.loadSelectedPeriodLabourCharge();
    this.applySelectedPeriod();
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

  calculateTotals() {
    this.totalBags = this.invoices.reduce(
      (sum, inv) => sum + (inv.entryType === 'advance' || inv.entryType === 'closure'
        ? 0
        : Number(inv.bags) || 0),
      0
    );
    this.totalAmount = this.invoices.reduce(
      (sum, inv) => sum + (inv.entryType === 'advance' || inv.entryType === 'closure'
        ? 0
        : Number(inv.amount) || 0),
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
      await this.invoiceService.updateCurrentPeriodLabourCharge(
        this.selectedAccount.accountId,
        Number(this.labourChangesPerBag)
      );
      await this.invoiceService.addAdvanceDetail(
        this.selectedAccount.accountId,
        date,
        Number(this.advanceAmount),
        Number(this.labourChangesPerBag)
      );
      await this.loadInvoicesData();
      this.closurePeriodIndex = this.visibleClosurePeriods.length - 1;
      this.loadSelectedPeriodLabourCharge();
      this.applySelectedPeriod();
      this.advanceAmount = 0;
      this.advanceSuccess = 'Advance recorded successfully.';
      this.storageError = '';
    } catch (error) {
      this.advanceError = this.errorMessage(error);
    } finally {
      this.changeDetector.markForCheck();
    }
  }

  async closeCurrentPeriod() {
    if (!this.canCloseCurrentPeriod) {
      this.closureError = 'Add at least one invoice or advance before closing this period.';
      return;
    }

    if (!window.confirm('Close this period? New details cannot be added to it afterward.')) {
      return;
    }

    this.closureError = '';
    try {
      await this.invoiceService.updateCurrentPeriodLabourCharge(
        this.selectedAccount.accountId,
        Number(this.labourChangesPerBag)
      );
      await this.invoiceService.addClosureDetail(
        this.selectedAccount.accountId,
        this.formatTableDate(this.todayInputDate()),
        Number(this.labourChangesPerBag)
      );
      this.closurePeriodIndex = -1;
      this.selectedClosureYear = 'all';
      await this.loadInvoicesData();
      this.closureError = '';
      this.storageError = '';
    } catch (error) {
      this.closureError = this.errorMessage(error);
    } finally {
      this.changeDetector.markForCheck();
    }
  }

  async deleteInvoice(invoice: InvoiceDetail) {
    if (invoice.recordId === undefined) {
      this.storageError = 'Unable to identify the selected invoice record.';
      return;
    }

    const recordType = invoice.entryType === 'advance' ? 'advance payment' : 'invoice';
    if (!window.confirm(`Delete this ${recordType} dated ${this.formatTableDate(invoice.date)}?`)) {
      return;
    }

    try {
      await this.invoiceService.deleteInvoiceDetail(
        this.selectedAccount.accountId,
        invoice.recordId
      );
      await this.loadInvoicesData();
      this.storageError = '';
    } catch (error) {
      this.storageError = this.errorMessage(error);
    }
  }

  async goToAddDetails() {
    if (!this.canEditLabourCharge) return;
    try {
      await this.invoiceService.updateCurrentPeriodLabourCharge(
        this.selectedAccount.accountId,
        Number(this.labourChangesPerBag)
      );
      this.labourError = '';
      this.currentView = 'add';
    } catch (error) {
      this.labourError = this.errorMessage(error);
    }
  }

  async backToDetails() {
    this.currentView = 'details';
    try {
      await this.loadInvoicesData();
      this.closurePeriodIndex = this.visibleClosurePeriods.length - 1;
      this.loadSelectedPeriodLabourCharge();
      this.applySelectedPeriod();
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