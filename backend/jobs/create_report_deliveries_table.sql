-- Run this in Supabase SQL Editor once
CREATE TABLE IF NOT EXISTS report_deliveries (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid REFERENCES users(id) ON DELETE CASCADE,
    email         text NOT NULL,
    report_type   text NOT NULL DEFAULT 'morning_operational',
    status        text NOT NULL,   -- sent | failed | error
    pdf_filename  text,
    delivered_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for quick lookup by user
CREATE INDEX IF NOT EXISTS idx_report_deliveries_user_id ON report_deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_report_deliveries_delivered_at ON report_deliveries(delivered_at DESC);
