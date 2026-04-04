import { BaseRepository } from "./BaseRepository";
import { Prisma } from "@prisma/client";

interface TrendRow {
  month: string;
  transaction_type: string;
  total: number;
}

interface CategorySpendRow {
  category_id: string;
  category_name: string;
  color: string;
  total: number;
}

interface CategoryMonthlyRow {
  category_id: string;
  category_name: string;
  category_type: string;
  month: string;
  total: number;
}

export type { TrendRow, CategorySpendRow, CategoryMonthlyRow };

export class DashboardRepository extends BaseRepository {
  async getIncomeExpenseTotals(userId: string, startDate: Date, endDate: Date) {
    return this.db.transaction.groupBy({
      by: ["transactionType"],
      where: { userId, transactionDate: { gte: startDate, lte: endDate } },
      _sum: { baseCurrencyAmount: true },
      _count: true,
    });
  }

  // Single query: top expense categories with names and colors via JOIN
  async getCategoryBreakdown(
    userId: string,
    startDate: Date,
    endDate: Date,
    limit = 10,
  ): Promise<CategorySpendRow[]> {
    return this.db.$queryRaw<CategorySpendRow[]>(Prisma.sql`
      SELECT t."categoryId"   AS category_id,
             c."name"         AS category_name,
             c."color"        AS color,
             SUM(t."baseCurrencyAmount")::float AS total
      FROM "Transaction" t
      JOIN "Category" c ON c."id" = t."categoryId"
      WHERE t."userId" = ${userId}
        AND t."transactionType" = 'EXPENSE'
        AND t."transactionDate" >= ${startDate}
        AND t."transactionDate" <= ${endDate}
      GROUP BY t."categoryId", c."name", c."color"
      ORDER BY total DESC
      LIMIT ${limit}
    `);
  }

  async getMonthlyTrend(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<TrendRow[]> {
    return this.db.$queryRaw<TrendRow[]>(Prisma.sql`
      SELECT to_char("transactionDate", 'YYYY-MM') AS month,
             "transactionType"                     AS transaction_type,
             SUM("baseCurrencyAmount")::float       AS total
      FROM "Transaction"
      WHERE "userId" = ${userId}
        AND "transactionDate" >= ${startDate}
        AND "transactionDate" <= ${endDate}
      GROUP BY month, "transactionType"
      ORDER BY month
    `);
  }

  async getRecentTransactions(userId: string, limit = 5) {
    return this.db.transaction.findMany({
      where: { userId },
      orderBy: { transactionDate: "desc" },
      take: limit,
      include: { category: true },
    });
  }

  /** Per-category per-month spend/income breakdown for AI preprocessing */
  async getCategoryMonthlyBreakdown(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CategoryMonthlyRow[]> {
    return this.db.$queryRaw<CategoryMonthlyRow[]>(Prisma.sql`
      SELECT t."categoryId"                     AS category_id,
             c."name"                           AS category_name,
             c."categoryType"                   AS category_type,
             to_char(t."transactionDate", 'YYYY-MM') AS month,
             SUM(t."baseCurrencyAmount")::float AS total
      FROM "Transaction" t
      JOIN "Category" c ON c."id" = t."categoryId"
      WHERE t."userId" = ${userId}
        AND t."transactionDate" >= ${startDate}
        AND t."transactionDate" <= ${endDate}
      GROUP BY t."categoryId", c."name", c."categoryType", month
      ORDER BY c."categoryType", total DESC
    `);
  }
}
