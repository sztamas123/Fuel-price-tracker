import type { CityPriceRepository } from "../repositories/index.js";
import type { FuelType, PricePoint } from "../types/index.js";

const DAY_IN_MS = 24 * 60 * 60 * 1_000;

export interface PriceAnalysis {
  latest: PricePoint;
  previous: PricePoint | null;
  average7Day: number | null;
  average14Day: number | null;
  median7Day: number | null;
  median14Day: number | null;
  differenceFrom7Day: number | null;
  differenceFrom14Day: number | null;
}

export function calculateAverage(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function calculateMedian(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? null;
  }

  const left = sorted[middle - 1];
  const right = sorted[middle];
  return left === undefined || right === undefined ? null : (left + right) / 2;
}

function difference(price: number, comparison: number | null): number | null {
  return comparison === null ? null : price - comparison;
}

export function analyzePriceHistory(points: readonly PricePoint[]): PriceAnalysis | null {
  if (points.length === 0) {
    return null;
  }

  const sorted = [...points].sort(
    (left, right) => right.observedAt.getTime() - left.observedAt.getTime()
  );
  const latest = sorted[0];
  if (!latest) {
    return null;
  }

  const previous = sorted[1] ?? null;
  const history = sorted.slice(1);
  const sevenDayStart = latest.observedAt.getTime() - 7 * DAY_IN_MS;
  const fourteenDayStart = latest.observedAt.getTime() - 14 * DAY_IN_MS;
  const prices7Day = history
    .filter((point) => point.observedAt.getTime() >= sevenDayStart)
    .map((point) => point.priceRon);
  const prices14Day = history
    .filter((point) => point.observedAt.getTime() >= fourteenDayStart)
    .map((point) => point.priceRon);
  const average7Day = calculateAverage(prices7Day);
  const average14Day = calculateAverage(prices14Day);

  return {
    latest,
    previous,
    average7Day,
    average14Day,
    median7Day: calculateMedian(prices7Day),
    median14Day: calculateMedian(prices14Day),
    differenceFrom7Day: difference(latest.priceRon, average7Day),
    differenceFrom14Day: difference(latest.priceRon, average14Day)
  };
}

export class PriceAnalysisService {
  constructor(private readonly repository: CityPriceRepository) {}

  async analyzeCityFuel(
    cityExternalId: string,
    fuelType: FuelType,
    now: Date = new Date()
  ): Promise<PriceAnalysis | null> {
    const since = new Date(now.getTime() - 15 * DAY_IN_MS);
    const history = await this.repository.findPriceHistory(
      cityExternalId,
      fuelType,
      since
    );
    return analyzePriceHistory(history);
  }
}
