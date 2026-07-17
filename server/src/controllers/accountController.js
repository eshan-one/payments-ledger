import { z } from "zod";
import { ACCOUNT_TYPES } from "../models/Account.js";
import { create, list, getById } from "../services/accountService.js";
import { getBalance } from "../services/ledgerService.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { formatCents } from "../utils/money.js";

// Single-currency only: balance aggregation sums amountCents with no currency grouping.
const createAccountSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(ACCOUNT_TYPES),
});

export const createAccount = asyncHandler(async (req, res) => {
  const parsed = createAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0].message);
  }

  const account = await create(parsed.data);
  res.status(201).json(account);
});

export const listAccounts = asyncHandler(async (req, res) => {
  const accounts = await list();
  res.status(200).json(accounts);
});

export const getAccountBalance = asyncHandler(async (req, res) => {
  const account = await getById(req.params.id);

  const balanceCents = await getBalance(account._id);
  res.status(200).json({
    accountId: account._id,
    balanceCents,
    balance: formatCents(balanceCents),
  });
});
