import { parseCsvBuffer, type CsvRow } from "../utils/csvParser";
import { CategoryRepository, TransactionRepository, UserRepository } from "../repositories";
import { CurrencyService } from "./CurrencyService";
import type { SupportedCurrency } from "../config/constants";

const categoryRepo = new CategoryRepository();
const txnRepo = new TransactionRepository();
const userRepo = new UserRepository();
const currencyService = new CurrencyService();

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportResult {
  imported: number;
  failed: number;
  errors: ImportRowError[];
}

export class CsvImportService {
  async importTransactions(userId: string, fileBuffer: Buffer): Promise<ImportResult> {
    const { validRows, errors } = await parseCsvBuffer(fileBuffer);

    // Fetch the user's categories once and build a lookup by name (case-insensitive)
    const userCategories = await categoryRepo.findByUserId(userId);
    const categoryMap = new Map<string, { id: string; type: string }>();
    for (const cat of userCategories) {
      categoryMap.set(cat.name.toLowerCase(), { id: cat.id, type: cat.categoryType });
      // Also index children
      for (const child of cat.children ?? []) {
        categoryMap.set(child.name.toLowerCase(), { id: child.id, type: child.categoryType });
      }
    }

    // Fetch user's base currency
    const user = await userRepo.findById(userId);
    const baseCurrency = (user?.baseCurrency ?? "USD") as SupportedCurrency;

    const rowErrors: ImportRowError[] = [...errors];
    let imported = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      // Row number: errors from parsing use 1-indexed; valid rows are 0-indexed here
      // but we don't know their original row numbers, so offset by parse-error count
      const rowNum = i + 1 + errors.filter((e) => e.row <= i + 1).length;

      const result = await this.processRow(row, rowNum, userId, baseCurrency, categoryMap);
      if (result.error) {
        rowErrors.push(result.error);
      } else {
        imported++;
      }
    }

    return { imported, failed: rowErrors.length, errors: rowErrors };
  }

  private async processRow(
    row: CsvRow,
    rowNum: number,
    userId: string,
    baseCurrency: SupportedCurrency,
    categoryMap: Map<string, { id: string; type: string }>,
  ): Promise<{ error?: ImportRowError }> {
    try {
      // Resolve category by name
      const catEntry = categoryMap.get(row.category.toLowerCase());
      if (!catEntry) {
        return { error: { row: rowNum, message: `Category "${row.category}" not found. Create it first.` } };
      }

      // Validate type matches category
      if (catEntry.type !== row.type) {
        return {
          error: {
            row: rowNum,
            message: `Type "${row.type}" doesn't match category "${row.category}" (${catEntry.type})`,
          },
        };
      }

      // Parse date
      const transactionDate = new Date(row.date);
      if (isNaN(transactionDate.getTime())) {
        return { error: { row: rowNum, message: `Invalid date "${row.date}"` } };
      }

      // Currency conversion
      const currency = (row.currency ?? "USD") as SupportedCurrency;
      const { baseCurrencyAmount, exchangeRate } = await currencyService.convert(
        row.amount,
        currency,
        baseCurrency,
      );

      await txnRepo.create({
        userId,
        categoryId: catEntry.id,
        amount: row.amount,
        currency,
        baseCurrencyAmount,
        exchangeRate,
        transactionType: row.type as "INCOME" | "EXPENSE",
        transactionDate,
        description: row.description || undefined,
        tags: [],
        isRecurring: false,
      });

      return {};
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return { error: { row: rowNum, message: msg } };
    }
  }
}
