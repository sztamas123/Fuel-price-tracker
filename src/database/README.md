# Database operations

## Production migrations

Set `DATABASE_URL` and run:

```bash
npm run db:migrate
```

Numbered SQL files in `migrations/` are applied in lexical order. Successful
migrations are recorded in `schema_migrations`. The application monitoring job
never applies schema changes automatically.

The initial schema stores tracked cities and city-average observations. It does
not model or claim to track individual gas stations.

## Demo database

Demo data must use a separate PostgreSQL database or Neon branch:

```env
DATABASE_URL=postgresql://production-connection
DEMO_DATABASE_URL=postgresql://separate-demo-connection
ALLOW_DEMO_SEED=true
```

Run:

```bash
npm run demo
npm run seed:cleanup
```

The guard compares production and demo database identities, including normalized
Neon pooled/direct hostnames, and refuses to continue if they match. Cleanup is
limited to tracked-city external IDs beginning with `demo-`; foreign-key cascades
remove their observations and notification history.
