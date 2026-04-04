import type { SupportedCurrency } from "../config/constants";
import type { SavingsRecommendation } from "./api";

// Re-usable ID type
export type ID = string;

// User
export interface UserModel {
  id: ID;
  email: string;
  name: string;
  passwordHash: string;
  baseCurrency: SupportedCurrency;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// Category
export interface CategoryModel {
  id: ID;
  userId: ID;
  name: string;
  categoryType: "INCOME" | "EXPENSE";
  color: string;
  icon: string | null;
  isDefault: boolean;
  parentId: ID | null;
  createdAt: Date;
  updatedAt: Date;
}

// Transaction
export interface TransactionModel {
  id: ID;
  userId: ID;
  categoryId: ID;
  amount: number;
  currency: SupportedCurrency;
  baseCurrencyAmount: number;
  exchangeRate: number;
  type: "INCOME" | "EXPENSE";
  description: string;
  date: Date;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Budget
export interface BudgetModel {
  id: ID;
  userId: ID;
  categoryId: ID;
  amount: number;
  month: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ExchangeRate
export interface ExchangeRateModel {
  id: ID;
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  updatedAt: Date;
}

// BankSyncLog
export interface BankSyncLogModel {
  id: ID;
  userId: ID;
  fileName: string | null;
  source: string;
  syncedAt: Date;
  transactionCount: number;
  status: "PENDING" | "SUCCESS" | "FAILURE" | "PARTIAL";
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// AuditLog
export interface AuditLogModel {
  id: ID;
  userId: ID;
  action: string;
  entity: string;
  entityId: ID;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// AIRecommendation
export interface AIRecommendationModel {
  id: ID;
  userId: ID;
  month: Date;
  inputSummary: Record<string, number>;
  recommendations: SavingsRecommendation[];
  totalSavings: number | null;
  status: "GENERATED" | "ACCEPTED" | "DISMISSED";
  createdAt: Date;
}

export interface SavingsRecommendationItem {
  category: string;
  currentSpending: number;
  suggestedTarget: number;
  potentialSavings: number;
  rationale: string;
}
