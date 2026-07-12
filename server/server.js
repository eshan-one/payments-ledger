import "dotenv/config";
import { createApp } from "./src/app.js";
import { connectDB } from "./src/config/db.js";

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/payments-ledger";

async function start() {
  await connectDB(MONGO_URI);

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start();
