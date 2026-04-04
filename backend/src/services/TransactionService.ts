import {
  TransactionRepository,
  CategoryRepository,
  UserRepository,
} from "../repositories";
import { NotFoundError } from "../types/errors";
import { CurrencyService } from "./CurrencyService";
import type { SupportedCurrency } from "../config/constants";

const txnRepo = new TransactionRepository();
const categoryRepo = new CategoryRepository();
const userRepo = new UserRepository();
const currencyService = new CurrencyService();

export class TransactionService {
  async list(
    userId: string,
    filters: {
      type?: "INCOME" | "EXPENSE";
      categoryId?: string;
      startDate?: string;
      endDate?: string;
      minAmount?: number;
      maxAmount?: number;
    },
    page: number,
    limit: number,
  ) {
    return txnRepo.findByUserId(
      userId,
      {
        ...filters,
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
      },
      page,
      limit,
    );
  }

  async getById(id: string, userId: string) {
    const txn = await txnRepo.findById(id, userId);
    if (!txn) throw new NotFoundError("Transaction", id);
    return txn;
  }

  async create(
    userId: string,
    data: {
      categoryId: string;
      amount: number;
      currency: string;
      description?: string;
      transactionDate: string;
      tags?: string[];
      notes?: string;
      isRecurring?: boolean;
    },
  ) {
    // Validate category exists and belongs to user
    const category = await categoryRepo.findById(data.categoryId, userId);
    if (!category) throw new NotFoundError("Category", data.categoryId);

    // Look up user's base currency for conversion
    const user = await userRepo.findById(userId);
    if (!user) throw new NotFoundError("User", userId);
    const baseCurrency = user.baseCurrency as SupportedCurrency;

    // Convert original amount to user's base currency
    const { baseCurrencyAmount, exchangeRate } = await currencyService.convert(
      data.amount,
      data.currency as SupportedCurrency,
      baseCurrency,
    );

    return txnRepo.create({
      userId,
      categoryId: data.categoryId,
      amount: data.amount,
      currency: data.currency,
      baseCurrencyAmount,
      exchangeRate,
      transactionType: category.categoryType as "INCOME" | "EXPENSE",
      transactionDate: new Date(data.transactionDate),
      description: data.description,
      tags: data.tags ?? [],
      notes: data.notes,
      isRecurring: data.isRecurring ?? false,
    });
  }

  async update(
    id: string,
    userId: string,
    data: {
      categoryId?: string;
      amount?: number;
      currency?: string;
      description?: string;
      transactionDate?: string;
      tags?: string[];
      notes?: string;
      isRecurring?: boolean;
    },
  ) {
    const existing = await txnRepo.findById(id, userId);
    if (!existing) throw new NotFoundError("Transaction", id);

    const updateData: Record<string, unknown> = {};

    // Re-derive transactionType if category changed
    if (data.categoryId && data.categoryId !== existing.categoryId) {
      const category = await categoryRepo.findById(data.categoryId, userId);
      if (!category) throw new NotFoundError("Category", data.categoryId);
      updateData.categoryId = data.categoryId;
      updateData.transactionType = category.categoryType;
    }

    // Re-convert if amount or currency changed
    const amount = data.amount ?? Number(existing.amount);
    const currency = data.currency ?? existing.currency;
    if (data.amount !== undefined || data.currency !== undefined) {
      const user = await userRepo.findById(userId);
      if (!user) throw new NotFoundError("User", userId);
      const baseCurrency = user.baseCurrency as SupportedCurrency;

      const { baseCurrencyAmount, exchangeRate } =
        await currencyService.convert(
          amount,
          currency as SupportedCurrency,
          baseCurrency,
        );
      updateData.amount = amount;
      updateData.currency = currency;
      updateData.baseCurrencyAmount = baseCurrencyAmount;
      updateData.exchangeRate = exchangeRate;
    }

    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.transactionDate !== undefined)
      updateData.transactionDate = new Date(data.transactionDate);
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.isRecurring !== undefined)
      updateData.isRecurring = data.isRecurring;

    await txnRepo.updateById(id, userId, updateData);
    return txnRepo.findById(id, userId);
  }

  async delete(id: string, userId: string) {
    const existing = await txnRepo.findById(id, userId);
    if (!existing) throw new NotFoundError("Transaction", id);
    await txnRepo.deleteById(id, userId);
  }
}
