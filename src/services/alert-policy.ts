import type { NotificationRecord } from "../types/index.js";
import type { PriceAnalysis } from "./price-analysis.js";

const FLOAT_TOLERANCE = 1e-9;
const HOUR_IN_MS = 60 * 60 * 1_000;

export type AlertReason =
  | "below_7_day_average"
  | "drop_vs_previous"
  | "below_absolute_target";

export interface AlertThresholds {
  dropVs7Day: number;
  dropVsPrevious: number;
  absoluteTargetPrice: number | null;
}

export interface AlertOpportunity {
  reasons: AlertReason[];
  analysis: PriceAnalysis;
}

export type SuppressionReason =
  | "unchanged_price"
  | "price_not_lower"
  | "cooldown_active"
  | "insufficient_additional_drop";

export type NotificationDecision =
  | { shouldNotify: true }
  | { shouldNotify: false; reason: SuppressionReason };

export interface NotificationPolicyConfig {
  cooldownHours: number;
  additionalDropForRenotify: number;
}

export function detectAlertOpportunity(
  analysis: PriceAnalysis,
  thresholds: AlertThresholds
): AlertOpportunity | null {
  const reasons: AlertReason[] = [];
  const currentPrice = analysis.latest.priceRon;

  if (
    analysis.average7Day !== null &&
    analysis.average7Day - currentPrice + FLOAT_TOLERANCE >= thresholds.dropVs7Day
  ) {
    reasons.push("below_7_day_average");
  }

  if (
    analysis.previous !== null &&
    analysis.previous.priceRon - currentPrice + FLOAT_TOLERANCE >=
      thresholds.dropVsPrevious
  ) {
    reasons.push("drop_vs_previous");
  }

  if (
    thresholds.absoluteTargetPrice !== null &&
    currentPrice < thresholds.absoluteTargetPrice
  ) {
    reasons.push("below_absolute_target");
  }

  return reasons.length > 0 ? { reasons, analysis } : null;
}

export function decideNotification(
  currentPrice: number,
  latestNotification: NotificationRecord | null,
  config: NotificationPolicyConfig,
  now: Date
): NotificationDecision {
  if (!latestNotification) {
    return { shouldNotify: true };
  }

  const priceDifference = latestNotification.priceRon - currentPrice;
  if (Math.abs(priceDifference) <= FLOAT_TOLERANCE) {
    return { shouldNotify: false, reason: "unchanged_price" };
  }
  if (priceDifference < 0) {
    return { shouldNotify: false, reason: "price_not_lower" };
  }

  const cooldownEndsAt =
    latestNotification.sentAt.getTime() + config.cooldownHours * HOUR_IN_MS;
  if (now.getTime() < cooldownEndsAt) {
    return { shouldNotify: false, reason: "cooldown_active" };
  }

  if (priceDifference + FLOAT_TOLERANCE < config.additionalDropForRenotify) {
    return { shouldNotify: false, reason: "insufficient_additional_drop" };
  }

  return { shouldNotify: true };
}

export function alertReasonLabel(reason: AlertReason): string {
  const labels: Record<AlertReason, string> = {
    below_7_day_average: "Below 7-day city average",
    drop_vs_previous: "Dropped since previous observation",
    below_absolute_target: "Below configured target price"
  };
  return labels[reason];
}
