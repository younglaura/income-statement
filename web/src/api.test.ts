import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchIncomeStatement } from "./api";

const Q1 = { start: "2026-01-01", end: "2026-03-31" };

function stubFetch(status: number, body: string) {
  const fetchMock = vi.fn(async (_url: string) => new Response(body, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchIncomeStatement", () => {
  it("requests the period through the /api proxy and returns the body", async () => {
    const body = { company: "Test Co", summary: { net_income: "-44480.14" } };
    const fetchMock = stubFetch(200, JSON.stringify(body));
    await expect(fetchIncomeStatement(Q1)).resolves.toEqual(body);
    expect(fetchMock).toHaveBeenCalledWith("/api/income-statement?start=2026-01-01&end=2026-03-31");
  });

  it("throws the server's message on a 400", async () => {
    stubFetch(400, JSON.stringify({ error: "start (2026-04-01) must be on or before end (2026-03-31)" }));
    await expect(fetchIncomeStatement(Q1)).rejects.toThrow("start (2026-04-01) must be on or before end (2026-03-31)");
  });

  it("throws the status code when the error body is not JSON (e.g. server down behind the proxy)", async () => {
    stubFetch(502, "Bad Gateway");
    await expect(fetchIncomeStatement(Q1)).rejects.toThrow("Request failed (502)");
  });
});
