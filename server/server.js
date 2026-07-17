import "dotenv/config";
import { createApp } from "./src/app.js";
import { connectDB } from "./src/config/db.js";
import { logger } from "./src/utils/logger.js";

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;

async function start() {
  await connectDB(MONGO_URI);

  const app = createApp();
  app.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT}`);
  });
}

start();
