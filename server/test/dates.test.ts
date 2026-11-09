import { describe, expect, it } from "vitest";
import { isIsoDate } from "../src/dates";

describe("isIsoDate", () => {
  it.each(["2026-01-01", "2026-12-31", "2028-02-29", "2000-02-29"])("accepts %s", (text) => {
    expect(isIsoDate(text)).toBe(true);
  });

  it.each([
    ["empty string", ""],
    ["no zero padding", "2026-1-5"],
    ["month 13", "2026-13-01"],
    ["month 00", "2026-00-10"],
    ["April 31", "2026-04-31"],
    ["Feb 29 in a non-leap year", "2026-02-29"],
    ["Feb 29 in 1900 (century, not leap)", "1900-02-29"],
    ["a timestamp", "2026-01-01T00:00:00Z"],
    ["surrounding space", " 2026-01-01"],
    ["a number", 20260101],
    ["null", null],
    ["undefined", undefined],
  ])("rejects %s", (_name, value) => {
    expect(isIsoDate(value)).toBe(false);
  });
});
