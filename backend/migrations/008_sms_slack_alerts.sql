-- Migration 008: SMS + Slack alert channels
-- Run in Supabase SQL editor

-- ── alert_preferences: SMS + Slack columns ───────────────────
ALTER TABLE alert_preferences
  ADD COLUMN IF NOT EXISTS sms_enabled          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sms_phone            TEXT,
  ADD COLUMN IF NOT EXISTS slack_enabled        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS slack_webhook_url    TEXT,
  ADD COLUMN IF NOT EXISTS teams_enabled        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS teams_webhook_url    TEXT,
  ADD COLUMN IF NOT EXISTS escalation_enabled   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS escalation_minutes   INT     DEFAULT 30;

-- ── alert_logs: track delivery per channel ───────────────────
ALTER TABLE alert_logs
  ADD COLUMN IF NOT EXISTS delivered_sms        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS delivered_slack      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS delivered_teams      BOOLEAN DEFAULT FALSE;
