import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddDetails } from './add-details';
import { Invoice } from '../../service/invoice';

describe('AddDetails', () => {
  let component: AddDetails;
  let fixture: ComponentFixture<AddDetails>;
  let invoiceService: { addInvoiceDetail: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    invoiceService = { addInvoiceDetail: vi.fn().mockResolvedValue(undefined) };

    await TestBed.configureTestingModule({
      imports: [AddDetails],
      providers: [{ provide: Invoice, useValue: invoiceService }],
    }).compileComponents();

    fixture = TestBed.createComponent(AddDetails);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('account', { accountId: 'ACC-1234' });
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('saves the selected date in the existing invoice date format', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const dateInput: HTMLInputElement = fixture.nativeElement.querySelector('input[type="date"]');
    dateInput.value = '2026-03-10';
    dateInput.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    component.currentRate = 25;
    component.noOfBags = 2;
    component.totalWeight = 4;
    await component.onAdd();

    expect(invoiceService.addInvoiceDetail).toHaveBeenCalledWith('ACC-1234', {
      date: '10/03/2026',
      rate: 25,
      bags: 2,
      weight: 4,
      amount: 50,
    });
    alertSpy.mockRestore();
  });
});
