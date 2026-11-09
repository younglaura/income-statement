## Net Income

2026.01.01 to 2026.3.31

### Expected Output
-44,480.14
### Actual Output
-44,480.14

## Decisions & Assumptions
Money:
- Use bigint for exact arithmetic
- Parse amounts into cents and format back to decimal strings
- No floating-point rounding errors
- Assumption: All amounts are non-negative and have exactly two decimal places

Date:
- Use string comparison for dates (e.g., "2026-01-01" < "2026-03-31")
- Parse dates into YYYY-MM-DD format
- No timezone conversion needed

Inactive accounts:
- is_active does not impact if journal entries are included in the report, if the journal entry is posted then it occured before the account was deactivated
- is_active only controls whether new entries can be posted, and that check belongs where entries are created, not in the report. Hiding posted history would understate expenses/revenue without anyone noticing (e.g. dropping 6300 Marketing (legacy) would change Q1 net income from (44,480.14) to (41,980.04))
- Considered excluding entries dated today on inactive accounts, but decided against it: the report would change depending on the day it runs, and a backdated entry would get past the check anyway
- Limitation: the ledger has no deactivation date, so a posting made after an account was closed can't be detected
- Tested by the golden Q1 test (6300) and "still reports posted activity on an inactive account"

## Verifcation process
Looked through the JSON and UI to see that the data was being parsed correctly.


## AI Usage

### Helped with
- Provided context and constraints, and asked for implementation guidance.
- Used pstack skills library to propose architecture.
- Asked for possible implementation options and chose the best one.


### Did not help with
- Wanted to use JS Date objects but realized that would introduce too much complexity when it is simpler to just use string comparison, a date is expected to be in YYYY-MM-DD format, which can be easily compared
- Originally ledger loader does not check types or missing fields, which could cause runtime errors
- gaps in testing
    - Needed to add more test cases to cover cases, ui tests, missing function coverage

## General Process steps
1. Read the problem and understand the requirements
2. Invoke AI to help with implementation
    - Gather context files and use Devin IDE + pstack skills library
    - review mainspec and make key architectural decisions
3. implement the slices gradually, testing as you go
4. review all AI changes and done!

## Next steps

Features (each should be a small change in one place):
- Comparative periods (e.g. this quarter vs last quarter): call `incomeStatement` twice and add a variance column in the UI; no accounting changes.
- Monthly columns: split the range into months and run `incomeStatement` per month. Additivity is already tested, so columns sum to the full period.
- Drill-down: click an account line to see the journal entries behind it. Reuse the same posted + date filter from `netDebitsByAccount` and return the matching lines.
- Toggle to include drafts (a "what if" view): add an `includeDrafts` option where `incomeStatement` filters by status.
- Gross margin and operating margin %: these are ratios, not money, so calculate them with scaled bigint math and return a rounded string (no floats).
- Balance sheet: same ledger, with `balance_sheet` accounts summed from the beginning of time up to an as-of date. Assets = Liabilities + Equity + net income to date would be the main test.
- CSV export of the statement from the same response data.

Money and dates:
- Division and allocation helpers in `money.ts` if a feature needs them (`divRound` with one named rounding rule, `allocate` that hands out leftover cents so totals still balance).
- Switch to `Temporal.PlainDate` if date math is needed (adding a month, prior period). Comparing strings is enough for now.
- A branded `IsoDate` type so the type system knows a string has already been validated.

Robustness:
- Add an optional `deactivated_on` date to accounts, then either reject posted entries dated on/after it in `loadLedger` or keep them and return a warnings list for the UI. Optionally tag inactive accounts as "(inactive)" in the table.
- Decide whether amounts like `"0100.00"` (leading zeros) should be rejected. They are accepted today and equal 100.00.
- Ignore stale responses in `App.tsx` when Run report is clicked twice quickly (a request id or `AbortController`).
- UI behavior tests (loads Q1 on open, Run report, shows the error message) with `jsdom` + `@testing-library/react`. The table rendering and `api.ts` are already tested.
- Show a clearer error in the UI when the server is down instead of "Request failed (502)".

Out of scope for 2 hours, would matter in production:
- A database instead of reading `ledger.json` at startup, plus reloading when the data changes.
- Multiple currencies (the ledger has one `currency` field today).
- Auth, deployment, logging.

## Metrics
| Metric | Description |
|---|---|
| Correctness | The numbers are right for any date range, not only the default one |
| Money | Amounts stay exact. No floating-point rounding errors |
| Tests | The tests would catch a real mistake in the accounting, not only a typo |
| Judgment | Assumptions about the data are noticed, decided, and written down |
| Code | Someone else could read it and change it. It is sized for 2 hours, not built for scale |
| AI | You can explain everything you submitted, including the parts a model wrote |

we will be adding more features when we get there. It builds on the same ledger, so a codebase that is easy to change will help you more than extra features.

5 minute demo:
How you implemented it: a quick demo, then the code path from the dates to the numbers.
How you work: the editor, AI tools, and other tools you used, and how you used them.

