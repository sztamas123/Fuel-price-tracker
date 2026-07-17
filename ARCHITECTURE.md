# Architecture

## Scope

The application tracks **city-level average fuel prices**, not individual gas
stations. The public PretCarburant aggregate feed currently supplies one record
per supported city. For the initial use case, `targu-mures` is tracked and the
standard/premium diesel averages are stored on every scheduled run.

This means an alert describes an unusually low city average. It must not claim
that a particular station sells fuel at that price. Exact-station tracking can
only be added later through a provider that permits frequent station-level API
access.

## Runtime model

The tracker is a short-lived batch process. GitHub Actions starts it every three
hours (or on demand), the process performs one monitoring pass, and then exits.
There is no web server and no in-memory scheduler.

```text
GitHub Actions
  -> monitoring job
    -> configured city-average fuel price provider
    -> validation and observation storage
    -> historical price analysis
    -> alert policy and duplicate prevention
    -> Telegram notification
    -> notification history storage
  -> clean exit
```

## Module boundaries

- `config/`: environment loading and validation.
- `database/`: PostgreSQL connection lifecycle and SQL migrations.
- `providers/`: external price-source boundary. Mock and PretCarburant HTTP
  implementations both implement `FuelPriceProvider`.
- `repositories/`: all persistence operations; services do not contain SQL.
- `services/`: calculations, alert policy, and Telegram delivery.
- `jobs/`: composition root for one scheduled monitoring execution.
- `types/`: shared domain types and provider contracts.
- `utils/`: small stateless helpers.
- `tests/`: unit tests and focused integration tests.

## Key decisions

1. **City averages, not stations:** the current provider uses the unrestricted
   `https://pretcarburant.ro/api/v1/preturi` JSON endpoint. It filters the feed
   by configured city slugs and maps standard/premium diesel city averages into
   observations. No HTML scraping or station endpoint is used.
2. **PostgreSQL as durable state:** price history and notification history must
   survive individual GitHub Actions runs. Neon is accessed through the normal
   PostgreSQL protocol using `pg`.
3. **Database-level integrity:** tracked cities own observations and notification
   history. Foreign keys, positive-price checks, constrained text, and indexes
   protect the data independently of application validation.
4. **Application-managed migrations:** numbered SQL files are committed and can
   be applied in order during setup. Runtime jobs will not silently mutate the
   schema.
5. **Configuration fails fast:** missing secrets and invalid thresholds stop a
   run before network or database work begins. An optional absolute target is
   represented as `null` when unset.
6. **Dependency direction:** the job composes concrete adapters; domain services
   depend on interfaces and plain values rather than on PostgreSQL or Telegram.

## Planned execution flow

1. Load and validate configuration.
2. Fetch observations from the configured provider.
3. Validate and normalize provider data.
4. Persist new observations.
5. Load city history and calculate previous, 7-day, and 14-day statistics.
6. Evaluate alert conditions and notification suppression rules.
7. Deliver eligible Telegram messages.
8. Persist successful notification records.
9. Close resources and exit with a meaningful status code.

Steps 2-5 are implemented in Phase 2. Steps 6-9 belong to Phase 3, and
operational packaging, seed data, and comprehensive alert tests to Phase 4.

## Data-source attribution

City-average data is provided by
[PretCarburant.ro](https://pretcarburant.ro/api) under CC BY 4.0. User-facing
documentation and future notifications must retain visible attribution. The
provider sends an ordinary application User-Agent and does not attempt to bypass
published API limits.
