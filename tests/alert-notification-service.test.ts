import { describe, expect, it, vi } from "vitest";
import type { NotificationRepository } from "../src/repositories/index.js";
import { AlertNotificationService } from "../src/services/index.js";
import type { AlertOpportunity } from "../src/services/alert-policy.js";
import type {
  FuelPriceObservation,
  NotificationRecord
} from "../src/types/index.js";

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
  observedAt: new Date("2026-07-17T12:00:00Z"),
  sourceReportedDate: "2026-07-17",
  source: "PretCarburant.ro"
};

const opportunity: AlertOpportunity = {
  reasons: ["below_7_day_average"],
  analysis: {
    latest: { priceRon: 7.2, observedAt: observation.observedAt },
    previous: { priceRon: 7.4, observedAt: new Date("2026-07-17T09:00:00Z") },
    average7Day: 7.5,
    average14Day: 7.55,
    median7Day: 7.5,
    median14Day: 7.55,
    differenceFrom7Day: -0.3,
    differenceFrom14Day: -0.35
  }
};

function repository(latest: NotificationRecord | null): NotificationRepository {
  return {
    findLatest: vi.fn(async () => latest),
    save: vi.fn(async (value) => ({ id: "1", ...value }))
  };
}

describe("AlertNotificationService", () => {
  it("sends first and persists only after successful delivery", async () => {
    const notificationRepository = repository(null);
    const notifier = { sendMessage: vi.fn(async () => undefined) };
    const service = new AlertNotificationService(notificationRepository, notifier, {
      cooldownHours: 24,
      additionalDropForRenotify: 0.05
    });

    await expect(
      service.deliver(observation, opportunity, new Date("2026-07-17T12:00:00Z"))
    ).resolves.toEqual({ sent: true });
    expect(notifier.sendMessage).toHaveBeenCalledOnce();
    expect(notificationRepository.save).toHaveBeenCalledOnce();
  });

  it("suppresses an unchanged already-notified price", async () => {
    const notificationRepository = repository({
      id: "1",
      cityExternalId: "targu-mures",
      fuelType: "diesel_standard",
      priceRon: 7.2,
      reason: "below_7_day_average",
      sentAt: new Date("2026-07-16T00:00:00Z")
    });
    const notifier = { sendMessage: vi.fn(async () => undefined) };
    const service = new AlertNotificationService(notificationRepository, notifier, {
      cooldownHours: 24,
      additionalDropForRenotify: 0.05
    });

    await expect(
      service.deliver(observation, opportunity, new Date("2026-07-17T12:00:00Z"))
    ).resolves.toEqual({ sent: false, reason: "unchanged_price" });
    expect(notifier.sendMessage).not.toHaveBeenCalled();
    expect(notificationRepository.save).not.toHaveBeenCalled();
  });
});
