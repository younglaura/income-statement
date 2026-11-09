import type { IncomeStatement, Period } from "../../shared/types";

/** GET /api/income-statement (Vite proxies /api to the server). Throws with the server's message on 4xx/5xx. */
export async function fetchIncomeStatement(period: Period): Promise<IncomeStatement> {
  const params = new URLSearchParams({ start: period.start, end: period.end });
  const res = await fetch(`/api/income-statement?${params}`);
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (body as { error?: string } | null)?.error;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  return body as IncomeStatement;
}
