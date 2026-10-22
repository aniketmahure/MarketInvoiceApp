import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Invoice } from '../../service/invoice';
import { AddDetails } from '../add-details/add-details';
import { CreateAccount } from '../create-account/create-account';

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [CommonModule, FormsModule, CreateAccount, AddDetails],
  templateUrl: './accounts.html',
  styleUrls: ['./accounts.css']
})
export class Accounts implements OnInit {
  searchQuery = '';
  accounts: any[] = [];
  selectedAccount: any = null;
  invoices: any[] = [];
  viewAll = false;
  totalBags = 0;
  totalAmount = 0;
  rate = 0;
  
  // Navigation state: 'home' | 'create' | 'details' | 'add'
  currentView = 'home'; 

  constructor(private invoiceService: Invoice) {}

  async ngOnInit() {
    await this.loadAccounts();
  }

  async loadAccounts() {
    this.accounts = await this.invoiceService.getAccounts(this.searchQuery);
  }

  async onSearch() {
    await this.loadAccounts();
  }

  goToCreate() {
    this.currentView = 'create';
  }

  async selectAccount(account: any) {
    this.selectedAccount = account;
    this.viewAll = false;
    await this.loadInvoicesData();
    this.currentView = 'details';
  }

  async loadInvoicesData() {
    this.invoices = await this.invoiceService.getInvoices(this.selectedAccount.accountId, this.viewAll);
    this.calculateTotals();
  }

  async toggleViewAll() {
    this.viewAll = !this.viewAll;
    await this.loadInvoicesData();
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

  backToHome() {
    this.currentView = 'home';
    this.selectedAccount = null;
  }
}