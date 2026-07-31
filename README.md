# Fuel Price Tracker

A production-oriented Node.js batch application that records Romanian city-level
fuel-price averages and sends Telegram alerts when diesel becomes meaningfully
cheaper.

The application is intentionally serverless in the operational sense:
cron-job.org asks GitHub Actions to start one process every three hours, the
process fetches prices, updates Neon PostgreSQL, evaluates alerts, sends eligible
notifications, and exits.

> **Scope:** this project tracks published **city averages**, not individual gas
> stations. A notification must not be interpreted as a guaranteed pump price.

## Features

- Real city-average data from the public PretCarburant REST endpoint
- Standard and premium diesel observations
- PostgreSQL history stored on Neon
- Previous-price, 7-day, and 14-day statistics
- Configurable absolute-target and price-drop alerts
- Persistent cooldown and duplicate prevention
- Telegram Bot API notifications
- One-shot execution triggered through GitHub Actions
- Strict external-data validation and transactional persistence
- Isolated, deterministic demo scenarios
- TypeScript and Vitest coverage with minimal dependencies

## How it works

```text
cron-job.org (every 3 hours)
  -> GitHub Actions workflow dispatch
  -> load and validate configuration
  -> fetch PretCarburant city averages
  -> validate and store observations in Neon
  -> calculate current, previous, 7-day, and 14-day statistics
  -> evaluate alert and re-notification policy
  -> send eligible Telegram messages
  -> persist successful notification history
  -> close database connections and exit
```

There is no HTTP server, frontend, in-memory scheduler, Docker requirement, or
long-running process.

## Alert rules

One notification is generated when any of these conditions match:

1. The current city average is at least `PRICE_DROP_VS_7D` below the previous
   seven-day average.
2. It dropped by at least `PRICE_DROP_VS_PREVIOUS` from the preceding
   observation.
3. It is below `ABSOLUTE_TARGET_PRICE`, when that optional target is configured.

If multiple conditions match, they are combined into one notification.

The first qualifying alert is sent immediately. A later alert for the same city
and fuel grade requires:

- the cooldown to have expired;
- a price lower than the last notified price; and
- at least `ADDITIONAL_DROP_FOR_RENOTIFY` of additional reduction.

Unchanged and higher prices are always suppressed.

## Technology

- Node.js 20 or newer
- TypeScript with ECMAScript modules
- PostgreSQL through `pg`
- Neon serverless PostgreSQL
- Telegram Bot API
- GitHub Actions
- cron-job.org
- Vitest

## Project structure

```text
src/
  config/        Environment loading and validation
  database/      Pool, migrations, and guarded demo data
  jobs/          Production monitoring and demo entry points
  providers/     Mock and PretCarburant HTTP providers
  repositories/ PostgreSQL persistence adapters
  services/      Validation, analysis, alerting, and Telegram delivery
  types/         Domain models and provider contracts
tests/           Unit and orchestration tests
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for design decisions and
[PROGRESS.md](PROGRESS.md) for the phased implementation record.

## Local setup

### 1. Install dependencies

```bash
git clone https://github.com/sztamas123/Fuel-price-tracker.git
cd Fuel-price-tracker
npm ci
cp .env.example .env
```

Only `.env.example` is committed. Never commit `.env` or paste credentials into
issues, logs, screenshots, or documentation.

### 2. Configure Neon

1. Create a project at [Neon](https://neon.com/).
2. Open the project's **Connect** dialog.
3. Copy the complete PostgreSQL connection string.
4. Set it in `.env`:

```env
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

Keep the entire string, including SSL and channel-binding query parameters.

Apply the committed migrations:

```bash
npm run db:migrate
```

The migration command is repeatable. Applied migration names are stored in
`schema_migrations`; application runs never mutate the schema automatically.

### 3. Configure Telegram

1. Open the verified `@BotFather` account in Telegram.
2. Send `/newbot` and follow the prompts.
3. Save the returned bot token.
4. Open the new bot, press **Start**, and send it a message.
5. In a terminal, load the token without putting it in shell history:

```bash
read -rsp "Bot token: " TELEGRAM_BOT_TOKEN
echo
curl --silent "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates"
```

Find the numeric `message.chat.id` in the response. Then set both values in
`.env`:

```env
TELEGRAM_BOT_TOKEN=your-secret-token
TELEGRAM_CHAT_ID=your-numeric-chat-id
```

Bots cannot initiate a private conversation, so you must message the bot first.
See Telegram's [official bot tutorial](https://core.telegram.org/bots/tutorial).

### 4. Configure the provider and thresholds

For live city averages:

```env
FUEL_PRICE_PROVIDER=http
FUEL_PRICE_API_URL=https://pretcarburant.ro/api/v1/preturi
TRACKED_CITY_SLUGS=targu-mures
```

For local mock data:

```env
FUEL_PRICE_PROVIDER=mock
```

The live endpoint only supports cities present in its aggregate response. If a
configured slug is absent, the job fails rather than silently tracking the wrong
area.

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | — | Complete production PostgreSQL URL |
| `TELEGRAM_BOT_TOKEN` | Yes | — | Telegram bot credential |
| `TELEGRAM_CHAT_ID` | Yes | — | Destination private/group chat |
| `PRICE_DROP_VS_7D` | No | `0.20` | Required reduction from 7-day average, RON/L |
| `PRICE_DROP_VS_PREVIOUS` | No | `0.15` | Required reduction from previous price, RON/L |
| `ABSOLUTE_TARGET_PRICE` | No | disabled | Alert below this RON/L price |
| `NOTIFICATION_COOLDOWN_HOURS` | No | `24` | Minimum time between alerts |
| `ADDITIONAL_DROP_FOR_RENOTIFY` | No | `0.05` | Further reduction required to alert again |
| `FUEL_PRICE_PROVIDER` | No | `mock` | `mock` or `http` |
| `FUEL_PRICE_API_URL` | No | PretCarburant API | HTTPS aggregate endpoint |
| `TRACKED_CITY_SLUGS` | No | `targu-mures` | Comma-separated city slugs |
| `DEMO_DATABASE_URL` | Demo only | — | Separate demo database/branch URL |
| `ALLOW_DEMO_SEED` | Demo only | `false` | Explicit demo write/cleanup guard |

`ABSOLUTE_TARGET_PRICE=` intentionally disables the absolute target while the
historical rules continue working.

## Running locally

Run directly from TypeScript:

```bash
npm run dev
```

Or build the production output and run it:

```bash
npm run build
npm start
```

A successful run prints a machine-readable summary:

```json
{
  "status": "ok",
  "fetched": 2,
  "inserted": 2,
  "analyzed": 2,
  "opportunities": 0,
  "notificationsSent": 0,
  "notificationsSuppressed": 0,
  "disabledSkipped": 0
}
```

The first live runs may not alert because seven-day history does not exist yet.
Previous-price comparisons begin with the second observation.

## Tests

```bash
npm test
npm run check
npm run build
```

The suite covers:

- average and median calculation;
- previous, 7-day, and 14-day analysis;
- malformed provider responses;
- city selection and API mapping;
- all three alert conditions;
- cooldown and additional-drop behavior;
- unchanged-price duplicate prevention;
- Telegram message formatting and delivery errors;
- persistence ordering; and
- complete monitoring orchestration.

Tests do not call Telegram, PretCarburant, or Neon.

## Safe demo data

Real history takes time to accumulate. The demo creates four deterministic
city-average scenarios:

| Scenario | Expected result |
| --- | --- |
| Stable price | No alert |
| Large historical/previous drop | Console notification |
| Absolute target | Console notification |
| Previously notified unchanged price | Suppressed duplicate |

Demo data is never allowed to use `DATABASE_URL`. Create a separate Neon branch
or database, then set:

```env
DEMO_DATABASE_URL=postgresql://demo-user:password@demo-host/demo?sslmode=require
ALLOW_DEMO_SEED=true
```

Every Neon branch has its own isolated connection string; see Neon's
[branching workflow guide](https://neon.com/docs/get-started-with-neon/workflow-primer).

Seed and run the console-only demo:

```bash
npm run demo
```

The command resets only cities whose IDs begin with `demo-`, seeds historical
observations, evaluates every scenario, prints would-be Telegram messages to the
console, and validates the expected outcomes. It never contacts Telegram.

Clean up demo records:

```bash
npm run seed:cleanup
```

Both commands refuse to run unless `ALLOW_DEMO_SEED=true`, and they reject a
demo URL that identifies the production database.

## Scheduled deployment

The workflow at
[`.github/workflows/monitor-fuel-prices.yml`](.github/workflows/monitor-fuel-prices.yml)
supports manual and authenticated API execution. cron-job.org calls that API
every three hours; the workflow does not rely on GitHub's best-effort cron
scheduler.

In the GitHub repository, open:

```text
Settings → Secrets and variables → Actions
```

Create these repository **secrets**:

- `DATABASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Optionally create these repository **variables**:

- `PRICE_DROP_VS_7D`
- `PRICE_DROP_VS_PREVIOUS`
- `ABSOLUTE_TARGET_PRICE`
- `NOTIFICATION_COOLDOWN_HOURS`
- `ADDITIONAL_DROP_FOR_RENOTIFY`
- `TRACKED_CITY_SLUGS`

When optional variables are absent, the workflow uses the documented defaults.
GitHub documents repository secret creation in
[Using secrets in GitHub Actions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).

After pushing the workflow:

1. Open the repository's **Actions** tab.
2. Select **Monitor fuel prices**.
3. Choose **Run workflow** for the first test.
4. Inspect the structured job summary.

### External scheduler

Create a fine-grained GitHub personal access token:

1. Open **GitHub → Settings → Developer settings → Personal access tokens →
   Fine-grained tokens**.
2. Limit repository access to `Fuel-price-tracker` only.
3. Grant the repository permission **Actions: Read and write**. No other write
   permission is required.
4. Choose an expiration and record a reminder to rotate the token.

Create a job at [cron-job.org](https://cron-job.org/) with these settings:

```text
Title: Fuel price tracker
URL: https://api.github.com/repos/sztamas123/Fuel-price-tracker/actions/workflows/monitor-fuel-prices.yml/dispatches
Method: POST
Schedule: every 3 hours at minute 17
Timezone: Europe/Bucharest
```

Add these request headers:

```text
Accept: application/vnd.github+json
Authorization: Bearer YOUR_FINE_GRAINED_TOKEN
X-GitHub-Api-Version: 2026-03-10
Content-Type: application/json
```

Set the request body to:

```json
{"ref":"main"}
```

Keep the token only in cron-job.org: never add it to this repository, an
environment example, or a support message. Enable failure notifications, then
use cron-job.org's **Test run**. A successful request returns HTTP `200` and
creates a GitHub Actions run whose event is `workflow_dispatch`.

## Database model

### `tracked_cities`

Stores configured city identities, county codes, coordinates, and enabled state.

### `fuel_price_observations`

Stores immutable city-average fuel observations, source reporting dates, and
source attribution.

### `notifications`

Stores successful Telegram deliveries used for cooldown and duplicate
prevention.

Disabling a row in `tracked_cities` prevents analysis and notification for that
city while preserving its history.

## Data source and responsible access

The HTTP provider uses the documented, unrestricted city aggregate endpoint:

```text
GET https://pretcarburant.ro/api/v1/preturi
```

Data is attributed to [PretCarburant.ro](https://pretcarburant.ro/api) under
CC BY 4.0. The application does not scrape HTML, impersonate an AI crawler, or
bypass station-endpoint rate limits.

Any future external fuel-price source must explicitly allow automated access.
Do not add a scraper merely because prices are visible in a browser.

## Adding another provider

Implement the small provider contract:

```ts
interface FuelPriceProvider {
  fetchPrices(): Promise<FuelPriceObservation[]>;
}
```

Then:

1. Map the external response into city observations.
2. Validate source-specific fields before mapping.
3. Add the provider name to configuration validation.
4. Select it in the monitoring job's provider factory.
5. Add malformed-response and mapping tests.
6. Document access terms, attribution, freshness, and rate limits.

Repositories and alert services should not depend on provider-specific response
types.

## Operational notes

- The job exits nonzero on provider, database, configuration, or Telegram errors.
- A failure for one city/fuel pair does not prevent other pairs from being
  attempted.
- Notification history is written only after Telegram confirms delivery.
- Telegram delivery and PostgreSQL cannot share a transaction. If Telegram
  succeeds and the subsequent database write fails, the next run could repeat
  that notification.
- Common PostgreSQL SSL aliases such as `sslmode=require` are normalized to
  `verify-full`, preserving certificate verification without relying on
  version-specific `pg` alias behavior.
- The pool allows 30 seconds for a serverless database cold start and enables
  TCP keepalive.
- Source prices are informational; the price displayed at the pump remains
  authoritative.

## Future improvements

- Configurable fuel-grade selection
- More permitted city-level providers and failover
- Provider freshness/staleness alerts
- Database-backed migration checks in CI
- Temporary Neon branches for automated integration tests
- Structured logging and run telemetry
- Route-aware city selection
- A small read-only historical reporting interface
