import { connect, clearDatabase, closeDatabase } from "./setup.js";
import { Account } from "../src/models/Account.js";
import { LedgerEntry } from "../src/models/LedgerEntry.js";
import { postTransaction, getBalance } from "../src/services/ledgerService.js";
import { ApiError } from "../src/utils/ApiError.js";

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

async function createAccounts() {
  const [cash, revenue] = await Promise.all([
    Account.create({ name: "Cash", type: "asset" }),
    Account.create({ name: "Revenue", type: "revenue" }),
  ]);
  return { cash, revenue };
}

describe("ledgerService.postTransaction", () => {
  it("persists a balanced entry", async () => {
    const { cash, revenue } = await createAccounts();

    const entry = await postTransaction({
      description: "Sale",
      lines: [
        { accountId: cash._id, direction: "debit", amountCents: 1000 },
        { accountId: revenue._id, direction: "credit", amountCents: 1000 },
      ],
    });

    expect(entry._id).toBeDefined();
    const stored = await LedgerEntry.findById(entry._id);
    expect(stored).not.toBeNull();
    expect(stored.lines).toHaveLength(2);
  });

  it("rejects an unbalanced entry with a 422 ApiError", async () => {
    const { cash, revenue } = await createAccounts();

    let thrown;
    try {
      await postTransaction({
        description: "Bad entry",
        lines: [
          { accountId: cash._id, direction: "debit", amountCents: 1000 },
          { accountId: revenue._id, direction: "credit", amountCents: 900 },
        ],
      });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect(thrown.status).toBe(422);
    expect(await LedgerEntry.countDocuments()).toBe(0);
  });
});

describe("ledgerService.getBalance", () => {
  it("derives the correct balance across multiple entries", async () => {
    const { cash, revenue } = await createAccounts();

    // Two sales of 1000, then a 400 refund (reverse of a sale).
    await postTransaction({
      description: "Sale 1",
      lines: [
        { accountId: cash._id, direction: "debit", amountCents: 1000 },
        { accountId: revenue._id, direction: "credit", amountCents: 1000 },
      ],
    });
    await postTransaction({
      description: "Sale 2",
      lines: [
        { accountId: cash._id, direction: "debit", amountCents: 1000 },
        { accountId: revenue._id, direction: "credit", amountCents: 1000 },
      ],
    });
    await postTransaction({
      description: "Refund",
      lines: [
        { accountId: revenue._id, direction: "debit", amountCents: 400 },
        { accountId: cash._id, direction: "credit", amountCents: 400 },
      ],
    });

    // getBalance's convention is credit-normal (credit adds, debit
    // subtracts): cash was debited 1000 + 1000 and credited 400.
    expect(await getBalance(cash._id)).toBe(400 - 1000 - 1000);
    expect(await getBalance(revenue._id)).toBe(1000 + 1000 - 400);
  });
});
