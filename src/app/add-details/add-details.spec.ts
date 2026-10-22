import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddDetails } from './add-details';

describe('AddDetails', () => {
  let component: AddDetails;
  let fixture: ComponentFixture<AddDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddDetails],
    }).compileComponents();

    fixture = TestBed.createComponent(AddDetails);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
