import mongoose from "mongoose";

const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"];

// No balance field: balance is always derived from LedgerEntry lines.
const accountSchema = new mongoose.Schema(
  {
    // Human-readable id (e.g. "ACC-1001"), assigned via the Counter model.
    _id: { type: String },
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ACCOUNT_TYPES },
    currency: { type: String, required: true, default: "USD", uppercase: true, trim: true },
  },
  { timestamps: true }
);

export const Account = mongoose.model("Account", accountSchema);
export { ACCOUNT_TYPES };
