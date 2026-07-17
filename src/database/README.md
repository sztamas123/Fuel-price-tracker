# Database migrations

Apply numbered SQL files in ascending order to the Neon database. For example,
with PostgreSQL's `psql` client installed:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f src/database/migrations/001_initial_schema.sql
```

The initial schema stores tracked cities and city-average fuel observations. It
does not model or claim to track individual gas stations.

Runtime migration automation is intentionally deferred to a later phase. Phase
2 repositories use this schema but never apply migrations automatically.
