import supertest from "supertest";
import { connect, clearDatabase, closeDatabase } from "./setup.js";
import { createApp } from "../src/app.js";
import { Account } from "../src/models/Account.js";
import { create as createInvoice, applyPayment } from "../src/services/invoiceService.js";
import { ApiError } from "../src/utils/ApiError.js";

const app = createApp();

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

async function seedAccounts() {
  await Promise.all([
    Account.create({ name: "Cash", type: "asset" }),
    Account.create({ name: "Accounts Receivable", type: "asset" }),
  ]);
}

async function seedInvoice(amountDueCents = 1000) {
  return createInvoice({
    lineItems: [{ description: "Widget", quantity: 1, unitPriceCents: amountDueCents }],
    dueDate: new Date("2026-08-01"),
  });
}

describe("invoiceService.applyPayment", () => {
  it("applies a partial payment and decrements the remaining balance", async () => {
    await seedAccounts();
    const invoice = await seedInvoice(1000);

    const updated = await applyPayment(invoice._id, { paymentId: "p1", amountCents: 400 });

    expect(updated.amountDueCents).toBe(600);
    expect(updated.status).toBe("sent");
    expect(updated.payments).toHaveLength(1);
  });

  it("rejects an overpayment with a 422 ApiError", async () => {
    await seedAccounts();
    const invoice = await seedInvoice(1000);

    let thrown;
    try {
      await applyPayment(invoice._id, { paymentId: "p1", amountCents: 1500 });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect(thrown.status).toBe(422);
  });

  it("treats a duplicate paymentId as an idempotent no-op", async () => {
    await seedAccounts();
    const invoice = await seedInvoice(1000);

    const first = await applyPayment(invoice._id, { paymentId: "dup", amountCents: 400 });
    const second = await applyPayment(invoice._id, { paymentId: "dup", amountCents: 400 });

    expect(first.amountDueCents).toBe(600);
    expect(second.amountDueCents).toBe(600);
    expect(second.payments).toHaveLength(1);
  });

  it("lets exactly one of two concurrent payments for the same remaining balance succeed", async () => {
    await seedAccounts();
    const invoice = await seedInvoice(1000);

    // Neither payment overpays 1000 on its own, but together they do —
    // a naive read-modify-write would let both succeed and drive the
    // invoice to a negative remaining balance.
    const paymentIds = ["race-a", "race-b"];
    const results = await Promise.allSettled(
      paymentIds.map((paymentId) =>
        applyPayment(invoice._id, { paymentId, amountCents: 700 }),
      ),
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    const winnerPaymentId = paymentIds[results.findIndex((r) => r.status === "fulfilled")];

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ApiError);
    expect(rejected[0].reason.status).toBe(422);
    expect(fulfilled[0].value.amountDueCents).toBe(300);

    // The invoice's final state must agree with exactly one payment applied —
    // no double-spend of the original 1000 remaining balance. Replaying the
    // winning paymentId must stay idempotent rather than re-throwing.
    const final = await applyPayment(invoice._id, { paymentId: winnerPaymentId, amountCents: 700 });
    expect(final.payments).toHaveLength(1);
    expect(final.amountDueCents).toBe(300);
  });
});

describe("POST /api/invoices/:id/payments", () => {
  it("returns 200 with the updated invoice on a successful payment", async () => {
    await seedAccounts();
    const invoice = await seedInvoice(1000);

    const res = await supertest(app)
      .post(`/api/invoices/${invoice._id}/payments`)
      .send({ paymentId: "http-1", amountCents: 1000 });

    expect(res.status).toBe(200);
    expect(res.body.amountDueCents).toBe(0);
    expect(res.body.status).toBe("paid");
  });
});
