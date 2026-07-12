import { Invoice, INVOICE_STATUSES } from "../models/Invoice.js";
import { Account } from "../models/Account.js";
import { postTransaction } from "./ledgerService.js";
import { ApiError } from "../utils/ApiError.js";

// Convention accounts a payment posts against. They must already exist
// (created via POST /api/accounts, Milestone 1) — invoiceService looks them
// up by name rather than storing account ids on the Invoice itself.
const CASH_ACCOUNT_NAME = "Cash";
const ACCOUNTS_RECEIVABLE_ACCOUNT_NAME = "Accounts Receivable";

// draft -> sent -> paid is the normal lifecycle. "overdue" is a legal target
// but nothing transitions into it automatically (see spec: "skip automatic
// overdue transition; leave it derivable from dueDate").
const ALLOWED_TRANSITIONS = {
  draft: ["sent", "paid"],
  sent: ["paid", "overdue"],
  paid: [],
  overdue: ["paid"],
};

/** Guard invoice.status changes so only legal lifecycle moves are possible. */
export function transition(invoice, nextStatus) {
  if (invoice.status === nextStatus) return invoice;

  const allowed = ALLOWED_TRANSITIONS[invoice.status] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new ApiError(
      422,
      `Cannot transition invoice from ${invoice.status} to ${nextStatus}`,
    );
  }

  invoice.status = nextStatus;
  return invoice;
}

/** Sum of quantity * unitPriceCents across every line item — the invoice total. */
function computeTotalCents(lineItems) {
  return lineItems.reduce(
    (total, item) => total + item.quantity * item.unitPriceCents,
    0,
  );
}

/**
 * Create an invoice. The total is always computed server-side from
 * lineItems — a client-sent total is never trusted.
 */
export async function create({ lineItems, dueDate }) {
  const amountDueCents = computeTotalCents(lineItems);

  const invoice = await Invoice.create({
    lineItems,
    amountDueCents,
    dueDate,
    status: "draft",
  });

  return invoice;
}

export async function getById(invoiceId) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    throw new ApiError(404, "Invoice not found");
  }
  return invoice;
}

/**
 * Apply a payment to an invoice.
 * - Duplicate paymentId (already recorded on this invoice) is an idempotent
 *   no-op: return the current state, do not touch the ledger again.
 * - Overpayment (amountCents > remaining) is a 422 business-rule violation.
 * - Otherwise post a balanced ledger entry (debit Cash / credit Accounts
 *   Receivable) and record the payment, flipping status to "paid" once the
 *   remaining balance hits zero.
 */
export async function applyPayment(invoiceId, { paymentId, amountCents }) {
  const invoice = await getById(invoiceId);

  const alreadyApplied = invoice.payments.some(
    (payment) => payment.paymentId === paymentId,
  );
  if (alreadyApplied) {
    return invoice;
  }

  if (amountCents > invoice.amountDueCents) {
    throw new ApiError(
      422,
      `Overpayment: amountCents (${amountCents}) exceeds amount due (${invoice.amountDueCents})`,
    );
  }

  const [cashAccount, receivableAccount] = await Promise.all([
    Account.findOne({ name: CASH_ACCOUNT_NAME }),
    Account.findOne({ name: ACCOUNTS_RECEIVABLE_ACCOUNT_NAME }),
  ]);
  if (!cashAccount || !receivableAccount) {
    throw new ApiError(
      404,
      `Required accounts not found: expected "${CASH_ACCOUNT_NAME}" and "${ACCOUNTS_RECEIVABLE_ACCOUNT_NAME}" accounts to exist`,
    );
  }

  await postTransaction({
    description: `Payment ${paymentId} for invoice ${invoice._id}`,
    lines: [
      { accountId: cashAccount._id, direction: "debit", amountCents },
      { accountId: receivableAccount._id, direction: "credit", amountCents },
    ],
    invoiceId: invoice._id,
    paymentId,
  });

  const remainingCents = invoice.amountDueCents - amountCents;
  transition(invoice, remainingCents === 0 ? "paid" : "sent");
  invoice.amountDueCents = remainingCents;
  invoice.payments.push({ paymentId, amountCents, appliedAt: new Date() });

  try {
    await invoice.save();
  } catch (err) {
    // Concurrent duplicate paymentId raced us to the unique index — treat it
    // the same as the idempotency check above: no-op, return current state.
    if (err?.code === 11000) {
      return getById(invoiceId);
    }
    throw err;
  }

  return invoice;
}

export { INVOICE_STATUSES };
