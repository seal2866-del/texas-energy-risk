-- TX Energy Risk CRM Enhancement
-- Run in Supabase SQL Editor

-- Extend prospects table with full pipeline statuses
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS newsletter_added_at  timestamptz,
  ADD COLUMN IF NOT EXISTS newsletter_sent_at   timestamptz,
  ADD COLUMN IF NOT EXISTS opened_at            timestamptz,
  ADD COLUMN IF NOT EXISTS clicked_at           timestamptz,
  ADD COLUMN IF NOT EXISTS demo_requested_at    timestamptz,
  ADD COLUMN IF NOT EXISTS converted_at         timestamptz,
  ADD COLUMN IF NOT EXISTS resend_contact_id    text,
  ADD COLUMN IF NOT EXISTS tags                 text[];   -- e.g. ['houston', 'oil-gas', 'high-priority']

-- Full pipeline status values:
-- new | newsletter_added | newsletter_sent | opened | clicked |
-- demo_requested | qualified | opportunity | customer | closed_lost

-- Prospect Audiences (named segments)
CREATE TABLE IF NOT EXISTS prospect_audiences (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,
    description     text,
    filters         jsonb,   -- stored filter criteria
    resend_list_id  text,    -- Resend audience/list ID
    member_count    int DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Audience membership
CREATE TABLE IF NOT EXISTS prospect_audience_members (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    audience_id  uuid REFERENCES prospect_audiences(id) ON DELETE CASCADE,
    prospect_id  uuid REFERENCES prospects(id) ON DELETE CASCADE,
    added_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE(audience_id, prospect_id)
);

CREATE INDEX IF NOT EXISTS idx_audience_members_audience ON prospect_audience_members(audience_id);
CREATE INDEX IF NOT EXISTS idx_audience_members_prospect ON prospect_audience_members(prospect_id);

-- Demo requests
CREATE TABLE IF NOT EXISTS demo_requests (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id  uuid REFERENCES prospects(id) ON DELETE CASCADE,
    company_name text,
    contact_name text,
    contact_email text,
    notes        text,
    status       text DEFAULT 'pending',  -- pending | scheduled | completed | no_show
    requested_at timestamptz NOT NULL DEFAULT now(),
    scheduled_at timestamptz
);

GRANT ALL ON prospect_audiences TO service_role;
GRANT ALL ON prospect_audience_members TO service_role;
GRANT ALL ON demo_requests TO service_role;
GRANT SELECT ON prospect_audiences TO authenticated;
GRANT SELECT ON prospect_audience_members TO authenticated;
