import type { TrackedCity } from "../types/index.js";

export interface DemoScenario {
  id: "normal" | "price_drop" | "absolute_target" | "duplicate";
  city: TrackedCity;
  prices: number[];
  seededNotification: boolean;
  expected: "no_alert" | "send" | "suppress_duplicate";
}

const stableHistory = [
  7.6, 7.61, 7.59, 7.6, 7.62, 7.61, 7.6, 7.59, 7.6, 7.61, 7.6, 7.59,
  7.6, 7.61
];

function city(externalId: string, name: string, latitude: number): TrackedCity {
  return {
    externalId,
    name,
    countyCode: "DEMO",
    latitude,
    longitude: 24.56522
  };
}

export function buildDemoScenarios(): DemoScenario[] {
  return [
    {
      id: "normal",
      city: city("demo-normal", "Demo City — Stable", 46.51),
      prices: [...stableHistory, 7.59],
      seededNotification: false,
      expected: "no_alert"
    },
    {
      id: "price_drop",
      city: city("demo-price-drop", "Demo City — Price Drop", 46.52),
      prices: [...stableHistory.map(() => 7.7), 7.35],
      seededNotification: false,
      expected: "send"
    },
    {
      id: "absolute_target",
      city: city("demo-absolute-target", "Demo City — Target Price", 46.53),
      prices: [...stableHistory.map(() => 7.34), 7.24],
      seededNotification: false,
      expected: "send"
    },
    {
      id: "duplicate",
      city: city("demo-duplicate", "Demo City — Duplicate Prevention", 46.54),
      prices: [...stableHistory.map(() => 7.65), 7.3],
      seededNotification: true,
      expected: "suppress_duplicate"
    }
  ];
}
