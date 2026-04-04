import { DashboardRepository } from "../repositories";
import type { DashboardSummary } from "../types/api";

const dashboardRepo = new DashboardRepository();

export class DashboardService {
  /**
   * All monetary values use baseCurrencyAmount (pre-converted at write time),
   * so aggregation is a straight SUM — no currency math at read time.
   */
  async getSummary(userId: string, startDate: string, endDate: string): Promise<DashboardSummary> {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // All four queries are independent — run in parallel
    const [totals, categoryRows, trendRows, recentTransactions] = await Promise.all([
      dashboardRepo.getIncomeExpenseTotals(userId, start, end),
      dashboardRepo.getCategoryBreakdown(userId, start, end),
      dashboardRepo.getMonthlyTrend(userId, start, end),
      dashboardRepo.getRecentTransactions(userId),
    ]);

    let totalIncome = 0;
    let totalExpense = 0;
    let transactionCount = 0;
    for (const row of totals) {
      const amount = Number(row._sum.baseCurrencyAmount ?? 0);
      transactionCount += row._count;
      if (row.transactionType === "INCOME") totalIncome = amount;
      else totalExpense = amount;
    }

    // categoryRows already contain name + color from the JOIN — no second lookup needed
    const topCategories = categoryRows.map((r) => ({
      categoryId: r.category_id,
      categoryName: r.category_name,
      color: r.color,
      total: r.total,
    }));

    // Pivot trend rows (one row per month+type) into { month, income, expense }
    const trendMap = new Map<string, { income: number; expense: number }>();
    for (const row of trendRows) {
      const entry = trendMap.get(row.month) ?? { income: 0, expense: 0 };
      if (row.transaction_type === "INCOME") entry.income = row.total;
      else entry.expense = row.total;
      trendMap.set(row.month, entry);
    }
    const monthlyTrend = Array.from(trendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, vals]) => ({ month, ...vals }));

    return {
      totalIncome,
      totalExpense,
      netSavings: totalIncome - totalExpense,
      transactionCount,
      topCategories,
      monthlyTrend,
      recentTransactions,
    };
  }
}
