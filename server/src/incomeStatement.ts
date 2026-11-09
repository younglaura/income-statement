import type { IncomeStatement, Period, SectionKey } from "../../shared/types";
import type { AccountSubtype, Ledger } from "./ledger";
import { formatMoney, ZERO, type Money } from "./money";

interface SectionSpec {
  key: SectionKey;
  label: string;
  subtypes: readonly AccountSubtype[];
  /** Side that increases the section: credit for income sections, debit for expense sections. */
  normal: "debit" | "credit";
}

/**
 * The statement layout, in display order. The only place that maps subtypes to sections.
 * balance_sheet is in no section, so those accounts never appear.
 */
export const SECTIONS: readonly SectionSpec[] = [
  { key: "revenue", label: "Revenue", subtypes: ["operating_revenue", "contra_revenue"], normal: "credit" },
  { key: "cogs", label: "Cost of goods sold", subtypes: ["cogs"], normal: "debit" },
  { key: "operating_expenses", label: "Operating expenses", subtypes: ["operating_expense"], normal: "debit" },
  { key: "other_income", label: "Other income", subtypes: ["other_income"], normal: "credit" },
];

export interface StatementLine {
  account: string;
  name: string;
  amount: Money;
}

export interface StatementSection {
  key: SectionKey;
  label: string;
  lines: StatementLine[];
  total: Money;
}

/** Domain result: same shape as the API response, but with exact bigint amounts. */
export interface Statement {
  company: string;
  currency: string;
  period: Period;
  sections: StatementSection[];
  grossProfit: Money;
  operatingIncome: Money;
  netIncome: Money;
}

/**
 * Builds the income statement for posted entries dated start..end (inclusive).
 *
 * Each line is signed toward its section's normal side: revenue = credit - debit,
 * expenses = debit - credit. loadLedger guarantees revenue/expense types match their
 * subtypes, so this is the same as signing by account type. So contra revenue comes out
 * negative, a credit to an expense reduces it, and an expense-typed account under
 * other_income (e.g. interest expense) shows negative and subtracts.
 *
 * Every income-statement account gets a line, including zero ones, so the layout is stable.
 */
export function incomeStatement(ledger: Ledger, period: Period): Statement {
  const netDebits = netDebitsByAccount(ledger, period);
  const accounts = [...ledger.accounts.values()];

  const sections = SECTIONS.map((spec): StatementSection => {
    const lines = accounts
      .filter((account) => spec.subtypes.includes(account.subtype))
      .map((account) => {
        const net = netDebits.get(account.number) ?? ZERO;
        return { account: account.number, name: account.name, amount: spec.normal === "debit" ? net : -net };
      });
    const total = lines.reduce((sum, line) => sum + line.amount, ZERO);
    return { key: spec.key, label: spec.label, lines, total };
  });

  const total = (key: SectionKey) => sections.find((s) => s.key === key)!.total;
  const grossProfit = total("revenue") - total("cogs");
  const operatingIncome = grossProfit - total("operating_expenses");
  const netIncome = operatingIncome + total("other_income");

  return {
    company: ledger.company,
    currency: ledger.currency,
    period,
    sections,
    grossProfit,
    operatingIncome,
    netIncome,
  };
}

/** debit - credit per account number, over posted entries dated within the period. */
function netDebitsByAccount(ledger: Ledger, period: Period): Map<string, Money> {
  const totals = new Map<string, Money>();
  for (const entry of ledger.entries) {
    if (entry.status !== "posted") continue;
    if (entry.date < period.start || entry.date > period.end) continue;
    for (const line of entry.lines) {
      totals.set(line.account, (totals.get(line.account) ?? ZERO) + line.debit - line.credit);
    }
  }
  return totals;
}

/** Converts bigint amounts to decimal strings for the JSON response. */
export function toIncomeStatementResponse(statement: Statement): IncomeStatement {
  return {
    company: statement.company,
    currency: statement.currency,
    period: statement.period,
    sections: statement.sections.map((section) => ({
      key: section.key,
      label: section.label,
      lines: section.lines.map((line) => ({ account: line.account, name: line.name, amount: formatMoney(line.amount) })),
      total: formatMoney(section.total),
    })),
    summary: {
      gross_profit: formatMoney(statement.grossProfit),
      operating_income: formatMoney(statement.operatingIncome),
      net_income: formatMoney(statement.netIncome),
    },
  };
}
