import { ApiRequestError } from "../api/client.ts";

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

/**
 * User-facing text for a caught error. The backend only crafts a message
 * for the "expected failure" codes (400/404/409/422 — see CLAUDE.md); those
 * are meant to be read by whoever is filling in the form, so show them
 * as-is. Everything else — 5xx, a network failure, a raw browser/fetch
 * error, anything unrecognized — collapses to one generic message so
 * backend internals never reach the UI.
 */
export function getDisplayMessage(err: unknown): string {
  if (err instanceof ApiRequestError && err.status >= 400 && err.status < 500) {
    return err.message;
  }
  return GENERIC_MESSAGE;
}
