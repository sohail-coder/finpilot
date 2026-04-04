import { BaseRepository } from "./BaseRepository";

export class BankSyncLogRepository extends BaseRepository {
  async create(data: {
    userId: string;
    source: string;
    transactionCount: number;
    status: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.db.bankSyncLog.create({ data: { ...data, metadata: data.metadata as any } });
  }

  async updateById(
    id: string,
    data: {
      transactionCount?: number;
      status?: string;
      errorMessage?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.db.bankSyncLog.update({ where: { id }, data: { ...data, metadata: data.metadata as any } });
  }

  async findByUserId(userId: string, limit = 20) {
    return this.db.bankSyncLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { transactions: { select: { id: true } } },
    });
  }

  /**
   * Check if transactions with the given descriptions + dates already exist
   * for this user (used for deduplication).
   */
  async findExistingTransactions(
    userId: string,
    keys: { description: string; transactionDate: Date; amount: number }[],
  ) {
    if (keys.length === 0) return [];

    return this.db.transaction.findMany({
      where: {
        userId,
        OR: keys.map((k) => ({
          description: k.description,
          transactionDate: k.transactionDate,
          amount: k.amount,
        })),
      },
      select: { description: true, transactionDate: true, amount: true },
    });
  }

  /** Delete all synced transactions and sync logs for a user. */
  async purgeAllSynced(userId: string) {
    const deleted = await this.db.transaction.deleteMany({
      where: { userId, bankSyncLogId: { not: null } },
    });
    await this.db.bankSyncLog.deleteMany({ where: { userId } });
    return deleted.count;
  }
}
