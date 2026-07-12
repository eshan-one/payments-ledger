import { useEffect, useState } from "react";
import { getInvoice } from "../api/client.ts";
import { ApplyPaymentForm } from "../components/ApplyPaymentForm.tsx";
import { formatCents } from "../lib/money.ts";
import { Card } from "../components/ui/Card.tsx";
import { Table } from "../components/ui/Table.tsx";
import { Badge } from "../components/ui/Badge.tsx";
import { Loading, ErrorState } from "../components/ui/States.tsx";
import type { Invoice } from "../types.ts";

interface InvoiceDetailPageProps {
  invoiceId: string;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; invoice: Invoice };

export function InvoiceDetailPage({ invoiceId }: InvoiceDetailPageProps) {
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
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Failed to load invoice",
        });
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

  if (state.status === "error") {
    return (
      <Card>
        <ErrorState>{state.message}</ErrorState>
      </Card>
    );
  }

  const { invoice } = state;
  const totalCents = invoice.lineItems.reduce(
    (total, item) => total + item.quantity * item.unitPriceCents,
    0,
  );

  return (
    <>
      <header className="page__head">
        <div>
          <h1 className="page__title">Invoice</h1>
          <p className="page__subtitle mono">{invoice._id}</p>
        </div>
        <Badge status={invoice.status} />
      </header>

      <Card title="Summary">
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

      {invoice.status !== "paid" ? (
        <Card title="Apply payment">
          <ApplyPaymentForm
            invoiceId={invoice._id}
            onApplied={(updated) =>
              setState({ status: "ready", invoice: updated })
            }
          />
        </Card>
      ) : (
        <Card>
          <div className="state">
            <Badge status="paid" />
            <span>This invoice has been paid in full.</span>
          </div>
        </Card>
      )}
    </>
  );
}
