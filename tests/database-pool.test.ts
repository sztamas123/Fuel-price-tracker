import { describe, expect, it } from "vitest";
import { createDatabasePool, normalizeDatabaseUrl } from "../src/database/index.js";

describe("database pool configuration", () => {
  it.each(["prefer", "require", "verify-ca"])(
    "upgrades sslmode=%s to explicit full verification",
    (sslMode) => {
      const normalized = new URL(
        normalizeDatabaseUrl(
          `postgresql://user:password@example.test/database?sslmode=${sslMode}`
        )
      );

      expect(normalized.searchParams.get("sslmode")).toBe("verify-full");
    }
  );

  it("preserves unrelated connection parameters", () => {
    const normalized = new URL(
      normalizeDatabaseUrl(
        "postgresql://user:password@example.test/database?sslmode=require&channel_binding=require"
      )
    );

    expect(normalized.searchParams.get("channel_binding")).toBe("require");
  });

  it("allows thirty seconds for serverless database cold starts", async () => {
    const pool = createDatabasePool(
      "postgresql://user:password@example.test/database?sslmode=require"
    );

    expect(pool.options.connectionTimeoutMillis).toBe(30_000);
    expect(pool.options.keepAlive).toBe(true);
    await pool.end();
  });
});
