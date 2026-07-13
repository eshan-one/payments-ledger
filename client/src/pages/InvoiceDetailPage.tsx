import { useEffect, useState } from "react";
import { ApiRequestError, getInvoice } from "../api/client.ts";
import { ApplyPaymentForm } from "../components/ApplyPaymentForm.tsx";
import { formatCents } from "../lib/money.ts";
import { invoiceTotalCents, displayStatus } from "../lib/invoiceMetrics.ts";
import { getDisplayMessage } from "../lib/errors.ts";
import { Card } from "../components/ui/Card.tsx";
import { Table } from "../components/ui/Table.tsx";
import { Badge } from "../components/ui/Badge.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Loading, ErrorState } from "../components/ui/States.tsx";
import type { Invoice } from "../types.ts";

interface InvoiceDetailPageProps {
  invoiceId: string;
  onBack: () => void;
}

type LoadState =
  | { status: "loading" }
  | { status: "not-found"; invoiceId: string }
  | { status: "error"; message: string }
  | { status: "ready"; invoice: Invoice };

export function InvoiceDetailPage({ invoiceId, onBack }: InvoiceDetailPageProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    getInvoice(invoiceId)
      .then((invoice) => {
        if (!cancelled) setState({ status: "ready", invoice });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiRequestError && err.status === 404) {
          setState({ status: "not-found", invoiceId });
          return;
        }
        setState({ status: "error", message: getDisplayMessage(err) });
      });

    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  if (state.status === "loading") {
    return (
      <Card>
        <Loading label="Loading invoice…" />
      </Card>
    );
  }

  if (state.status === "not-found") {
    return (
      <Card>
        <div className="state state--error">
          <span className="state__icon--error" aria-hidden="true">!</span>
          <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 600, color: "var(--text)" }}>
            Invoice not found
          </h3>
          <p className="state--error">
            No invoice found for "{state.invoiceId}". Check the ID and try again.
          </p>
          <Button variant="secondary" onClick={onBack}>
            Back to invoices
          </Button>
        </div>
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

  const { invoice } = state;
  const totalCents = invoiceTotalCents(invoice);

  return (
    <>
      <div className="detail-head">
        <Button variant="ghost" onClick={onBack}>
          ← Invoices
        </Button>
        <Badge status={displayStatus(invoice)} />
      </div>

      <Card
        title={<span className="mono">{invoice._id}</span>}
        action={<span className="card__meta">Created {new Date(invoice.createdAt).toLocaleDateString()}</span>}
      >
        <div className="meta">
          <div>
            <p className="meta__label">Invoice total</p>
            <p className="meta__value num">{formatCents(totalCents)}</p>
          </div>
          <div>
            <p className="meta__label">Remaining due</p>
            <p
              className={
                "meta__value num" + (invoice.amountDueCents > 0 ? " neg" : " pos")
              }
            >
              {formatCents(invoice.amountDueCents)}
            </p>
          </div>
          <div>
            <p className="meta__label">Due date</p>
            <p className="meta__value">
              {new Date(invoice.dueDate).toLocaleDateString()}
            </p>
          </div>
        </div>
      </Card>

      <Card title="Line items">
        <Table>
          <thead>
            <tr>
              <th>Description</th>
              <th className="amount">Qty</th>
              <th className="amount">Unit price</th>
              <th className="amount">Line total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((item, i) => (
              <tr key={i}>
                <td>{item.description}</td>
                <td className="amount">{item.quantity}</td>
                <td className="amount">{formatCents(item.unitPriceCents)}</td>
                <td className="amount">
                  {formatCents(item.quantity * item.unitPriceCents)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Total</td>
              <td className="amount num">{formatCents(totalCents)}</td>
            </tr>
          </tfoot>
        </Table>
      </Card>

      <Card title="Payments">
        {invoice.payments.length === 0 ? (
          <p className="state" style={{ padding: "var(--space-6)" }}>
            No payments applied yet.
          </p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Payment ID</th>
                <th>Applied</th>
                <th className="amount">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.payments.map((payment) => (
                <tr key={payment.paymentId}>
                  <td className="mono">{payment.paymentId}</td>
                  <td>{new Date(payment.appliedAt).toLocaleString()}</td>
                  <td className="amount pos">{formatCents(payment.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {invoice.status === "paid" && (
        <Card>
          <div className="paid-banner">
            <Badge status="paid" />
            <span>This invoice has been paid in full.</span>
          </div>
        </Card>
      )}

      {invoice.status !== "paid" && (
        <Card
          title="Apply payment"
          action={<span className="remaining-pill num">Remaining {formatCents(invoice.amountDueCents)}</span>}
        >
          <ApplyPaymentForm
            invoiceId={invoice._id}
            onApplied={(updated) =>
              setState({ status: "ready", invoice: updated })
            }
          />
        </Card>
      )}
    </>
  );
}
