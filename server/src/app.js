import express from "express";
import cors from "cors";
import accountRoutes from "./routes/accountRoutes.js";
import ledgerRoutes from "./routes/ledgerRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

  app.use("/api/accounts", accountRoutes);
  app.use("/api/ledger", ledgerRoutes);

  // Must be mounted last — catches every thrown/rejected error from routes.
  app.use(errorHandler);

  return app;
}
