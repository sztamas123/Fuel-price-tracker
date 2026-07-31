import { pathToFileURL } from "node:url";
import { loadConfig, type AppConfig } from "../config/index.js";
import { createDatabasePool } from "../database/index.js";
import { HttpFuelPriceProvider, MockFuelPriceProvider } from "../providers/index.js";
import {
  PostgresCityPriceRepository,
  PostgresNotificationRepository,
  type CityPriceRepository
} from "../repositories/index.js";
import {
  AlertNotificationService,
  detectAlertOpportunity,
  PriceAnalysisService,
  PriceStorageService,
  TelegramBotNotifier
} from "../services/index.js";
import type { FuelPriceObservation, FuelPriceProvider } from "../types/index.js";

export interface MonitoringJobResult {
  fetched: number;
  inserted: number;
  analyzed: number;
  opportunities: number;
  notificationsSent: number;
  notificationsSuppressed: number;
  disabledSkipped: number;
}

interface MonitoringJobDependencies {
  storageService: PriceStorageService;
  priceRepository: CityPriceRepository;
  analysisService: PriceAnalysisService;
  alertNotificationService: AlertNotificationService;
  thresholds: AppConfig["thresholds"];
  clock?: () => Date;
}

function uniqueCityFuelObservations(
  observations: FuelPriceObservation[]
): FuelPriceObservation[] {
  const unique = new Map<string, FuelPriceObservation>();
  for (const observation of observations) {
    unique.set(
      `${observation.city.externalId}:${observation.fuelType}`,
      observation
    );
  }
  return [...unique.values()];
}

export class MonitoringJob {
  private readonly clock: () => Date;

  constructor(private readonly dependencies: MonitoringJobDependencies) {
    this.clock = dependencies.clock ?? (() => new Date());
  }

  async run(): Promise<MonitoringJobResult> {
    const storage = await this.dependencies.storageService.fetchAndStore();
    const result: MonitoringJobResult = {
      fetched: storage.fetched,
      inserted: storage.inserted,
      analyzed: 0,
      opportunities: 0,
      notificationsSent: 0,
      notificationsSuppressed: 0,
      disabledSkipped: 0
    };
    const errors: unknown[] = [];
    const now = this.clock();

    for (const observation of uniqueCityFuelObservations(storage.observations)) {
      try {
        const enabled = await this.dependencies.priceRepository.isCityEnabled(
          observation.city.externalId
        );
        if (!enabled) {
          result.disabledSkipped += 1;
          continue;
        }

        const analysis = await this.dependencies.analysisService.analyzeCityFuel(
          observation.city.externalId,
          observation.fuelType,
          now
        );
        if (!analysis) {
          continue;
        }
        result.analyzed += 1;

        const opportunity = detectAlertOpportunity(
          analysis,
          this.dependencies.thresholds
        );
        if (!opportunity) {
          continue;
        }
        result.opportunities += 1;

        const delivery = await this.dependencies.alertNotificationService.deliver(
          observation,
          opportunity,
          now
        );
        if (delivery.sent) {
          result.notificationsSent += 1;
        } else {
          result.notificationsSuppressed += 1;
        }
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, `${errors.length} city/fuel checks failed`);
    }

    return result;
  }
}

function createProvider(config: AppConfig): FuelPriceProvider {
  return config.provider.name === "http"
    ? new HttpFuelPriceProvider({
        apiUrl: config.provider.apiUrl,
        trackedCitySlugs: config.provider.trackedCitySlugs
      })
    : new MockFuelPriceProvider();
}

export async function runMonitoringJob(): Promise<MonitoringJobResult> {
  const config = loadConfig();
  const pool = createDatabasePool(config.databaseUrl);

  try {
    const priceRepository = new PostgresCityPriceRepository(pool);
    const notificationRepository = new PostgresNotificationRepository(pool);
    const provider = createProvider(config);
    const job = new MonitoringJob({
      storageService: new PriceStorageService(provider, priceRepository),
      priceRepository,
      analysisService: new PriceAnalysisService(priceRepository),
      alertNotificationService: new AlertNotificationService(
        notificationRepository,
        new TelegramBotNotifier(config.telegram),
        config.notifications
      ),
      thresholds: config.thresholds
    });
    return await job.run();
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  try {
    const result = await runMonitoringJob();
    console.log(JSON.stringify({ status: "ok", ...result }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown monitoring error";
    console.error(JSON.stringify({ status: "error", message }));
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  void main();
}
