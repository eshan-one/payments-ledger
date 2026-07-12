import { z } from "zod";
import { Account, ACCOUNT_TYPES } from "../models/Account.js";
import { getBalance } from "../services/ledgerService.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { formatCents } from "../utils/money.js";

const createAccountSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(ACCOUNT_TYPES),
  currency: z.string().trim().min(1).optional(),
});

export const createAccount = asyncHandler(async (req, res) => {
  const parsed = createAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0].message);
  }

  const account = await Account.create(parsed.data);
  res.status(201).json(account);
});

export const listAccounts = asyncHandler(async (req, res) => {
  const accounts = await Account.find().sort({ createdAt: 1 });
  res.status(200).json(accounts);
});

export const getAccountBalance = asyncHandler(async (req, res) => {
  const account = await Account.findById(req.params.id);
  if (!account) {
    throw new ApiError(404, "Account not found");
  }

  const balanceCents = await getBalance(account._id);
  res.status(200).json({
    accountId: account._id,
    balanceCents,
    balance: formatCents(balanceCents),
  });
});
