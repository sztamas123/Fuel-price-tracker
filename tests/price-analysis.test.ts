import { describe, expect, it } from "vitest";
import {
  analyzePriceHistory,
  calculateAverage,
  calculateMedian
} from "../src/services/price-analysis.js";

describe("price statistics", () => {
  it("calculates averages and handles empty input", () => {
    expect(calculateAverage([7.2, 7.4, 7.6])).toBeCloseTo(7.4);
    expect(calculateAverage([])).toBeNull();
  });

  it("calculates odd and even medians without mutating input", () => {
    const values = [7.8, 7.2, 7.4, 7.6];
    expect(calculateMedian(values)).toBeCloseTo(7.5);
    expect(calculateMedian([7.8, 7.2, 7.4])).toBeCloseTo(7.4);
    expect(calculateMedian([])).toBeNull();
    expect(values).toEqual([7.8, 7.2, 7.4, 7.6]);
  });

  it("analyzes latest, previous, and prior 7/14-day city history", () => {
    const analysis = analyzePriceHistory([
      { priceRon: 7.2, observedAt: new Date("2026-07-17T12:00:00Z") },
      { priceRon: 7.5, observedAt: new Date("2026-07-16T12:00:00Z") },
      { priceRon: 7.7, observedAt: new Date("2026-07-11T12:00:00Z") },
      { priceRon: 7.9, observedAt: new Date("2026-07-05T12:00:00Z") },
      { priceRon: 8.1, observedAt: new Date("2026-07-01T11:59:59Z") }
    ]);

    expect(analysis?.latest.priceRon).toBe(7.2);
    expect(analysis?.previous?.priceRon).toBe(7.5);
    expect(analysis?.average7Day).toBeCloseTo(7.6);
    expect(analysis?.average14Day).toBeCloseTo(7.7);
    expect(analysis?.median14Day).toBeCloseTo(7.7);
    expect(analysis?.differenceFrom7Day).toBeCloseTo(-0.4);
  });
});
