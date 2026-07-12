import mongoose from "mongoose";

const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"];

// No balance field on purpose — balance is always DERIVED from LedgerEntry
// lines (see services/ledgerService.js#getBalance), never stored/mutated here.
const accountSchema = new mongoose.Schema(
  {
    // Human-readable id (e.g. "ACC-1001") instead of the default ObjectId —
    // it's what shows up in ledger lines and lookups, so it should read as
    // an account number. Assigned by accountService.create via the Counter
    // model; overriding the type to String disables Mongoose's automatic
    // ObjectId generation.
    _id: { type: String },
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ACCOUNT_TYPES },
    currency: { type: String, required: true, default: "USD", uppercase: true, trim: true },
  },
  { timestamps: true }
);

export const Account = mongoose.model("Account", accountSchema);
export { ACCOUNT_TYPES };
