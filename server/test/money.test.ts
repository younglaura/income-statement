import { describe, expect, it } from "vitest";
import { formatMoney, parseMoney } from "../src/money";

describe("parseMoney", () => {
  it.each([
    ["0.00", 0n],
    ["0.05", 5n],
    ["0.10", 10n],
    ["42.18", 4218n],
    ["1199.97", 119997n],
    ["12450.75", 1245075n],
  ])("parses %s as %s cents", (text, cents) => {
    expect(parseMoney(text)).toBe(cents);
  });

  it.each(["", "abc", "12", "12.5", "12.345", "1,000.00", "-5.00", " 5.00", "1e3"])(
    "rejects %j",
    (text) => {
      expect(() => parseMoney(text)).toThrow();
    },
  );
});

describe("formatMoney", () => {
  it.each([
    [0n, "0.00"],
    [5n, "0.05"],
    [-5n, "-0.05"],
    [119997n, "1199.97"],
    [-80025n, "-800.25"],
    [-4448014n, "-44480.14"],
  ])("formats %s cents as %s", (cents, text) => {
    expect(formatMoney(cents)).toBe(text);
  });
});

describe("exact arithmetic", () => {
  it("does not drift like floats do (Q1 net income from the section totals)", () => {
    expect(37850.5 - 14272.75 - 68100.07 + 42.18).toBe(-44480.14000000001);
    const net =
      parseMoney("37850.50") - parseMoney("14272.75") - parseMoney("68100.07") + parseMoney("42.18");
    expect(formatMoney(net)).toBe("-44480.14");
  });

  it("round-trips every amount in the expected range", () => {
    for (const text of ["0.01", "0.99", "1.00", "650.25", "18500.00"]) {
      expect(formatMoney(parseMoney(text))).toBe(text);
    }
  });
});

describe("large amounts", () => {
  // Number.MAX_SAFE_INTEGER is 9007199254740991; float cents stop being exact past it.
  const PAST_SAFE_INTEGER = "90071992547409.93"; // 9007199254740993 cents

  it("parses amounts past Number.MAX_SAFE_INTEGER cents exactly", () => {
    expect(parseMoney(PAST_SAFE_INTEGER)).toBe(9007199254740993n);
    // A detour through Number (float) silently drops the last cent:
    expect(BigInt(Number(parseMoney(PAST_SAFE_INTEGER)))).toBe(9007199254740992n);
  });

  it("adds across the Number.MAX_SAFE_INTEGER boundary without losing cents", () => {
    const sum = parseMoney("90071992547409.91") + parseMoney("0.02");
    expect(formatMoney(sum)).toBe(PAST_SAFE_INTEGER);
  });

  it("round-trips amounts far beyond any 64-bit integer", () => {
    const huge = "123456789012345678901234567890.99";
    expect(formatMoney(parseMoney(huge))).toBe(huge);
    expect(formatMoney(-parseMoney(huge))).toBe(`-${huge}`);
  });

  it("sums many large lines exactly", () => {
    let total = 0n;
    for (let i = 0; i < 1000; i++) total += parseMoney("99999999999999.99");
    expect(formatMoney(total)).toBe("99999999999999990.00");
  });
});
