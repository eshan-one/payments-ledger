import { Router } from "express";
import { createInvoice, listInvoices, getInvoice, payInvoice } from "../controllers/invoiceController.js";

const router = Router();

router.post("/", createInvoice);
router.get("/", listInvoices);
router.get("/:id", getInvoice);
router.post("/:id/payments", payInvoice);

export default router;
