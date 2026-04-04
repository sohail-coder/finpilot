import { ExchangeRateRepository } from "../repositories";
import { logger } from "../utils/logger";

// ── Provider interface ───────────────────────────────────
// Any exchange-rate source (DB, external API, mock) implements this contract.
// Swap implementations without touching business logic.

export interface RateProvider {
  /** Return the exchange rate to convert 1 unit of `from` into `to`. */
  getRate(from: string, to: string): Promise<number>;
}

// ── Database provider ────────────────────────────────────
// Reads from the ExchangeRate table (seeded / admin-managed rows).

export class DatabaseRateProvider implements RateProvider {
  private repo = new ExchangeRateRepository();

  async getRate(from: string, to: string): Promise<number> {
    // Direct lookup
    const direct = await this.repo.findByPair(from, to);
    if (direct) return direct.rate.toNumber();

    // Try inverse (e.g. DB has EUR→USD but we need USD→EUR)
    const inverse = await this.repo.findByPair(to, from);
    if (inverse) return 1 / inverse.rate.toNumber();

    throw new Error(`No exchange rate found for ${from} → ${to}`);
  }
}

// ── Fixed-rate provider (dev / testing) ──────────────────
// Hardcoded rates relative to USD. Useful for tests and offline dev.

const FIXED_RATES_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  INR: 0.012,
  JPY: 0.0067,
  CAD: 0.74,
  AUD: 0.65,
};

export class FixedRateProvider implements RateProvider {
  async getRate(from: string, to: string): Promise<number> {
    if (from === to) return 1;

    const fromUsd = FIXED_RATES_TO_USD[from];
    const toUsd = FIXED_RATES_TO_USD[to];

    if (fromUsd === undefined || toUsd === undefined) {
      throw new Error(`Fixed rate not available for ${from} → ${to}`);
    }

    // Cross-rate via USD: (from→USD) / (to→USD)
    return fromUsd / toUsd;
  }
}

// ── Fallback wrapper ─────────────────────────────────────
// Tries the primary provider, falls back to the secondary on failure.
// Logs the failure so it surfaces in monitoring without crashing the request.

export class FallbackRateProvider implements RateProvider {
  constructor(
    private primary: RateProvider,
    private fallback: RateProvider,
  ) {}

  async getRate(from: string, to: string): Promise<number> {
    try {
      return await this.primary.getRate(from, to);
    } catch (err) {
      logger.warn(
        `Primary rate provider failed for ${from}→${to}, using fallback`,
        {
          error: err instanceof Error ? err.message : err,
        },
      );
      return this.fallback.getRate(from, to);
    }
  }
}
