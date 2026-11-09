# Income statement take-home: spec and slices

The stack is decided (TypeScript). The remaining defaults are listed in section 8.

## 1. Goal

`GET /income-statement?start=YYYY-MM-DD&end=YYYY-MM-DD` returns an income statement for
Northwind Coffee Roasters, built from `ledger.json`. A single page has two date inputs and
shows the statement so an accountant can read it. The tests should catch real accounting
mistakes. The time limit is 2 hours, and the code has to be easy to extend by hand during
an AI-off pairing session.

Out of scope: styling, auth, deployment, Docker, a database, and a balance sheet.

## 2. Domain rules (these go into NOTES.md)

| # | Rule | Data that tests it |
|---|------|-------------------|
| R1 | Only `status == "posted"` entries count. `draft` and `void` are excluded. | JE-009 void (duplicate sale), JE-019 draft bonus, JE-025 void |
| R2 | The period is inclusive on both ends, `start <= date <= end`. Dates are compared as plain calendar dates, with no time zone. | JE-007 on 01-01, JE-021/022/023 on 03-31, JE-001 in Dec, JE-024 on 04-01 |
| R3 | The sign comes from the account `type` (normal balance), not the subtype. Revenue amount = credit - debit. Expense amount = debit - credit. | all |
| R4 | `subtype` alone decides the section. `balance_sheet` accounts never appear. | JE-004, JE-013 (balance-sheet only) |
| R5 | Contra revenue sits inside the Revenue section as its own line. It is revenue-typed, so R3 makes it negative, shown as (800.25). Revenue subtotal = net revenue. | JE-012, JE-016 (3-line entry) |
| R6 | A credit to an expense account reduces that expense. It is not dropped, and it is not moved to revenue. | JE-020 software credit |
| R7 | Inactive accounts still report their posted history. `is_active` only restricts *new* postings. | JE-008 to 6300 Marketing (legacy) |
| R8 | Report entries as recorded, with no re-accrual. Rent paid for Jan-Mar is fully expensed on 2026-01-01. | JE-007 |
| R9 | Money is exact decimal (or integer cents), never float. Values cross the wire as decimal strings like `"-800.25"`. Negatives are formatted in parentheses only in the UI. | all |
| R10 | Validate at load time and fail fast on: an unbalanced entry, an unknown account number, a line with both or neither of debit/credit non-zero, a bad date, or an unknown status/subtype. | all 25 entries balance today |
| R11 | Accounts with no activity in the period: show every income-statement account, including zero rows, so the layout stays stable across ranges (default, open to change). | most ranges |
| R12 | Other income sign: an account typed `expense` in `other_income` (e.g. interest expense) would subtract. The section subtotal is the sum of type-signed amounts. | not in data today, but the code handles it |

Bad requests return 400 with a message: missing or malformed date, or `start > end`.
A range with no entries returns all zeros, not an error.

## 3. Statement math

```
Revenue            = sum(operating_revenue) + sum(contra_revenue)   (contra is negative)
Cost of goods sold = sum(cogs)
Gross profit       = Revenue - COGS
Operating expenses = sum(operating_expense)
Operating income   = Gross profit - Operating expenses
Other income       = sum(other_income)
Net income         = Operating income + Other income
```

### Expected Q1 2026 (2026-01-01 to 2026-03-31)

Computed independently with a throwaway Decimal script. Check it by hand before trusting it.

| Account | Amount |
|---|---|
| 4000 Product Revenue | 35,650.75 |
| 4100 Subscription Revenue | 3,000.00 |
| 4900 Sales Returns & Discounts | (800.25) |
| **Revenue** | **37,850.50** |
| 5000 Cost of Goods Sold | 14,272.75 |
| **Gross profit** | **23,577.75** |
| 6000 Salaries | 55,500.00 |
| 6100 Rent | 9,000.00 |
| 6200 Software | 1,099.97 |
| 6300 Marketing (legacy) | 2,500.10 |
| **Operating expenses** | **68,100.07** |
| **Operating income** | **(44,522.32)** |
| 7000 Interest Income | 42.18 |
| **Net income** | **(44,480.14)** |

Wrong answers the tests should catch: including JE-009 adds 8,200 to revenue, including
JE-019 adds 5,000 to salaries, an exclusive end date drops all the 03-31 activity, and
float math gives a Q1 net income of -44480.14000000001.

## 4. Response shape

```json
{
  "company": "Northwind Coffee Roasters",
  "currency": "USD",
  "period": {"start": "2026-01-01", "end": "2026-03-31"},
  "sections": [
    {"key": "revenue", "label": "Revenue",
     "lines": [{"account": "4000", "name": "Product Revenue", "amount": "35650.75"}, ...],
     "total": "37850.50"},
    {"key": "cogs", ...}, {"key": "operating_expenses", ...}, {"key": "other_income", ...}
  ],
  "summary": {
    "gross_profit": "23577.75",
    "operating_income": "-44522.32",
    "net_income": "-44480.14"
  }
}
```

Why: sections are data, so the frontend renders a loop and doesn't hard-code account
numbers. Computed subtotals are kept apart from account lines so a reader never mistakes
one for the other. Amounts are strings because JSON numbers become floats in JS.

Alternative considered: one ordered `rows[]` list mixing
`{kind: "account" | "subtotal" | "computed"}`. That is simpler to render but harder to
assert on in tests.

## 5. Architecture

**Stack: TypeScript everywhere, on Node 26 (`.nvmrc`).**

- Backend: Express + TypeScript, run with `tsx watch`. Port 3001.
- Frontend: Vite + React + TypeScript. Port 5173, with `/api` proxied to 3001.
- Tests: Vitest for the domain core and the HTTP layer (supertest).
- One root `package.json` with npm workspaces (`server`, `web`). `npm run dev` starts both
  servers (via `concurrently`), and `npm test` runs the Vitest suites.
- No database. `ledger.json` is loaded and validated once at startup.

```
ledger.json
server/src/
  money.ts            Money = bigint cents. parseMoney("12450.75") -> 1245075n, formatMoney(-80025n) -> "-800.25"
  ledger.ts           types (Account, Entry, Line) + loadLedger(json): Ledger. Validation lives here (R10)
  incomeStatement.ts  SECTIONS table + incomeStatement(ledger, period): IncomeStatement   (pure)
  period.ts           parsePeriod(start?, end?): Period | error   (YYYY-MM-DD, real date, start <= end)
  app.ts              Express app: GET /income-statement -> 200 JSON | 400 {error}
  index.ts            loads the ledger, app.listen
server/test/          money, ledger, incomeStatement (golden, rules, invariants), app
web/src/
  App.tsx             two <input type="date"> fields (default Q1 2026), fetch, render
  StatementTable.tsx  loops over sections; parentheses for negatives; bold totals
  api.ts              typed fetch, using the response types
shared/types.ts       IncomeStatement response type, imported by server and web
```

### Guardrails

- **Money: never use `number`.** `parseMoney` splits the string on `.`, checks it against
  `/^\d+\.\d{2}$/`, and builds `BigInt(whole) * 100n + BigInt(cents)`. Never call
  `parseFloat` or `Number()`. Sums use bigint, and values leave the server as strings via
  `formatMoney`.
- **Dates: never build a `Date` for comparison.** `new Date("2026-01-01")` is parsed as UTC
  and shown in local time, so it can display as Dec 31. Keep dates as `YYYY-MM-DD` strings,
  which compare correctly as strings. Use `Date` only inside `parsePeriod` to reject
  things like `2026-02-30`: round-trip through `toISOString().slice(0,10)` and compare.
- **The frontend does no accounting.** It formats strings it receives. Even the parentheses
  are applied to strings, with a `-` prefix check.
- **Shared response type** in `shared/types.ts`, so the API and the UI can't drift apart.

### Design notes

- **Single source for layout.** One `SECTIONS` table maps each subtype to its section and
  order, and sets where the computed lines go. Section mapping is not repeated in the
  backend, the frontend, and the tests.
- Parse JSON into domain types at the edge. `incomeStatement` never sees raw strings or
  Express objects.
- `incomeStatement` owns all accounting policy (R1-R8, R11, R12). Likely extensions
  (comparative periods, drill-down to entries, monthly columns, balance sheet, a toggle to
  include drafts) should each be a small change in one place.
- Alternative considered: Python/FastAPI with `Decimal` (fewer money and date traps). We
  chose TS for fluency.

## 6. Test plan (behavior, not implementation)

1. **Golden Q1**: the full statement for Q1 matches the table in section 3, line by line.
2. **Status filter**: a draft or void entry in range changes nothing. Use a small inline
   ledger fixture so the test reads on its own.
3. **Boundaries**: an entry on `start` and one on `end` are included. The day before and
   the day after are excluded. Also test a single-day range (`start == end`).
4. **Sign rules**: contra revenue reduces revenue, a credit to an expense reduces it, and
   other income adds.
5. **Invariant**: for any range, net income from the statement equals the balance-sheet
   side of the same posted entries, i.e. `sum(debit - credit over balance-sheet accounts)`.
   Double entry guarantees this, and it is computed by a separate path.
6. **Additivity**: statement(Jan) + statement(Feb) + statement(Mar) == statement(Q1),
   for every line.
7. **Validation**: an unbalanced entry or unknown account fails to load. `start > end`
   and a bad date return 400.
8. **HTTP smoke test**: one request through the real app returns the Q1 net income string.

## 7. Slices (one commit or more each; each one is verifiable)

| # | Slice | Done when |
|---|-------|-----------|
| 0 | Scaffold: git init, npm workspaces, TS configs, Vite+React, Express on `tsx`, Vitest, `.nvmrc`, `ledger.json`, README run commands | `npm test` green on a trivial test; `npm run dev` serves both; `/api/health` reachable via proxy |
| 1 | `money.ts` (bigint cents) + `ledger.ts` load/validate (R9, R10) | money round-trip tests (incl. `"0.10"`, `"1199.97"`, negatives), and a corrupted fixture fails with a clear error |
| 2 | `incomeStatement.ts` core (R1-R8, R11, R12) and `SECTIONS` table | golden Q1, status, boundary, sign, invariant, and additivity tests green |
| 3 | `period.ts` + `app.ts` endpoint + 400 handling | curl Q1 returns `"net_income": "-44480.14"`. Validation tests green |
| 4 | Frontend: `App.tsx` + `StatementTable.tsx`, using the shared types, defaulting to Q1 | manual check against section 3 in the browser |
| 5 | NOTES.md (Q1 number, decisions R1-R12, verification method, AI notes, next steps) + README versions | a fresh clone runs in under 5 minutes, following the README |

## 8. Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Stack | TypeScript, Node 26, Express + Vite/React, Vitest |
| 2 | Response shape | `sections[]` + `summary` (default, open to change) |
| 3 | Zero-activity accounts (R11) | show as 0.00 (default, open to change) |
| 4 | Contra revenue display | one Revenue section with a (800.25) line (default, open to change) |
