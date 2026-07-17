BEGIN;

CREATE TABLE stations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  external_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE fuel_price_observations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  station_id BIGINT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  fuel_type TEXT NOT NULL CHECK (length(trim(fuel_type)) > 0),
  price_ron NUMERIC(6, 3) NOT NULL CHECK (price_ron > 0),
  observed_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL CHECK (length(trim(source)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (station_id, fuel_type, observed_at, source)
);

CREATE TABLE notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  station_id BIGINT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  fuel_type TEXT NOT NULL CHECK (length(trim(fuel_type)) > 0),
  price_ron NUMERIC(6, 3) NOT NULL CHECK (price_ron > 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stations_enabled
  ON stations (enabled)
  WHERE enabled = TRUE;

CREATE INDEX idx_observations_station_fuel_observed
  ON fuel_price_observations (station_id, fuel_type, observed_at DESC);

CREATE INDEX idx_notifications_station_fuel_sent
  ON notifications (station_id, fuel_type, sent_at DESC);

COMMIT;
