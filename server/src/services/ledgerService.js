import mongoose from "mongoose";
import { LedgerEntry } from "../models/LedgerEntry.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Enforce the double-entry invariant: every line is a positive integer
 * amount, there are at least 2 lines, and sum(debits) === sum(credits).
 * Throws 422 (business-rule violation) rather than 400 (malformed input) —
 * shape is valid, the accounting rule is what's broken.
 */
export function assertBalanced(lines) {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new ApiError(422, "A transaction requires at least 2 lines");
  }

  let debitTotal = 0;
  let creditTotal = 0;

  for (const line of lines) {
    if (!Number.isInteger(line.amountCents) || line.amountCents <= 0) {
      throw new ApiError(422, "Every line amountCents must be a positive integer");
    }

    if (line.direction === "debit") {
      debitTotal += line.amountCents;
    } else if (line.direction === "credit") {
      creditTotal += line.amountCents;
    } else {
      throw new ApiError(422, `Invalid line direction: ${line.direction}`);
    }
  }

  if (debitTotal !== creditTotal) {
    throw new ApiError(
      422,
      `Unbalanced transaction: debits (${debitTotal}) !== credits (${creditTotal})`
    );
  }
}

/**
 * Validate and persist a double-entry transaction. The whole transaction is
 * one LedgerEntry document (lines[] embedded), so a single insert is
 * atomic — it is impossible to persist half of a double-entry write.
 *
 * Pass `session` to fold this insert into a caller's transaction (e.g.
 * invoiceService.applyPayment, which needs the invoice update and this
 * ledger write to commit or roll back together).
 */
export async function postTransaction({ description, lines, invoiceId, paymentId, session }) {
  assertBalanced(lines);

  const [entry] = await LedgerEntry.create(
    [
      {
        description,
        lines,
        ...(invoiceId && { invoiceId }),
        ...(paymentId && { paymentId }),
      },
    ],
    { session },
  );

  return entry;
}

/**
 * Derive an account's balance by aggregating every ledger line ever posted
 * against it — there is no stored balance field to drift or corrupt.
 * Credit lines add, debit lines subtract.
 */
export async function getBalance(accountId) {
  const result = await LedgerEntry.aggregate([
    { $unwind: "$lines" },
    { $match: { "lines.accountId": new mongoose.Types.ObjectId(accountId) } },
    {
      $group: {
        _id: null,
        balance: {
          $sum: {
            $cond: [
              { $eq: ["$lines.direction", "credit"] },
              "$lines.amountCents",
              { $multiply: ["$lines.amountCents", -1] },
            ],
          },
        },
      },
    },
  ]);

  return result[0]?.balance ?? 0;
}
