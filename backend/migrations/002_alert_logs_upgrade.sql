-- Migration 002: Upgrade alert_logs table for Phase 4-5
-- Run in Supabase SQL editor

-- If alert_logs doesn't exist yet, create it:
CREATE TABLE IF NOT EXISTS alert_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  risk_level      TEXT NOT NULL DEFAULT 'low',
  confidence      INT,
  primary_driver  TEXT,
  city            TEXT DEFAULT 'Houston',
  ercot_price     NUMERIC,
  weather_temp    NUMERIC,
  gas_storage     NUMERIC,
  message         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  delivered_email BOOLEAN DEFAULT FALSE,
  delivered_sms   BOOLEAN DEFAULT FALSE,
  acknowledged    BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  channel         TEXT DEFAULT 'email',
  severity        TEXT DEFAULT 'low',
  sent_at         TIMESTAMPTZ DEFAULT now()
);

-- Add new columns to existing table (safe to run multiple times)
ALTER TABLE alert_logs
  ADD COLUMN IF NOT EXISTS risk_level      TEXT,
  ADD COLUMN IF NOT EXISTS confidence      INT,
  ADD COLUMN IF NOT EXISTS primary_driver  TEXT,
  ADD COLUMN IF NOT EXISTS city            TEXT DEFAULT 'Houston',
  ADD COLUMN IF NOT EXISTS ercot_price     NUMERIC,
  ADD COLUMN IF NOT EXISTS weather_temp    NUMERIC,
  ADD COLUMN IF NOT EXISTS gas_storage     NUMERIC,
  ADD COLUMN IF NOT EXISTS delivered_email BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS delivered_sms   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;

-- Upgrade alert_preferences table
ALTER TABLE alert_preferences
  ADD COLUMN IF NOT EXISTS alert_frequency TEXT DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS sms_alerts      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS risk_threshold  TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS city            TEXT DEFAULT 'Houston',
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT now();

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_alert_logs_user_created ON alert_logs(user_id, created_at DESC);
