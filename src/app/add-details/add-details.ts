import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Invoice } from '../../service/invoice';
import { OperationDeadline, OperationTimeoutError } from '../../service/operation-deadline';

@Component({
  imports: [CommonModule, FormsModule],
  standalone: true,
  selector: 'app-add-details',
  styleUrl: './add-details.css',
  templateUrl: './add-details.html',
})

export class AddDetails implements OnInit {
  @Input() account: any;
  @Input() labourChargePerBag = 7;
  @Output() back = new EventEmitter<void>();
  @Output() timedOut = new EventEmitter<void>();

  currentDate = '';
  currentRate: number = 0;
  noOfBags: number = 0;
  totalWeight: number = 0;
  errorMessage = '';
  isSaving = false;

  constructor(private invoiceService: Invoice) {}

  ngOnInit() {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    this.currentDate = `${today.getFullYear()}-${month}-${day}`;
  }

  get totalAmount(): number {
    const weight = Number(this.totalWeight) || 0;
    const bags = Number(this.noOfBags) || 0;
    const rate = Number(this.currentRate) || 0;
    return rate * (weight - bags);
  }

  onClear() {
    if (this.isSaving) return;
    this.currentRate = 0;
    this.noOfBags = 0;
    this.totalWeight = 0;
  }

  async onAdd() {
    if (this.isSaving) return;
    const date = this.formatDateForStorage(this.currentDate);
    if (!date) {
      this.errorMessage = 'Please select a valid date.';
      return;
    }

    if (this.currentRate <= 0 || this.totalWeight <= 0) {
      alert('Please enter valid rate and total weight.');
      return;
    }

    this.errorMessage = '';
    const accountId = this.account.accountId;
    this.isSaving = true;
    const deadline = new OperationDeadline();
    try {
      await deadline.wait(this.invoiceService.addInvoiceDetail(accountId, {
        date,
        rate: this.currentRate,
        bags: this.noOfBags,
        weight: this.totalWeight,
        amount: this.totalAmount,
        labourChargePerBag: Number(this.labourChargePerBag)
      }));
      this.back.emit();
    } catch (error) {
      if (error instanceof OperationTimeoutError) {
        this.timedOut.emit();
        return;
      }
      this.errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      this.isSaving = false;
    }
  }

  private formatDateForStorage(value: string): string | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;

    const [, year, month, day] = match;
    const parsedDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (
      parsedDate.getUTCFullYear() !== Number(year) ||
      parsedDate.getUTCMonth() !== Number(month) - 1 ||
      parsedDate.getUTCDate() !== Number(day)
    ) {
      return null;
    }

    return `${day}/${month}/${year}`;
  }

  onCancel() {
    if (this.isSaving) return;
    this.back.emit();
  }
}