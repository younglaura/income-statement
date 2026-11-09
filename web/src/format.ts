/**
 * Display format for a money string from the API: "-44480.14" -> "(44,480.14)".
 * Pure string work, no parseFloat: the server already did the exact math.
 */
export function formatAmount(amount: string): string {
  const negative = amount.startsWith("-");
  const [whole = "", cents = ""] = (negative ? amount.slice(1) : amount).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return negative ? `(${grouped}.${cents})` : `${grouped}.${cents}`;
}
