import { useEffect, useState } from "react";
import { listInvoices } from "../api/client.ts";
import { Card } from "../components/ui/Card.tsx";
import { Table } from "../components/ui/Table.tsx";
import { Badge } from "../components/ui/Badge.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Loading, ErrorState, EmptyState } from "../components/ui/States.tsx";
import { AreaChart, DonutChart } from "../components/ui/Charts.tsx";
import { formatCents } from "../lib/money.ts";
import { getDisplayMessage } from "../lib/errors.ts";
import {
  computeDashboardMetrics,
  collectedByMonth,
  invoiceTotalCents,
  displayStatus,
} from "../lib/invoiceMetrics.ts";
import type { Invoice } from "../types.ts";

interface DashboardPageProps {
  onSelectInvoice: (invoiceId: string) => void;
  onCreateInvoice: () => void;
  onViewAllInvoices: () => void;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; invoices: Invoice[] };

export function DashboardPage({ onSelectInvoice, onCreateInvoice, onViewAllInvoices }: DashboardPageProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

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
        <Loading label="Loading your ledger…" />
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
  const hasData = invoices.length > 0;
  const metrics = computeDashboardMetrics(invoices);
  const months = collectedByMonth(invoices);
  const recent = [...invoices].slice(0, 6);
  const paidPct = metrics.invoicedCents > 0
    ? Math.round((metrics.collectedCents / metrics.invoicedCents) * 100)
    : 0;

  return (
    <>
      <div className="summary-grid">
        <div className="stat">
          <p className="stat__label">Total balance</p>
          <p className="stat__value num" style={{ color: "var(--accent)" }}>
            {formatCents(metrics.collectedCents)}
          </p>
          <p className="stat__foot">Collected across all invoices</p>
        </div>
        <div className="stat">
          <p className="stat__label">Outstanding</p>
          <p className="stat__value num">{formatCents(metrics.outstandingCents)}</p>
          <p className="stat__foot">Unpaid across {metrics.unpaidCount} invoices</p>
        </div>
        <div className="stat">
          <p className="stat__label">Overdue</p>
          <p className="stat__value num neg">{formatCents(metrics.overdueCents)}</p>
          <p className="stat__foot">{metrics.counts.overdue} past due date</p>
        </div>
        <div className="stat">
          <p className="stat__label">Invoices</p>
          <p className="stat__value num">{invoices.length}</p>
          <div className="chip-row">
            <span className="chip chip--paid">{metrics.counts.paid} paid</span>
            <span className="chip chip--sent">{metrics.counts.sent} sent</span>
            <span className="chip chip--overdue">{metrics.counts.overdue} overdue</span>
            <span className="chip chip--draft">{metrics.counts.draft} draft</span>
          </div>
        </div>
      </div>

      {!hasData && (
        <Card>
          <EmptyState>
            <span className="state__icon" aria-hidden="true" />
            <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 600, color: "var(--text)" }}>
              No invoices yet
            </h3>
            <p>Create your first invoice to see balances, charts and activity here.</p>
            <Button onClick={onCreateInvoice}>+ Create your first invoice</Button>
          </EmptyState>
        </Card>
      )}

      {hasData && (
        <>
          <div className="chart-row">
            <Card
              title="Collected over time"
              action={<span className="card__meta">Last 6 months</span>}
            >
              <AreaChart points={months} color="var(--accent)" label="Collected over time" />
            </Card>
            <Card title="Invoices by status">
              <DonutChart
                label="Invoices by status"
                segments={[
                  { label: "Paid", value: metrics.counts.paid, color: "var(--pos)" },
                  { label: "Sent", value: metrics.counts.sent, color: "var(--accent)" },
                  { label: "Overdue", value: metrics.counts.overdue, color: "var(--neg)" },
                  { label: "Draft", value: metrics.counts.draft, color: "var(--text-faint)" },
                ]}
              />
            </Card>
          </div>

          <Card
            title="Paid vs outstanding"
            action={<span className="card__meta">of {formatCents(metrics.invoicedCents)} invoiced</span>}
          >
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${paidPct}%` }} />
            </div>
            <div className="split-legend">
              <span className="split-legend__item">
                <span className="split-legend__dot split-legend__dot--paid" />
                Collected · {formatCents(metrics.collectedCents)}
              </span>
              <span className="split-legend__item">
                <span className="split-legend__dot split-legend__dot--out" />
                Outstanding · {formatCents(metrics.outstandingCents)}
              </span>
            </div>
          </Card>

          <Card
            title="Recent activity"
            action={
              <a
                href="#"
                className="link"
                onClick={(e) => {
                  e.preventDefault();
                  onViewAllInvoices();
                }}
              >
                View all →
              </a>
            }
          >
            <Table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Status</th>
                  <th>Due date</th>
                  <th className="amount">Total</th>
                  <th className="amount">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((invoice) => (
                  <tr
                    key={invoice._id}
                    className="table-row--clickable"
                    onClick={() => onSelectInvoice(invoice._id)}
                  >
                    <td className="mono">{invoice._id}</td>
                    <td>
                      <Badge status={displayStatus(invoice)} />
                    </td>
                    <td>{new Date(invoice.dueDate).toLocaleDateString()}</td>
                    <td className="amount">{formatCents(invoiceTotalCents(invoice))}</td>
                    <td
                      className={
                        "amount" + (invoice.amountDueCents > 0 ? " neg" : " pos")
                      }
                    >
                      {formatCents(invoice.amountDueCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      )}
    </>
  );
}
