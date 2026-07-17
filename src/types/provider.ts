import type { FuelPriceObservation } from "./fuel-price.js";

export interface FuelPriceProvider {
  fetchPrices(): Promise<FuelPriceObservation[]>;
}
