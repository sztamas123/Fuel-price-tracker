import { fuelTypes, type FuelPriceObservation } from "../types/index.js";

export class ObservationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ObservationValidationError";
  }
}

function isValidDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}

export function validateObservations(
  observations: FuelPriceObservation[]
): FuelPriceObservation[] {
  if (observations.length === 0) {
    throw new ObservationValidationError("Provider returned no observations");
  }

  const keys = new Set<string>();

  for (const [index, observation] of observations.entries()) {
    const label = `Observation ${index + 1}`;

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(observation.city.externalId)) {
      throw new ObservationValidationError(`${label} has an invalid city external ID`);
    }
    if (observation.city.name.trim() === "") {
      throw new ObservationValidationError(`${label} has an empty city name`);
    }
    if (observation.city.countyCode.trim() === "") {
      throw new ObservationValidationError(`${label} has an empty county code`);
    }
    if (
      !Number.isFinite(observation.city.latitude) ||
      observation.city.latitude < -90 ||
      observation.city.latitude > 90 ||
      !Number.isFinite(observation.city.longitude) ||
      observation.city.longitude < -180 ||
      observation.city.longitude > 180
    ) {
      throw new ObservationValidationError(`${label} has invalid coordinates`);
    }
    if (!fuelTypes.includes(observation.fuelType)) {
      throw new ObservationValidationError(`${label} has an unsupported fuel type`);
    }
    if (
      !Number.isFinite(observation.priceRon) ||
      observation.priceRon < 1 ||
      observation.priceRon > 20
    ) {
      throw new ObservationValidationError(
        `${label} price must be between 1 and 20 RON/L`
      );
    }
    if (!isValidDate(observation.observedAt)) {
      throw new ObservationValidationError(`${label} has an invalid observation time`);
    }
    if (
      observation.sourceReportedDate !== null &&
      !/^\d{4}-\d{2}-\d{2}$/.test(observation.sourceReportedDate)
    ) {
      throw new ObservationValidationError(`${label} has an invalid source date`);
    }
    if (observation.source.trim() === "") {
      throw new ObservationValidationError(`${label} has an empty source`);
    }

    const key = [
      observation.city.externalId,
      observation.fuelType,
      observation.observedAt.toISOString(),
      observation.source
    ].join(":");
    if (keys.has(key)) {
      throw new ObservationValidationError(`${label} duplicates another observation`);
    }
    keys.add(key);
  }

  return observations;
}
