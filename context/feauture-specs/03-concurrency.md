# Milestone 3 — Edge Case (Concurrency) + Tests

## Objective

Handle concurrent payments on the same invoice safely, and add the required
tests on ledger + invoice logic.

## Why it matters

Part 3 (one edge case) is required, and the brief explicitly asks for tests.
Concurrency + tests together are the strongest correctness signal.

## Chosen edge case

Concurrent payments hitting the same invoice (race conditions). It reuses the
idempotency work from Milestone 2 and is the most fintech-credible option.

## Tasks (in execution order)

1. Make `applyPayment` concurrency-safe. Two guards:
   - unique index on `paymentId` (already added) serializes duplicate applies.
   - atomic conditional update: use `findOneAndUpdate` with a filter that asserts
     the expected remaining balance (or an optimistic `version` field), OR a
     Mongo session transaction, so two simultaneous payments cannot both consume
     the same remaining balance.
2. Set up test infra: Jest + Supertest + mongodb-memory-server; a `tests/setup`
   that spins an in-memory Mongo before tests and tears it down after.
3. `tests/ledger.test.js`:
   - balanced entry persists; unbalanced rejected (422);
   - getBalance derives the correct figure over multiple entries.
4. `tests/invoice.test.js`:
   - partial payment updates remaining;
   - overpayment rejected;
   - duplicate paymentId is idempotent (balance unchanged);
   - concurrency: fire two applyPayment calls in parallel for the same remaining
     balance and assert exactly one succeeds (or correct partial ordering).

## Definition of Done

- `npm test` is green.
- Two parallel payments for the same remaining balance never both succeed.
- Idempotency and overpayment tests pass.

## Concepts to explain after building

- Race conditions on shared state and why naive read-modify-write is unsafe.
- Atomic conditional update vs transaction — trade-offs.
- Why in-memory Mongo is the right way to test data logic (fast, isolated).

## Skip if behind

- Drop the parallel concurrency test but KEEP the unique-index guard and the
  idempotency test — still counts as handling the edge case.
