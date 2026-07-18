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

// Double-entry bookkeeping splits accounts into two families with opposite
// "normal" sides. Debit-normal accounts (asset, expense) grow with debits and
// shrink with credits — e.g. a Cash debit is money coming in. Credit-normal
// accounts (liability, equity, revenue) grow with credits and shrink with
// debits — e.g. a Revenue credit is income recognized. Applying one sign
// convention to both families silently inverts every debit-normal balance.
const DEBIT_NORMAL_TYPES = new Set(["asset", "expense"]);

/** Derive an account's balance from ledger lines, sign depending on accountType. */
export async function getBalance(accountId, accountType) {
  const increasingDirection = DEBIT_NORMAL_TYPES.has(accountType) ? "debit" : "credit";

  const result = await LedgerEntry.aggregate([
    { $unwind: "$lines" },
    { $match: { "lines.accountId": accountId } },
    {
      $group: {
        _id: null,
        balance: {
          $sum: {
            $cond: [
              { $eq: ["$lines.direction", increasingDirection] },
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
