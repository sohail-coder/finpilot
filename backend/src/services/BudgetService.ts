import { BudgetRepository } from "../repositories";
import { NotFoundError } from "../types/errors";
import type { BudgetStatus } from "../types/api";

const budgetRepo = new BudgetRepository();

export class BudgetService {
  async list(userId: string, month?: string) {
    return budgetRepo.findByUserId(
      userId,
      month ? new Date(`${month}-01`) : undefined,
    );
  }

  async getById(id: string, userId: string) {
    const budget = await budgetRepo.findById(id, userId);
    if (!budget) throw new NotFoundError("Budget", id);
    return budget;
  }

  async create(
    userId: string,
    data: { categoryId: string; amount: number; month: string },
  ) {
    return budgetRepo.create({
      userId,
      categoryId: data.categoryId,
      amount: data.amount,
      month: new Date(`${data.month}-01`),
    });
  }

  async update(id: string, userId: string, data: { amount: number }) {
    const result = await budgetRepo.updateById(id, userId, data);
    if (result.count === 0) throw new NotFoundError("Budget", id);
    return budgetRepo.findById(id, userId);
  }

  async delete(id: string, userId: string) {
    const result = await budgetRepo.deleteById(id, userId);
    if (result.count === 0) throw new NotFoundError("Budget", id);
  }

  /**
   * Calculate budget vs actual spending for a given month.
   *
   * Algorithm:
   * 1. Fetch all budgets for (userId, month)
   * 2. Query sum of EXPENSE transactions per category in that month
   * 3. For each budget: spent = sum for that category (or 0),
   *    remaining = budget - spent, percentUsed = (spent / budget) * 100
   */
  async getStatus(userId: string, month: string): Promise<BudgetStatus[]> {
    const monthStart = new Date(`${month}-01`);
    const monthEnd = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1),
    );

    const [budgets, spentRows] = await Promise.all([
      budgetRepo.findByUserId(userId, monthStart),
      budgetRepo.sumSpentByCategory(userId, monthStart, monthEnd),
    ]);

    const spentMap = new Map<string, number>();
    for (const row of spentRows) {
      spentMap.set(row.categoryId, Number(row._sum.baseCurrencyAmount ?? 0));
    }

    return budgets.map((b) => {
      const budgetAmount = Number(b.amount);
      const spentAmount = spentMap.get(b.categoryId) ?? 0;
      const remainingAmount = budgetAmount - spentAmount;
      const percentUsed =
        budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : 0;

      return {
        budgetId: b.id,
        categoryId: b.categoryId,
        categoryName: b.category.name,
        budgetAmount,
        spentAmount,
        remainingAmount,
        percentUsed: Math.round(percentUsed * 100) / 100,
      };
    });
  }
}
