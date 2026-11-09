import { describe, expect, it } from "vitest";
import { formatAmount } from "./format";

describe("formatAmount", () => {
  it.each([
    ["0.00", "0.00"],
    ["42.18", "42.18"],
    ["999.99", "999.99"],
    ["1000.00", "1,000.00"],
    ["35650.75", "35,650.75"],
    ["1234567.00", "1,234,567.00"],
    ["-800.25", "(800.25)"],
    ["-44480.14", "(44,480.14)"],
    ["-1234567.89", "(1,234,567.89)"],
    ["90071992547409.93", "90,071,992,547,409.93"],
  ])("formats %s as %s", (input, expected) => {
    expect(formatAmount(input)).toBe(expected);
  });
});
