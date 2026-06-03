-- ── 009_chatbot.sql ────────────────────────────────────────────────────────
-- TX Energy Risk AI Assistant — Supabase schema
-- Run in Supabase SQL editor

-- Enable pgvector if available (optional — we use text search fallback)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge sources (URLs/docs registered by admin)
CREATE TABLE IF NOT EXISTS chatbot_knowledge_sources (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  source_type  TEXT NOT NULL DEFAULT 'url', -- url | document | manual
  url          TEXT,
  content      TEXT,
  enabled      BOOLEAN NOT NULL DEFAULT true,
  last_synced  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Document chunks (chunked content for RAG search)
CREATE TABLE IF NOT EXISTS chatbot_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   UUID REFERENCES chatbot_knowledge_sources(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content     TEXT NOT NULL,
  keywords    TEXT[], -- extracted keywords for search
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat sessions
CREATE TABLE IF NOT EXISTS chatbot_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_token TEXT UNIQUE NOT NULL,
  page_context  TEXT,
  user_email    TEXT,
  user_name     TEXT,
  is_lead       BOOLEAN NOT NULL DEFAULT false,
  demo_requested BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chatbot_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES chatbot_sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     TEXT NOT NULL,
  sources     TEXT[], -- doc sections used
  was_helpful BOOLEAN,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unanswered / low-confidence questions
CREATE TABLE IF NOT EXISTS chatbot_unanswered_questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID REFERENCES chatbot_sessions(id) ON DELETE SET NULL,
  question    TEXT NOT NULL,
  context     TEXT,
  resolved    BOOLEAN NOT NULL DEFAULT false,
  answer      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lead captures
CREATE TABLE IF NOT EXISTS chatbot_leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID REFERENCES chatbot_sessions(id) ON DELETE SET NULL,
  name          TEXT,
  email         TEXT NOT NULL,
  company       TEXT,
  role          TEXT,
  interest      TEXT,
  demo_requested BOOLEAN NOT NULL DEFAULT false,
  contacted     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feedback on responses
CREATE TABLE IF NOT EXISTS chatbot_feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES chatbot_messages(id) ON DELETE CASCADE,
  session_id  UUID REFERENCES chatbot_sessions(id) ON DELETE SET NULL,
  helpful     BOOLEAN NOT NULL,
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE chatbot_sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_unanswered_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_leads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_feedback          ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_chunks            ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "service_role_all_chatbot_sessions"   ON chatbot_sessions   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_chatbot_messages"   ON chatbot_messages   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_unanswered"         ON chatbot_unanswered_questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_leads"              ON chatbot_leads      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_feedback"           ON chatbot_feedback   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_knowledge_sources"  ON chatbot_knowledge_sources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_chunks"             ON chatbot_chunks     FOR ALL USING (true) WITH CHECK (true);
