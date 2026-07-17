import "dotenv/config";

export type FuelPriceProviderName = "mock" | "http";

export interface AppConfig {
  databaseUrl: string;
  telegram: {
    botToken: string;
    chatId: string;
  };
  thresholds: {
    dropVs7Day: number;
    dropVsPrevious: number;
    absoluteTargetPrice: number | null;
  };
  notifications: {
    cooldownHours: number;
    additionalDropForRenotify: number;
  };
  provider: {
    name: FuelPriceProviderName;
    apiUrl: string;
    trackedCitySlugs: string[];
  };
}
type Environment = NodeJS.ProcessEnv;

function requiredString(env: Environment, name: string): string {
  const value = env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function nonNegativeNumber(
  env: Environment,
  name: string,
  defaultValue?: number
): number {
  const raw = env[name]?.trim();

  if (!raw && defaultValue !== undefined) {
    return defaultValue;
  }

  if (!raw) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number`);
  }

  return value;
}

function optionalPositiveNumber(env: Environment, name: string): number | null {
  const raw = env[name]?.trim();
  if (!raw) {
    return null;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number when provided`);
  }

  return value;
}

function providerName(env: Environment): FuelPriceProviderName {
  const value = (env.FUEL_PRICE_PROVIDER?.trim() || "mock").toLowerCase();
  if (value !== "mock" && value !== "http") {
    throw new Error('FUEL_PRICE_PROVIDER must be either "mock" or "http"');
  }

  return value;
}

function absoluteHttpUrl(env: Environment, name: string, defaultValue: string): string {
  const raw = env[name]?.trim() || defaultValue;

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") {
      throw new Error();
    }
    return url.toString();
  } catch {
    throw new Error(`${name} must be a valid HTTPS URL`);
  }
}

function trackedCitySlugs(env: Environment): string[] {
  const values = (env.TRACKED_CITY_SLUGS || "targu-mures")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const uniqueValues = [...new Set(values)];

  if (uniqueValues.length === 0) {
    throw new Error("TRACKED_CITY_SLUGS must contain at least one city slug");
  }

  for (const slug of uniqueValues) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error(`Invalid city slug in TRACKED_CITY_SLUGS: ${slug}`);
    }
  }

  return uniqueValues;
}

export function loadConfig(env: Environment = process.env): AppConfig {
  return {
    databaseUrl: requiredString(env, "DATABASE_URL"),
    telegram: {
      botToken: requiredString(env, "TELEGRAM_BOT_TOKEN"),
      chatId: requiredString(env, "TELEGRAM_CHAT_ID")
    },
    thresholds: {
      dropVs7Day: nonNegativeNumber(env, "PRICE_DROP_VS_7D", 0.2),
      dropVsPrevious: nonNegativeNumber(env, "PRICE_DROP_VS_PREVIOUS", 0.15),
      absoluteTargetPrice: optionalPositiveNumber(env, "ABSOLUTE_TARGET_PRICE")
    },
    notifications: {
      cooldownHours: nonNegativeNumber(env, "NOTIFICATION_COOLDOWN_HOURS", 24),
      additionalDropForRenotify: nonNegativeNumber(
        env,
        "ADDITIONAL_DROP_FOR_RENOTIFY",
        0.05
      )
    },
    provider: {
      name: providerName(env),
      apiUrl: absoluteHttpUrl(
        env,
        "FUEL_PRICE_API_URL",
        "https://pretcarburant.ro/api/v1/preturi"
      ),
      trackedCitySlugs: trackedCitySlugs(env)
    }
  };
}
