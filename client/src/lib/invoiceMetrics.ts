// Pure aggregation helpers over Invoice[] for the dashboard/invoices views.

import type { Invoice, InvoiceStatus } from "../types.ts";

const STATUSES: InvoiceStatus[] = ["draft", "sent", "paid", "overdue"];

/** Sum of quantity * unitPriceCents across an invoice's line items — its face value. */
export function invoiceTotalCents(invoice: Invoice): number {
  return invoice.lineItems.reduce(
    (total, item) => total + item.quantity * item.unitPriceCents,
    0,
  );
}

export interface DashboardMetrics {
  invoicedCents: number;
  outstandingCents: number;
  collectedCents: number;
  overdueCents: number;
  counts: Record<InvoiceStatus, number>;
  unpaidCount: number;
}

/** Roll every invoice up into the numbers the dashboard's stat cards show. */
export function computeDashboardMetrics(invoices: Invoice[]): DashboardMetrics {
  const counts: Record<InvoiceStatus, number> = { draft: 0, sent: 0, paid: 0, overdue: 0 };
  let invoicedCents = 0;
  let outstandingCents = 0;
  let overdueCents = 0;

  for (const invoice of invoices) {
    invoicedCents += invoiceTotalCents(invoice);
    outstandingCents += invoice.amountDueCents;
    const status = displayStatus(invoice);
    counts[status] += 1;
    if (status === "overdue") overdueCents += invoice.amountDueCents;
  }

  return {
    invoicedCents,
    outstandingCents,
    collectedCents: invoicedCents - outstandingCents,
    overdueCents,
    counts,
    unpaidCount: counts.sent + counts.overdue + counts.draft,
  };
}

export interface MonthPoint {
  label: string;
  valueCents: number;
}

/** Total payments collected per calendar month, oldest first, for the trailing `months`. */
export function collectedByMonth(invoices: Invoice[], months = 6): MonthPoint[] {
  const now = new Date();
  const buckets: MonthPoint[] = [];
  const keyFor = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const totals = new Map<string, number>();

  for (const invoice of invoices) {
    for (const payment of invoice.payments) {
      const key = keyFor(new Date(payment.appliedAt));
      totals.set(key, (totals.get(key) ?? 0) + payment.amountCents);
    }
  }

  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      label: d.toLocaleDateString("en-US", { month: "short" }),
      valueCents: totals.get(keyFor(d)) ?? 0,
    });
  }

  return buckets;
}

const DUE_SOON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** True when a sent invoice's due date falls within the next 7 days. */
export function isDueSoon(invoice: Invoice): boolean {
  if (invoice.status !== "sent") return false;
  const msUntilDue = new Date(invoice.dueDate).getTime() - Date.now();
  return msUntilDue > 0 && msUntilDue < DUE_SOON_WINDOW_MS;
}

// "overdue" is derived client-side from dueDate; use displayStatus, not invoice.status.

/** True when a sent invoice's due date has already passed. */
export function isOverdue(invoice: Invoice): boolean {
  return invoice.status === "sent" && new Date(invoice.dueDate).getTime() < Date.now();
}

/** The status to show in the UI: invoice.status, except overdue sent invoices read as "overdue". */
export function displayStatus(invoice: Invoice): InvoiceStatus {
  return isOverdue(invoice) ? "overdue" : invoice.status;
}

export { STATUSES as INVOICE_STATUSES };
