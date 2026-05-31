import { app } from "./app";
import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { logger } from "./utils/logger";
import { startScheduler } from "./config/scheduler";

async function main() {
  // Hostinger waits for listen() before marking the app healthy — connect DB after binding.
  const server = app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
    console.log(`[finpilot] listening on port ${env.PORT}`);
  });

  try {
    await connectDatabase();
    startScheduler();
  } catch (error) {
    logger.error("Database connection failed — fix DATABASE_URL in hPanel env vars", {
      error,
    });
    console.error("[finpilot] Database connection failed:", error);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
