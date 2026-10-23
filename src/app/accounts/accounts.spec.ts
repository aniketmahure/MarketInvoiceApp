import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Accounts } from './accounts';

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

  it('filters invoices inclusively by date and recalculates totals', () => {
    component.allInvoices = [
      { date: '09/03/2026', bags: 2, amount: 50 },
      { date: '10/03/2026', bags: 3, amount: 75 },
      { date: '11/03/2026', bags: 4, amount: 100 },
    ];
    component.fromDate = '2026-03-10';
    component.toDate = '2026-03-11';

    component.applyDateRange();

    expect(component.invoices.length).toBe(2);
    expect(component.totalBags).toBe(7);
    expect(component.totalAmount).toBe(175);
  });
});
