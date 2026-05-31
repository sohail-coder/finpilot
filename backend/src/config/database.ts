import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { env } from "./env";
import { getDatabaseConnectionLabel, getDatabasePoolConfig } from "./dbConfig";
import { logger } from "../utils/logger";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const pool = new Pool(getDatabasePoolConfig());

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log:
      env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  logger.info(`Connecting to database (${getDatabaseConnectionLabel()})`);
  await prisma.$queryRaw`SELECT 1`;
  logger.info("Database connected successfully");
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info("Database disconnected");
}
