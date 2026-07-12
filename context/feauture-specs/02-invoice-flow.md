# Milestone 2 — Invoice Flow + Payments + Idempotency

## Objective

Create invoices with line items and a status lifecycle, apply full and partial
payments, and make double-payment / overpayment impossible.

## Why it matters

Second graded pillar. The brief hints "the webhook can fire twice" — that is a
direct instruction to implement idempotency. It is a scored trap.

## Tasks (in execution order)

1. `src/models/Invoice.js` — lineItems[], amountDueCents, status
   (draft|sent|paid|overdue), dueDate, payments[] with a UNIQUE index on paymentId.
2. `src/services/invoiceService.js`:
   - `create()` — compute `amountDueCents` server-side from lineItems
     (quantity \* unitPriceCents). Never trust a client total.
   - `transition()` — guarded status changes (e.g. draft→sent→paid).
   - `applyPayment(invoiceId, { paymentId, amountCents })`:
     - duplicate paymentId → idempotent no-op (return current state).
     - overpayment (amount > remaining) → 422.
     - partial payment keeps status `sent`; remaining hits 0 → `paid`.
     - each payment posts a BALANCED ledger entry via ledgerService
       (debit Cash / credit Accounts-Receivable), linking ledger↔invoice.
3. `src/controllers/invoiceController.js` — create, getById, applyPayment (Zod).
4. `src/routes/invoiceRoutes.js`; mount at `/api/invoices` in app.js.

## Endpoints

- `POST /api/invoices` → 201
- `GET  /api/invoices/:id`
- `POST /api/invoices/:id/payments` (body: `{ paymentId, amountCents }`)

## Definition of Done

- Partial payment leaves the correct remaining balance.
- A second identical payment (same paymentId) does NOT change the balance.
- Overpayment is rejected with 422.
- Invoice flips to `paid` exactly when remaining reaches 0.
- Ledger stays balanced after every payment.

## Concepts to explain after building

- Idempotency: why a unique key makes a duplicate webhook safe.
- Why totals are computed server-side.
- How a payment maps to a double-entry ledger posting (Cash vs A/R).
- Guarded state machine for invoice status.

## Skip if behind

- Skip automatic `overdue` transition; leave it derivable from dueDate.
