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

### Current architecture

The application is a short-lived scheduled batch process. A provider fetches
city-average diesel prices, validation rejects the entire batch before any write
if tracked-city data is malformed, and a transactional repository upserts city
metadata and stores observations in Neon PostgreSQL. Analysis services read the
durable history and calculate statistics without knowing about SQL.

The application does **not** track individual gas stations. An observation for
Târgu Mureș represents the published city average and future notifications must
say so explicitly. Data attribution: PretCarburant.ro, CC BY 4.0.

See `ARCHITECTURE.md` for module boundaries and data-source decisions.

### Remaining tasks

#### Phase 3

- Implement the three alert conditions against city averages.
- Implement cooldown, unchanged-price suppression, and re-notification rules.
- Generate city-worded Telegram messages with PretCarburant attribution.
- Add Telegram delivery and successful-notification persistence.
- Compose the scheduled monitoring job with clean shutdown/error handling.

#### Phase 4

- Add remaining alert, cooldown, duplicate, and Telegram tests.
- Add fictional city-average historical seed/demo scenarios.
- Add the three-hour GitHub Actions workflow and manual dispatch.
- Complete end-user setup, Neon, Telegram, provider, and operations documentation.

## Continuation note

Begin the next session at Phase 3. Do not describe observations as station prices
and do not use PretCarburant station endpoints or HTML scraping.
