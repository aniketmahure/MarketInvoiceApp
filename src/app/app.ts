import { Component } from '@angular/core';
import { Accounts } from './accounts/accounts';
import { Navbar } from './navbar/navbar';

@Component({
  imports: [Accounts, Navbar],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
}
