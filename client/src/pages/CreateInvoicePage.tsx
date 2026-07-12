import { useState, type FormEvent } from "react";
import { createInvoice } from "../api/client.ts";
import {
  LineItemsEditor,
  emptyLineItem,
  type DraftLineItem,
} from "../components/LineItemsEditor.tsx";
import { parseDollarsToCents } from "../lib/money.ts";
import { getDisplayMessage } from "../lib/errors.ts";
import { Card } from "../components/ui/Card.tsx";
import { Input } from "../components/ui/Input.tsx";
import { Button } from "../components/ui/Button.tsx";
import type { LineItem } from "../types.ts";

interface CreateInvoicePageProps {
  onCreated: (invoiceId: string) => void;
}

/** Turn draft rows into the LineItem[] the API expects, or return an error. */
function parseLineItems(items: DraftLineItem[]): LineItem[] | string {
  const parsed: LineItem[] = [];

  for (const item of items) {
    if (!item.description.trim()) return "Every line item needs a description";

    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return `Invalid quantity for "${item.description}"`;
    }

    const unitPriceCents = parseDollarsToCents(item.unitPrice);
    if (unitPriceCents === null) {
      return `Invalid unit price for "${item.description}"`;
    }

    parsed.push({ description: item.description.trim(), quantity, unitPriceCents });
  }

  return parsed;
}

export function CreateInvoicePage({ onCreated }: CreateInvoicePageProps) {
  const [items, setItems] = useState<DraftLineItem[]>([emptyLineItem()]);
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!dueDate) {
      setError("Due date is required");
      return;
    }

    const lineItems = parseLineItems(items);
    if (typeof lineItems === "string") {
      setError(lineItems);
      return;
    }

    setSubmitting(true);
    try {
      const invoice = await createInvoice({ lineItems, dueDate });
      onCreated(invoice._id);
    } catch (err) {
      setError(getDisplayMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Card title="Line items" action={<span className="card__meta">Totals are computed from unit price × quantity</span>}>
        <form className="form" onSubmit={handleSubmit}>
          <LineItemsEditor items={items} onChange={setItems} />

          <Input
            label="Due date"
            type="date"
            className="field--date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="form__footer">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create invoice"}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
