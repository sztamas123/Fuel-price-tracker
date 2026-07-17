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
  provider: FuelPriceProviderName;
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
    provider: providerName(env)
  };
}
