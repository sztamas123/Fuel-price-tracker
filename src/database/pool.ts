import { Pool } from "pg";

export function createDatabasePool(databaseUrl: string): Pool {
  return new Pool({
    connectionString: databaseUrl,
    max: 2,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000
  });
}
