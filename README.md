# Mini Payment Ledger & Invoice Service

A small double-entry payment ledger + invoice service: Node/Express/Mongoose
API with a React + TypeScript UI over it. Built as a scoped fintech hiring
exercise, prioritizing **correctness of money handling > clean architecture >
tests > UI polish**.

## Architecture summary

```
route -> controller -> service -> model
```

- **server/** — Node.js (ESM) + Express + Mongoose. Routes only map URL+verb
  to a controller; controllers parse/validate input with Zod and shape the
  HTTP response; all business rules (double-entry balancing, idempotency,
  invoice state machine, concurrency handling) live in `services/`, which
  know nothing about HTTP and are unit-testable in isolation.
- **client/** — Vite + React + TypeScript (`strict: true`). A thin, typed
  client over the API — no business logic, no money math, just fetch +
  render. `src/api/client.ts` is the one place that touches the raw HTTP
  response; every component beyond it only ever sees typed data.
- **Money** is stored and computed as integer cents everywhere. Conversion
  to/from decimal only happens at the edges: `formatCents` (display) and
  `parseDollarsToCents` (form input) in `client/src/lib/money.ts`, mirroring
  `server/src/utils/money.js` on the backend.
- **Ledger balances are derived, never stored.** An account has no balance
  field; `GET /api/accounts/:id/balance` aggregates every `LedgerEntry` line
  ever posted against that account.

## Running locally

### Server

```bash
cd server
cp .env.example .env   # set MONGO_URI to your own MongoDB instance
npm install
npm run dev             # http://localhost:4000
```

### Client

```bash
cd client
cp .env.example .env    # VITE_API_URL should point at the server above
npm install
npm run dev              # http://localhost:5173
```

### Seed data

The invoice payment flow posts against two convention accounts that must
already exist, looked up by name:

```bash
curl -X POST http://localhost:4000/api/accounts -H "Content-Type: application/json" -d '{"name":"Cash","type":"asset"}'
curl -X POST http://localhost:4000/api/accounts -H "Content-Type: application/json" -d '{"name":"Accounts Receivable","type":"asset"}'
```

Then, in the UI: create an invoice with one or more line items, open it (you
land there automatically after creating), and apply a partial payment
followed by a payment for the remaining balance — the invoice flips from
`draft` → `sent` → `paid`, and the Accounts page reflects the new derived
balances.

### Tests

```bash
cd server
npm test    # Jest + Supertest + mongodb-memory-server, no live DB needed
```

## The chosen edge case: concurrent payments

The brief asked for one edge case handled thoroughly. We chose **concurrent
payments racing on the same invoice** (e.g. a webhook firing twice, or two
requests landing at once) because it's the most fintech-credible failure
mode and builds directly on the idempotency work from Milestone 2.

Two guards, stacked (`server/src/services/invoiceService.js`):

1. **Optimistic lock** — `applyPayment`'s `findOneAndUpdate` re-asserts the
   exact `amountDueCents` it just read. If another payment changed that
   value in between, the filter no longer matches, the update is a no-op,
   and an outer retry loop (bounded at 5 attempts) tries again against fresh
   state instead of clobbering the other payment.
2. **Session transaction** — the invoice update and the ledger write commit
   or roll back together, so a failure partway through can never leave a
   payment recorded on the invoice with no matching `LedgerEntry`.

A duplicate `paymentId` (the idempotency key) is treated as a no-op at three
layers: an in-memory check, a unique Mongo index, and a caught duplicate-key
error if two identical requests race each other into the write itself.

## What I'd do differently with more time

- Add a proper account picker to the invoice payment flow instead of
  hardcoding "Cash" / "Accounts Receivable" by name in the service — an
  `accountId` reference on the Invoice (or a small chart-of-accounts config)
  would be more explicit and remove the name-lookup coupling.
- Automatic `draft`/`sent` → `overdue` transition (currently intentionally
  skipped — status is derivable from `dueDate` but never flips on its own).
- Optimistic UI updates and toast-style feedback in the client instead of
  full reloads after every mutation.
- A dedicated ledger/transactions view in the UI (the API supports posting
  and would support listing, but Milestone 4 only asked for accounts,
  invoices, and payments).
- Deployment (Render/Railway + Vercel) — skipped to keep the remaining time
  on correctness and the reflections below rather than infra.

## Shortcuts taken

- No auth — anyone who can reach the API can do anything. Explicitly out of
  scope per the brief.
- The client has no router; navigation is a small `useState` switch in
  `App.tsx` between three views. A five-screen internal tool didn't justify
  pulling in React Router.
- `AccountsPage` fetches every account's balance with one request per
  account (`Promise.all`) rather than adding a batched "balances" endpoint —
  fine at demo scale, would not scale to a large chart of accounts.
- No pagination anywhere (accounts list, invoice payments) — acceptable at
  the data volumes this exercise produces.
- Payment amount and unit price inputs are validated client-side with a
  regex (`parseDollarsToCents`) but the server is the actual source of
  truth; a malformed amount that somehow got past the client would still be
  correctly rejected server-side.
