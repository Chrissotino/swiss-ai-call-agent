-- ─────────────────────────────────────────────────────────────
-- Swiss AI Call Agent — Database Initialization
-- PostgreSQL Schema
-- ─────────────────────────────────────────────────────────────

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- ─────────────────────────────────────────────────────────────
-- Enum Types
-- ─────────────────────────────────────────────────────────────

CREATE TYPE call_type AS ENUM ('inbound', 'outbound');
CREATE TYPE call_status AS ENUM ('active', 'completed', 'escalated', 'failed', 'no_answer', 'busy');
CREATE TYPE call_language AS ENUM ('de', 'de-CH', 'fr', 'it');
CREATE TYPE decision_action AS ENUM (
  'continue', 'escalate_to_human', 'end_call',
  'create_ticket', 'schedule_callback', 'update_crm'
);

-- ─────────────────────────────────────────────────────────────
-- Calls Table
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS calls (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id         VARCHAR(255) UNIQUE NOT NULL, -- Twilio CallSid or UUID
  call_type       call_type NOT NULL,
  status          call_status NOT NULL DEFAULT 'active',
  goal            TEXT NOT NULL,
  customer_name   VARCHAR(255),
  customer_phone  VARCHAR(50),
  customer_email  VARCHAR(255),
  language        call_language NOT NULL DEFAULT 'de-CH',
  confidence_avg  FLOAT,                        -- Average AI confidence score
  requires_review BOOLEAN DEFAULT FALSE,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  duration_s      INTEGER GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER
  ) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_calls_call_type ON calls(call_type);
CREATE INDEX idx_calls_started_at ON calls(started_at DESC);
CREATE INDEX idx_calls_customer_phone ON calls(customer_phone);

-- ─────────────────────────────────────────────────────────────
-- Transcript Table
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transcript_entries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id         UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  role            VARCHAR(20) NOT NULL CHECK (role IN ('agent', 'customer')),
  text            TEXT NOT NULL,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transcript_call_id ON transcript_entries(call_id);
CREATE INDEX idx_transcript_timestamp ON transcript_entries(timestamp);

-- ─────────────────────────────────────────────────────────────
-- AI Decisions Table
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_decisions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id         UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  action          decision_action NOT NULL,
  confidence      FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  response_text   TEXT NOT NULL,
  reasoning       TEXT,
  follow_up_tasks JSONB DEFAULT '[]'::JSONB,
  requires_review BOOLEAN GENERATED ALWAYS AS (confidence >= 70 AND confidence < 90) STORED,
  escalated       BOOLEAN GENERATED ALWAYS AS (confidence < 70) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_decisions_call_id ON ai_decisions(call_id);
CREATE INDEX idx_decisions_action ON ai_decisions(action);
CREATE INDEX idx_decisions_confidence ON ai_decisions(confidence);

-- ─────────────────────────────────────────────────────────────
-- Callbacks Table
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS callbacks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id         UUID REFERENCES calls(id),
  customer_name   VARCHAR(255),
  phone_number    VARCHAR(50) NOT NULL,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  notes           TEXT,
  status          VARCHAR(50) NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled', 'completed', 'cancelled', 'missed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_callbacks_scheduled_at ON callbacks(scheduled_at);
CREATE INDEX idx_callbacks_status ON callbacks(status);

-- ─────────────────────────────────────────────────────────────
-- Tickets Table
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tickets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id       VARCHAR(50) UNIQUE NOT NULL,  -- e.g. TKT-1234567890
  call_id         UUID REFERENCES calls(id),
  summary         TEXT NOT NULL,
  priority        VARCHAR(20) NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  assigned_to     VARCHAR(255) DEFAULT 'first-level-support',
  status          VARCHAR(50) NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);

-- ─────────────────────────────────────────────────────────────
-- Campaigns Table (Outbound)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaigns (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255) NOT NULL,
  goal            TEXT NOT NULL,
  language        call_language NOT NULL DEFAULT 'de-CH',
  status          VARCHAR(50) NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
  total_contacts  INTEGER NOT NULL DEFAULT 0,
  calls_made      INTEGER NOT NULL DEFAULT 0,
  calls_completed INTEGER NOT NULL DEFAULT 0,
  calls_failed    INTEGER NOT NULL DEFAULT 0,
  scheduled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- Updated_at Trigger
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calls_updated_at BEFORE UPDATE ON calls
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Useful Views
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW call_summary AS
SELECT
  c.id,
  c.call_id,
  c.call_type,
  c.status,
  c.language,
  c.customer_name,
  c.customer_phone,
  c.goal,
  c.started_at,
  c.ended_at,
  c.duration_s,
  c.requires_review,
  AVG(d.confidence) AS avg_confidence,
  COUNT(d.id) AS decision_count,
  COUNT(te.id) AS transcript_length
FROM calls c
LEFT JOIN ai_decisions d ON d.call_id = c.id
LEFT JOIN transcript_entries te ON te.call_id = c.id
GROUP BY c.id;

-- Done
SELECT 'Swiss AI Call Agent database initialized successfully.' AS status;
