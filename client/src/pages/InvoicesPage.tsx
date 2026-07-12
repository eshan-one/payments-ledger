import { useEffect, useState } from "react";
import { listInvoices } from "../api/client.ts";
import { Card } from "../components/ui/Card.tsx";
import { Table } from "../components/ui/Table.tsx";
import { Badge } from "../components/ui/Badge.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Loading, ErrorState, EmptyState } from "../components/ui/States.tsx";
import { formatCents } from "../lib/money.ts";
import { getDisplayMessage } from "../lib/errors.ts";
import { INVOICE_STATUSES, invoiceTotalCents, isDueSoon } from "../lib/invoiceMetrics.ts";
import type { Invoice, InvoiceStatus } from "../types.ts";

interface InvoicesPageProps {
  onSelectInvoice: (invoiceId: string) => void;
  onCreateInvoice: () => void;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; invoices: Invoice[] };

type Filter = "all" | InvoiceStatus;

const FILTER_LABELS: Record<Filter, string> = {
  all: "All",
  draft: "Draft",
  sent: "Sent",
  overdue: "Overdue",
  paid: "Paid",
};

export function InvoicesPage({ onSelectInvoice, onCreateInvoice }: InvoicesPageProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    listInvoices()
      .then((invoices) => {
        if (!cancelled) setState({ status: "ready", invoices });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({ status: "error", message: getDisplayMessage(err) });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <Card>
        <Loading label="Loading invoices…" />
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card>
        <ErrorState>{state.message}</ErrorState>
      </Card>
    );
  }

  const { invoices } = state;
  const filters: Filter[] = ["all", ...INVOICE_STATUSES];
  const filtered = filter === "all" ? invoices : invoices.filter((inv) => inv.status === filter);

  return (
    <>
      <div className="filter-row">
        {filters.map((f) => {
          const count = f === "all" ? invoices.length : invoices.filter((inv) => inv.status === f).length;
          return (
            <button
              key={f}
              type="button"
              className={"filter-pill" + (filter === f ? " active" : "")}
              onClick={() => setFilter(f)}
            >
              {FILTER_LABELS[f]} <span className="filter-pill__count">{count}</span>
            </button>
          );
        })}
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState>
            <span className="state__icon" aria-hidden="true" />
            <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 600, color: "var(--text)" }}>
              {invoices.length === 0 ? "No invoices yet" : "No invoices with this status"}
            </h3>
            <p>
              {invoices.length === 0
                ? "Create your first invoice to get started."
                : "Try a different status filter, or create a new invoice."}
            </p>
            <Button onClick={onCreateInvoice}>+ New invoice</Button>
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Status</th>
                <th>Due date</th>
                <th className="amount">Total</th>
                <th className="amount">Remaining</th>
                <th className="amount" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((invoice) => (
                <tr
                  key={invoice._id}
                  className="table-row--clickable"
                  onClick={() => onSelectInvoice(invoice._id)}
                >
                  <td className="mono">{invoice._id}</td>
                  <td>
                    <Badge status={invoice.status} />
                  </td>
                  <td>
                    {new Date(invoice.dueDate).toLocaleDateString()}
                    {isDueSoon(invoice) && <span className="due-soon">Due soon</span>}
                  </td>
                  <td className="amount">{formatCents(invoiceTotalCents(invoice))}</td>
                  <td className={"amount" + (invoice.amountDueCents > 0 ? " neg" : " pos")}>
                    {formatCents(invoice.amountDueCents)}
                  </td>
                  <td className="amount link">Open →</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
