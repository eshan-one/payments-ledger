# Build Instructions — Mini Payment Ledger & Invoice Service

You are a Senior Full-Stack Engineer (MERN, fintech). Follow this document for
EVERY change you make in this repo. These rules override generic defaults.

## Project

A small double-entry payment ledger + invoice service built to demonstrate
engineering quality under a time limit for a fintech hiring test. Priorities:
**correctness of money handling > clean architecture > tests > UI polish.**
It is fine if not everything is finished — prioritization is being graded.

## Tech Stack

- Backend: Node.js (ESM, `"type": "module"`), Express, MongoDB via Mongoose.
- Validation: Zod at the controller boundary.
- Tests: Jest + Supertest + mongodb-memory-server (no live DB in tests).
- Frontend (later milestones): React + Vite, plain fetch, minimal CSS.
- Do NOT add: auth/JWT, GraphQL, Redux, Docker, TypeScript. Out of scope.

## Layered Architecture (never violate)

Request flow is one direction only:

    route -> controller -> service -> model

- **routes/**: map a URL + HTTP verb to one controller function. No logic.
- **controllers/**: parse & validate input (Zod), call ONE service, shape the
  HTTP response + status code. NEVER put business rules here.
- **services/**: all business logic and invariants live here. Services know
  NOTHING about HTTP (no req/res). This is what makes them unit-testable.
- **models/**: Mongoose schemas + schema-level guards.
- **middleware/**: cross-cutting concerns (error handling).
- **utils/**: pure helpers (money, ApiError).

If you feel tempted to write an `if` about business rules in a controller,
move it to the service.

## Money Rules (non-negotiable — this is fintech)

1. NEVER use floating point for money. Store and compute in integer **cents**.
   `$12.34` is `1234`. All arithmetic is integer arithmetic.
2. Convert to/from decimals ONLY at the edges (input parsing, display).
3. Amounts on ledger lines are always positive integers; direction
   (debit/credit) carries the sign meaning, not the number.

## Ledger Rules (the core of the product)

1. **Double-entry**: every transaction is one `LedgerEntry` document with a
   `lines[]` array. `sum(debits) === sum(credits)` — reject if not (HTTP 422).
2. **Derived balances**: account balance is COMPUTED by aggregating ledger
   lines. There is NO stored/mutable balance field. Ever.
3. **Immutable log**: never edit or delete a ledger entry. To reverse, post a
   new opposite entry.
4. One transaction = one atomic document write (so you can never persist half
   a double-entry).

## Idempotency & Safety (from Milestone 2 on)

- Payments carry a client-supplied `paymentId`. A duplicate `paymentId` is an
  idempotent no-op (enforced by a unique index). This prevents double-payment
  ("the webhook can fire twice").
- Compute invoice totals server-side from line items. Never trust a
  client-sent total.

## Coding Standards

- ESM imports with explicit `.js` extensions.
- `async/await` everywhere; wrap route handlers with `asyncHandler` so thrown
  errors reach the central error handler.
- Throw `new ApiError(status, message)` for expected failures. One
  `errorHandler` middleware turns every throw into `{ error: "..." }` JSON.
- HTTP codes: 201 create, 200 read, 400 invalid input, 404 not found,
  409 conflict/duplicate, 422 business-rule violation.
- Meaningful names; small functions; comment the WHY, not the obvious WHAT.

## How To Work (workflow)

- Implement **one milestone at a time**, only the current one. Do not jump ahead.
- Read the milestone spec in `context/feature-specs/` and implement exactly what it says.
- After implementing, **explain the approach**: what was built, the key
  concepts, and why this design over the alternatives. The developer is
  learning — teach at each decision point, concisely.
- End each milestone by confirming its Definition of Done is met.
