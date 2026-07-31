import { Pool } from "pg";

const SSL_MODES_REQUIRING_VERIFICATION = new Set([
  "prefer",
  "require",
  "verify-ca"
]);

export function normalizeDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const sslMode = url.searchParams.get("sslmode");

  if (sslMode && SSL_MODES_REQUIRING_VERIFICATION.has(sslMode)) {
    url.searchParams.set("sslmode", "verify-full");
  }

  return url.toString();
}

export function createDatabasePool(databaseUrl: string): Pool {
  return new Pool({
    connectionString: normalizeDatabaseUrl(databaseUrl),
    max: 2,
    connectionTimeoutMillis: 30_000,
    idleTimeoutMillis: 10_000,
    keepAlive: true
  });
}
