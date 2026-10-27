import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Invoice } from '../../service/invoice';

@Component({
  imports: [CommonModule, FormsModule],
  selector: 'app-create-account',
  styleUrl: './create-account.css',
  templateUrl: './create-account.html',
})

export class CreateAccount {
  name = '';
  surname = '';
  mobile = '';
  address = '';
  errorMessage = '';
  
  @Output() back = new EventEmitter<void>();

  constructor(private invoiceService: Invoice) {}

  async onCreate() {
    if (!this.name || !this.surname) {
      alert('Please enter Name and Surname.');
      return;
    }

    if (!this.address) {
      alert('Please enter Address.');
      return;
    }

    this.errorMessage = '';
    try {
      const newAcc = await this.invoiceService.createAccount({
        name: this.name,
        surname: this.surname,
        mobile: this.mobile,
        address: this.address
      });

      alert(`Account created successfully in ${newAcc.folderName}/${newAcc.fileName}! ID: ${newAcc.accountId}`);
      this.back.emit();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : String(error);
    }
  }

  onCancel() {
    this.back.emit();
  }
}
