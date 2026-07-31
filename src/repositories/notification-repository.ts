import type { Pool } from "pg";
import type {
  FuelType,
  NewNotification,
  NotificationRecord
} from "../types/index.js";

export interface NotificationRepository {
  findLatest(
    cityExternalId: string,
    fuelType: FuelType
  ): Promise<NotificationRecord | null>;
  save(notification: NewNotification): Promise<NotificationRecord>;
}

interface NotificationRow {
  id: string;
  city_external_id: string;
  fuel_type: FuelType;
  price_ron: string;
  reason: string;
  sent_at: Date;
}

function mapNotification(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    cityExternalId: row.city_external_id,
    fuelType: row.fuel_type,
    priceRon: Number(row.price_ron),
    reason: row.reason,
    sentAt: new Date(row.sent_at)
  };
}

export class PostgresNotificationRepository implements NotificationRepository {
  constructor(private readonly pool: Pool) {}

  async findLatest(
    cityExternalId: string,
    fuelType: FuelType
  ): Promise<NotificationRecord | null> {
    const result = await this.pool.query<NotificationRow>(
      `SELECT notification.id,
              city.external_id AS city_external_id,
              notification.fuel_type,
              notification.price_ron,
              notification.reason,
              notification.sent_at
       FROM notifications notification
       INNER JOIN tracked_cities city ON city.id = notification.city_id
       WHERE city.external_id = $1
         AND notification.fuel_type = $2
       ORDER BY notification.sent_at DESC
       LIMIT 1`,
      [cityExternalId, fuelType]
    );
    const row = result.rows[0];
    return row ? mapNotification(row) : null;
  }

  async save(notification: NewNotification): Promise<NotificationRecord> {
    const result = await this.pool.query<NotificationRow>(
      `INSERT INTO notifications (city_id, fuel_type, price_ron, reason, sent_at)
       SELECT id, $2, $3, $4, $5
       FROM tracked_cities
       WHERE external_id = $1
       RETURNING id,
                 $1::text AS city_external_id,
                 fuel_type,
                 price_ron,
                 reason,
                 sent_at`,
      [
        notification.cityExternalId,
        notification.fuelType,
        notification.priceRon,
        notification.reason,
        notification.sentAt
      ]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error(
        `Cannot save notification for unknown city ${notification.cityExternalId}`
      );
    }
    return mapNotification(row);
  }
}
