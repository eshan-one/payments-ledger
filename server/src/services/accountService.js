import { Account } from "../models/Account.js";
import { Counter } from "../models/Counter.js";
import { ApiError } from "../utils/ApiError.js";

// Account numbers start at ACC-1000, assigned via an atomic counter $inc.
const ACCOUNT_ID_PREFIX = "ACC-";
const ACCOUNT_ID_START = 1000;

async function nextAccountId() {
  const counter = await Counter.findByIdAndUpdate(
    "account",
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return `${ACCOUNT_ID_PREFIX}${ACCOUNT_ID_START + counter.seq}`;
}

export async function create({ name, type }) {
  const _id = await nextAccountId();
  return Account.create({ _id, name, type });
}

/** Every account, oldest first — matches the order accounts are typically created in. */
export async function list() {
  return Account.find().sort({ createdAt: 1 });
}

export async function getById(accountId) {
  const account = await Account.findById(accountId);
  if (!account) {
    throw new ApiError(404, "Account not found");
  }
  return account;
}
