-- Migration 007: Add morning digest preferences to alert_preferences
-- Run once in Supabase SQL editor

ALTER TABLE alert_preferences
  ADD COLUMN IF NOT EXISTS digest_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS digest_email   TEXT;

COMMENT ON COLUMN alert_preferences.digest_enabled IS 'Opt-in to 7am CT morning risk digest email';
COMMENT ON COLUMN alert_preferences.digest_email   IS 'Digest delivery address (falls back to auth email if null)';
