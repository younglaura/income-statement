import express from "express";
import { incomeStatement, toIncomeStatementResponse } from "./incomeStatement";
import type { Ledger } from "./ledger";
import { parsePeriod, PeriodError } from "./period";

export function createApp(ledger: Ledger) {
  const app = express();

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/income-statement", (req, res) => {
    let period;
    try {
      period = parsePeriod(req.query.start, req.query.end);
    } catch (err) {
      if (err instanceof PeriodError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
    res.json(toIncomeStatementResponse(incomeStatement(ledger, period)));
  });

  return app;
}
