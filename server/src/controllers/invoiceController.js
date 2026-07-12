import { z } from "zod";
import { create, getById, applyPayment } from "../services/invoiceService.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { ApiError } from "../utils/ApiError.js";

const lineItemSchema = z.object({
  description: z.string().trim().min(1),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().positive(),
});

const createInvoiceSchema = z.object({
  lineItems: z.array(lineItemSchema).min(1),
  dueDate: z.coerce.date(),
});

const applyPaymentSchema = z.object({
  paymentId: z.string().trim().min(1),
  amountCents: z.number().int().positive(),
});

export const createInvoice = asyncHandler(async (req, res) => {
  const parsed = createInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0].message);
  }

  const invoice = await create(parsed.data);
  res.status(201).json(invoice);
});

export const getInvoice = asyncHandler(async (req, res) => {
  const invoice = await getById(req.params.id);
  res.status(200).json(invoice);
});

export const payInvoice = asyncHandler(async (req, res) => {
  const parsed = applyPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0].message);
  }

  const invoice = await applyPayment(req.params.id, parsed.data);
  res.status(409).json(invoice);
});
