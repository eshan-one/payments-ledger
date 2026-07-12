import mongoose from "mongoose";

const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"];

// No balance field on purpose — balance is always DERIVED from LedgerEntry
// lines (see services/ledgerService.js#getBalance), never stored/mutated here.
const accountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ACCOUNT_TYPES },
    currency: { type: String, required: true, default: "USD", uppercase: true, trim: true },
  },
  { timestamps: true }
);

export const Account = mongoose.model("Account", accountSchema);
export { ACCOUNT_TYPES };
