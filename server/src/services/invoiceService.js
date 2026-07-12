import mongoose from "mongoose";
import { Invoice, INVOICE_STATUSES } from "../models/Invoice.js";
import { Account } from "../models/Account.js";
import { Counter } from "../models/Counter.js";
import { postTransaction } from "./ledgerService.js";
import { ApiError } from "../utils/ApiError.js";
import { formatCents } from "../utils/money.js";

// Invoice numbers start at INV-1001 — a $inc on a single counter document
// is one atomic write, so concurrent creates can never collide on a number.
const INVOICE_ID_PREFIX = "INV-";
const INVOICE_ID_START = 1000;

async function nextInvoiceId() {
  const counter = await Counter.findByIdAndUpdate(
    "invoice",
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return `${INVOICE_ID_PREFIX}${INVOICE_ID_START + counter.seq}`;
}

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
  const _id = await nextInvoiceId();

  const invoice = await Invoice.create({
    _id,
    lineItems,
    amountDueCents,
    dueDate,
    status: "draft",
  });

  return invoice;
}

export async function getById(invoiceId) {
  // _id is a plain String field (not ObjectId), so an unknown id just finds
  // nothing rather than throwing a cast error — no format check needed.
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    throw new ApiError(404, "Invoice not found");
  }
  return invoice;
}

/** Every invoice, newest first — backs the dashboard and invoice-list views. */
export async function list() {
  return Invoice.find().sort({ createdAt: -1 });
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
 * Concurrency-safe by construction, two guards stacked together:
 * 1. Optimistic lock — the invoice update's filter re-asserts the exact
 *    amountDueCents this attempt read. If another payment changed that
 *    value in between, the filter no longer matches, the update is a
 *    no-op, and the outer loop retries against fresh state instead of
 *    clobbering it. That is what stops two simultaneous payments from
 *    both consuming the same remaining balance.
 * 2. Session transaction — the invoice update and the ledger write happen
 *    inside one `session.withTransaction`. Without this, a failure in the
 *    ledger write (bad account lookup, dropped connection, whatever) after
 *    the invoice was already updated would leave a payment recorded on the
 *    invoice with no matching LedgerEntry — silently breaking the
 *    double-entry invariant. The transaction makes the two writes commit
 *    or roll back together, so that split-brain state can't happen.
 */
export async function applyPayment(invoiceId, { paymentId, amountCents }) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new ApiError(400, "amountCents must be a positive integer");
  }

  for (let attempt = 0; attempt < MAX_APPLY_PAYMENT_ATTEMPTS; attempt += 1) {
    const invoice = await getById(invoiceId);

    const alreadyApplied = invoice.payments.some(
      (payment) => payment.paymentId === paymentId,
    );
    if (alreadyApplied) {
      return invoice;
    }

    if (amountCents > invoice.amountDueCents) {
      // User-facing message: dollars, not the internal cents representation.
      throw new ApiError(
        422,
        `Overpayment: $${formatCents(amountCents)} exceeds the remaining balance of $${formatCents(invoice.amountDueCents)}`,
      );
    }

    const remainingCents = invoice.amountDueCents - amountCents;
    const nextStatus = remainingCents === 0 ? "paid" : "sent";
    transition(invoice, nextStatus); // validates the transition; throws 422 if illegal

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

    const session = await mongoose.startSession();
    let updated = null;
    let duplicatePaymentRace = false;

    try {
      await session.withTransaction(async () => {
        // Optimistic lock: only succeeds if amountDueCents is still exactly
        // what we just read. "payments.paymentId": { $ne } is defense-in-
        // depth on top of the schema's unique index, for the case where two
        // requests with the identical paymentId race each other.
        updated = await Invoice.findOneAndUpdate(
          {
            _id: invoiceId,
            amountDueCents: invoice.amountDueCents,
            "payments.paymentId": { $ne: paymentId },
          },
          {
            $set: { amountDueCents: remainingCents, status: nextStatus },
            $push: {
              payments: { paymentId, amountCents, appliedAt: new Date() },
            },
          },
          { new: true, session },
        );

        if (!updated) {
          // Lost the optimistic-lock race. Nothing to commit — abort this
          // transaction (no-op) and let the outer loop retry against fresh
          // state rather than failing the caller for a transient conflict.
          return;
        }

        await postTransaction({
          description: `Payment ${paymentId} for invoice ${invoice._id}`,
          lines: [
            { accountId: cashAccount._id, direction: "debit", amountCents },
            {
              accountId: receivableAccount._id,
              direction: "credit",
              amountCents,
            },
          ],
          invoiceId: invoice._id,
          paymentId,
          session,
        });
      });
    } catch (err) {
      // Concurrent duplicate paymentId raced us to the ledger's unique
      // index — treat it the same as the idempotency check above: no-op,
      // return current state. The transaction rolled back automatically,
      // so the invoice update from this attempt never persisted either.
      if (err?.code === 11000) {
        duplicatePaymentRace = true;
      } else {
        throw err;
      }
    } finally {
      await session.endSession();
    }

    if (duplicatePaymentRace) {
      return getById(invoiceId);
    }

    if (!updated) {
      continue;
    }

    return updated;
  }

  throw new ApiError(
    409,
    "Could not apply payment: too many concurrent updates, please retry",
  );
}

export { INVOICE_STATUSES };
