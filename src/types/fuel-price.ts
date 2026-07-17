export const fuelTypes = [
  "gasoline_standard",
  "gasoline_premium",
  "diesel_standard",
  "diesel_premium",
  "lpg"
] as const;

export type FuelType = (typeof fuelTypes)[number];

export interface TrackedCity {
  externalId: string;
  name: string;
  countyCode: string;
  latitude: number;
  longitude: number;
}

export interface FuelPriceObservation {
  city: TrackedCity;
  fuelType: FuelType;
  priceRon: number;
  observedAt: Date;
  sourceReportedDate: string | null;
  source: string;
}

export interface StoredFuelPriceObservation extends FuelPriceObservation {
  id: string;
  cityId: string;
}

export interface PricePoint {
  priceRon: number;
  observedAt: Date;
}
