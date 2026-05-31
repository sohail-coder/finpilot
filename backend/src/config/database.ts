import { PrismaClient } from "@prisma/client";
import { env } from "./env";
import { logger } from "../utils/logger";

const prisma = new PrismaClient({
  log:
    env.NODE_ENV === "development"
      ? ["query", "info", "warn", "error"]
      : ["error"],
});

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info("Database connected successfully");
  } catch (error) {
    logger.error("Failed to connect to database", { error });
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info("Database disconnected");
}

export { prisma };
