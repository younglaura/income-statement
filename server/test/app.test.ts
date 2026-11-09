import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { readLedgerFile } from "../src/ledger";

const app = createApp(readLedgerFile(new URL("../../ledger.json", import.meta.url)));

describe("GET /health", () => {
  it("responds ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe("GET /income-statement", () => {
  it("returns the Q1 2026 statement", async () => {
    const res = await request(app).get("/income-statement?start=2026-01-01&end=2026-03-31");
    expect(res.status).toBe(200);
    expect(res.body.period).toEqual({ start: "2026-01-01", end: "2026-03-31" });
    expect(res.body.sections.map((s: { key: string }) => s.key)).toEqual([
      "revenue",
      "cogs",
      "operating_expenses",
      "other_income",
    ]);
    expect(res.body.summary).toEqual({
      gross_profit: "23577.75",
      operating_income: "-44522.32",
      net_income: "-44480.14",
    });
  });

  it("returns all zeros for a range with no entries", async () => {
    const res = await request(app).get("/income-statement?start=2030-01-01&end=2030-12-31");
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ gross_profit: "0.00", operating_income: "0.00", net_income: "0.00" });
  });

  it.each([
    ["no params", ""],
    ["missing end", "?start=2026-01-01"],
    ["malformed date", "?start=2026-1-1&end=2026-03-31"],
    ["impossible date", "?start=2026-01-01&end=2026-02-30"],
    ["start after end", "?start=2026-04-01&end=2026-03-31"],
    ["repeated param", "?start=2026-01-01&start=2026-02-01&end=2026-03-31"],
  ])("returns 400 with a message for %s", async (_name, query) => {
    const res = await request(app).get(`/income-statement${query}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });
});
