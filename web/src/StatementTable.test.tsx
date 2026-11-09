import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { IncomeStatement } from "../../shared/types";
import { StatementTable } from "./StatementTable";

/** The server's Q1 2026 response (same values as the server golden test). */
const Q1: IncomeStatement = {
  company: "Northwind Coffee Roasters",
  currency: "USD",
  period: { start: "2026-01-01", end: "2026-03-31" },
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
  summary: { gross_profit: "23577.75", operating_income: "-44522.32", net_income: "-44480.14" },
};

/** Visible text of each table row, in order. */
function rowTexts(statement: IncomeStatement): string[] {
  const html = renderToStaticMarkup(<StatementTable statement={statement} />);
  return [...html.matchAll(/<tr[^>]*>(.*?)<\/tr>/g)].map((m) =>
    m[1]!.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim(),
  );
}

describe("StatementTable", () => {
  it("renders Q1 in statement order, with subtotals after COGS, opex and other income", () => {
    expect(rowTexts(Q1)).toEqual([
      "Revenue",
      "4000 Product Revenue 35,650.75",
      "4100 Subscription Revenue 3,000.00",
      "4900 Sales Returns & Discounts (800.25)",
      "Total revenue 37,850.50",
      "Cost of goods sold",
      "5000 Cost of Goods Sold 14,272.75",
      "Total cost of goods sold 14,272.75",
      "Gross profit 23,577.75",
      "Operating expenses",
      "6000 Salaries 55,500.00",
      "6100 Rent 9,000.00",
      "6200 Software 1,099.97",
      "6300 Marketing (legacy) 2,500.10",
      "Total operating expenses 68,100.07",
      "Operating income (44,522.32)",
      "Other income",
      "7000 Interest Income 42.18",
      "Total other income 42.18",
      "Net income (44,480.14)",
    ]);
  });

  it("shows the company, period and currency in the caption", () => {
    expect(renderToStaticMarkup(<StatementTable statement={Q1} />)).toContain(
      "Northwind Coffee Roasters · 2026-01-01 to 2026-03-31 · USD",
    );
  });
});
