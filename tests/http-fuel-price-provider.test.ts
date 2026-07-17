import { describe, expect, it, vi } from "vitest";
import { HttpFuelPriceProvider } from "../src/providers/index.js";

const liveShape = {
  status: "ok",
  data: "2026-07-17",
  rezultate: [
    {
      benzina: 8.62,
      benzina_premium: 9.1,
      gpl: 4.55,
      judet: "MS",
      lat: 46.55136,
      lng: 24.56522,
      motorina: 9.39,
      motorina_premium: 10.16,
      oras: "Targu Mures",
      slug: "targu-mures"
    }
  ]
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

describe("HttpFuelPriceProvider", () => {
  it("maps city-average standard and premium diesel prices", async () => {
    const fetcher = vi.fn(async () => jsonResponse(liveShape));
    const provider = new HttpFuelPriceProvider({
      apiUrl: "https://pretcarburant.ro/api/v1/preturi",
      trackedCitySlugs: ["targu-mures"],
      fetcher,
      clock: () => new Date("2026-07-17T12:00:00Z")
    });

    const observations = await provider.fetchPrices();

    expect(observations).toHaveLength(2);
    expect(observations[0]).toMatchObject({
      city: {
        externalId: "targu-mures",
        name: "Targu Mures",
        countyCode: "MS"
      },
      fuelType: "diesel_standard",
      priceRon: 9.39,
      sourceReportedDate: "2026-07-17",
      source: "PretCarburant.ro"
    });
    expect(observations[0]?.observedAt.toISOString()).toBe(
      "2026-07-17T12:00:00.000Z"
    );
  });

  it("rejects a malformed tracked-city response", async () => {
    const malformed = structuredClone(liveShape);
    malformed.rezultate[0]!.motorina = Number.NaN;
    const provider = new HttpFuelPriceProvider({
      apiUrl: "https://pretcarburant.ro/api/v1/preturi",
      trackedCitySlugs: ["targu-mures"],
      fetcher: async () => jsonResponse(malformed)
    });

    await expect(provider.fetchPrices()).rejects.toThrow(
      "motorina must be a finite number"
    );
  });

  it("fails when a configured city is not present", async () => {
    const provider = new HttpFuelPriceProvider({
      apiUrl: "https://pretcarburant.ro/api/v1/preturi",
      trackedCitySlugs: ["sovata"],
      fetcher: async () => jsonResponse(liveShape)
    });

    await expect(provider.fetchPrices()).rejects.toThrow(
      "did not include tracked cities: sovata"
    );
  });
});
