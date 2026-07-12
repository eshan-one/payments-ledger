import { Router } from "express";
import { createAccount, listAccounts, getAccountBalance } from "../controllers/accountController.js";

const router = Router();

router.post("/", createAccount);
router.get("/", listAccounts);
router.get("/:id/balance", getAccountBalance);

export default router;
