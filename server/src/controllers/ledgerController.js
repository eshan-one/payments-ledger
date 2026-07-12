import { z } from "zod";
import { Account } from "../models/Account.js";
import { postTransaction } from "../services/ledgerService.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { ApiError } from "../utils/ApiError.js";

const lineSchema = z.object({
  accountId: z.string().trim().min(1),
  direction: z.enum(["debit", "credit"]),
  amountCents: z.number().int().positive(),
});

const postTransactionSchema = z.object({
  description: z.string().trim().min(1),
  lines: z.array(lineSchema).min(2),
});

export const createTransaction = asyncHandler(async (req, res) => {
  const parsed = postTransactionSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0].message);
  }

  const { description, lines } = parsed.data;

  const accountIds = [...new Set(lines.map((line) => line.accountId))];
  const foundAccounts = await Account.find({ _id: { $in: accountIds } }).select("_id");
  const foundIds = new Set(foundAccounts.map((account) => account._id.toString()));
  const missingId = accountIds.find((id) => !foundIds.has(id));
  if (missingId) {
    throw new ApiError(404, `Account not found: ${missingId}`);
  }

  const entry = await postTransaction({ description, lines });
  res.status(201).json(entry);
});
