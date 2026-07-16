import mongoose from "mongoose";

const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue"];

const lineItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    quantity: {
      type: Number,
      required: true,
      validate: { validator: Number.isInteger, message: "quantity must be an integer" },
      min: [1, "quantity must be at least 1"],
    },
    unitPriceCents: {
      type: Number,
      required: true,
      validate: { validator: Number.isInteger, message: "unitPriceCents must be an integer" },
      min: [1, "unitPriceCents must be a positive integer"],
    },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    paymentId: { type: String, required: true },
    amountCents: {
      type: Number,
      required: true,
      validate: { validator: Number.isInteger, message: "amountCents must be an integer" },
      min: [1, "amountCents must be a positive integer"],
    },
    appliedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

// amountDueCents is the remaining balance, decremented as payments are applied.
const invoiceSchema = new mongoose.Schema(
  {
    // Human-readable id (e.g. "INV-1001"), assigned via the Counter model.
    _id: { type: String },
    lineItems: {
      type: [lineItemSchema],
      required: true,
      validate: { validator: (items) => Array.isArray(items) && items.length > 0, message: "lineItems must contain at least 1 item" },
    },
    amountDueCents: {
      type: Number,
      required: true,
      validate: { validator: Number.isInteger, message: "amountDueCents must be an integer" },
      min: [0, "amountDueCents cannot be negative"],
    },
    status: { type: String, required: true, enum: INVOICE_STATUSES, default: "draft" },
    dueDate: { type: Date, required: true },
    payments: { type: [paymentSchema], default: [] },
  },
  { timestamps: true }
);

// paymentId is unique collection-wide, making duplicate webhook calls safe to retry.
invoiceSchema.index({ "payments.paymentId": 1 }, { unique: true, sparse: true });

export const Invoice = mongoose.model("Invoice", invoiceSchema);
export { INVOICE_STATUSES };
