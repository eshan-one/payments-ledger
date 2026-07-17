// Mirrors the server's Mongoose JSON shapes. Money fields are always integer cents.

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export interface Account {
  _id: string;
  name: string;
  type: AccountType;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountBalance {
  accountId: string;
  balanceCents: number;
  balance: string;
}

export type LedgerDirection = "debit" | "credit";

export interface LedgerLine {
  accountId: string;
  direction: LedgerDirection;
  amountCents: number;
}

export interface LedgerEntry {
  _id: string;
  description: string;
  lines: LedgerLine[];
  invoiceId?: string;
  paymentId?: string;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export interface LineItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface Payment {
  paymentId: string;
  amountCents: number;
  appliedAt: string;
}

export interface Invoice {
  _id: string;
  lineItems: LineItem[];
  amountDueCents: number;
  status: InvoiceStatus;
  dueDate: string;
  payments: Payment[];
  createdAt: string;
  updatedAt: string;
}
