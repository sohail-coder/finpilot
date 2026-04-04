import { z } from "zod";

// ── Auth ─────────────────────────────────────────────────
export const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(128),
  baseCurrency: z.string().length(3).default("USD"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ── Category ─────────────────────────────────────────────
export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  categoryType: z.enum(["INCOME", "EXPENSE"]),
  parentId: z.string().min(1).nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
});

// ── Transaction ──────────────────────────────────────────
export const createTransactionSchema = z.object({
  categoryId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3),
  description: z.string().max(500).optional(),
  transactionDate: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid date"),
  tags: z.array(z.string().max(50)).max(10).default([]),
  notes: z.string().max(2000).optional(),
  isRecurring: z.boolean().default(false),
});

export const updateTransactionSchema = z.object({
  categoryId: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  description: z.string().max(500).optional(),
  transactionDate: z
    .string()
    .refine((s) => !isNaN(Date.parse(s)), "Invalid date")
    .optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  notes: z.string().max(2000).optional(),
  isRecurring: z.boolean().optional(),
});

// ── Budget ───────────────────────────────────────────────
export const createBudgetSchema = z.object({
  categoryId: z.string().min(1),
  amount: z.number().positive(),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Format: YYYY-MM"),
});

export const updateBudgetSchema = z.object({
  amount: z.number().positive(),
});

// ── Query params ─────────────────────────────────────────
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const transactionFilterSchema = paginationSchema.extend({
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
  categoryId: z.string().min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  minAmount: z.coerce.number().positive().optional(),
  maxAmount: z.coerce.number().positive().optional(),
});

// ── Dashboard ────────────────────────────────────────────
export const dashboardQuerySchema = z.object({
  startDate: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid date"),
  endDate: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid date"),
});
