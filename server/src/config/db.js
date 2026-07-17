import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

export async function connectDB(uri) {
  if (!uri) {
    logger.error(
      "MONGO_URI is not set. Add it to your .env file (see .env.example)."
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    logger.info("MongoDB connected");
  } catch (err) {
    logger.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }
}
