import type { NotificationRepository } from "../repositories/index.js";
import type { FuelPriceObservation } from "../types/index.js";
import {
  decideNotification,
  type AlertOpportunity,
  type NotificationPolicyConfig,
  type SuppressionReason
} from "./alert-policy.js";
import { formatTelegramMessage } from "./telegram-message.js";
import type { TelegramNotifier } from "./telegram-notifier.js";

export type AlertDeliveryResult =
  | { sent: true }
  | { sent: false; reason: SuppressionReason };

export class AlertNotificationService {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly notifier: TelegramNotifier,
    private readonly policy: NotificationPolicyConfig
  ) {}

  async deliver(
    observation: FuelPriceObservation,
    opportunity: AlertOpportunity,
    now: Date = new Date()
  ): Promise<AlertDeliveryResult> {
    const latestNotification = await this.repository.findLatest(
      observation.city.externalId,
      observation.fuelType
    );
    const decision = decideNotification(
      opportunity.analysis.latest.priceRon,
      latestNotification,
      this.policy,
      now
    );

    if (!decision.shouldNotify) {
      return { sent: false, reason: decision.reason };
    }

    await this.notifier.sendMessage(formatTelegramMessage(observation, opportunity));
    await this.repository.save({
      cityExternalId: observation.city.externalId,
      fuelType: observation.fuelType,
      priceRon: opportunity.analysis.latest.priceRon,
      reason: opportunity.reasons.join(","),
      sentAt: now
    });
    return { sent: true };
  }
}
