import { TestBed } from '@angular/core/testing';
import { Invoice } from './invoice';

describe('Invoice', () => {
  let service: Invoice;

  beforeEach(() => {
    localStorage.clear();
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
        amount: 75.5,
        labourChargePerBag: 7
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

  it('persists closure entries and rejects backdated entries afterward', async () => {
    await service.addInvoiceDetail('ACC-1234', {
      date: '01/10/2026',
      rate: 10,
      bags: 2,
      weight: 5,
      amount: 20,
      labourChargePerBag: 7
    });
    await service.addClosureDetail('ACC-1234', '02/10/2026', 7);

    await expect(service.getInvoices('ACC-1234', true)).resolves.toEqual([
      {
        date: '01/10/2026',
        rate: 10,
        bags: 2,
        weight: 5,
        amount: 20,
        labourChargePerBag: 7,
        recordId: 0
      },
      { entryType: 'closure', date: '02/10/2026', labourChargePerBag: 7, recordId: 1 },
    ]);
    await expect(service.addAdvanceDetail('ACC-1234', '01/10/2026', 5))
      .rejects.toThrow('New details cannot be dated before the latest closure.');
    await expect(service.addAdvanceDetail('ACC-1234', '02/10/2026', 5)).resolves.toBeUndefined();
  });

  it('does not allow closing a period without invoice or advance activity', async () => {
    await expect(service.addClosureDetail('ACC-1234', '02/10/2026'))
      .rejects.toThrow('Add at least one invoice or advance before closing this period.');
  });

  it('stores the period labour charge and changes only the ongoing period', async () => {
    await service.updateCurrentPeriodLabourCharge('ACC-1234', 4.5);
    await service.addInvoiceDetail('ACC-1234', {
      date: '01/10/2026',
      rate: 10,
      bags: 2,
      weight: 5,
      amount: 20,
      labourChargePerBag: 4.5
    });
    await service.addClosureDetail('ACC-1234', '02/10/2026', 4.5);

    await service.updateCurrentPeriodLabourCharge('ACC-1234', 8);
    await service.addAdvanceDetail('ACC-1234', '03/10/2026', 15, 8);

    const records = JSON.parse(localStorage.getItem('invoices_ACC-1234') || '[]');
    expect(records.map((record: { labourChargePerBag?: number }) =>
      record.labourChargePerBag
    )).toEqual([4.5, 4.5, 4.5, 8, 8]);
    const savedEntries = await service.getInvoices('ACC-1234', true);
    expect(savedEntries.map((record) => [record.entryType ?? 'invoice', record.labourChargePerBag]))
      .toEqual([
        ['labour', 4.5],
        ['invoice', 4.5],
        ['closure', 4.5],
        ['labour', 8],
        ['advance', 8]
      ]);
  });
});
