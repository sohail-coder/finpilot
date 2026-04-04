import { BaseRepository } from "./BaseRepository";

export class ExchangeRateRepository extends BaseRepository {
  async findAll() {
    return this.db.exchangeRate.findMany();
  }

  async findByPair(baseCurrency: string, targetCurrency: string) {
    return this.db.exchangeRate.findUnique({
      where: { baseCurrency_targetCurrency: { baseCurrency, targetCurrency } },
    });
  }
}
