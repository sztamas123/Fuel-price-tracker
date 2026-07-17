import { describe, expect, it, vi } from "vitest";
import type { CityPriceRepository } from "../src/repositories/index.js";
import { MockFuelPriceProvider } from "../src/providers/index.js";
import {
  ObservationValidationError,
  PriceStorageService
} from "../src/services/index.js";
import type { FuelPriceObservation } from "../src/types/index.js";

function observation(priceRon = 7.42): FuelPriceObservation {
  return {
    city: {
      externalId: "targu-mures",
      name: "Targu Mures",
      countyCode: "MS",
      latitude: 46.55136,
      longitude: 24.56522
    },
    fuelType: "diesel_standard",
    priceRon,
    observedAt: new Date("2026-07-17T12:00:00Z"),
    sourceReportedDate: "2026-07-17",
    source: "mock"
  };
}

function repository(): CityPriceRepository {
  return {
    saveObservations: vi.fn(async (values) => values.length),
    findPriceHistory: vi.fn(async () => [])
  };
}

describe("PriceStorageService", () => {
  it("validates and stores provider observations", async () => {
    const priceRepository = repository();
    const service = new PriceStorageService(
      new MockFuelPriceProvider([observation()]),
      priceRepository
    );

    await expect(service.fetchAndStore()).resolves.toEqual({ fetched: 1, inserted: 1 });
    expect(priceRepository.saveObservations).toHaveBeenCalledOnce();
  });

  it("does not write malformed provider data", async () => {
    const priceRepository = repository();
    const service = new PriceStorageService(
      new MockFuelPriceProvider([observation(Number.NaN)]),
      priceRepository
    );

    await expect(service.fetchAndStore()).rejects.toBeInstanceOf(
      ObservationValidationError
    );
    expect(priceRepository.saveObservations).not.toHaveBeenCalled();
  });
});
