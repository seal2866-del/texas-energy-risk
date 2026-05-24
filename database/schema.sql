-- ============================================================
-- Texas Energy Risk Alert Platform — Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. USERS (extends Supabase auth.users)
-- ============================================================
CREATE TABLE public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT UNIQUE NOT NULL,
  full_name     TEXT,
  company       TEXT,
  role          TEXT DEFAULT 'buyer',          -- buyer | operator | investor
  tier          TEXT DEFAULT 'free',            -- free | pro
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile"   ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Auto-create user row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. SUBSCRIPTIONS
-- ============================================================
CREATE TABLE public.subscriptions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  stripe_customer_id    TEXT,
  stripe_subscription_id TEXT,
  plan                  TEXT NOT NULL DEFAULT 'free',   -- free | pro
  status                TEXT NOT NULL DEFAULT 'active', -- active | canceled | past_due | trialing
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscription" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_subscriptions_user_id         ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);

-- ============================================================
-- 3. ERCOT PRICES
-- ============================================================
CREATE TABLE public.ercot_prices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp       TIMESTAMPTZ NOT NULL,
  settlement_point TEXT NOT NULL DEFAULT 'HB_HOUSTON', -- hub or load zone
  price_mwh       NUMERIC(10, 2) NOT NULL,              -- $/MWh
  price_type      TEXT DEFAULT 'real_time',             -- real_time | day_ahead
  source          TEXT DEFAULT 'mock',                  -- mock | ercot_api
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ercot_prices_timestamp        ON public.ercot_prices(timestamp DESC);
CREATE INDEX idx_ercot_prices_settlement_point ON public.ercot_prices(settlement_point);

-- ============================================================
-- 4. WEATHER FORECASTS
-- ============================================================
CREATE TABLE public.weather_forecasts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  forecast_time   TIMESTAMPTZ NOT NULL,               -- when the forecast is for
  fetched_at      TIMESTAMPTZ DEFAULT NOW(),           -- when we pulled it
  station_id      TEXT DEFAULT 'KHOU',                -- NWS station / grid point
  location_name   TEXT DEFAULT 'Houston, TX',
  temp_f          NUMERIC(5, 1),
  temp_high_f     NUMERIC(5, 1),
  temp_low_f      NUMERIC(5, 1),
  humidity_pct    NUMERIC(5, 1),
  wind_mph        NUMERIC(5, 1),
  condition       TEXT,                               -- clear | cloudy | rain | storm
  demand_risk     TEXT DEFAULT 'low',                 -- low | medium | high
  source          TEXT DEFAULT 'mock'                 -- mock | noaa_api
);

CREATE INDEX idx_weather_forecasts_time ON public.weather_forecasts(forecast_time DESC);

-- ============================================================
-- 5. GAS DATA (EIA natural gas storage + prices)
-- ============================================================
CREATE TABLE public.gas_data (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_date           DATE NOT NULL,
  storage_bcf           NUMERIC(8, 1),        -- working gas in storage, Bcf
  storage_5yr_avg_bcf   NUMERIC(8, 1),        -- 5-year average
  storage_pct_vs_avg    NUMERIC(6, 2),        -- % above or below 5yr avg
  henry_hub_price       NUMERIC(8, 4),        -- $/MMBtu
  supply_pressure       TEXT DEFAULT 'normal', -- low | normal | high
  source                TEXT DEFAULT 'mock',   -- mock | eia_api
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gas_data_report_date ON public.gas_data(report_date DESC);

-- ============================================================
-- 6. SIGNALS (computed risk signals)
-- ============================================================
CREATE TABLE public.signals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  computed_at     TIMESTAMPTZ DEFAULT NOW(),
  signal_type     TEXT NOT NULL,        -- price_volatility | weather_demand | gas_supply
  severity        TEXT NOT NULL,        -- low | medium | high
  triggered       BOOLEAN DEFAULT FALSE,
  value           NUMERIC,              -- the raw value that triggered the signal
  threshold       NUMERIC,              -- the threshold that was crossed
  message         TEXT,                 -- human-readable description
  risk_score      TEXT,                 -- overall: low | medium | high
  active_signals  INTEGER DEFAULT 0,   -- count of concurrently triggered signals
  metadata        JSONB DEFAULT '{}'
);

CREATE INDEX idx_signals_computed_at  ON public.signals(computed_at DESC);
CREATE INDEX idx_signals_signal_type  ON public.signals(signal_type);
CREATE INDEX idx_signals_triggered    ON public.signals(triggered);

-- ============================================================
-- 7. ALERT PREFERENCES
-- ============================================================
CREATE TABLE public.alert_preferences (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email_alerts              BOOLEAN DEFAULT TRUE,
  price_volatility_alert    BOOLEAN DEFAULT TRUE,
  weather_demand_alert      BOOLEAN DEFAULT TRUE,
  gas_supply_alert          BOOLEAN DEFAULT TRUE,
  high_risk_score_alert     BOOLEAN DEFAULT TRUE,
  price_threshold_mwh       NUMERIC(10, 2) DEFAULT 150.00,   -- alert above this $/MWh
  temp_high_threshold_f     NUMERIC(5, 1)  DEFAULT 105.0,   -- alert above this temp
  temp_low_threshold_f      NUMERIC(5, 1)  DEFAULT 25.0,    -- alert below this temp
  gas_storage_pct_threshold NUMERIC(6, 2)  DEFAULT -10.0,   -- alert below this % vs avg
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.alert_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own alert prefs" ON public.alert_preferences
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 8. ALERT LOGS
-- ============================================================
CREATE TABLE public.alert_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES public.users(id) ON DELETE CASCADE,
  signal_id       UUID REFERENCES public.signals(id),
  alert_type      TEXT NOT NULL,       -- email | in_app
  channel         TEXT,                -- price_volatility | weather_demand | gas_supply | risk_score
  severity        TEXT,                -- low | medium | high
  message         TEXT,
  sent_at         TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged    BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_alert_logs_user_id ON public.alert_logs(user_id);
CREATE INDEX idx_alert_logs_sent_at ON public.alert_logs(sent_at DESC);

-- ============================================================
-- SEED: Insert mock data for development
-- ============================================================

-- Mock ERCOT prices (last 24 hours, hourly)
INSERT INTO public.ercot_prices (timestamp, settlement_point, price_mwh, price_type, source)
SELECT
  NOW() - (n || ' hours')::INTERVAL,
  'HB_HOUSTON',
  ROUND((30 + random() * 120)::NUMERIC, 2),
  'real_time',
  'mock'
FROM generate_series(0, 23) AS n;

-- Mock weather forecasts (next 7 days)
INSERT INTO public.weather_forecasts (forecast_time, temp_high_f, temp_low_f, condition, demand_risk, source)
VALUES
  (NOW() + INTERVAL '1 day',  102, 81, 'sunny',   'high',   'mock'),
  (NOW() + INTERVAL '2 days',  98, 79, 'sunny',   'high',   'mock'),
  (NOW() + INTERVAL '3 days',  95, 77, 'cloudy',  'medium', 'mock'),
  (NOW() + INTERVAL '4 days',  88, 72, 'cloudy',  'medium', 'mock'),
  (NOW() + INTERVAL '5 days',  91, 74, 'sunny',   'medium', 'mock'),
  (NOW() + INTERVAL '6 days', 105, 83, 'sunny',   'high',   'mock'),
  (NOW() + INTERVAL '7 days', 103, 82, 'sunny',   'high',   'mock');

-- Mock gas data
INSERT INTO public.gas_data (report_date, storage_bcf, storage_5yr_avg_bcf, storage_pct_vs_avg, henry_hub_price, supply_pressure, source)
VALUES
  (CURRENT_DATE - 7,  2180, 2310, -5.6,  2.41, 'normal', 'mock'),
  (CURRENT_DATE - 14, 2210, 2340, -5.6,  2.38, 'normal', 'mock'),
  (CURRENT_DATE - 21, 2150, 2300, -6.5,  2.55, 'low',    'mock'),
  (CURRENT_DATE - 28, 2090, 2280, -8.3,  2.72, 'low',    'mock');

-- Mock signals
INSERT INTO public.signals (signal_type, severity, triggered, value, threshold, message, risk_score, active_signals)
VALUES
  ('price_volatility', 'high',   true,  245.50, 150.0, 'ERCOT real-time price spiked to $245/MWh — volatility may be elevated.', 'high',   2),
  ('weather_demand',   'high',   true,  105.0,  100.0, 'Forecast high of 105°F may drive elevated cooling demand across Texas.', 'high',   2),
  ('gas_supply',       'medium', false, -8.3,   -10.0, 'Natural gas storage is tracking below the 5-year average.', 'medium', 1);
