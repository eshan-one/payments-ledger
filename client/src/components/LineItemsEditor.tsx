import { formatCents, parseDollarsToCents } from "../lib/money.ts";
import { Input } from "./ui/Input.tsx";
import { Button } from "./ui/Button.tsx";

/** Line item still being typed: quantity/price are raw strings until parsed. */
export interface DraftLineItem {
  description: string;
  quantity: string;
  unitPrice: string;
}

interface LineItemsEditorProps {
  items: DraftLineItem[];
  onChange: (items: DraftLineItem[]) => void;
}

export function emptyLineItem(): DraftLineItem {
  return { description: "", quantity: "1", unitPrice: "" };
}

/** Sum of quantity * unitPriceCents for the rows that currently parse cleanly. */
export function computeDraftTotalCents(items: DraftLineItem[]): number {
  return items.reduce((total, item) => {
    const quantity = Number(item.quantity);
    const unitPriceCents = parseDollarsToCents(item.unitPrice);
    if (!Number.isInteger(quantity) || quantity <= 0 || unitPriceCents === null) {
      return total;
    }
    return total + quantity * unitPriceCents;
  }, 0);
}

export function LineItemsEditor({ items, onChange }: LineItemsEditorProps) {
  function updateItem(index: number, patch: Partial<DraftLineItem>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function addItem() {
    onChange([...items, emptyLineItem()]);
  }

  return (
    <div className="line-items">
      <div className="line-items__head" aria-hidden="true">
        <span>Description</span>
        <span>Qty</span>
        <span>Unit price</span>
        <span />
      </div>

      {items.map((item, index) => (
        <div className="line-items__row" key={index}>
          <Input
            label="Description"
            placeholder="e.g. Consulting hours"
            value={item.description}
            onChange={(e) => updateItem(index, { description: e.target.value })}
          />
          <Input
            label="Quantity"
            type="number"
            min={1}
            step={1}
            placeholder="Qty"
            value={item.quantity}
            onChange={(e) => updateItem(index, { quantity: e.target.value })}
          />
          <Input
            label="Unit price"
            inputMode="decimal"
            placeholder="0.00"
            value={item.unitPrice}
            onChange={(e) => updateItem(index, { unitPrice: e.target.value })}
          />
          <Button
            variant="danger"
            size="sm"
            onClick={() => removeItem(index)}
            disabled={items.length <= 1}
            aria-label={`Remove line item ${index + 1}`}
          >
            Remove
          </Button>
        </div>
      ))}

      <div className="line-items__foot">
        <Button variant="secondary" size="sm" onClick={addItem}>
          + Add line item
        </Button>
        <span className="line-items__total num">
          {formatCents(computeDraftTotalCents(items))}
        </span>
      </div>
    </div>
  );
}
