// Money is always integer cents on the wire. This module only converts at
// the two edges (display and user input) — it never does money arithmetic.

/** Format integer cents for display, e.g. 1234 -> "$12.34". */
export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/** Parse a dollar string (e.g. "12.34") into integer cents, or null if invalid. */
export function parseDollarsToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;

  const [wholePart, fractionPart = ""] = trimmed.split(".");
  const cents = Number(wholePart) * 100 + Number(fractionPart.padEnd(2, "0"));
  return cents > 0 ? cents : null;
}
