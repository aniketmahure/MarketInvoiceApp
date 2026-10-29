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

  it('persists advance entries with hyphens in the invoice detail fields', async () => {
    await service.addAdvanceDetail('ACC-1234', '10/03/2026', 75.5);

    const savedEntries = JSON.parse(localStorage.getItem('invoices_ACC-1234') || '[]');
    expect(savedEntries).toEqual([
      {
        entryType: 'advance',
        date: '10/03/2026',
        rate: '-',
        bags: '-',
        weight: '-',
        amount: 75.5
      }
    ]);
    await expect(service.getInvoices('ACC-1234', true)).resolves.toEqual([
      { ...savedEntries[0], recordId: 0 }
    ]);
  });

  it('deletes only the selected invoice record from browser storage', async () => {
    const records = [
      { date: '10/03/2026', rate: 25, bags: 2, weight: 4, amount: 50 },
      { date: '10/03/2026', rate: 25, bags: 2, weight: 4, amount: 50 },
      { date: '11/03/2026', rate: 30, bags: 3, weight: 5, amount: 60 },
    ];
    localStorage.setItem('invoices_ACC-1234', JSON.stringify(records));

    const loadedRecords = await service.getInvoices('ACC-1234', true);
    await service.deleteInvoiceDetail('ACC-1234', loadedRecords[1].recordId!);

    expect(JSON.parse(localStorage.getItem('invoices_ACC-1234') || '[]'))
      .toEqual([records[0], records[2]]);
  });
});
