-- Migration: full alert tables repair
-- Safe to run even if some columns already exist (all use IF NOT EXISTS).
-- Run this in Supabase SQL Editor.

-- ── alert_logs: add every column the backend expects ─────────
ALTER TABLE alert_logs
  ADD COLUMN IF NOT EXISTS risk_level           TEXT,
  ADD COLUMN IF NOT EXISTS previous_risk_level  TEXT,
  ADD COLUMN IF NOT EXISTS confidence           INT,
  ADD COLUMN IF NOT EXISTS primary_driver       TEXT,
  ADD COLUMN IF NOT EXISTS risk_direction       TEXT,
  ADD COLUMN IF NOT EXISTS city                 TEXT    DEFAULT 'Houston',
  ADD COLUMN IF NOT EXISTS ercot_price          NUMERIC,
  ADD COLUMN IF NOT EXISTS weather_temp         NUMERIC,
  ADD COLUMN IF NOT EXISTS gas_storage          NUMERIC,
  ADD COLUMN IF NOT EXISTS source_health_status TEXT,
  ADD COLUMN IF NOT EXISTS delivery_status      TEXT    DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS delivered_email      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS delivered_sms        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS voice_sent           BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS acknowledged_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at           TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS sent_at              TIMESTAMPTZ DEFAULT now();

-- Back-fill alert_type for existing rows (column may already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_logs' AND column_name = 'alert_type'
  ) THEN
    ALTER TABLE alert_logs ADD COLUMN alert_type TEXT DEFAULT 'risk_change';
  END IF;
END $$;

UPDATE alert_logs SET alert_type = 'risk_change' WHERE alert_type IS NULL;

-- ── alert_preferences: add every column the backend expects ──
ALTER TABLE alert_preferences
  ADD COLUMN IF NOT EXISTS sms_alerts           BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS voice_enabled        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alert_frequency      TEXT    DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS risk_threshold       TEXT    DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS city                 TEXT    DEFAULT 'Houston',
  ADD COLUMN IF NOT EXISTS price_volatility_alert   BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS weather_demand_alert     BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS gas_supply_alert         BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS data_source_alert        BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS quiet_start_time     TEXT    DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS quiet_end_time       TEXT    DEFAULT '06:00',
  ADD COLUMN IF NOT EXISTS price_threshold_mwh       NUMERIC DEFAULT 150,
  ADD COLUMN IF NOT EXISTS temp_high_threshold_f     NUMERIC DEFAULT 105,
  ADD COLUMN IF NOT EXISTS temp_low_threshold_f      NUMERIC DEFAULT 25,
  ADD COLUMN IF NOT EXISTS gas_storage_pct_threshold NUMERIC DEFAULT -10,
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ DEFAULT now();

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_alert_logs_user_sent
  ON alert_logs(user_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_logs_user_created
  ON alert_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_logs_user_type
  ON alert_logs(user_id, alert_type, created_at DESC);
