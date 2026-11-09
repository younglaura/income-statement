import { Fragment } from "react";
import type { IncomeStatement, SectionKey } from "../../shared/types";
import { formatAmount } from "./format";

/** Which summary row is shown after which section. Display only: the server computed the values. */
const SUBTOTAL_AFTER: Partial<Record<SectionKey, { label: string; key: keyof IncomeStatement["summary"] }>> = {
  cogs: { label: "Gross profit", key: "gross_profit" },
  operating_expenses: { label: "Operating income", key: "operating_income" },
  other_income: { label: "Net income", key: "net_income" },
};

export function StatementTable({ statement }: { statement: IncomeStatement }) {
  return (
    <table className="statement">
      <caption>
        {statement.company} · {statement.period.start} to {statement.period.end} · {statement.currency}
      </caption>
      <tbody>
        {statement.sections.map((section) => {
          const subtotal = SUBTOTAL_AFTER[section.key];
          return (
            <Fragment key={section.key}>
              <tr className="section-header">
                <th colSpan={2}>{section.label}</th>
              </tr>
              {section.lines.map((line) => (
                <tr key={line.account}>
                  <td className="name">
                    <span className="account">{line.account}</span> {line.name}
                  </td>
                  <td className="amount">{formatAmount(line.amount)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total {section.label.toLowerCase()}</td>
                <td className="amount">{formatAmount(section.total)}</td>
              </tr>
              {subtotal && (
                <tr className={subtotal.key === "net_income" ? "summary net" : "summary"}>
                  <td>{subtotal.label}</td>
                  <td className="amount">{formatAmount(statement.summary[subtotal.key])}</td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
