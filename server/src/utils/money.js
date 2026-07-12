// All money is handled as integer cents. Never use floats for currency math
// (0.1 + 0.2 !== 0.3 in IEEE-754) — see CLAUDE.md "Money Rules".

/**
 * Convert a decimal dollar amount (string or number, e.g. "12.34" or 12.3)
 * into integer cents (1234). Parses as a string to avoid float artifacts.
 */
export function toCents(amount) {
  const str = String(amount).trim();

  if (!/^-?\d+(\.\d{1,2})?$/.test(str)) {
    throw new Error(`Invalid money amount: ${amount}`);
  }

  const negative = str.startsWith("-");
  const unsigned = negative ? str.slice(1) : str;
  const [wholePart, fractionPart = ""] = unsigned.split(".");
  const cents = fractionPart.padEnd(2, "0");

  const total = Number(wholePart) * 100 + Number(cents);
  return negative ? -total : total;
}

/** Convert integer cents (1234) into a fixed decimal dollar string ("12.34"). */
export function formatCents(cents) {
  if (!isValidCents(cents, { allowZero: true, allowNegative: true })) {
    throw new Error(`Invalid cents value: ${cents}`);
  }

  const negative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = String(abs % 100).padStart(2, "0");

  return `${negative ? "-" : ""}${dollars}.${remainder}`;
}

/** True if value is a valid integer cents amount (positive by default). */
export function isValidCents(value, { allowZero = false, allowNegative = false } = {}) {
  if (typeof value !== "number" || !Number.isInteger(value)) return false;
  if (!allowNegative && value < 0) return false;
  if (!allowZero && value === 0) return false;
  return true;
}
