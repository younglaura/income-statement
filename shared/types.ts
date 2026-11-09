/**
 * Response of GET /income-statement, shared by server and web.
 * Money values are decimal strings like "-800.25" (JSON numbers would become floats).
 */

/** Inclusive date range, both ends "YYYY-MM-DD". */
export interface Period {
  start: string;
  end: string;
}

export type SectionKey = "revenue" | "cogs" | "operating_expenses" | "other_income";

export interface IncomeStatementLine {
  account: string;
  name: string;
  amount: string;
}

export interface IncomeStatementSection {
  key: SectionKey;
  label: string;
  lines: IncomeStatementLine[];
  total: string;
}

export interface IncomeStatement {
  company: string;
  currency: string;
  period: Period;
  sections: IncomeStatementSection[];
  summary: {
    gross_profit: string;
    operating_income: string;
    net_income: string;
  };
}
