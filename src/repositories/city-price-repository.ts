import type { Pool, PoolClient } from "pg";
import type {
  FuelPriceObservation,
  FuelType,
  PricePoint
} from "../types/index.js";

export interface CityPriceRepository {
  saveObservations(observations: FuelPriceObservation[]): Promise<number>;
  findPriceHistory(
    cityExternalId: string,
    fuelType: FuelType,
    since: Date
  ): Promise<PricePoint[]>;
}

interface IdRow {
  id: string;
}

interface PriceRow {
  price_ron: string;
  observed_at: Date;
}

async function upsertCity(
  client: PoolClient,
  observation: FuelPriceObservation
): Promise<string> {
  const result = await client.query<IdRow>(
    `INSERT INTO tracked_cities
       (external_id, name, county_code, latitude, longitude)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (external_id) DO UPDATE SET
       name = EXCLUDED.name,
       county_code = EXCLUDED.county_code,
       latitude = EXCLUDED.latitude,
       longitude = EXCLUDED.longitude,
       updated_at = NOW()
     RETURNING id`,
    [
      observation.city.externalId,
      observation.city.name,
      observation.city.countyCode,
      observation.city.latitude,
      observation.city.longitude
    ]
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error(`Failed to upsert city ${observation.city.externalId}`);
  }
  return row.id;
}

export class PostgresCityPriceRepository implements CityPriceRepository {
  constructor(private readonly pool: Pool) {}

  async saveObservations(observations: FuelPriceObservation[]): Promise<number> {
    const client = await this.pool.connect();
    let insertedCount = 0;

    try {
      await client.query("BEGIN");
      const cityIds = new Map<string, string>();

      for (const observation of observations) {
        let cityId = cityIds.get(observation.city.externalId);
        if (!cityId) {
          cityId = await upsertCity(client, observation);
          cityIds.set(observation.city.externalId, cityId);
        }

        const result = await client.query(
          `INSERT INTO fuel_price_observations
             (city_id, fuel_type, price_ron, observed_at, source_reported_date, source)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (city_id, fuel_type, observed_at, source) DO NOTHING`,
          [
            cityId,
            observation.fuelType,
            observation.priceRon,
            observation.observedAt,
            observation.sourceReportedDate,
            observation.source
          ]
        );
        insertedCount += result.rowCount ?? 0;
      }

      await client.query("COMMIT");
      return insertedCount;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findPriceHistory(
    cityExternalId: string,
    fuelType: FuelType,
    since: Date
  ): Promise<PricePoint[]> {
    const result = await this.pool.query<PriceRow>(
      `SELECT observation.price_ron, observation.observed_at
       FROM fuel_price_observations observation
       INNER JOIN tracked_cities city ON city.id = observation.city_id
       WHERE city.external_id = $1
         AND observation.fuel_type = $2
         AND observation.observed_at >= $3
       ORDER BY observation.observed_at DESC`,
      [cityExternalId, fuelType, since]
    );

    return result.rows.map((row) => ({
      priceRon: Number(row.price_ron),
      observedAt: new Date(row.observed_at)
    }));
  }
}
