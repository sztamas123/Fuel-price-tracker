import type { FuelPriceObservation, FuelType } from "../types/index.js";
import { alertReasonLabel, type AlertOpportunity } from "./alert-policy.js";

const fuelLabels: Record<FuelType, string> = {
  gasoline_standard: "Standard gasoline",
  gasoline_premium: "Premium gasoline",
  diesel_standard: "Standard diesel",
  diesel_premium: "Premium diesel",
  lpg: "LPG"
};

function price(value: number | null): string {
  return value === null ? "Not enough history" : `${value.toFixed(2)} RON/L`;
}

function difference(value: number | null): string {
  if (value === null) {
    return "Not enough history";
  }
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)} RON/L`;
}

function estimatedSaving(opportunity: AlertOpportunity): number | null {
  const { analysis } = opportunity;
  const comparisons = [analysis.average7Day, analysis.previous?.priceRon ?? null]
    .filter((value): value is number => value !== null)
    .map((value) => value - analysis.latest.priceRon)
    .filter((value) => value > 0);
  return comparisons.length > 0 ? Math.max(...comparisons) * 50 : null;
}

function checkedAt(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(value);
}

export function formatTelegramMessage(
  observation: FuelPriceObservation,
  opportunity: AlertOpportunity
): string {
  const { analysis } = opportunity;
  const saving = estimatedSaving(opportunity);
  const reasons = opportunity.reasons
    .map((reason) => `• ${alertReasonLabel(reason)}`)
    .join("\n");
  const attribution =
    observation.source === "PretCarburant.ro"
      ? "PretCarburant.ro (CC BY 4.0)"
      : observation.source;

  return [
    "⛽ City fuel price drop detected",
    "",
    `City: ${observation.city.name}`,
    "Price scope: City average (not an individual station)",
    `Fuel: ${fuelLabels[observation.fuelType]}`,
    "",
    `Current city average: ${price(analysis.latest.priceRon)}`,
    `Previous observation: ${price(analysis.previous?.priceRon ?? null)}`,
    `7-day average: ${price(analysis.average7Day)}`,
    `Difference from 7-day average: ${difference(analysis.differenceFrom7Day)}`,
    `14-day average: ${price(analysis.average14Day)}`,
    ...(saving === null
      ? []
      : [`Estimated saving on 50 L: ${saving.toFixed(2)} RON`]),
    "",
    "Reasons:",
    reasons,
    "",
    `Source: ${attribution}`,
    `Checked: ${checkedAt(analysis.latest.observedAt)}`
  ].join("\n");
}
