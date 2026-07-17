import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/index.js";

const requiredEnvironment = {
  DATABASE_URL: "postgresql://example.test/database",
  TELEGRAM_BOT_TOKEN: "test-token",
  TELEGRAM_CHAT_ID: "12345"
};

describe("provider configuration", () => {
  it("loads and deduplicates configured city slugs", () => {
    const config = loadConfig({
      ...requiredEnvironment,
      FUEL_PRICE_PROVIDER: "http",
      TRACKED_CITY_SLUGS: "targu-mures, cluj-napoca, targu-mures"
    });

    expect(config.provider).toEqual({
      name: "http",
      apiUrl: "https://pretcarburant.ro/api/v1/preturi",
      trackedCitySlugs: ["targu-mures", "cluj-napoca"]
    });
  });

  it("rejects invalid city slugs", () => {
    expect(() =>
      loadConfig({
        ...requiredEnvironment,
        TRACKED_CITY_SLUGS: "Târgu Mureș"
      })
    ).toThrow("Invalid city slug");
  });
});
