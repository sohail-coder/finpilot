import { prisma } from "../config/database";
import type { PrismaClient } from "@prisma/client";

/**
 * Base repository — provides the Prisma client to all child repos.
 * Subclasses access `this.db` for queries.
 */
export abstract class BaseRepository {
  protected readonly db: PrismaClient;

  constructor() {
    this.db = prisma;
  }
}
