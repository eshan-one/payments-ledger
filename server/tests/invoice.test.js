import supertest from "supertest";
import { connect, clearDatabase, closeDatabase } from "./setup.js";
import { createApp } from "../src/app.js";
import { create as createAccount } from "../src/services/accountService.js";
import { create as createInvoice, applyPayment } from "../src/services/invoiceService.js";
import { getBalance } from "../src/services/ledgerService.js";
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
  const [cash, receivable] = await Promise.all([
    createAccount({ name: "Cash", type: "asset" }),
    createAccount({ name: "Accounts Receivable", type: "asset" }),
  ]);
  return { cash, receivable };
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

  it("moves Cash up and Accounts Receivable down by the payment amount (both debit-normal assets)", async () => {
    const { cash, receivable } = await seedAccounts();
    const invoice = await seedInvoice(1000);

    // applyPayment posts: debit Cash, credit Accounts Receivable. Both accounts
    // are type "asset" (debit-normal), so a debit should increase the balance
    // and a credit should decrease it — the opposite of the credit-normal rule.
    await applyPayment(invoice._id, { paymentId: "p1", amountCents: 400 });

    expect(await getBalance(cash._id, cash.type)).toBe(400);
    expect(await getBalance(receivable._id, receivable.type)).toBe(-400);
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

    // Neither payment overpays alone, but together they would without the lock.
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

    // Replaying the winning paymentId must stay idempotent, not re-throw.
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

describe("GET /api/invoices/:id", () => {
  it("returns 404 (not 500) for an unknown id", async () => {
    const res = await supertest(app).get("/api/invoices/not-a-real-invoice");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Invoice not found");
  });
});

describe("invoiceService.create — invoice ids", () => {
  it("assigns human-readable, sequential, unique ids", async () => {
    const first = await seedInvoice(1000);
    const second = await seedInvoice(1000);

    expect(first._id).toMatch(/^INV-\d+$/);
    expect(second._id).toMatch(/^INV-\d+$/);
    expect(first._id).not.toBe(second._id);
  });
});

describe("GET /api/invoices", () => {
  it("returns every invoice, newest first", async () => {
    const older = await seedInvoice(1000);
    const newer = await seedInvoice(2000);

    const res = await supertest(app).get("/api/invoices");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((inv) => inv._id)).toEqual([
      String(newer._id),
      String(older._id),
    ]);
  });

  it("returns an empty array when there are no invoices", async () => {
    const res = await supertest(app).get("/api/invoices");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
