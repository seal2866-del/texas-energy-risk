-- Migration 006: Signal Snapshots — historical risk time-series storage
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS signal_snapshots (
  id                     UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  location               TEXT        NOT NULL DEFAULT 'Houston',
  computed_at            TIMESTAMPTZ NOT NULL,

  -- Core risk state
  risk_score             TEXT        NOT NULL,          -- 'low' | 'medium' | 'high'
  risk_score_numeric     FLOAT       NOT NULL DEFAULT 0, -- 0-10 numeric
  risk_direction         TEXT,                           -- 'rising' | 'stable' | 'falling'
  confidence             FLOAT,                          -- 0-100
  escalation_pct         FLOAT,                          -- 0-100

  -- Condition levels
  demand_level           TEXT,                           -- 'low' | 'medium' | 'high'
  supply_level           TEXT,
  market_level           TEXT,

  -- Key metrics
  ercot_price            FLOAT,                          -- $/MWh
  henry_hub_price        FLOAT,                          -- $/MMBtu
  primary_driver         TEXT,
  signal_alignment_score FLOAT,                          -- 0-1

  -- Compact signal flags
  data_valid             BOOLEAN     DEFAULT FALSE,
  active_signals         INT         DEFAULT 0,

  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Time-series index — queries always filter by location + time range
CREATE INDEX IF NOT EXISTS idx_snapshots_location_time
  ON signal_snapshots (location, computed_at DESC);

-- Cleanup index — for purging old rows
CREATE INDEX IF NOT EXISTS idx_snapshots_created
  ON signal_snapshots (created_at);

-- RLS — readable by anyone (no PII), writable only by service role
ALTER TABLE signal_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snapshots_public_read"
  ON signal_snapshots FOR SELECT
  USING (true);

CREATE POLICY "snapshots_service_write"
  ON signal_snapshots FOR INSERT
  WITH CHECK (true);

-- Grant service role full access
GRANT ALL ON signal_snapshots TO service_role;
GRANT SELECT ON signal_snapshots TO anon;
GRANT SELECT ON signal_snapshots TO authenticated;

-- Auto-purge rows older than 30 days (keep storage lean)
-- Run this as a cron job or scheduled function in Supabase if desired:
-- DELETE FROM signal_snapshots WHERE created_at < NOW() - INTERVAL '30 days';
