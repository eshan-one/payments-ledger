import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";

/** Wrap an async route handler so a rejected promise reaches errorHandler. */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** Central error handler — must be mounted last. Turns every throw into JSON. */
export function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message });
  }

  logger.error(err);
  return res.status(500).json({ error: "Internal server error" });
}
