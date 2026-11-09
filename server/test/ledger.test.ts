import { describe, expect, it } from "vitest";
import { LedgerError, loadLedger, readLedgerFile } from "../src/ledger";

const LEDGER_PATH = new URL("../../ledger.json", import.meta.url);

/** Smallest valid raw ledger. Tests clone it and break one thing. */
function validRaw() {
  return {
    company: "Test Co",
    currency: "USD",
    accounts: [
      { number: "1000", name: "Cash", type: "asset", subtype: "balance_sheet", is_active: true },
      { number: "4000", name: "Sales", type: "revenue", subtype: "operating_revenue", is_active: true },
    ],
    journal_entries: [
      {
        id: "JE-1",
        date: "2026-01-15",
        status: "posted",
        memo: "sale",
        lines: [
          { account: "1000", debit: "100.00", credit: "0.00" },
          { account: "4000", debit: "0.00", credit: "100.00" },
        ],
      },
    ],
  };
}

describe("loadLedger with the real ledger.json", () => {
  it("loads every account and entry", () => {
    const ledger = readLedgerFile(LEDGER_PATH);
    expect(ledger.company).toBe("Northwind Coffee Roasters");
    expect(ledger.accounts.size).toBe(15);
    expect(ledger.entries).toHaveLength(25);
  });

  it("parses amounts into cents and keeps inactive accounts", () => {
    const ledger = readLedgerFile(LEDGER_PATH);
    const je016 = ledger.entries.find((e) => e.id === "JE-016");
    expect(je016?.lines.map((l) => [l.account, l.debit, l.credit])).toEqual([
      ["1100", 1485000n, 0n],
      ["4900", 15000n, 0n],
      ["4000", 0n, 1500000n],
    ]);
    expect(ledger.accounts.get("6300")?.isActive).toBe(false);
  });
});

describe("loadLedger validation", () => {
  it("accepts the minimal valid fixture", () => {
    expect(() => loadLedger(validRaw())).not.toThrow();
  });

  it("rejects an unbalanced entry", () => {
    const raw = validRaw();
    raw.journal_entries[0]!.lines[1]!.credit = "99.99";
    expect(() => loadLedger(raw)).toThrow(LedgerError);
  });

  it("rejects a line referencing an unknown account", () => {
    const raw = validRaw();
    raw.journal_entries[0]!.lines[1]!.account = "9999";
    expect(() => loadLedger(raw)).toThrow(/JE-1 line 2: unknown account "9999"/);
  });

  it("rejects a line with both debit and credit non-zero", () => {
    const raw = validRaw();
    raw.journal_entries[0]!.lines[0]!.credit = "100.00";
    raw.journal_entries[0]!.lines[1]!.debit = "100.00";
    expect(() => loadLedger(raw)).toThrow(/exactly one of debit or credit/);
  });

  it("rejects a line with both debit and credit zero", () => {
    const raw = validRaw();
    raw.journal_entries[0]!.lines.push({ account: "1000", debit: "0.00", credit: "0.00" });
    expect(() => loadLedger(raw)).toThrow(/JE-1 line 3: exactly one of debit or credit/);
  });

  it("rejects an entry with fewer than two lines", () => {
    const raw = validRaw();
    raw.journal_entries[0]!.lines = [];
    expect(() => loadLedger(raw)).toThrow(/at least two lines/);
  });

  it("rejects a malformed date (2026-1-5)", () => {
    const raw = validRaw();
    raw.journal_entries[0]!.date = "2026-1-5";
    expect(() => loadLedger(raw)).toThrow(/invalid date/);
  });

  it("rejects an impossible date (2026-02-30)", () => {
    const raw = validRaw();
    raw.journal_entries[0]!.date = "2026-02-30";
    expect(() => loadLedger(raw)).toThrow(/invalid date/);
  });

  it("rejects an unknown status", () => {
    const raw = validRaw();
    raw.journal_entries[0]!.status = "pending";
    expect(() => loadLedger(raw)).toThrow(/unknown status "pending"/);
  });

  it("rejects an unknown account type or subtype", () => {
    const badType = validRaw();
    badType.accounts[1]!.type = "income";
    expect(() => loadLedger(badType)).toThrow(/account 4000: unknown type/);

    const badSubtype = validRaw();
    badSubtype.accounts[1]!.subtype = "sales";
    expect(() => loadLedger(badSubtype)).toThrow(/account 4000: unknown subtype/);
  });

  it("rejects a type that does not fit its subtype (asset filed as cogs)", () => {
    const raw = validRaw();
    raw.accounts[0]!.subtype = "cogs";
    expect(() => loadLedger(raw)).toThrow(/type asset cannot have subtype cogs/);
  });

  it("rejects duplicate account numbers", () => {
    const raw = validRaw();
    raw.accounts.push({ ...raw.accounts[0]!, name: "Cash again" });
    expect(() => loadLedger(raw)).toThrow(/duplicate account number 1000/);
  });

  it("rejects duplicate entry ids", () => {
    const raw = validRaw();
    raw.journal_entries.push(structuredClone(raw.journal_entries[0]!));
    expect(() => loadLedger(raw)).toThrow(/duplicate entry id JE-1/);
  });

  it("rejects a non-money amount string (12.5)", () => {
    const raw = validRaw();
    raw.journal_entries[0]!.lines[0]!.debit = "12.5";
    expect(() => loadLedger(raw)).toThrow(LedgerError);
  });

  it("validates draft and void entries too", () => {
    const raw = validRaw();
    raw.journal_entries[0]!.status = "void";
    raw.journal_entries[0]!.lines[1]!.credit = "99.99";
    expect(() => loadLedger(raw)).toThrow(/debits do not equal credits/);
  });

  it("rejects an entry with exactly one line", () => {
    const raw = validRaw();
    raw.journal_entries[0]!.lines.pop();
    expect(() => loadLedger(raw)).toThrow(/JE-1: needs at least two lines/);
  });

  it.each([
    ["null", null],
    ["an array", []],
    ["no accounts array", { company: "T", currency: "USD", journal_entries: [] }],
    ["no journal_entries array", { company: "T", currency: "USD", accounts: [] }],
  ])("rejects a ledger that is %s", (_name, raw) => {
    expect(() => loadLedger(raw)).toThrow(/ledger must have accounts and journal_entries arrays/);
  });
});

describe("loadLedger field types (the JSON is outside the type system)", () => {
  type Raw = ReturnType<typeof validRaw>;
  type Field = Record<string, unknown>;
  const account = (raw: Raw) => raw.accounts[1] as unknown as Field;
  const entry = (raw: Raw) => raw.journal_entries[0] as unknown as Field;
  const line = (raw: Raw) => raw.journal_entries[0]!.lines[0] as unknown as Field;

  it.each<[string, (raw: Raw) => void, RegExp]>([
    ["company missing", (raw) => delete (raw as Partial<Raw>).company, /ledger company must be a non-empty string/],
    ["currency is a number", (raw) => ((raw as unknown as Field).currency = 840), /ledger currency must be a non-empty string, got 840/],
    ["account number is a JSON number", (raw) => (account(raw).number = 4000), /account #2 number must be a non-empty string, got 4000/],
    ["account number is empty", (raw) => (account(raw).number = ""), /account #2 number must be a non-empty string/],
    ["account name missing", (raw) => delete account(raw).name, /account 4000 name must be a non-empty string/],
    ["is_active missing", (raw) => delete account(raw).is_active, /account 4000: is_active must be true or false, got undefined/],
    ["is_active is \"yes\"", (raw) => (account(raw).is_active = "yes"), /account 4000: is_active must be true or false, got "yes"/],
    ["account is not an object", (raw) => ((raw.accounts as unknown[])[1] = "4000"), /account #2 must be an object/],
    ["entry id missing", (raw) => delete entry(raw).id, /entry #1 id must be a non-empty string/],
    ["memo missing", (raw) => delete entry(raw).memo, /entry JE-1 memo must be a string, got undefined/],
    ["line account is a JSON number", (raw) => (line(raw).account = 1000), /JE-1 line 1 account must be a non-empty string, got 1000/],
    ["debit is a JSON number", (raw) => (line(raw).debit = 100), /JE-1 line 1 debit must be a non-empty string, got 100/],
    ["credit missing", (raw) => delete line(raw).credit, /JE-1 line 1 credit must be a non-empty string/],
    ["line is not an object", (raw) => ((raw.journal_entries[0]!.lines as unknown[])[0] = null), /JE-1 line 1 must be an object/],
  ])("rejects %s", (_name, mutate, message) => {
    const raw = validRaw();
    mutate(raw);
    expect(() => loadLedger(raw)).toThrow(LedgerError);
    expect(() => loadLedger(raw)).toThrow(message);
  });

  it("allows an empty memo", () => {
    const raw = validRaw();
    raw.journal_entries[0]!.memo = "";
    expect(loadLedger(raw).entries[0]!.memo).toBe("");
  });
});
