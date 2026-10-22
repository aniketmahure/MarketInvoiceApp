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
  
  @Output() back = new EventEmitter<void>();

  constructor(private invoiceService: Invoice) {}

  async onCreate() {
    if (!this.name || !this.surname) {
      alert('Please enter Name and Surname.');
      return;
    }

    const newAcc = await this.invoiceService.createAccount({
      name: this.name,
      surname: this.surname,
      mobile: this.mobile
    });

    alert(`Account created successfully in ${newAcc.fileName}! ID: ${newAcc.accountId}`);
    this.back.emit();
  }

  onCancel() {
    this.back.emit();
  }
}
