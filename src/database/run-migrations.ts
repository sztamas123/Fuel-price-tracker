import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
import { createDatabasePool } from "./pool.js";

const migrationsDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "migrations"
);

export async function runMigrations(pool: Pool): Promise<string[]> {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);

  const migrationNames = (await readdir(migrationsDirectory))
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();
  const applied: string[] = [];

  for (const name of migrationNames) {
    const existing = await pool.query(
      "SELECT 1 FROM schema_migrations WHERE name = $1",
      [name]
    );
    if ((existing.rowCount ?? 0) > 0) {
      continue;
    }

    const sql = await readFile(join(migrationsDirectory, name), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
      await client.query("COMMIT");
      applied.push(name);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  return applied;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run migrations");
  }

  const pool = createDatabasePool(databaseUrl);
  try {
    const applied = await runMigrations(pool);
    console.log(JSON.stringify({ status: "ok", applied }));
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Migration failed";
    console.error(JSON.stringify({ status: "error", message }));
    process.exitCode = 1;
  });
}
