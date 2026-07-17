import type {
  FuelPriceObservation,
  FuelPriceProvider
} from "../types/index.js";

export class MockFuelPriceProvider implements FuelPriceProvider {
  constructor(private readonly observations?: FuelPriceObservation[]) {}

  async fetchPrices(): Promise<FuelPriceObservation[]> {
    const values = this.observations ?? this.defaultObservations();
    return values.map((observation) => ({
      ...observation,
      city: { ...observation.city },
      observedAt: new Date(observation.observedAt)
    }));
  }

  private defaultObservations(): FuelPriceObservation[] {
    const observedAt = new Date();
    const city = {
      externalId: "targu-mures",
      name: "Targu Mures",
      countyCode: "MS",
      latitude: 46.55136,
      longitude: 24.56522
    };

    return [
      {
        city,
        fuelType: "diesel_standard",
        priceRon: 7.42,
        observedAt,
        sourceReportedDate: observedAt.toISOString().slice(0, 10),
        source: "mock"
      },
      {
        city,
        fuelType: "diesel_premium",
        priceRon: 7.76,
        observedAt,
        sourceReportedDate: observedAt.toISOString().slice(0, 10),
        source: "mock"
      }
    ];
  }
}
