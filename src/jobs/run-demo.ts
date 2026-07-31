import { fileURLToPath } from "node:url";
import { buildDemoScenarios } from "../database/demo-scenarios.js";
import { createDatabasePool } from "../database/index.js";
import { getDemoDatabaseUrl } from "../database/seed-demo.js";
import {
  PostgresCityPriceRepository,
  PostgresNotificationRepository
} from "../repositories/index.js";
import {
  AlertNotificationService,
  detectAlertOpportunity,
  PriceAnalysisService,
  type TelegramNotifier
} from "../services/index.js";
import type { FuelPriceObservation } from "../types/index.js";

class ConsoleNotifier implements TelegramNotifier {
  async sendMessage(message: string): Promise<void> {
    console.log(`\n${message}\n`);
  }
}

type DemoOutcome = "no_alert" | "send" | "suppress_duplicate";

export async function runDemo(): Promise<
  Array<{ scenario: string; expected: DemoOutcome; actual: DemoOutcome }>
> {
  const pool = createDatabasePool(getDemoDatabaseUrl());
  try {
    const priceRepository = new PostgresCityPriceRepository(pool);
    const notificationRepository = new PostgresNotificationRepository(pool);
    const analysisService = new PriceAnalysisService(priceRepository);
    const deliveryService = new AlertNotificationService(
      notificationRepository,
      new ConsoleNotifier(),
      { cooldownHours: 24, additionalDropForRenotify: 0.05 }
    );
    const results: Array<{
      scenario: string;
      expected: DemoOutcome;
      actual: DemoOutcome;
    }> = [];

    for (const scenario of buildDemoScenarios()) {
      const analysis = await analysisService.analyzeCityFuel(
        scenario.city.externalId,
        "diesel_standard"
      );
      if (!analysis) {
        throw new Error(`No history found for demo scenario ${scenario.id}`);
      }

      const opportunity = detectAlertOpportunity(analysis, {
        dropVs7Day: 0.2,
        dropVsPrevious: 0.15,
        absoluteTargetPrice: 7.25
      });
      let actual: DemoOutcome = "no_alert";

      if (opportunity) {
        const latestPrice = scenario.prices.at(-1);
        if (latestPrice === undefined) {
          throw new Error(`No latest price for demo scenario ${scenario.id}`);
        }
        const observation: FuelPriceObservation = {
          city: scenario.city,
          fuelType: "diesel_standard",
          priceRon: latestPrice,
          observedAt: analysis.latest.observedAt,
          sourceReportedDate: analysis.latest.observedAt.toISOString().slice(0, 10),
          source: "demo-seed"
        };
        const delivery = await deliveryService.deliver(
          observation,
          opportunity
        );
        actual = delivery.sent ? "send" : "suppress_duplicate";
      }

      results.push({ scenario: scenario.id, expected: scenario.expected, actual });
    }

    const mismatches = results.filter((result) => result.expected !== result.actual);
    if (mismatches.length > 0) {
      throw new Error(`Demo outcomes did not match: ${JSON.stringify(mismatches)}`);
    }
    return results;
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void runDemo()
    .then((results) => {
      console.log(JSON.stringify({ status: "ok", results }, null, 2));
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Demo failed";
      console.error(JSON.stringify({ status: "error", message }));
      process.exitCode = 1;
    });
}
