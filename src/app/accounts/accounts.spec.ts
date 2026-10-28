import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Accounts } from './accounts';
import { Invoice } from '../../service/invoice';

describe('Accounts', () => {
  let component: Accounts;
  let fixture: ComponentFixture<Accounts>;

  beforeEach(async () => {
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

  it('filters invoices inclusively by date and recalculates totals', () => {
    component.allInvoices = [
      { date: '09/03/2026', bags: 2, amount: 50 },
      { date: '10/03/2026', bags: 3, amount: 75 },
      { date: '11/03/2026', bags: 4, amount: 100 },
      {
        date: '10/03/2026',
        bags: '-',
        weight: '-',
        rate: '-',
        amount: 25,
        entryType: 'advance'
      },
    ];
    component.fromDate = '2026-03-10';
    component.toDate = '2026-03-11';

    component.applyDateRange();

    expect(component.invoices.length).toBe(3);
    expect(component.totalBags).toBe(7);
    expect(component.totalAmount).toBe(175);
    expect(component.totalAdvanceAmount).toBe(25);
    expect(component.printFromDate).toBe('10/03/2026');
    expect(component.printToDate).toBe('11/03/2026');

    component.clearDateRange();

    expect(component.printFromDate).toBe('09/03/2026');
    expect(component.printToDate).toBe('11/03/2026');
  });

  it('deducts labour changes per bag from the total amount', () => {
    component.invoices = [
      { bags: 2, amount: 50 },
      { bags: 3, amount: 75 },
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
});
