import type { InvoiceStatus } from "../../types.ts";

interface BadgeProps {
  status: InvoiceStatus;
}

const LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
};

/** Subtle status pill for invoices. Color is carried by a per-status modifier. */
export function Badge({ status }: BadgeProps) {
  return <span className={`badge badge--${status}`}>{LABELS[status]}</span>;
}
