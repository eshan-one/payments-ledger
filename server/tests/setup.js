import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

let mongoServer;

// applyPayment uses a session transaction (invoice update + ledger write
// must commit/roll back together), and MongoDB only supports transactions
// against a replica set — a single-node standalone instance rejects them.
// A 1-member replica set gives us that for free while staying just as fast
// and disposable as a standalone instance would have been.
export async function connect() {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongoServer.getUri());
}

/** Drop every collection — call between tests so state doesn't leak. */
export async function clearDatabase() {
  const { collections } = mongoose.connection;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({})),
  );
}

/** Disconnect Mongoose and tear down the in-memory instance. */
export async function closeDatabase() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
}
