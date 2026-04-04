// Shared types matching backend responses

// ── Auth ─────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  categoryType: "INCOME" | "EXPENSE";
  parentId: string | null;
  color: string;
  icon: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  children: Category[];
}

export interface Transaction {
  id: string;
  userId: string;
  categoryId: string;
  bankSyncLogId: string | null;
  description: string | null;
  amount: string; // Decimal comes as string from Prisma
  baseCurrencyAmount: string;
  currency: string;
  exchangeRate: string | null;
  transactionDate: string;
  transactionType: "INCOME" | "EXPENSE";
  tags: string[];
  notes: string | null;
  isRecurring: boolean;
  createdAt: string;
  updatedAt: string;
  category: Category;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateCategoryInput {
  name: string;
  categoryType: "INCOME" | "EXPENSE";
  parentId?: string | null;
  color?: string;
  icon?: string;
}

export interface UpdateCategoryInput {
  name?: string;
  color?: string;
  icon?: string;
}

export interface CreateTransactionInput {
  categoryId: string;
  amount: number;
  currency: string;
  description?: string;
  transactionDate: string;
  tags?: string[];
  notes?: string;
  isRecurring?: boolean;
}

export interface UpdateTransactionInput {
  categoryId?: string;
  amount?: number;
  currency?: string;
  description?: string;
  transactionDate?: string;
  tags?: string[];
  notes?: string;
  isRecurring?: boolean;
}

export interface TransactionFilters {
  page?: number;
  limit?: number;
  type?: "INCOME" | "EXPENSE";
  categoryId?: string;
  startDate?: string;
  endDate?: string;
}

// ── Budget ───────────────────────────────────────────────
export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  amount: string; // Decimal comes as string from Prisma
  month: string;
  alertThreshold: string;
  createdAt: string;
  updatedAt: string;
  category: Category;
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

export interface CreateBudgetInput {
  categoryId: string;
  amount: number;
  month: string; // YYYY-MM
}

export interface UpdateBudgetInput {
  amount: number;
}

// ── Dashboard ────────────────────────────────────────────
export interface DashboardSummary {
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  transactionCount: number;
  topCategories: { categoryId: string; categoryName: string; color: string; total: number }[];
  monthlyTrend: { month: string; income: number; expense: number }[];
  recentTransactions: Transaction[];
}

// ── CSV Import ───────────────────────────────────────────
export interface CsvImportResult {
  imported: number;
  failed: number;
  errors: { row: number; message: string }[];
}

// ── Bank Sync ────────────────────────────────────────────
export interface BankSyncResult {
  syncLogId: string;
  imported: number;
  skipped: number;
  failed: number;
  errors: { description: string; message: string }[];
}

export interface BankSyncLog {
  id: string;
  userId: string;
  source: string;
  syncedAt: string;
  transactionCount: number;
  status: string;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  transactions: { id: string }[];
}

// ── Credit Card Recommendations ──────────────────────────
export interface CreditCardRecommendation {
  cardName: string;
  issuer: string;
  imageUrl: string;
  applyUrl: string;
  annualFee: string;
  rewardsRate: string;
  signUpBonus: string;
  bestFor: string;
  matchScore: number;
  rationale: string;
}

export interface CreditCardInsight {
  title: string;
  description: string;
  integrationHealth: number;
  cards: CreditCardRecommendation[];
}

// ── AI Savings Plan ──────────────────────────────────────
export interface SavingsPlanRecommendation {
  category: string;
  currentSpending: number;
  suggestedTarget: number;
  potentialSavings: number;
  rationale: string;
  priority: "high" | "medium" | "low";
}

export interface SavingsPlan {
  id: string;
  summary: string;
  recommendations: SavingsPlanRecommendation[];
  estimatedMonthlySavings: number;
  currentMonthlySavings: number;
  cautionNotes: string[];
  source: "ai" | "rules" | "insufficient_data";
}

export interface SavingsPlanHistory {
  id: string;
  userId: string;
  month: string;
  inputSummary: Record<string, unknown>;
  recommendations: Record<string, unknown>;
  totalSavings: string | null;
  status: "GENERATED" | "ACCEPTED" | "DISMISSED";
  createdAt: string;
}

// ── Report Schedule ──────────────────────────────────────
export interface ReportSchedule {
  id: string;
  userId: string;
  email: string;
  active: boolean;
  lastSent: string | null;
  createdAt: string;
  updatedAt: string;
}
