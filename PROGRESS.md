# Implementation progress

## Phase 1 - Complete

### Completed work

- Documented the scheduled batch architecture and module boundaries.
- Created the Node.js 20+, TypeScript, ESM, and Vitest project foundation.
- Selected a minimal runtime dependency set: `pg` and `dotenv`.
- Added environment examples and fail-fast typed configuration validation.
- Added the initial PostgreSQL migration and project folder structure.

## Phase 2 - Complete

### Completed work

- Changed the product scope from individual stations to city-level fuel-price
  averages.
- Verified and integrated the unrestricted PretCarburant city aggregate endpoint.
- Added configurable tracked city slugs; the example tracks `targu-mures`.
- Added `FuelPriceProvider`, city, fuel, observation, and price-history types.
- Implemented `MockFuelPriceProvider` for development and tests.
- Implemented `HttpFuelPriceProvider` for PretCarburant JSON data with strict
  response parsing, timeouts, missing-city detection, and no HTML scraping.
- Reworked the PostgreSQL schema around `tracked_cities`, city observations, and
  future city notification history.
- Added Neon-compatible pool creation and a transactional PostgreSQL repository.
- Added validation before persistence, including duplicate, range, coordinate,
  date, fuel-type, and required-field checks.
- Added fetch-and-store orchestration at the service layer.
- Added latest/previous, 7-day and 14-day average, median, and difference
  calculations. The historical averages exclude the latest observation being
  evaluated.
- Added Phase 2 tests for provider mapping and malformed data, storage validation,
  average/median calculation, and historical analysis.

## Phase 3 - Complete

### Completed work

- Implemented the 7-day-average, previous-observation, and optional absolute
  target alert conditions for city averages.
- Combined simultaneous matching conditions into one alert opportunity.
- Implemented unchanged/higher-price suppression, a minimum cooldown, and the
  additional-drop requirement for re-notification.
- Added notification-history lookup and successful-send persistence in
  PostgreSQL.
- Added direct Telegram Bot API delivery with timeouts and response validation,
  without another runtime dependency.
- Added city-worded Telegram messages with comparison statistics, reasons,
  estimated 50 L savings where possible, Romanian local time, and visible
  PretCarburant CC BY 4.0 attribution.
- Added the one-shot monitoring composition root with configuration loading,
  provider selection, validation/storage, enabled-city checks, analysis,
  notification delivery, resource cleanup, structured summaries, and nonzero
  failure status.
- Added unit/orchestration tests for all alert conditions, cooldown behavior,
  duplicate prevention, Telegram formatting/delivery, persistence ordering, and
  the complete monitoring flow.

## Phase 4 - Complete

### Completed work

- Added an explicit, repeatable migration runner with migration-history tracking.
- Made the baseline schema safe to adopt in an already initialized database.
- Added four deterministic city-average demo scenarios: stable, significant
  drop, absolute target, and duplicate suppression.
- Added transactional demo seed/reset and cleanup commands protected by
  `ALLOW_DEMO_SEED=true`.
- Required a separate `DEMO_DATABASE_URL` and reject the production database,
  including equivalent Neon pooled/direct hostnames.
- Added a console-only demo runner that exercises the real repository, analysis,
  alert, suppression, and notification-history services without contacting
  Telegram.
- Added the scheduled GitHub Actions workflow with a three-hour cron, manual
  dispatch, least-privilege permissions, concurrency control, timeout, locked
  dependency installation, build, and production execution.
- Added demo-scenario and seed-safety tests.
- Added complete setup, Neon, Telegram, environment, testing, demo, GitHub
  Actions, provider-extension, operations, and future-improvement documentation
  in the root README.

### Current architecture

The application is a short-lived scheduled batch process. A provider fetches
city-average diesel prices, validation rejects the entire batch before any write
if tracked-city data is malformed, and a transactional repository upserts city
metadata and stores observations in Neon PostgreSQL. Analysis services evaluate
durable history, then the notification service applies persistent suppression
rules before delivering and recording eligible Telegram messages.

The application does **not** track individual gas stations. An observation for
Târgu Mureș represents the published city average and future notifications must
say so explicitly. Data attribution: PretCarburant.ro, CC BY 4.0.

See `ARCHITECTURE.md` for module boundaries and data-source decisions.

### Remaining tasks

All four requested implementation phases are complete. Before relying on the
scheduled production workflow:

- apply migrations with `npm run db:migrate`;
- push the Phase 4 commit;
- configure the three GitHub repository secrets;
- optionally configure threshold repository variables; and
- run the workflow manually once from the GitHub Actions tab.

## Continuation note

Use `README.md` as the operational entry point. Continue to describe observations
as city averages, and do not use PretCarburant station endpoints or HTML
scraping.
