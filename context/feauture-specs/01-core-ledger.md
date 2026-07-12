# Milestone 1 — Backend Foundation + Core Ledger

## Objective

A running Express + MongoDB API where you can create accounts, post
double-entry transactions, and read balances that are DERIVED from the log.

## Why it matters

The ledger is the highest-weighted, most fintech-specific part. Correct money +
double-entry + derived balances is the core signal a reviewer looks for.

## Tasks (in execution order)

1. Scaffold `server/`: `package.json` (ESM), install express, mongoose, cors,
   dotenv, zod. Add `.env.example` and `.gitignore`.
2. `src/config/db.js` — connect to Mongo; exit process on failure.
3. `src/utils/money.js` — `toCents`, `formatCents`, `isValidCents`. No floats.
4. `src/utils/ApiError.js` — Error carrying an HTTP status code.
5. `src/middleware/errorHandler.js` — central error → JSON `{error}`; plus an
   `asyncHandler` wrapper so thrown errors in async routes are caught.
6. `src/models/Account.js` — schema WITHOUT a balance field.
7. `src/models/LedgerEntry.js` — `lines[]` schema; ≥2 lines; positive int cents.
8. `src/services/ledgerService.js`:
   - `assertBalanced(lines)` — throws 422 unless sum(debits)===sum(credits) and
     all amounts are positive integers.
   - `postTransaction({description, lines, ...})` — validate then insert atomically.
   - `getBalance(accountId)` — aggregate ledger lines (credit adds, debit subtracts).
9. `src/controllers/accountController.js` — create/list/getBalance (thin, Zod-validated).
10. `src/controllers/ledgerController.js` — postTransaction; verify referenced
    accounts exist (404 if not).
11. `src/routes/accountRoutes.js`, `src/routes/ledgerRoutes.js`.
12. `src/app.js` (build app, `/health`, mount routes, error handler LAST) and
    `server.js` (connect DB then listen).

## Files to create

server/package.json, .env.example, .gitignore, server.js,
src/app.js, src/config/db.js, src/utils/money.js, src/utils/ApiError.js,
src/middleware/errorHandler.js, src/models/Account.js, src/models/LedgerEntry.js,
src/services/ledgerService.js, src/controllers/accountController.js,
src/controllers/ledgerController.js, src/routes/accountRoutes.js,
src/routes/ledgerRoutes.js

## Endpoints

- `POST /api/accounts` → 201
- `GET  /api/accounts`
- `GET  /api/accounts/:id/balance` → derived balance
- `POST /api/ledger/transactions` → 201 (body: `{ description, lines[] }`)

## Definition of Done

- Posting an UNBALANCED transaction returns 422 and writes nothing.
- Posting a BALANCED transaction persists and returns 201.
- Balance endpoint returns the correct DERIVED figure across several transactions.
- No stored balance field anywhere; no floats used for money.

## Concepts to explain after building

- Why money is integer cents (the `0.1 + 0.2` problem).
- Why balances are derived, not stored (crash-safety, single source of truth).
- Double-entry and the balanced-lines invariant.
- The route→controller→service→model layering and why services are HTTP-free.

## Skip if behind

- Skip a separate ledger-listing endpoint; keep post + balance only.
