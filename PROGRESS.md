# Implementation progress

## Phase 1 - Complete

### Completed work

- Inspected the repository; it contained only the product prompt.
- Documented the scheduled batch architecture and module boundaries.
- Created the Node.js 20+, TypeScript, ESM, and Vitest project foundation.
- Selected a minimal runtime dependency set: `pg` and `dotenv`.
- Added environment examples and fail-fast typed configuration validation.
- Added the initial PostgreSQL migration for stations, observations, and
  notification history, including constraints and history-query indexes.
- Created the planned source and test directory structure.

### Current architecture

The application is designed as a one-run batch job invoked by GitHub Actions.
The future job composition root will connect a configured price provider,
repositories backed by Neon PostgreSQL, analysis and alert services, and a
Telegram adapter. Durable notification records will provide duplicate and
cooldown protection across otherwise stateless scheduled runs.

See `ARCHITECTURE.md` for decisions and dependency boundaries.

### Remaining tasks

#### Phase 2

- Define domain observation types and the `FuelPriceProvider` contract.
- Implement mock provider and HTTP provider skeleton with permitted-source TODOs.
- Add PostgreSQL connection handling and repositories.
- Validate/store provider observations and implement average/median calculations.

#### Phase 3

- Implement the three alert conditions.
- Implement cooldown, unchanged-price suppression, and re-notification rules.
- Add Telegram message generation and delivery.
- Compose the scheduled monitoring job with clean shutdown/error handling.

#### Phase 4

- Add unit and focused integration tests requested by the prompt.
- Add fictional Romanian seed/demo data and scenarios.
- Add the three-hour GitHub Actions workflow and manual dispatch.
- Complete end-user setup, Neon, Telegram, provider, and operations documentation.

## Continuation note

Begin the next session at Phase 2. Do not implement Phase 3 alerting while the
provider/repository/calculation layer is still incomplete.
