-- TX Energy Risk — Prospects Table
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS prospects (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Company
    company_name          text,
    website               text,
    industry              text,
    employee_count        int,
    city                  text,
    state                 text,
    country               text DEFAULT 'US',
    -- Contact
    contact_name          text,
    contact_title         text,
    contact_email         text,
    contact_linkedin      text,
    -- Apollo
    apollo_person_id      text,
    apollo_org_id         text,
    -- AI Enrichment
    energy_exposure       text,
    pain_points           text,
    sales_message         text,
    enriched_at           timestamptz,
    -- Lead Scoring
    lead_score            int DEFAULT 0,   -- 0-100
    score_company_size    int DEFAULT 0,
    score_energy_intensity int DEFAULT 0,
    score_location        int DEFAULT 0,
    score_operational     int DEFAULT 0,
    priority              text DEFAULT 'low',  -- low | medium | high
    -- Workflow
    status                text DEFAULT 'new',  -- new | contacted | qualified | disqualified
    notes                 text,
    source                text DEFAULT 'apollo',
    search_query          text,   -- what search produced this
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospects_lead_score  ON prospects(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_prospects_priority    ON prospects(priority);
CREATE INDEX IF NOT EXISTS idx_prospects_status      ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_state       ON prospects(state);
CREATE INDEX IF NOT EXISTS idx_prospects_company     ON prospects(company_name);

GRANT ALL ON prospects TO service_role;
GRANT SELECT ON prospects TO authenticated;
