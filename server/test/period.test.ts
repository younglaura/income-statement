import { describe, expect, it } from "vitest";
import { parsePeriod, PeriodError } from "../src/period";

describe("parsePeriod", () => {
  it("accepts a valid range", () => {
    expect(parsePeriod("2026-01-01", "2026-03-31")).toEqual({ start: "2026-01-01", end: "2026-03-31" });
  });

  it("accepts a single day (start == end)", () => {
    expect(parsePeriod("2026-03-31", "2026-03-31")).toEqual({ start: "2026-03-31", end: "2026-03-31" });
  });

  it("accepts Feb 29 in a leap year", () => {
    expect(parsePeriod("2028-02-29", "2028-02-29")).toEqual({ start: "2028-02-29", end: "2028-02-29" });
  });

  it.each([
    ["missing start", undefined, "2026-03-31", /required/],
    ["missing end", "2026-01-01", undefined, /required/],
    ["malformed start", "2026-1-1", "2026-03-31", /start must be a real date/],
    ["impossible end", "2026-01-01", "2026-02-30", /end must be a real date/],
    ["Feb 29 in a non-leap year", "2026-02-29", "2026-03-31", /start must be a real date/],
    ["repeated param", ["2026-01-01", "2026-02-01"], "2026-03-31", /start must be a real date/],
    ["start after end", "2026-04-01", "2026-03-31", /on or before end/],
  ])("rejects %s", (_name, start, end, message) => {
    expect(() => parsePeriod(start, end)).toThrow(PeriodError);
    expect(() => parsePeriod(start, end)).toThrow(message);
  });
});
