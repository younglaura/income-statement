import { useEffect, useState, type FormEvent } from "react";
import type { IncomeStatement, Period } from "../../shared/types";
import { fetchIncomeStatement } from "./api";
import { StatementTable } from "./StatementTable";

const DEFAULT_PERIOD: Period = { start: "2026-01-01", end: "2026-03-31" };

export function App() {
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const [statement, setStatement] = useState<IncomeStatement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(requested: Period) {
    setLoading(true);
    setError(null);
    try {
      setStatement(await fetchIncomeStatement(requested));
    } catch (err) {
      setStatement(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(DEFAULT_PERIOD);
  }, []);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void load(period);
  }

  return (
    <main>
      <h1>Income statement</h1>
      <form onSubmit={onSubmit}>
        <label>
          Start
          <input
            type="date"
            required
            value={period.start}
            onChange={(e) => setPeriod({ ...period, start: e.target.value })}
          />
        </label>
        <label>
          End
          <input
            type="date"
            required
            value={period.end}
            onChange={(e) => setPeriod({ ...period, end: e.target.value })}
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Loading..." : "Run report"}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {statement && <StatementTable statement={statement} />}
    </main>
  );
}
