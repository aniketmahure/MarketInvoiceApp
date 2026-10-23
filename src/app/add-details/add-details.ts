import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Invoice } from '../../service/invoice';

@Component({
  imports: [CommonModule, FormsModule],
  standalone: true,
  selector: 'app-add-details',
  styleUrl: './add-details.css',
  templateUrl: './add-details.html',
})

export class AddDetails implements OnInit {
  @Input() account: any;
  @Output() back = new EventEmitter<void>();

  currentDate = '';
  currentRate: number = 0;
  noOfBags: number = 0;
  totalWeight: number = 0;
  errorMessage = '';

  constructor(private invoiceService: Invoice) {}

  ngOnInit() {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    this.currentDate = `${day}/${month}/${year}`;
  }

  get totalAmount(): number {
    const weight = Number(this.totalWeight) || 0;
    const bags = Number(this.noOfBags) || 0;
    const rate = Number(this.currentRate) || 0;
    return rate * (weight - bags);
  }

  onClear() {
    this.currentRate = 0;
    this.noOfBags = 0;
    this.totalWeight = 0;
  }

  async onAdd() {
    if (this.currentRate <= 0 || this.totalWeight <= 0) {
      alert('Please enter valid rate and total weight.');
      return;
    }

    this.errorMessage = '';
    try {
      await this.invoiceService.addInvoiceDetail(this.account.accountId, {
        date: this.currentDate,
        rate: this.currentRate,
        bags: this.noOfBags,
        weight: this.totalWeight,
        amount: this.totalAmount
      });

      alert('Details added successfully to CSV!');
      this.back.emit();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : String(error);
    }
  }

  onCancel() {
    this.back.emit();
  }
}