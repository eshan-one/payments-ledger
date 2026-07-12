import mongoose from "mongoose";

const lineSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    direction: { type: String, required: true, enum: ["debit", "credit"] },
    amountCents: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: "amountCents must be an integer",
      },
      min: [1, "amountCents must be a positive integer"],
    },
  },
  { _id: false }
);

// Immutable double-entry log: every document is one balanced transaction.
// sum(debit lines) === sum(credit lines) is enforced in ledgerService before
// insert — never edit or delete a LedgerEntry; reverse with a new entry.
const ledgerEntrySchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    lines: {
      type: [lineSchema],
      required: true,
      validate: {
        validator: (lines) => Array.isArray(lines) && lines.length >= 2,
        message: "lines must contain at least 2 entries",
      },
    },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" },
    paymentId: { type: String },
  },
  { timestamps: true }
);

export const LedgerEntry = mongoose.model("LedgerEntry", ledgerEntrySchema);
