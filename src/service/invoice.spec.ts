import { TestBed } from '@angular/core/testing';
import { Invoice } from './invoice';

describe('Invoice', () => {
  let service: Invoice;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Invoice);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('deletes an account and its invoices from browser storage', async () => {
    localStorage.setItem('market_accounts', JSON.stringify([
      { accountId: 'ACC-1234', name: 'Ada', surname: 'Lovelace' },
      { accountId: 'ACC-5678', name: 'Grace', surname: 'Hopper' }
    ]));
    localStorage.setItem('invoices_ACC-1234', JSON.stringify([{ amount: 42 }]));

    await service.deleteAccount('ACC-1234');

    expect(JSON.parse(localStorage.getItem('market_accounts') || '[]'))
      .toEqual([{ accountId: 'ACC-5678', name: 'Grace', surname: 'Hopper' }]);
    expect(localStorage.getItem('invoices_ACC-1234')).toBeNull();
  });
});
