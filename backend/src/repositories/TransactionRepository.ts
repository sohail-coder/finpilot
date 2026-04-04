import { BaseRepository } from "./BaseRepository";
import type { Prisma } from "@prisma/client";

export class TransactionRepository extends BaseRepository {
  async findByUserId(
    userId: string,
    filters: {
      type?: "INCOME" | "EXPENSE";
      categoryId?: string;
      startDate?: Date;
      endDate?: Date;
      minAmount?: number;
      maxAmount?: number;
    },
    page: number,
    limit: number
  ) {
    const where: Prisma.TransactionWhereInput = { userId };
    if (filters.type) where.transactionType = filters.type;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.startDate || filters.endDate) {
      where.transactionDate = {};
      if (filters.startDate) where.transactionDate.gte = filters.startDate;
      if (filters.endDate) where.transactionDate.lte = filters.endDate;
    }
    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      where.amount = {};
      if (filters.minAmount !== undefined) where.amount.gte = filters.minAmount;
      if (filters.maxAmount !== undefined) where.amount.lte = filters.maxAmount;
    }

    const [data, total] = await Promise.all([
      this.db.transaction.findMany({
        where,
        orderBy: { transactionDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { category: true },
      }),
      this.db.transaction.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string, userId: string) {
    return this.db.transaction.findFirst({ where: { id, userId }, include: { category: true } });
  }

  async create(data: {
    userId: string;
    categoryId: string;
    amount: number;
    currency: string;
    baseCurrencyAmount: number;
    exchangeRate: number;
    transactionType: "INCOME" | "EXPENSE";
    transactionDate: Date;
    description?: string;
    tags?: string[];
    notes?: string;
    isRecurring?: boolean;
    bankSyncLogId?: string;
  }) {
    return this.db.transaction.create({ data });
  }

  async updateById(id: string, userId: string, data: Prisma.TransactionUpdateInput) {
    return this.db.transaction.updateMany({ where: { id, userId }, data });
  }

  async deleteById(id: string, userId: string) {
    return this.db.transaction.deleteMany({ where: { id, userId } });
  }
}
