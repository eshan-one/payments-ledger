# Architecture Reference

## Target folder structure (built incrementally across milestones)

    payment-ledger/
    ├── context/                 # you are here (instructions + specs)
    ├── server/
    │   ├── package.json
    │   ├── .env.example
    │   ├── server.js            # entry: connect DB, then listen
    │   ├── src/
    │   │   ├── app.js           # builds Express app (routes + middleware)
    │   │   ├── config/db.js
    │   │   ├── models/          # Account, LedgerEntry, Invoice
    │   │   ├── services/        # ledgerService, invoiceService (logic + tests)
    │   │   ├── controllers/     # thin request handlers
    │   │   ├── routes/          # URL -> controller maps
    │   │   ├── middleware/      # errorHandler, asyncHandler
    │   │   └── utils/           # money.js, ApiError.js
    │   └── tests/               # jest specs on ledger/invoice logic
    └── client/                  # React + Vite (Milestone 4)

## Data model

### Account

`{ _id, name, type: asset|liability|equity|revenue|expense, currency, timestamps }`
No balance field — balance is derived.

### LedgerEntry (immutable, double-entry)

    {
      _id, description, createdAt,
      lines: [ { accountId, direction: "debit"|"credit", amountCents:int>0 }, ... ],
      invoiceId?, paymentId?   // traceability links
    }

Invariant: sum(debit amounts) === sum(credit amounts).

### Invoice (Milestone 2)

    {
      _id, number,
      lineItems: [ { description, quantity, unitPriceCents } ],
      amountDueCents,          // computed from lineItems, server-side
      status: draft|sent|paid|overdue,
      dueDate,
      payments: [ { paymentId (unique), amountCents, appliedAt } ],
      timestamps
    }

## Balance derivation (getBalance)

Aggregate over all ledger lines for an account:
credit lines add, debit lines subtract → the running balance.
The number is COMPUTED on read, never stored.

## Why these choices

- lines[] in one document → atomic double-entry, impossible to persist half.
- derived balance → no drift after a crash; the log is the single truth.
- integer cents → exact money math, no float rounding bugs.
- layered services → business rules are testable without HTTP or a running server.
