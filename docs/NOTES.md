## Net Income

2026.01.01 to 2026.3.31

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

## Verifcation process

## AI Usage
### Helped with
- 

### Did not help with
- Wanted to use JS Date objects but realized that would introduce too much complexity when it is simpler to just use string comparison, a date is expected to be in YYYY-MM-DD format, which can be easily compared

## General Process steps
1. Read the problem and understand the requirements
2. Invoke AI to help with implementation
    - Gather context files and use Devin IDE + pstack skills library
    - review mainspec and make key architectural decisions
3. 

## Next steps

## Metrics
| --- | --- |
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

