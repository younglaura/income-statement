/**
 * Money is an integer number of cents, stored as a bigint so sums are exact.
 * Never convert to `number` (float). Parse from and format to decimal strings only.
 */
export type Money = bigint;

export const ZERO: Money = 0n;

const MONEY_PATTERN = /^(\d+)\.(\d{2})$/;

/**
 * Parses a ledger amount like "12450.75" into cents (1245075n).
 * Accepts only non-negative amounts with exactly two decimal places, which is the
 * format of every debit/credit in ledger.json. Throws on anything else.
 */
export function parseMoney(text: string): Money {
  const match = MONEY_PATTERN.exec(text);
  if (!match) {
    throw new Error(`Invalid money amount ${JSON.stringify(text)}: expected digits with two decimals, like "12.50"`);
  }
  const whole = match[1]!;
  const cents = match[2]!;
  return BigInt(whole) * 100n + BigInt(cents);
}

/**
 * Formats cents as a plain decimal string: 119997n -> "1199.97", -80025n -> "-800.25",
 * 5n -> "0.05". No thousands separators or parentheses; that is the UI's job.
 */
export function formatMoney(cents: Money): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = abs / 100n;
  const rest = (abs % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${rest}`;
}
