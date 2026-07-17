import type { FuelPriceProvider } from "../types/index.js";
import type { CityPriceRepository } from "../repositories/index.js";
import { validateObservations } from "./observation-validation.js";

export interface StorageResult {
  fetched: number;
  inserted: number;
}

export class PriceStorageService {
  constructor(
    private readonly provider: FuelPriceProvider,
    private readonly repository: CityPriceRepository
  ) {}

  async fetchAndStore(): Promise<StorageResult> {
    const observations = validateObservations(await this.provider.fetchPrices());
    const inserted = await this.repository.saveObservations(observations);
    return { fetched: observations.length, inserted };
  }
}
