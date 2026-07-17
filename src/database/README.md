# Database migrations

Apply numbered SQL files in ascending order to the Neon database. For example,
with PostgreSQL's `psql` client installed:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f src/database/migrations/001_initial_schema.sql
```

Runtime migration automation and repositories are intentionally deferred to the
later implementation phases.
