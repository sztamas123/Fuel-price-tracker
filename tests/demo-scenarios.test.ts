import { describe, expect, it } from "vitest";
import { buildDemoScenarios } from "../src/database/demo-scenarios.js";
import { getDemoDatabaseUrl } from "../src/database/seed-demo.js";
import {
  analyzePriceHistory,
  decideNotification,
  detectAlertOpportunity
} from "../src/services/index.js";
import type { PricePoint } from "../src/types/index.js";

const referenceTime = new Date("2026-07-31T12:00:00Z");
const DAY_IN_MS = 24 * 60 * 60 * 1_000;

function points(prices: number[]): PricePoint[] {
  return prices.map((priceRon, index) => ({
    priceRon,
    observedAt: new Date(
      referenceTime.getTime() - (prices.length - index - 1) * DAY_IN_MS
    )
  }));
}

describe("demo scenarios", () => {
  it("covers normal, drop, target, and duplicate behavior", () => {
    const scenarios = buildDemoScenarios();
    const outcomes = scenarios.map((scenario) => {
      const analysis = analyzePriceHistory(points(scenario.prices));
      if (!analysis) {
        throw new Error("Expected demo analysis");
      }
      const opportunity = detectAlertOpportunity(analysis, {
        dropVs7Day: 0.2,
        dropVsPrevious: 0.15,
        absoluteTargetPrice: 7.25
      });
      if (!opportunity) {
        return "no_alert";
      }
      if (!scenario.seededNotification) {
        return "send";
      }
      const decision = decideNotification(
        analysis.latest.priceRon,
        {
          id: "1",
          cityExternalId: scenario.city.externalId,
          fuelType: "diesel_standard",
          priceRon: analysis.latest.priceRon,
          reason: "below_7_day_average",
          sentAt: new Date(referenceTime.getTime() - 2 * DAY_IN_MS)
        },
        { cooldownHours: 24, additionalDropForRenotify: 0.05 },
        referenceTime
      );
      return decision.shouldNotify ? "send" : "suppress_duplicate";
    });

    expect(outcomes).toEqual([
      "no_alert",
      "send",
      "send",
      "suppress_duplicate"
    ]);
  });

  it("refuses demo operations without an explicit opt-in", () => {
    expect(() =>
      getDemoDatabaseUrl({
        DEMO_DATABASE_URL: "postgresql://demo:secret@demo.example/db"
      })
    ).toThrow("ALLOW_DEMO_SEED=true");
  });

  it("refuses to seed the production database", () => {
    const databaseUrl = "postgresql://user:secret@same.example/database";
    expect(() =>
      getDemoDatabaseUrl({
        ALLOW_DEMO_SEED: "true",
        DATABASE_URL: databaseUrl,
        DEMO_DATABASE_URL: databaseUrl
      })
    ).toThrow("must not point to the production database");
  });

  it("requires the production URL as a safety reference", () => {
    expect(() =>
      getDemoDatabaseUrl({
        ALLOW_DEMO_SEED: "true",
        DEMO_DATABASE_URL: "postgresql://demo:secret@demo.example/database"
      })
    ).toThrow("DATABASE_URL is required");
  });

  it("recognizes pooled and direct URLs for the same Neon branch", () => {
    expect(() =>
      getDemoDatabaseUrl({
        ALLOW_DEMO_SEED: "true",
        DATABASE_URL:
          "postgresql://owner:secret@ep-example-pooler.eu.neon.tech/database",
        DEMO_DATABASE_URL:
          "postgresql://owner:secret@ep-example.eu.neon.tech/database"
      })
    ).toThrow("must not point to the production database");
  });
});
