import { ExchangeRateRepository } from "../repositories";
import { SUPPORTED_CURRENCIES } from "../config/constants";
import type { SupportedCurrency } from "../config/constants";
import {
  type RateProvider,
  DatabaseRateProvider,
  FixedRateProvider,
  FallbackRateProvider,
} from "../providers";

// ── In-memory rate cache with TTL ────────────────────────

interface CachedRate {
  rate: number;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

class RateCache {
  private entries = new Map<string, CachedRate>();

  private key(from: string, to: string) {
    return `${from}:${to}`;
  }

  get(from: string, to: string): number | null {
    const entry = this.entries.get(this.key(from, to));
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
      this.entries.delete(this.key(from, to));
      return null;
    }
    return entry.rate;
  }

  set(from: string, to: string, rate: number) {
    this.entries.set(this.key(from, to), { rate, fetchedAt: Date.now() });
  }

  clear() {
    this.entries.clear();
  }
}

// ── Service ──────────────────────────────────────────────

const exchangeRateRepo = new ExchangeRateRepository();

export interface ConversionResult {
  baseCurrencyAmount: number;
  exchangeRate: number;
}

export class CurrencyService {
  private provider: RateProvider;
  private cache = new RateCache();

  constructor(provider?: RateProvider) {
    // Default: try DB first, fall back to fixed rates on failure
    this.provider =
      provider ??
      new FallbackRateProvider(
        new DatabaseRateProvider(),
        new FixedRateProvider(),
      );
  }

  async getRates() {
    return exchangeRateRepo.findAll();
  }

  getSupportedCurrencies() {
    return SUPPORTED_CURRENCIES;
  }

  /**
   * Convert `amount` from `fromCurrency` into the user's `baseCurrency`.
   * Returns both the converted amount and the rate used (stored on the transaction).
   */
  async convert(
    amount: number,
    fromCurrency: SupportedCurrency,
    baseCurrency: SupportedCurrency,
  ): Promise<ConversionResult> {
    if (fromCurrency === baseCurrency) {
      return { baseCurrencyAmount: amount, exchangeRate: 1 };
    }

    const rate = await this.getRate(fromCurrency, baseCurrency);
    return {
      baseCurrencyAmount: parseFloat((amount * rate).toFixed(2)),
      exchangeRate: parseFloat(rate.toFixed(6)),
    };
  }

  /** Fetch a rate, hitting the cache first. */
  private async getRate(from: string, to: string): Promise<number> {
    const cached = this.cache.get(from, to);
    if (cached !== null) return cached;

    const rate = await this.provider.getRate(from, to);
    this.cache.set(from, to, rate);
    return rate;
  }
}
