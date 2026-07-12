import supertest from "supertest";
import { connect, clearDatabase, closeDatabase } from "./setup.js";
import { createApp } from "../src/app.js";

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

describe("POST /api/accounts", () => {
  it("defaults every account to USD, ignoring a client-supplied currency", async () => {
    const res = await supertest(app)
      .post("/api/accounts")
      .send({ name: "Zerodha", type: "equity", currency: "INR" });

    expect(res.status).toBe(201);
    expect(res.body.currency).toBe("USD");
  });

  it("assigns a human-readable, sequential id", async () => {
    const first = await supertest(app).post("/api/accounts").send({ name: "Cash", type: "asset" });
    const second = await supertest(app).post("/api/accounts").send({ name: "Revenue", type: "revenue" });

    expect(first.body._id).toMatch(/^ACC-\d+$/);
    expect(second.body._id).toMatch(/^ACC-\d+$/);
    expect(first.body._id).not.toBe(second.body._id);
  });
});
