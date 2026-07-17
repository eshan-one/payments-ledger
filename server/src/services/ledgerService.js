import { LedgerEntry } from "../models/LedgerEntry.js";
import { ApiError } from "../utils/ApiError.js";

/** Enforce the double-entry invariant: sum(debits) === sum(credits), >= 2 lines. */
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

/** Validate and persist a double-entry transaction as one atomic LedgerEntry insert. */
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

/** Derive an account's balance from ledger lines; credits add, debits subtract. */
export async function getBalance(accountId) {
  const result = await LedgerEntry.aggregate([
    { $unwind: "$lines" },
    { $match: { "lines.accountId": accountId } },
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
