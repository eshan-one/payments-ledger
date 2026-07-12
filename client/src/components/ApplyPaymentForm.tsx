import { useState, type FormEvent } from "react";
import { applyPayment } from "../api/client.ts";
import { parseDollarsToCents } from "../lib/money.ts";
import { Input } from "./ui/Input.tsx";
import { Button } from "./ui/Button.tsx";
import type { Invoice } from "../types.ts";

interface ApplyPaymentFormProps {
  invoiceId: string;
  onApplied: (invoice: Invoice) => void;
}

/** paymentId is client-supplied so a retried/duplicate submit is a safe no-op. */
function generatePaymentId(): string {
  return crypto.randomUUID();
}

export function ApplyPaymentForm({ invoiceId, onApplied }: ApplyPaymentFormProps) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const amountCents = parseDollarsToCents(amount);
    if (amountCents === null) {
      setError("Enter a valid payment amount");
      return;
    }

    setSubmitting(true);
    try {
      const invoice = await applyPayment(invoiceId, {
        paymentId: generatePaymentId(),
        amountCents,
      });
      setAmount("");
      onApplied(invoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply payment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="pay-panel__row">
        <Input
          label="Payment amount"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          error={Boolean(error)}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? "Applying…" : "Apply payment"}
        </Button>
      </div>
      {error && (
        <p className="form-error" role="alert" style={{ marginTop: "var(--space-3)" }}>
          {error}
        </p>
      )}
    </form>
  );
}
