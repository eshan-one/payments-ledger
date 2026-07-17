import { ApiRequestError } from "../api/client.ts";

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

/** User-facing text for a caught error; only 4xx messages are shown as-is, else generic. */
export function getDisplayMessage(err: unknown): string {
  if (err instanceof ApiRequestError && err.status >= 400 && err.status < 500) {
    return err.message;
  }
  return GENERIC_MESSAGE;
}
