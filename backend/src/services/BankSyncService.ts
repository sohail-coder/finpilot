import {
  BankSyncLogRepository,
  CategoryRepository,
  TransactionRepository,
  UserRepository,
} from "../repositories";
import {
  type BankProvider,
  type BankTransaction,
  MockBankProvider,
} from "../providers";
import { CurrencyService } from "./CurrencyService";
import type { SupportedCurrency } from "../config/constants";
import { logger } from "../utils/logger";

const bankSyncLogRepo = new BankSyncLogRepository();
const categoryRepo = new CategoryRepository();
const txnRepo = new TransactionRepository();
const userRepo = new UserRepository();
const currencyService = new CurrencyService();

// Registry of available providers — add real ones here later
const providers: Record<string, BankProvider> = {
  mock: new MockBankProvider(),
};

export interface SyncResult {
  syncLogId: string;
  imported: number;
  skipped: number; // duplicates
  failed: number;
  errors: { description: string; message: string }[];
}

export class BankSyncService {
  /**
   * Trigger a bank sync using the specified provider.
   * 1. Creates a PENDING sync log
   * 2. Fetches transactions from the provider
   * 3. Deduplicates against existing data
   * 4. Creates new transactions + links them to the sync log
   * 5. Updates the sync log with results
   */
  async triggerSync(
    userId: string,
    providerName = "mock",
  ): Promise<SyncResult> {
    const provider = providers[providerName];
    if (!provider) {
      throw new Error(`Unknown bank provider: "${providerName}"`);
    }

    // 1. Create a pending sync log
    const syncLog = await bankSyncLogRepo.create({
      userId,
      source: providerName.toUpperCase(),
      transactionCount: 0,
      status: "PENDING",
      metadata: { provider: providerName },
    });

    try {
      // 2. Fetch transactions from the provider
      const bankTxns = await provider.fetchTransactions(userId);
      logger.info(`Bank sync: fetched ${bankTxns.length} transactions from ${providerName}`);

      // 3. Resolve user info + categories for mapping
      const user = await userRepo.findById(userId);
      const baseCurrency = (user?.baseCurrency ?? "USD") as SupportedCurrency;

      const userCategories = await categoryRepo.findByUserId(userId);
      const categoryMap = new Map<string, { id: string; type: string }>();
      for (const cat of userCategories) {
        categoryMap.set(cat.name.toLowerCase(), { id: cat.id, type: cat.categoryType });
        for (const child of cat.children ?? []) {
          categoryMap.set(child.name.toLowerCase(), { id: child.id, type: child.categoryType });
        }
      }

      // 4. Deduplication: check if transactions with same description+date+amount exist
      const dedupKeys = bankTxns.map((tx) => ({
        description: tx.description,
        transactionDate: new Date(tx.date),
        amount: Math.abs(tx.amount),
      }));
      const existing = await bankSyncLogRepo.findExistingTransactions(userId, dedupKeys);
      const existingSet = new Set(
        existing.map((e) =>
          `${e.description}|${new Date(e.transactionDate).toISOString().slice(0, 10)}|${Number(e.amount)}`,
        ),
      );

      // 5. Process each transaction
      let imported = 0;
      let skipped = 0;
      const errors: { description: string; message: string }[] = [];

      for (const bankTx of bankTxns) {
        const key = `${bankTx.description}|${bankTx.date}|${Math.abs(bankTx.amount)}`;
        if (existingSet.has(key)) {
          skipped++;
          continue;
        }

        const result = await this.processTransaction(
          bankTx,
          userId,
          baseCurrency,
          categoryMap,
          syncLog.id,
        );

        if (result.error) {
          errors.push({ description: bankTx.description, message: result.error });
        } else {
          imported++;
          // Add to dedup set to avoid duplicates within the same batch
          existingSet.add(key);
        }
      }

      // 6. Update sync log
      const status = errors.length > 0 ? (imported > 0 ? "PARTIAL" : "FAILURE") : "SUCCESS";
      await bankSyncLogRepo.updateById(syncLog.id, {
        transactionCount: imported,
        status,
        metadata: {
          provider: providerName,
          fetched: bankTxns.length,
          imported,
          skipped,
          failed: errors.length,
        },
      });

      return { syncLogId: syncLog.id, imported, skipped, failed: errors.length, errors };
    } catch (err) {
      // Mark sync as failed
      const msg = err instanceof Error ? err.message : "Unknown error";
      await bankSyncLogRepo.updateById(syncLog.id, {
        status: "FAILURE",
        errorMessage: msg,
      });
      throw err;
    }
  }

  /** Get sync history for a user */
  async getSyncHistory(userId: string) {
    return bankSyncLogRepo.findByUserId(userId);
  }

  /** List available providers */
  getProviders() {
    return Object.keys(providers);
  }

  /** Delete all synced transactions and sync logs */
  async purgeAllSynced(userId: string) {
    return bankSyncLogRepo.purgeAllSynced(userId);
  }

  /** Get accounts from a provider */
  async getAccounts(userId: string, providerName = "mock") {
    const provider = providers[providerName];
    if (!provider) throw new Error(`Unknown bank provider: "${providerName}"`);
    return provider.getAccounts(userId);
  }

  // ── Private helpers ────────────────────────────────────

  private async processTransaction(
    bankTx: BankTransaction,
    userId: string,
    baseCurrency: SupportedCurrency,
    categoryMap: Map<string, { id: string; type: string }>,
    syncLogId: string,
  ): Promise<{ error?: string }> {
    try {
      const isExpense = bankTx.amount < 0;
      const absAmount = Math.abs(bankTx.amount);
      const txType = isExpense ? "EXPENSE" : "INCOME";

      // Try to match category by provider's hint
      let catEntry = categoryMap.get(bankTx.categoryHint.toLowerCase());

      // If hint matched but type is wrong, ignore the match
      if (catEntry && catEntry.type !== txType) {
        catEntry = undefined;
      }

      // Auto-create the category if it doesn't exist
      if (!catEntry) {
        const catName = bankTx.categoryHint || (isExpense ? "Other Expense" : "Other Income");
        logger.info(`Bank sync: auto-creating category "${catName}" (${txType}) for user`);
        const newCat = await categoryRepo.create({
          userId,
          name: catName,
          categoryType: txType,
        });
        catEntry = { id: newCat.id, type: newCat.categoryType };
        // Update the shared map so subsequent transactions reuse it
        categoryMap.set(catName.toLowerCase(), catEntry);
      }

      // Currency conversion
      const currency = (bankTx.currency || "USD") as SupportedCurrency;
      const { baseCurrencyAmount, exchangeRate } = await currencyService.convert(
        absAmount,
        currency,
        baseCurrency,
      );

      await txnRepo.create({
        userId,
        categoryId: catEntry.id,
        amount: absAmount,
        currency,
        baseCurrencyAmount,
        exchangeRate,
        transactionType: txType,
        transactionDate: new Date(bankTx.date),
        description: bankTx.description,
        tags: bankTx.merchant ? [bankTx.merchant] : [],
        isRecurring: false,
        bankSyncLogId: syncLogId,
      });

      return {};
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return { error: msg };
    }
  }
}
