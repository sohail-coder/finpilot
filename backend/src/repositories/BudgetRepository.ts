import { BaseRepository } from "./BaseRepository";

export class BudgetRepository extends BaseRepository {
  async findByUserId(userId: string, month?: Date) {
    return this.db.budget.findMany({
      where: { userId, ...(month ? { month } : {}) },
      include: { category: true },
      orderBy: { month: "desc" },
    });
  }

  async findById(id: string, userId: string) {
    return this.db.budget.findFirst({
      where: { id, userId },
      include: { category: true },
    });
  }

  async create(data: {
    userId: string;
    categoryId: string;
    amount: number;
    month: Date;
  }) {
    return this.db.budget.create({ data, include: { category: true } });
  }

  async updateById(id: string, userId: string, data: { amount: number }) {
    return this.db.budget.updateMany({ where: { id, userId }, data });
  }

  async deleteById(id: string, userId: string) {
    return this.db.budget.deleteMany({ where: { id, userId } });
  }

  /**
   * Sum baseCurrencyAmount of EXPENSE transactions per category for a given month.
   * Returns an array of { categoryId, _sum: { baseCurrencyAmount } }.
   */
  async sumSpentByCategory(userId: string, monthStart: Date, monthEnd: Date) {
    return this.db.transaction.groupBy({
      by: ["categoryId"],
      where: {
        userId,
        transactionType: "EXPENSE",
        transactionDate: { gte: monthStart, lt: monthEnd },
      },
      _sum: { baseCurrencyAmount: true },
    });
  }
}
