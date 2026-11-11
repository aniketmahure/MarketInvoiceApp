import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Accounts } from './accounts';
import { Invoice } from '../../service/invoice';

describe('Accounts', () => {
  let component: Accounts;
  let fixture: ComponentFixture<Accounts>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Accounts],
    }).compileComponents();

    fixture = TestBed.createComponent(Accounts);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('returns to invoice details immediately while refreshing invoices', async () => {
    const invoiceService = TestBed.inject(Invoice);
    vi.spyOn(invoiceService, 'getInvoices').mockResolvedValue([
      { date: '10/03/2026', rate: 25, bags: 2, weight: 4, amount: 50 }
    ]);
    component.selectedAccount = { accountId: 'ACC-1234' };
    component.currentView = 'add';

    const refresh = component.backToDetails();

    expect(component.currentView).toBe('details');
    await refresh;
    expect(component.invoices).toEqual([
      { date: '10/03/2026', rate: 25, bags: 2, weight: 4, amount: 50 }
    ]);
  });

  it('filters closure periods by closure year and retains the ongoing period for all years', async () => {
    const invoiceService = TestBed.inject(Invoice);
    vi.spyOn(invoiceService, 'getInvoices').mockResolvedValue([
      { recordId: 0, date: '30/12/2025', bags: 2, amount: 50 },
      { recordId: 1, date: '31/12/2025', entryType: 'closure' },
      { recordId: 2, date: '01/01/2026', bags: 3, amount: 75 },
      { recordId: 3, date: '02/01/2026', entryType: 'closure' },
      { recordId: 4, date: '03/01/2026', bags: 4, amount: 100 },
    ]);
    component.selectedAccount = { accountId: 'ACC-1234' };

    await component.loadInvoicesData();
    expect(component.closureYears).toEqual(['2026', '2025']);

    component.selectClosureYear('2025');
    expect(component.invoices.map((invoice) => invoice.recordId)).toEqual([0, 1]);
    expect(component.totalBags).toBe(2);
    expect(component.totalAmount).toBe(50);
    expect(component.canNavigateToPreviousPeriod).toBe(false);
    expect(component.canNavigateToNextPeriod).toBe(false);

    component.selectClosureYear('2026');
    expect(component.invoices.map((invoice) => invoice.recordId)).toEqual([2, 3]);
    expect(component.totalAmount).toBe(75);

    component.selectClosureYear('all');
    expect(component.invoices.map((invoice) => invoice.recordId)).toEqual([4]);
    expect(component.totalAmount).toBe(100);
  });

  it('sorts invoices from older to newer regardless of stored order', async () => {
    const invoiceService = TestBed.inject(Invoice);
    vi.spyOn(invoiceService, 'getInvoices').mockResolvedValue([
      { date: '01/01/2027', bags: 1, amount: 10 },
      { date: '15/12/2026', bags: 2, amount: 20 },
      { date: '02/01/2026', bags: 3, amount: 30 },
    ]);
    component.selectedAccount = { accountId: 'ACC-1234' };

    await component.loadInvoicesData();

    expect(component.invoices.map((invoice) => invoice.date)).toEqual([
      '02/01/2026',
      '15/12/2026',
      '01/01/2027',
    ]);
  });

  it('deletes the confirmed invoice record and reloads the table', async () => {
    const invoiceService = TestBed.inject(Invoice);
    const deleteSpy = vi.spyOn(invoiceService, 'deleteInvoiceDetail').mockResolvedValue();
    const getInvoicesSpy = vi.spyOn(invoiceService, 'getInvoices').mockResolvedValue([]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.selectedAccount = { accountId: 'ACC-1234' };

    await component.deleteInvoice({
      recordId: 2,
      date: '10/03/2026',
      rate: 25,
      bags: 2,
      weight: 4,
      amount: 50,
    });

    expect(deleteSpy).toHaveBeenCalledWith('ACC-1234', 2);
    expect(getInvoicesSpy).toHaveBeenCalledWith('ACC-1234', true);
    expect(component.invoices).toEqual([]);
    expect(component.storageError).toBe('');
    confirmSpy.mockRestore();
  });

  it('marks the view for checking after recording and reloading an advance', async () => {
    const invoiceService = TestBed.inject(Invoice);
    vi.spyOn(invoiceService, 'addAdvanceDetail').mockResolvedValue();
    vi.spyOn(invoiceService, 'getInvoices').mockResolvedValue([
      {
        date: '29/10/2026',
        rate: '-',
        bags: '-',
        weight: '-',
        amount: 75,
        entryType: 'advance',
      },
    ]);
    const markForCheck = vi.spyOn(component['changeDetector'], 'markForCheck');
    component.selectedAccount = { accountId: 'ACC-1234' };
    component.advanceDate = '2026-10-29';
    component.advanceAmount = 75;

    await component.recordAdvance();

    expect(component.invoices).toEqual([
      {
        date: '29/10/2026',
        rate: '-',
        bags: '-',
        weight: '-',
        amount: 75,
        entryType: 'advance',
      },
    ]);
    expect(component.advanceSuccess).toBe('Advance recorded successfully.');
    expect(markForCheck).toHaveBeenCalled();
  });

  it('opens the platform print preview when printing the invoice', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    component.printInvoice();

    expect(printSpy).toHaveBeenCalledOnce();
    printSpy.mockRestore();
  });

  it('deducts labour changes per bag from the total amount', () => {
    component.invoices = [
      { date: '01/10/2026', bags: 2, amount: 50 },
      { date: '02/10/2026', bags: 3, amount: 75 },
    ];
    component.calculateTotals();
    component.labourChangesPerBag = 2.5;

    expect(component.totalBags).toBe(5);
    expect(component.totalLabourChanges).toBe(12.5);
    expect(component.totalAmount).toBe(125);
    expect(component.netTotalAmount).toBe(112.5);
  });

  it('deducts recorded advances after labour charges without counting them as purchases', () => {
    component.invoices = [
      { date: '09/03/2026', bags: 2, amount: 150 },
      {
        date: '10/03/2026',
        bags: '-',
        weight: '-',
        rate: '-',
        amount: 40,
        entryType: 'advance'
      }
    ];
    component.labourChangesPerBag = 5;

    component.calculateTotals();

    expect(component.totalBags).toBe(2);
    expect(component.totalAmount).toBe(150);
    expect(component.totalAdvanceAmount).toBe(40);
    expect(component.totalLabourChanges).toBe(10);
    expect(component.netTotalAmount).toBe(100);
    expect(component.formatTableDate('2026-03-10')).toBe('10/03/2026');
  });

  it('shows and calculates only the selected closure period', async () => {
    const invoiceService = TestBed.inject(Invoice);
    vi.spyOn(invoiceService, 'getInvoices').mockResolvedValue([
      { recordId: 0, date: '01/10/2026', bags: 2, amount: 100 },
      { recordId: 1, date: '02/10/2026', bags: '-', amount: 20, entryType: 'advance' },
      { recordId: 2, date: '03/10/2026', entryType: 'closure' },
      { recordId: 3, date: '04/10/2026', bags: 3, amount: 150 },
      { recordId: 4, date: '05/10/2026', entryType: 'closure' },
      { recordId: 5, date: '06/10/2026', bags: 1, amount: 60 },
    ]);
    component.selectedAccount = { accountId: 'ACC-1234' };

    await component.loadInvoicesData();
    expect(component.totalAmount).toBe(60);
    expect(component.invoices.map((invoice) => invoice.recordId)).toEqual([5]);
    expect(component.closurePeriodLabel).toBe('Period 3 of 3');

    component.previousClosurePeriod();
    expect(component.invoices.map((invoice) => invoice.recordId)).toEqual([3, 4]);
    expect(component.totalAmount).toBe(150);

    component.previousClosurePeriod();
    expect(component.invoices.map((invoice) => invoice.recordId)).toEqual([0, 1, 2]);
    expect(component.totalAmount).toBe(100);
    expect(component.totalAdvanceAmount).toBe(20);

    component.nextClosurePeriod();
    expect(component.totalAmount).toBe(150);
    expect(component.canNavigateToPreviousPeriod).toBe(true);
    expect(component.canNavigateToNextPeriod).toBe(true);
  });

  it('closes the active period and opens an empty period for new details', async () => {
    const invoiceService = TestBed.inject(Invoice);
    vi.spyOn(invoiceService, 'addClosureDetail').mockResolvedValue();
    vi.spyOn(invoiceService, 'getInvoices')
      .mockResolvedValueOnce([
        { recordId: 0, date: '01/10/2026', bags: 1, amount: 30 }
      ])
      .mockResolvedValueOnce([
        { recordId: 0, date: '01/10/2026', bags: 1, amount: 30 },
        { recordId: 1, date: '02/10/2026', entryType: 'closure' },
      ]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.selectedAccount = { accountId: 'ACC-1234' };
    await component.loadInvoicesData();

    await component.closeCurrentPeriod();

    expect(invoiceService.addClosureDetail).toHaveBeenCalledWith(
      'ACC-1234',
      expect.any(String),
      7
    );
    expect(component.closurePeriodLabel).toBe('Period 2 of 2');
    expect(component.invoices).toEqual([]);
    component.previousClosurePeriod();
    expect(component.invoices.map((invoice) => invoice.recordId)).toEqual([0, 1]);
    expect(component.invoices[component.invoices.length - 1]?.entryType).toBe('closure');
    expect(component.canCloseCurrentPeriod).toBe(false);
  });

  it('loads labour charges from each period and locks historical periods', async () => {
    const invoiceService = TestBed.inject(Invoice);
    const updateSpy = vi.spyOn(invoiceService, 'updateCurrentPeriodLabourCharge')
      .mockResolvedValue();
    vi.spyOn(invoiceService, 'getInvoices').mockResolvedValue([
      {
        recordId: 0,
        date: '01/10/2026',
        bags: 2,
        amount: 100,
        labourChargePerBag: 4
      },
      { recordId: 1, date: '02/10/2026', entryType: 'closure', labourChargePerBag: 4 },
      { recordId: 2, date: '', entryType: 'labour', labourChargePerBag: 9 },
    ]);
    component.selectedAccount = { accountId: 'ACC-1234' };

    await component.loadInvoicesData();
    expect(component.labourChangesPerBag).toBe(9);
    expect(component.canEditLabourCharge).toBe(true);

    component.previousClosurePeriod();
    expect(component.labourChangesPerBag).toBe(4);
    expect(component.totalLabourChanges).toBe(8);
    expect(component.canEditLabourCharge).toBe(false);
    await component.onLabourChargeCommit();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('saves the first labour charge on blur without confirmation', async () => {
    const invoiceService = TestBed.inject(Invoice);
    const updateSpy = vi.spyOn(invoiceService, 'updateCurrentPeriodLabourCharge')
      .mockResolvedValue();
    vi.spyOn(invoiceService, 'getInvoices').mockResolvedValue([
      { entryType: 'labour', date: '', labourChargePerBag: 6.5 }
    ]);
    component.selectedAccount = { accountId: 'ACC-1234' };
    component.closurePeriods = [[]];
    component.closurePeriodIndex = 0;
    component.labourChangesPerBag = 6.5;
    const confirmSpy = vi.spyOn(window, 'confirm');

    await component.onLabourChargeCommit();

    expect(updateSpy).toHaveBeenCalledWith('ACC-1234', 6.5);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(component.savedLabourChargePerBag).toBe(6.5);
    confirmSpy.mockRestore();
  });

  it('asks before changing a saved labour charge and restores it if declined', async () => {
    const invoiceService = TestBed.inject(Invoice);
    const updateSpy = vi.spyOn(invoiceService, 'updateCurrentPeriodLabourCharge')
      .mockResolvedValue();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    component.closurePeriods = [[]];
    component.closurePeriodIndex = 0;
    component.savedLabourChargePerBag = 7;
    component.labourChangesPerBag = 5;

    await component.onLabourChargeCommit();

    expect(confirmSpy).toHaveBeenCalledWith('Do you want to make changes in charges?');
    expect(updateSpy).not.toHaveBeenCalled();
    expect(component.labourChangesPerBag).toBe(7);
    confirmSpy.mockRestore();
  });
});
