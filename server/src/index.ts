import { createApp } from "./app";
import { readLedgerFile } from "./ledger";

const PORT = Number(process.env.PORT ?? 3001);
const LEDGER_PATH = new URL("../../ledger.json", import.meta.url);

// Load and validate once at startup: a bad ledger stops the server here, not mid-request.
const ledger = readLedgerFile(LEDGER_PATH);

createApp(ledger).listen(PORT, () => {
  console.log(`loaded ${ledger.entries.length} entries for ${ledger.company}`);
  console.log(`server listening on http://localhost:${PORT}`);
});
