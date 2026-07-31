import "dotenv/config";
import { fileURLToPath } from "node:url";
import type { Pool, PoolClient } from "pg";
import { buildDemoScenarios } from "./demo-scenarios.js";
import { createDatabasePool } from "./pool.js";
import { runMigrations } from "./run-migrations.js";

const DAY_IN_MS = 24 * 60 * 60 * 1_000;

function databaseIdentity(value: string): string {
  const url = new URL(value);
  const normalizedHostname = url.hostname.replace(/-pooler(?=\.)/, "");
  return `${url.username}@${normalizedHostname}${url.pathname}`;
}

export function getDemoDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Set ALLOW_DEMO_SEED=true to enable demo data operations");
  }

  const demoUrl = env.DEMO_DATABASE_URL?.trim();
  if (!demoUrl) {
    throw new Error("DEMO_DATABASE_URL must point to a separate demo database");
  }

  const productionUrl = env.DATABASE_URL?.trim();
  if (!productionUrl) {
    throw new Error("DATABASE_URL is required as a production safety reference");
  }
  if (databaseIdentity(productionUrl) === databaseIdentity(demoUrl)) {
    throw new Error("DEMO_DATABASE_URL must not point to the production database");
  }

  return demoUrl;
}

export async function cleanupDemoData(client: Pool | PoolClient): Promise<number> {
  const result = await client.query(
    "DELETE FROM tracked_cities WHERE external_id LIKE 'demo-%'"
  );
  return result.rowCount ?? 0;
}

export async function seedDemoData(
  pool: Pool,
  referenceTime: Date = new Date()
): Promise<{ cities: number; observations: number; notifications: number }> {
  const scenarios = buildDemoScenarios();
  const client = await pool.connect();
  let observationCount = 0;
  let notificationCount = 0;

  try {
    await client.query("BEGIN");
    await cleanupDemoData(client);

    for (const scenario of scenarios) {
      const cityResult = await client.query<{ id: string }>(
        `INSERT INTO tracked_cities
           (external_id, name, county_code, latitude, longitude)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          scenario.city.externalId,
          scenario.city.name,
          scenario.city.countyCode,
          scenario.city.latitude,
          scenario.city.longitude
        ]
      );
      const cityId = cityResult.rows[0]?.id;
      if (!cityId) {
        throw new Error(`Failed to seed ${scenario.city.externalId}`);
      }

      for (const [index, priceRon] of scenario.prices.entries()) {
        const daysBeforeLatest = scenario.prices.length - index - 1;
        const observedAt = new Date(
          referenceTime.getTime() - daysBeforeLatest * DAY_IN_MS
        );
        await client.query(
          `INSERT INTO fuel_price_observations
             (city_id, fuel_type, price_ron, observed_at, source_reported_date, source)
           VALUES ($1, 'diesel_standard', $2, $3, $4, 'demo-seed')`,
          [cityId, priceRon, observedAt, observedAt.toISOString().slice(0, 10)]
        );
        observationCount += 1;
      }

      if (scenario.seededNotification) {
        const latestPrice = scenario.prices.at(-1);
        if (latestPrice === undefined) {
          throw new Error(`No latest price for ${scenario.city.externalId}`);
        }
        await client.query(
          `INSERT INTO notifications
             (city_id, fuel_type, price_ron, reason, sent_at)
           VALUES ($1, 'diesel_standard', $2, 'below_7_day_average', $3)`,
          [cityId, latestPrice, new Date(referenceTime.getTime() - 2 * DAY_IN_MS)]
        );
        notificationCount += 1;
      }
    }

    await client.query("COMMIT");
    return {
      cities: scenarios.length,
      observations: observationCount,
      notifications: notificationCount
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const pool = createDatabasePool(getDemoDatabaseUrl());
  try {
    await runMigrations(pool);
    if (process.argv.includes("--cleanup")) {
      const removedCities = await cleanupDemoData(pool);
      console.log(JSON.stringify({ status: "ok", removedCities }));
      return;
    }

    const result = await seedDemoData(pool);
    console.log(JSON.stringify({ status: "ok", ...result }));
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Demo seed failed";
    console.error(JSON.stringify({ status: "error", message }));
    process.exitCode = 1;
  });
}
