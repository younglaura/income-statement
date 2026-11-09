import type { Period } from "../../shared/types";
import { isIsoDate } from "./dates";

/** A bad start/end from the request. The route turns it into a 400. */
export class PeriodError extends Error {
  override name = "PeriodError";
}

/**
 * Validates the raw start/end query values into an inclusive Period.
 * Takes `unknown` because Express query values can be missing, strings, or arrays (?start=a&start=b).
 */
export function parsePeriod(start: unknown, end: unknown): Period {
  if (start === undefined || end === undefined) {
    throw new PeriodError("start and end are required, e.g. ?start=2026-01-01&end=2026-03-31");
  }
  if (!isIsoDate(start)) throw new PeriodError(`start must be a real date as YYYY-MM-DD, got ${JSON.stringify(start)}`);
  if (!isIsoDate(end)) throw new PeriodError(`end must be a real date as YYYY-MM-DD, got ${JSON.stringify(end)}`);
  if (start > end) throw new PeriodError(`start (${start}) must be on or before end (${end})`);
  return { start, end };
}
