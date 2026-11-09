import { describe, expect, it } from "vitest";
import type { Period } from "../../shared/types";
import { incomeStatement, toIncomeStatementResponse, type Statement } from "../src/incomeStatement";
import { loadLedger, readLedgerFile, type Ledger } from "../src/ledger";
import { formatMoney, ZERO, type Money } from "../src/money";

const realLedger = readLedgerFile(new URL("../../ledger.json", import.meta.url));
const Q1: Period = { start: "2026-01-01", end: "2026-03-31" };

// ---- small inline ledgers, so each rule test reads on its own ----

const TEST_ACCOUNTS = [
  { number: "1000", name: "Cash", type: "asset", subtype: "balance_sheet" },
  { number: "4000", name: "Sales", type: "revenue", subtype: "operating_revenue" },
  { number: "4900", name: "Returns", type: "revenue", subtype: "contra_revenue" },
  { number: "5000", name: "COGS", type: "expense", subtype: "cogs" },
  { number: "6200", name: "Software", type: "expense", subtype: "operating_expense" },
  { number: "7000", name: "Interest income", type: "revenue", subtype: "other_income" },
  { number: "7100", name: "Interest expense", type: "expense", subtype: "other_income" },
];

type Line = [account: string, debit: string, credit: string];

function entry(id: string, date: string, lines: Line[], status = "posted") {
  return {
    id,
    date,
    status,
    memo: id,
    lines: lines.map(([account, debit, credit]) => ({ account, debit, credit })),
  };
}

function sale(id: string, date: string, amount: string, status = "posted") {
  return entry(id, date, [["1000", amount, "0.00"], ["4000", "0.00", amount]], status);
}

function ledgerOf(...entries: ReturnType<typeof entry>[]): Ledger {
  return loadLedger({
    company: "Test Co",
    currency: "USD",
    accounts: TEST_ACCOUNTS.map((a) => ({ ...a, is_active: true })),
    journal_entries: entries,
  });
}

/** Formatted amount of one account's line, e.g. amountOf(s, "4000") === "100.00". */
function amountOf(statement: Statement, account: string): string | undefined {
  const line = statement.sections.flatMap((s) => s.lines).find((l) => l.account === account);
  return line && formatMoney(line.amount);
}

function sectionTotal(statement: Statement, key: string): string {
  return formatMoney(statement.sections.find((s) => s.key === key)!.total);
}

// ---- tests ----

describe("golden: Q1 2026 from the real ledger", () => {
  it("matches the hand-checked statement line by line", () => {
    expect(toIncomeStatementResponse(incomeStatement(realLedger, Q1))).toEqual({
      company: "Northwind Coffee Roasters",
      currency: "USD",
      period: Q1,
      sections: [
        {
          key: "revenue",
          label: "Revenue",
          lines: [
            { account: "4000", name: "Product Revenue", amount: "35650.75" },
            { account: "4100", name: "Subscription Revenue", amount: "3000.00" },
            { account: "4900", name: "Sales Returns & Discounts", amount: "-800.25" },
          ],
          total: "37850.50",
        },
        {
          key: "cogs",
          label: "Cost of goods sold",
          lines: [{ account: "5000", name: "Cost of Goods Sold", amount: "14272.75" }],
          total: "14272.75",
        },
        {
          key: "operating_expenses",
          label: "Operating expenses",
          lines: [
            { account: "6000", name: "Salaries", amount: "55500.00" },
            { account: "6100", name: "Rent", amount: "9000.00" },
            { account: "6200", name: "Software", amount: "1099.97" },
            { account: "6300", name: "Marketing (legacy)", amount: "2500.10" },
          ],
          total: "68100.07",
        },
        {
          key: "other_income",
          label: "Other income",
          lines: [{ account: "7000", name: "Interest Income", amount: "42.18" }],
          total: "42.18",
        },
      ],
      summary: {
        gross_profit: "23577.75",
        operating_income: "-44522.32",
        net_income: "-44480.14",
      },
    });
  });
});

describe("which entries count", () => {
  it("ignores draft and void entries", () => {
    const s = incomeStatement(
      ledgerOf(sale("JE-1", "2026-02-01", "100.00"), sale("JE-2", "2026-02-01", "50.00", "draft"), sale("JE-3", "2026-02-01", "25.00", "void")),
      Q1,
    );
    expect(amountOf(s, "4000")).toBe("100.00");
    expect(formatMoney(s.netIncome)).toBe("100.00");
  });

  it("includes both boundary days and excludes the days just outside", () => {
    const ledger = ledgerOf(
      sale("before", "2025-12-31", "1.00"),
      sale("start", "2026-01-01", "10.00"),
      sale("end", "2026-03-31", "100.00"),
      sale("after", "2026-04-01", "1000.00"),
    );
    expect(amountOf(incomeStatement(ledger, Q1), "4000")).toBe("110.00");
  });

  it("supports a single-day range", () => {
    const ledger = ledgerOf(sale("JE-1", "2026-03-30", "1.00"), sale("JE-2", "2026-03-31", "100.00"));
    expect(amountOf(incomeStatement(ledger, { start: "2026-03-31", end: "2026-03-31" }), "4000")).toBe("100.00");
  });

  it("still reports posted activity on an inactive account", () => {
    const ledger = loadLedger({
      company: "Test Co",
      currency: "USD",
      accounts: TEST_ACCOUNTS.map((a) => ({ ...a, is_active: a.number !== "6200" })),
      journal_entries: [entry("old bill", "2026-01-10", [["6200", "25.00", "0.00"], ["1000", "0.00", "25.00"]])],
    });
    expect(ledger.accounts.get("6200")!.isActive).toBe(false);
    expect(amountOf(incomeStatement(ledger, Q1), "6200")).toBe("25.00");
  });
});

describe("signs", () => {
  it("contra revenue is negative and reduces revenue", () => {
    const s = incomeStatement(
      ledgerOf(sale("JE-1", "2026-01-10", "1000.00"), entry("JE-2", "2026-01-11", [["4900", "50.00", "0.00"], ["1000", "0.00", "50.00"]])),
      Q1,
    );
    expect(amountOf(s, "4900")).toBe("-50.00");
    expect(sectionTotal(s, "revenue")).toBe("950.00");
  });

  it("a credit to an expense account reduces that expense", () => {
    const s = incomeStatement(
      ledgerOf(
        entry("bill", "2026-01-10", [["6200", "300.00", "0.00"], ["1000", "0.00", "300.00"]]),
        entry("refund", "2026-01-20", [["1000", "100.00", "0.00"], ["6200", "0.00", "100.00"]]),
      ),
      Q1,
    );
    expect(amountOf(s, "6200")).toBe("200.00");
    expect(sectionTotal(s, "operating_expenses")).toBe("200.00");
    expect(sectionTotal(s, "revenue")).toBe("0.00");
  });

  it("other income adds, and an expense-typed other_income account subtracts", () => {
    const s = incomeStatement(
      ledgerOf(
        entry("interest", "2026-01-31", [["1000", "40.00", "0.00"], ["7000", "0.00", "40.00"]]),
        entry("loan interest", "2026-01-31", [["7100", "15.00", "0.00"], ["1000", "0.00", "15.00"]]),
      ),
      Q1,
    );
    expect(amountOf(s, "7000")).toBe("40.00");
    expect(amountOf(s, "7100")).toBe("-15.00");
    expect(sectionTotal(s, "other_income")).toBe("25.00");
    expect(formatMoney(s.netIncome)).toBe("25.00");
  });

  it("subtotals chain: gross profit, operating income, net income", () => {
    const s = incomeStatement(
      ledgerOf(
        sale("sale", "2026-01-05", "1000.00"),
        entry("cogs", "2026-01-05", [["5000", "400.00", "0.00"], ["1000", "0.00", "400.00"]]),
        entry("opex", "2026-01-06", [["6200", "700.00", "0.00"], ["1000", "0.00", "700.00"]]),
        entry("int", "2026-01-31", [["1000", "5.00", "0.00"], ["7000", "0.00", "5.00"]]),
      ),
      Q1,
    );
    expect(formatMoney(s.grossProfit)).toBe("600.00");
    expect(formatMoney(s.operatingIncome)).toBe("-100.00");
    expect(formatMoney(s.netIncome)).toBe("-95.00");
  });
});

describe("layout", () => {
  it("shows every income-statement account, at 0.00 when it has no activity, and no balance-sheet accounts", () => {
    const s = incomeStatement(ledgerOf(), Q1);
    expect(s.sections.map((sec) => [sec.key, sec.lines.map((l) => l.account)])).toEqual([
      ["revenue", ["4000", "4900"]],
      ["cogs", ["5000"]],
      ["operating_expenses", ["6200"]],
      ["other_income", ["7000", "7100"]],
    ]);
    expect(s.sections.flatMap((sec) => sec.lines).every((l) => l.amount === ZERO)).toBe(true);
    expect(amountOf(s, "1000")).toBeUndefined();
    expect(formatMoney(s.netIncome)).toBe("0.00");
  });
});

describe("invariants on the real ledger", () => {
  const RANGES: Period[] = [
    Q1,
    { start: "2026-01-01", end: "2026-01-31" },
    { start: "2025-12-01", end: "2025-12-31" },
    { start: "2025-01-01", end: "2026-12-31" },
    { start: "2026-03-31", end: "2026-03-31" },
    { start: "2030-01-01", end: "2030-12-31" },
  ];

  it.each(RANGES)("net income equals the balance-sheet side of the same entries ($start to $end)", (period) => {
    // Double entry: P&L credits - debits == balance-sheet debits - credits. Computed here on its own.
    let balanceSheetNet: Money = ZERO;
    for (const e of realLedger.entries) {
      if (e.status !== "posted" || e.date < period.start || e.date > period.end) continue;
      for (const l of e.lines) {
        if (realLedger.accounts.get(l.account)!.subtype === "balance_sheet") balanceSheetNet += l.debit - l.credit;
      }
    }
    expect(incomeStatement(realLedger, period).netIncome).toBe(balanceSheetNet);
  });

  it("January + February + March equals Q1 on every line", () => {
    const months = [
      { start: "2026-01-01", end: "2026-01-31" },
      { start: "2026-02-01", end: "2026-02-28" },
      { start: "2026-03-01", end: "2026-03-31" },
    ].map((p) => incomeStatement(realLedger, p));
    const q1 = incomeStatement(realLedger, Q1);

    q1.sections.forEach((section, si) => {
      section.lines.forEach((line, li) => {
        const summed = months.reduce((sum, m) => sum + m.sections[si]!.lines[li]!.amount, ZERO);
        expect(summed, `${line.account} ${line.name}`).toBe(line.amount);
      });
    });
    expect(months.reduce((sum, m) => sum + m.netIncome, ZERO)).toBe(q1.netIncome);
  });
});
