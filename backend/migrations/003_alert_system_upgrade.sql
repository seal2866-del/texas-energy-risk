-- Migration 003: Full alert system upgrade
-- Run in Supabase SQL editor

-- ── alert_preferences: add new fields ────────────────────────
ALTER TABLE alert_preferences
  ADD COLUMN IF NOT EXISTS voice_enabled        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS data_source_alert    BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS quiet_start_time     TEXT    DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS quiet_end_time       TEXT    DEFAULT '06:00';

-- ── alert_logs: add new fields ────────────────────────────────
ALTER TABLE alert_logs
  ADD COLUMN IF NOT EXISTS alert_type           TEXT    DEFAULT 'risk_change',
  ADD COLUMN IF NOT EXISTS previous_risk_level  TEXT,
  ADD COLUMN IF NOT EXISTS risk_direction       TEXT,
  ADD COLUMN IF NOT EXISTS source_health_status TEXT,
  ADD COLUMN IF NOT EXISTS delivery_status      TEXT    DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS voice_sent           BOOLEAN DEFAULT FALSE;

-- Back-fill alert_type for any existing rows
UPDATE alert_logs SET alert_type = 'risk_change' WHERE alert_type IS NULL;

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_alert_logs_user_type
  ON alert_logs(user_id, alert_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_prefs_user
  ON alert_preferences(user_id);
