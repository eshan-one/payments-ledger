import { Router } from "express";
import { createTransaction } from "../controllers/ledgerController.js";

const router = Router();

router.post("/transactions", createTransaction);

export default router;
