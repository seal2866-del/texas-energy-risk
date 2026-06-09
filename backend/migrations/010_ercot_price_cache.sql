-- Migration 010: ERCOT price persistence table
-- Stores the last known real price per settlement point so the
-- in-memory cache can be re-seeded instantly after a Railway restart,
-- instead of starting cold and waiting for the first 5-min poll.

CREATE TABLE IF NOT EXISTS ercot_price_cache (
    settlement_point  TEXT         PRIMARY KEY,
    price_mwh         DOUBLE PRECISION NOT NULL,
    timestamp         TIMESTAMPTZ  NOT NULL,        -- CDR reading time (UTC)
    source            TEXT,                         -- e.g. "ercot_cdr"
    cdr_updated       TEXT,                         -- raw "Last Updated" string from CDR page
    persisted_at      TIMESTAMPTZ  DEFAULT NOW()    -- when we last wrote this row
);

-- Allow the service-role key full access
ALTER TABLE ercot_price_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON ercot_price_cache
    USING (true)
    WITH CHECK (true);
