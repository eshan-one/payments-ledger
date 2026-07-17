import mongoose from "mongoose";
import { Invoice, INVOICE_STATUSES } from "../models/Invoice.js";
import { Account } from "../models/Account.js";
import { Counter } from "../models/Counter.js";
import { postTransaction } from "./ledgerService.js";
import { ApiError } from "../utils/ApiError.js";
import { formatCents } from "../utils/money.js";

// Invoice numbers start at INV-1001, assigned via an atomic counter $inc.
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

// Convention accounts a payment posts against; must already exist.
const CASH_ACCOUNT_NAME = "Cash";
const ACCOUNTS_RECEIVABLE_ACCOUNT_NAME = "Accounts Receivable";

// draft -> sent -> paid is the normal lifecycle; "overdue" is never entered automatically.
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

/** Create an invoice; total is always computed server-side, never client-trusted. */
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

// Bounds the optimistic-concurrency retry loop below (guards the lost-update race
// where two concurrent payments both read/write the same remaining balance).
const MAX_APPLY_PAYMENT_ATTEMPTS = 5;

/**
 * Apply a payment to an invoice. Duplicate paymentId is an idempotent no-op;
 * overpayment is a 422. Concurrency-safe via an optimistic lock (invoice
 * update re-asserts the amountDueCents just read) plus a session transaction
 * (invoice update + ledger write commit or roll back together).
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
          // Lost the optimistic-lock race; outer loop retries against fresh state.
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
      // Concurrent duplicate paymentId hit the ledger's unique index; treat as a no-op.
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
