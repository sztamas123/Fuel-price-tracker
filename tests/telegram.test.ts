import { describe, expect, it, vi } from "vitest";
import type { AlertOpportunity } from "../src/services/alert-policy.js";
import { formatTelegramMessage } from "../src/services/telegram-message.js";
import { TelegramBotNotifier } from "../src/services/telegram-notifier.js";
import type { FuelPriceObservation } from "../src/types/index.js";

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
  reasons: ["below_7_day_average", "drop_vs_previous"],
  analysis: {
    latest: { priceRon: 7.2, observedAt: new Date("2026-07-17T12:00:00Z") },
    previous: { priceRon: 7.4, observedAt: new Date("2026-07-17T09:00:00Z") },
    average7Day: 7.5,
    average14Day: 7.55,
    median7Day: 7.5,
    median14Day: 7.55,
    differenceFrom7Day: -0.3,
    differenceFrom14Day: -0.35
  }
};

describe("Telegram message generation", () => {
  it("clearly describes city-average data and attribution", () => {
    const message = formatTelegramMessage(observation, opportunity);

    expect(message).toContain("City: Targu Mures");
    expect(message).toContain("City average (not an individual station)");
    expect(message).toContain("Current city average: 7.20 RON/L");
    expect(message).toContain("Estimated saving on 50 L: 15.00 RON");
    expect(message).toContain("Source: PretCarburant.ro (CC BY 4.0)");
  });
});

describe("TelegramBotNotifier", () => {
  it("posts a plain-text message to the configured chat", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, result: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    const notifier = new TelegramBotNotifier({
      botToken: "test-token",
      chatId: "12345",
      fetcher
    });

    await notifier.sendMessage("test message");

    const request = fetcher.mock.calls[0];
    expect(request?.[0].toString()).toContain("bottest-token/sendMessage");
    expect(JSON.parse(request?.[1]?.body as string)).toEqual({
      chat_id: "12345",
      text: "test message"
    });
  });

  it("rejects unsuccessful Telegram responses", async () => {
    const notifier = new TelegramBotNotifier({
      botToken: "test-token",
      chatId: "12345",
      fetcher: async () =>
        new Response(JSON.stringify({ ok: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
    });

    await expect(notifier.sendMessage("test")).rejects.toThrow(
      "Telegram rejected"
    );
  });
});
