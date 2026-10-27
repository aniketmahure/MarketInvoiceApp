import type { CustomerAccount, InvoiceDetail } from './service/invoice';

declare global {
  interface Window {
    api?: {
      getAccounts: () => Promise<CustomerAccount[]>;
      createAccount: (data: CustomerAccount) => Promise<CustomerAccount>;
      deleteAccount: (accountId: string) => Promise<void>;
      getAccountInvoices: (accountId: string) => Promise<InvoiceDetail[]>;
      addInvoiceDetail: (accountId: string, detail: InvoiceDetail) => Promise<void>;
      getInvoices: () => Promise<any[]>;
      saveInvoice: (invoice: any) => Promise<boolean>;
      getCompanyHeader: () => Promise<string[]>;
    };
  }
}

export {};
