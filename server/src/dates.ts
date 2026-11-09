const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True for a real calendar date written as YYYY-MM-DD ("2026-02-28"), false for
 * "2026-1-5" or "2026-02-30". Dates stay strings everywhere else; Date is used only
 * here, in UTC, to check the day exists.
 */
export function isIsoDate(text: unknown): text is string {
  if (typeof text !== "string" || !ISO_DATE.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}
