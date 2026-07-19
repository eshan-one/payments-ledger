Readme · MD

# Mini Payment Ledger & Invoice Service

A small double-entry payment ledger + invoice service: a Node/Express/Mongoose
API with a React + TypeScript UI on top. Built as a scoped fintech hiring
exercise, prioritizing **correctness of money handling > clean architecture >
tests > UI polish**.

Core ideas:

- **Double-entry ledger** — every payment posts one `LedgerEntry` with
  balanced debit/credit lines. Account balances are **derived** by
  aggregating ledger lines, never stored.
- **Invoices** move `draft` → `sent` → `paid` (with `sent` → `overdue` →
  `paid` also allowed) as payments are applied against them; totals are
  always computed server-side from line items.
- **Idempotent payments** — a duplicate `paymentId` is a no-op, guarded at
  the application layer and by a unique DB index (handles a webhook firing
  twice — see "the chosen edge case" below for how _differing_ concurrent
  payments are kept safe too).
- **Money is integer cents** everywhere; decimals only appear at the UI edges.

## Prerequisites

- Node.js 20+
- A MongoDB instance (local or Atlas) — not needed for running tests, only
  for running the server itself

## Setup

### 1. Server (API)

```bash
cd server
cp .env.example .env   # set MONGO_URI to your own MongoDB instance
npm install
npm run dev             # http://localhost:4000
```

### 2. Client (UI)

In a second terminal:

```bash
cd client
cp .env.example .env    # VITE_API_URL should point at the server above
npm install
npm run dev              # http://localhost:5173
```

## Using it

Open `http://localhost:5173`.

1. **Accounts** — on first run, use the "Required accounts" one-click setup
   to create the `Cash` and `Accounts Receivable` accounts that payments
   post against (or add any account manually from "Add account").
2. **New invoice** — create an invoice with one or more line items; the
   total is computed server-side.
3. Open the invoice and **apply a payment** — partial or full. The invoice
   moves `draft` → `sent` → `paid` as its balance is paid down, and the
   **Accounts** and **Dashboard** pages reflect the new derived balances
   immediately.

## Tests

```bash
cd server
npm test    # Jest + Supertest + mongodb-memory-server — no live DB needed
```

## Project layout

```
route -> controller -> service -> model
```

- **server/** — routes only map URL+verb to a controller; controllers
  parse/validate input with Zod and shape the HTTP response; all business
  rules (double-entry balancing, idempotency, invoice state machine,
  concurrency handling) live in `services/`, which know nothing about HTTP.
- **client/** — Vite + React + TypeScript (`strict: true`). `src/api/client.ts`
  is the only place that touches the raw HTTP response; everything else only
  sees typed data.

## The chosen edge case: concurrent payments

The brief asked for one edge case handled thoroughly: **concurrent payments
racing on the same invoice** (e.g. a webhook firing twice, or two requests
landing at once). Two guards, stacked (`server/src/services/invoiceService.js`):

1. **Optimistic lock** — `applyPayment`'s `findOneAndUpdate` re-asserts the
   exact `amountDueCents` it just read. If another payment changed that value
   in between, the update is a no-op and a bounded retry loop (5 attempts)
   tries again against fresh state instead of clobbering the other payment.
2. **Session transaction** — the invoice update and the ledger write commit
   or roll back together, so a failure partway through can never leave a
   payment on the invoice with no matching `LedgerEntry`.
   A duplicate `paymentId` is a no-op at three layers: an in-memory check, a
   unique Mongo index, and a caught duplicate-key error if two identical
   requests race into the write itself.

## Known issues

- **Accounts Receivable doesn't reflect real outstanding balances.** Invoice
  creation never posts a ledger entry — only `applyPayment()` does. So
  Accounts Receivable is only ever _credited_ (by payments coming in), never
  _debited_ (by invoices going out), which means a fully-paid invoice leaves
  the balance permanently negative rather than back at $0. A correct
  implementation would post `debit Accounts Receivable / credit Revenue`
  when an invoice moves to `sent`, so a payment's later
  `credit Accounts Receivable` brings the balance back to zero instead of
  past it. (`Account.type` already includes `revenue`; it's just unused so
  far.)

## Shortcuts taken

- No auth — anyone who can reach the API can do anything. Out of scope per
  the brief.
- No router in the client; navigation is a `useState` switch in `App.tsx`.
- `AccountsPage` fetches each account's balance with one request per account
  rather than a batched endpoint — fine at demo scale.
- No pagination anywhere.
- No deploy — time spent on correctness instead.
