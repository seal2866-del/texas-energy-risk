-- TX Energy Risk Newsletter System
-- Run in Supabase SQL Editor

-- ── Newsletter Subscribers ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email            text NOT NULL UNIQUE,
    first_name       text,
    last_name        text,
    company          text,
    title            text,
    city             text,
    industry         text,
    segment          text,       -- e.g. "Midland Oil & Gas", "Houston Energy", "Industrial Buyer"
    source           text,       -- "homepage", "manual", "linkedin", "outreach"
    status           text NOT NULL DEFAULT 'active',  -- active | unsubscribed | bounced | complained
    subscribed_at    timestamptz NOT NULL DEFAULT now(),
    unsubscribed_at  timestamptz,
    last_sent_at     timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email  ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_status ON newsletter_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_segment ON newsletter_subscribers(segment);

-- ── Newsletter Issues ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_issues (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_date       date NOT NULL,
    subject          text NOT NULL,
    preview_text     text,
    risk_level       text,       -- low | medium | high
    market_state     text,       -- Stable | Elevated | Stressed
    ercot_price      numeric,
    weather_demand   text,
    gas_supply       text,
    executive_summary   text,
    what_changed        text,
    watch_items         text,   -- JSON array stored as text
    ai_outlook          text,
    regional_snapshot   text,   -- JSON stored as text
    cta_text            text,
    html_content        text,
    text_content        text,
    status           text NOT NULL DEFAULT 'draft',  -- draft | approved | scheduled | sent | failed
    created_at       timestamptz NOT NULL DEFAULT now(),
    approved_at      timestamptz,
    scheduled_for    timestamptz,
    sent_at          timestamptz
);

CREATE INDEX IF NOT EXISTS idx_newsletter_issues_status     ON newsletter_issues(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_issues_issue_date ON newsletter_issues(issue_date DESC);

-- ── Newsletter Sends ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_sends (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    newsletter_issue_id  uuid REFERENCES newsletter_issues(id) ON DELETE CASCADE,
    subscriber_id        uuid REFERENCES newsletter_subscribers(id) ON DELETE CASCADE,
    email                text NOT NULL,
    resend_message_id    text,
    status               text NOT NULL DEFAULT 'pending',  -- pending | sent | delivered | opened | clicked | bounced | complained | failed
    sent_at              timestamptz,
    opened_at            timestamptz,
    clicked_at           timestamptz,
    bounced_at           timestamptz,
    complained_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_newsletter_sends_issue_id      ON newsletter_sends(newsletter_issue_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_sends_subscriber_id ON newsletter_sends(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_sends_status        ON newsletter_sends(status);

-- ── Unsubscribe token (for one-click unsubscribe) ──────────────────────────
ALTER TABLE newsletter_subscribers
    ADD COLUMN IF NOT EXISTS unsubscribe_token text DEFAULT gen_random_uuid()::text;
