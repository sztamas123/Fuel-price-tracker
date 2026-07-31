import { describe, expect, it, vi } from "vitest";
import { MonitoringJob } from "../src/jobs/monitor-fuel-prices.js";
import { MockFuelPriceProvider } from "../src/providers/index.js";
import type {
  CityPriceRepository,
  NotificationRepository
} from "../src/repositories/index.js";
import {
  AlertNotificationService,
  PriceAnalysisService,
  PriceStorageService
} from "../src/services/index.js";
import type { FuelPriceObservation } from "../src/types/index.js";

const currentTime = new Date("2026-07-17T12:00:00Z");
const observation: FuelPriceObservation = {
  city: {
    externalId: "targu-mures",
    name: "Targu Mures",
    countyCode: "MS",
    latitude: 46.55136,
    longitude: 24.56522
  },
  fuelType: "diesel_standard",
  priceRon: 7.2,
  observedAt: currentTime,
  sourceReportedDate: "2026-07-17",
  source: "PretCarburant.ro"
};

describe("MonitoringJob", () => {
  it("runs storage, analysis, alert delivery, and persistence once", async () => {
    const priceRepository: CityPriceRepository = {
      saveObservations: vi.fn(async (values) => values.length),
      isCityEnabled: vi.fn(async () => true),
      findPriceHistory: vi.fn(async () => [
        { priceRon: 7.2, observedAt: currentTime },
        { priceRon: 7.5, observedAt: new Date("2026-07-16T12:00:00Z") }
      ])
    };
    const notificationRepository: NotificationRepository = {
      findLatest: vi.fn(async () => null),
      save: vi.fn(async (value) => ({ id: "1", ...value }))
    };
    const notifier = { sendMessage: vi.fn(async () => undefined) };
    const job = new MonitoringJob({
      storageService: new PriceStorageService(
        new MockFuelPriceProvider([observation]),
        priceRepository
      ),
      priceRepository,
      analysisService: new PriceAnalysisService(priceRepository),
      alertNotificationService: new AlertNotificationService(
        notificationRepository,
        notifier,
        { cooldownHours: 24, additionalDropForRenotify: 0.05 }
      ),
      thresholds: {
        dropVs7Day: 0.2,
        dropVsPrevious: 0.15,
        absoluteTargetPrice: null
      },
      clock: () => currentTime
    });

    await expect(job.run()).resolves.toEqual({
      fetched: 1,
      inserted: 1,
      analyzed: 1,
      opportunities: 1,
      notificationsSent: 1,
      notificationsSuppressed: 0,
      disabledSkipped: 0
    });
    expect(notifier.sendMessage).toHaveBeenCalledOnce();
    expect(notificationRepository.save).toHaveBeenCalledOnce();
  });
});
