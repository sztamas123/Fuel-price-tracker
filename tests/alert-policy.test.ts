import { describe, expect, it } from "vitest";
import {
  decideNotification,
  detectAlertOpportunity
} from "../src/services/alert-policy.js";
import type { PriceAnalysis } from "../src/services/price-analysis.js";
import type { NotificationRecord } from "../src/types/index.js";

function analysis(overrides: Partial<PriceAnalysis> = {}): PriceAnalysis {
  return {
    latest: { priceRon: 7.2, observedAt: new Date("2026-07-17T12:00:00Z") },
    previous: { priceRon: 7.4, observedAt: new Date("2026-07-17T09:00:00Z") },
    average7Day: 7.45,
    average14Day: 7.5,
    median7Day: 7.45,
    median14Day: 7.5,
    differenceFrom7Day: -0.25,
    differenceFrom14Day: -0.3,
    ...overrides
  };
}

function notification(overrides: Partial<NotificationRecord> = {}): NotificationRecord {
  return {
    id: "1",
    cityExternalId: "targu-mures",
    fuelType: "diesel_standard",
    priceRon: 7.3,
    reason: "below_7_day_average",
    sentAt: new Date("2026-07-16T10:00:00Z"),
    ...overrides
  };
}

const thresholds = {
  dropVs7Day: 0.2,
  dropVsPrevious: 0.15,
  absoluteTargetPrice: 7.3
};

const policy = {
  cooldownHours: 24,
  additionalDropForRenotify: 0.05
};

describe("alert opportunity detection", () => {
  it("collects every matching alert reason", () => {
    expect(detectAlertOpportunity(analysis(), thresholds)?.reasons).toEqual([
      "below_7_day_average",
      "drop_vs_previous",
      "below_absolute_target"
    ]);
  });

  it("returns null when no condition matches", () => {
    expect(
      detectAlertOpportunity(
        analysis({
          latest: { priceRon: 7.4, observedAt: new Date("2026-07-17T12:00:00Z") },
          previous: { priceRon: 7.45, observedAt: new Date("2026-07-17T09:00:00Z") },
          average7Day: 7.5,
          differenceFrom7Day: -0.1
        }),
        { ...thresholds, absoluteTargetPrice: null }
      )
    ).toBeNull();
  });
});

describe("notification duplicate policy", () => {
  const now = new Date("2026-07-17T12:00:00Z");

  it("allows the first notification", () => {
    expect(decideNotification(7.2, null, policy, now)).toEqual({
      shouldNotify: true
    });
  });

  it("suppresses unchanged and higher prices", () => {
    expect(decideNotification(7.3, notification(), policy, now)).toEqual({
      shouldNotify: false,
      reason: "unchanged_price"
    });
    expect(decideNotification(7.4, notification(), policy, now)).toEqual({
      shouldNotify: false,
      reason: "price_not_lower"
    });
  });

  it("enforces the cooldown even after a significant drop", () => {
    expect(
      decideNotification(
        7.1,
        notification({ sentAt: new Date("2026-07-17T00:00:01Z") }),
        policy,
        now
      )
    ).toEqual({ shouldNotify: false, reason: "cooldown_active" });
  });

  it("requires the configured additional drop after cooldown", () => {
    expect(decideNotification(7.27, notification(), policy, now)).toEqual({
      shouldNotify: false,
      reason: "insufficient_additional_drop"
    });
    expect(decideNotification(7.25, notification(), policy, now)).toEqual({
      shouldNotify: true
    });
  });
});
