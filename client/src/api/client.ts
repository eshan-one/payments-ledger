import type { Account, AccountBalance, Invoice, LineItem } from "../types.ts";

const BASE_URL = import.meta.env.VITE_API_URL;

/** Thrown for any non-2xx response; carries the server's error message. */
export class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

/**
 * Central fetch wrapper: every caller gets typed data back, or this throws.
 * Components never see a raw Response or unknown JSON body.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message = (body && typeof body.error === "string") ? body.error : `Request failed with status ${res.status}`;
    throw new ApiRequestError(res.status, message);
  }

  return body as T;
}

export function listAccounts(): Promise<Account[]> {
  return request<Account[]>("/api/accounts");
}

export function getAccountBalance(accountId: string): Promise<AccountBalance> {
  return request<AccountBalance>(`/api/accounts/${accountId}/balance`);
}

export interface CreateInvoiceInput {
  lineItems: LineItem[];
  dueDate: string;
}

export function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  return request<Invoice>("/api/invoices", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getInvoice(invoiceId: string): Promise<Invoice> {
  return request<Invoice>(`/api/invoices/${invoiceId}`);
}

export interface ApplyPaymentInput {
  paymentId: string;
  amountCents: number;
}

export function applyPayment(invoiceId: string, input: ApplyPaymentInput): Promise<Invoice> {
  return request<Invoice>(`/api/invoices/${invoiceId}/payments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
