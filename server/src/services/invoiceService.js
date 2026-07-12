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

// Read-modify-write on amountDueCents is unsafe: two concurrent payments can
// both read the same remaining balance, both compute a valid new balance,
// and both write it, so one payment's decrement silently overwrites the
// other's — the classic lost-update race. MAX_APPLY_PAYMENT_ATTEMPTS bounds
// the optimistic-concurrency retry loop below that closes that gap.
const MAX_APPLY_PAYMENT_ATTEMPTS = 5;

/**
 * Apply a payment to an invoice.
 * - Duplicate paymentId (already recorded on this invoice) is an idempotent
 *   no-op: return the current state, do not touch the ledger again.
 * - Overpayment (amountCents > remaining) is a 422 business-rule violation.
 * - Otherwise post a balanced ledger entry (debit Cash / credit Accounts
 *   Receivable) and record the payment, flipping status to "paid" once the
 *   remaining balance hits zero.
 *
 * Concurrency-safe by construction: the invoice update is an atomic
 * `findOneAndUpdate` whose filter re-asserts the exact amountDueCents this
 * call read. If another payment (or another attempt at this same payment)
 * changed that value in between, the filter no longer matches, the update
 * is a no-op, and we retry against the fresh state instead of clobbering
 * it. That is what stops two simultaneous payments from both consuming the
 * same remaining balance.
 */
export async function applyPayment(invoiceId, { paymentId, amountCents }) {
  for (let attempt = 0; attempt < MAX_APPLY_PAYMENT_ATTEMPTS; attempt += 1) {
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

    const remainingCents = invoice.amountDueCents - amountCents;
    const nextStatus = remainingCents === 0 ? "paid" : "sent";
    transition(invoice, nextStatus); // validates the transition; throws 422 if illegal

    // Optimistic lock: only succeeds if amountDueCents is still exactly what
    // we just read. "payments.paymentId": { $ne } is defense-in-depth on top
    // of the schema's unique index, for the case where two requests with the
    // identical paymentId race each other.
    const updated = await Invoice.findOneAndUpdate(
      {
        _id: invoiceId,
        amountDueCents: invoice.amountDueCents,
        "payments.paymentId": { $ne: paymentId },
      },
      {
        $set: { amountDueCents: remainingCents, status: nextStatus },
        $push: { payments: { paymentId, amountCents, appliedAt: new Date() } },
      },
      { new: true },
    );

    if (!updated) {
      // Lost the race — the invoice changed under us. Retry against fresh
      // state rather than failing the caller for a transient conflict.
      continue;
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

    try {
      await postTransaction({
        description: `Payment ${paymentId} for invoice ${invoice._id}`,
        lines: [
          { accountId: cashAccount._id, direction: "debit", amountCents },
          { accountId: receivableAccount._id, direction: "credit", amountCents },
        ],
        invoiceId: invoice._id,
        paymentId,
      });
    } catch (err) {
      // Concurrent duplicate paymentId raced us to the ledger's unique
      // index — treat it the same as the idempotency check above: no-op,
      // return current state.
      if (err?.code === 11000) {
        return getById(invoiceId);
      }
      throw err;
    }

    return updated;
  }

  throw new ApiError(
    409,
    "Could not apply payment: too many concurrent updates, please retry",
  );
}

export { INVOICE_STATUSES };
