# Income statement

A small full-stack app that shows an income statement (P&L) for Northwind Coffee Roasters
for any date range, built from `ledger.json`.

## Versions

- Node 26 (see `.nvmrc`), npm 11+
- TypeScript, Express (backend), Vite + React (frontend), Vitest (tests)

## Run

```bash
nvm use          # Node 26
npm install
npm run dev      # backend on http://localhost:3001, frontend on http://localhost:5173
```

Open http://localhost:5173.

## Test

```bash
npm test
npm run typecheck
```

## Layout

- `server/`: Express API. Domain code lives in `server/src`, tests in `server/test`.
- `web/`: Vite + React page. Calls the API through the `/api` dev proxy.
- `ledger.json`: chart of accounts and journal entries.
- `docs/SPEC.md`: spec and plan.
