import { Component } from '@angular/core';
import { Accounts } from './accounts/accounts';

@Component({
  imports: [Accounts],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
}
