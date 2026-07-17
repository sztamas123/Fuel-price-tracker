import type {
  FuelPriceObservation,
  FuelPriceProvider,
  FuelType,
  TrackedCity
} from "../types/index.js";

const SOURCE_NAME = "PretCarburant.ro";

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

interface HttpFuelPriceProviderOptions {
  apiUrl: string;
  trackedCitySlugs: string[];
  fetcher?: Fetcher;
  clock?: () => Date;
}

interface PretCarburantCity {
  slug: string;
  oras: string;
  judet: string;
  lat: number;
  lng: number;
  motorina: number;
  motorina_premium: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`PretCarburant response field ${field} must be a non-empty string`);
  }
  return value.trim();
}

function requiredNumber(record: Record<string, unknown>, field: string): number {
  const value = record[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`PretCarburant response field ${field} must be a finite number`);
  }
  return value;
}

function parseCity(value: unknown): PretCarburantCity {
  if (!isRecord(value)) {
    throw new Error("PretCarburant city result must be an object");
  }

  return {
    slug: requiredString(value, "slug"),
    oras: requiredString(value, "oras"),
    judet: requiredString(value, "judet"),
    lat: requiredNumber(value, "lat"),
    lng: requiredNumber(value, "lng"),
    motorina: requiredNumber(value, "motorina"),
    motorina_premium: requiredNumber(value, "motorina_premium")
  };
}

function parseResponse(value: unknown): { reportedDate: string; cities: unknown[] } {
  if (!isRecord(value) || value.status !== "ok" || !Array.isArray(value.rezultate)) {
    throw new Error("PretCarburant response has an invalid root structure");
  }

  const reportedDate = requiredString(value, "data");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportedDate)) {
    throw new Error("PretCarburant response data must use YYYY-MM-DD format");
  }

  return { reportedDate, cities: value.rezultate };
}

function toObservations(
  city: PretCarburantCity,
  observedAt: Date,
  reportedDate: string
): FuelPriceObservation[] {
  const trackedCity: TrackedCity = {
    externalId: city.slug,
    name: city.oras,
    countyCode: city.judet,
    latitude: city.lat,
    longitude: city.lng
  };
  const prices: Array<[FuelType, number]> = [
    ["diesel_standard", city.motorina],
    ["diesel_premium", city.motorina_premium]
  ];

  return prices.map(([fuelType, priceRon]) => ({
    city: trackedCity,
    fuelType,
    priceRon,
    observedAt: new Date(observedAt),
    sourceReportedDate: reportedDate,
    source: SOURCE_NAME
  }));
}

export class HttpFuelPriceProvider implements FuelPriceProvider {
  private readonly apiUrl: URL;
  private readonly trackedCitySlugs: Set<string>;
  private readonly fetcher: Fetcher;
  private readonly clock: () => Date;

  constructor(options: HttpFuelPriceProviderOptions) {
    this.apiUrl = new URL(options.apiUrl);
    this.trackedCitySlugs = new Set(options.trackedCitySlugs);
    this.fetcher = options.fetcher ?? fetch;
    this.clock = options.clock ?? (() => new Date());
  }

  async fetchPrices(): Promise<FuelPriceObservation[]> {
    const response = await this.fetcher(this.apiUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "fuel-price-tracker/0.1"
      },
      signal: AbortSignal.timeout(15_000)
    });

    if (!response.ok) {
      throw new Error(`PretCarburant request failed with HTTP ${response.status}`);
    }

    const payload: unknown = await response.json();
    const { reportedDate, cities } = parseResponse(payload);
    const selectedCities = cities
      .filter(
        (city): city is Record<string, unknown> =>
          isRecord(city) &&
          typeof city.slug === "string" &&
          this.trackedCitySlugs.has(city.slug)
      )
      .map(parseCity);
    const foundSlugs = new Set(selectedCities.map((city) => city.slug));
    const missingSlugs = [...this.trackedCitySlugs].filter(
      (slug) => !foundSlugs.has(slug)
    );

    if (missingSlugs.length > 0) {
      throw new Error(
        `PretCarburant response did not include tracked cities: ${missingSlugs.join(", ")}`
      );
    }

    const observedAt = this.clock();
    return selectedCities.flatMap((city) =>
      toObservations(city, observedAt, reportedDate)
    );
  }
}
