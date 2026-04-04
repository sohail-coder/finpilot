// Shared request / response shapes

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface TransactionFilters extends PaginationQuery {
  type?: "INCOME" | "EXPENSE";
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  tags?: string[];
}

export interface DashboardSummary {
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  transactionCount: number;
  topCategories: { categoryId: string; categoryName: string; color: string; total: number }[];
  monthlyTrend: { month: string; income: number; expense: number }[];
  recentTransactions: unknown[];
}

export interface BudgetStatus {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  budgetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentUsed: number;
}

export interface SavingsRecommendation {
  category: string;
  currentSpending: number;
  suggestedTarget: number;
  potentialSavings: number;
  rationale: string;
}
