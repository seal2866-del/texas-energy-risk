-- ============================================================
-- Migration 005: Grant service_role full access to alert tables
-- and ensure RLS is configured so the backend never gets 42501.
--
-- Run this ONCE in Supabase > SQL Editor.
-- Safe to re-run (all statements are idempotent).
-- ============================================================

-- ── 1. Ensure RLS is enabled on both tables ───────────────────
ALTER TABLE public.alert_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_preferences  ENABLE ROW LEVEL SECURITY;

-- ── 2. Grant schema usage to service_role ────────────────────
GRANT USAGE ON SCHEMA public TO service_role;

-- ── 3. Grant table-level privileges to service_role ──────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_logs        TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_preferences TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions     TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users             TO service_role;

-- ── 4. RLS bypass policies for service_role ──────────────────
--  (service_role JWT bypasses RLS by default in modern Supabase,
--   but adding explicit bypass policies makes it bulletproof.)

-- alert_logs
DROP POLICY IF EXISTS "service_role_all_alert_logs" ON public.alert_logs;
CREATE POLICY "service_role_all_alert_logs"
  ON public.alert_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can only see their own logs
DROP POLICY IF EXISTS "users_own_alert_logs" ON public.alert_logs;
CREATE POLICY "users_own_alert_logs"
  ON public.alert_logs
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- alert_preferences
DROP POLICY IF EXISTS "service_role_all_alert_prefs" ON public.alert_preferences;
CREATE POLICY "service_role_all_alert_prefs"
  ON public.alert_preferences
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "users_own_alert_prefs" ON public.alert_preferences;
CREATE POLICY "users_own_alert_prefs"
  ON public.alert_preferences
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 5. Ensure all columns from migration 004 exist ───────────
--  (safe to re-run — all use IF NOT EXISTS)

ALTER TABLE public.alert_logs
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_logs' AND column_name = 'alert_type'
  ) THEN
    ALTER TABLE public.alert_logs ADD COLUMN alert_type TEXT DEFAULT 'risk_change';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_logs' AND column_name = 'acknowledged'
  ) THEN
    ALTER TABLE public.alert_logs ADD COLUMN acknowledged BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

ALTER TABLE public.alert_preferences
  ADD COLUMN IF NOT EXISTS sms_alerts               BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS voice_enabled             BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alert_frequency           TEXT    DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS risk_threshold            TEXT    DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS city                      TEXT    DEFAULT 'Houston',
  ADD COLUMN IF NOT EXISTS price_volatility_alert    BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS weather_demand_alert      BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS gas_supply_alert          BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS data_source_alert         BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled       BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS quiet_start_time          TEXT    DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS quiet_end_time            TEXT    DEFAULT '06:00',
  ADD COLUMN IF NOT EXISTS price_threshold_mwh       NUMERIC DEFAULT 150,
  ADD COLUMN IF NOT EXISTS temp_high_threshold_f     NUMERIC DEFAULT 105,
  ADD COLUMN IF NOT EXISTS temp_low_threshold_f      NUMERIC DEFAULT 25,
  ADD COLUMN IF NOT EXISTS gas_storage_pct_threshold NUMERIC DEFAULT -10,
  ADD COLUMN IF NOT EXISTS updated_at                TIMESTAMPTZ DEFAULT now();

-- ── 6. Indexes (idempotent) ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_alert_logs_user_created
  ON public.alert_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_logs_user_sent
  ON public.alert_logs(user_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_logs_user_type
  ON public.alert_logs(user_id, alert_type, created_at DESC);

-- ── Done ──────────────────────────────────────────────────────
-- After running this, redeploy the Railway backend.
-- The dashboard should no longer show 42501 errors.
