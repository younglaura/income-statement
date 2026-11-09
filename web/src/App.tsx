import { useEffect, useState } from "react";

export function App() {
  const [status, setStatus] = useState("checking...");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((body: { ok: boolean }) => setStatus(body.ok ? "ok" : "not ok"))
      .catch(() => setStatus("unreachable"));
  }, []);

  return (
    <main>
      <h1>Income statement</h1>
      <p>API: {status}</p>
    </main>
  );
}
