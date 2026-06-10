/* eslint-disable @typescript-eslint/no-var-requires */
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const MIGRATION = /* sql */ `
-- Customers (shoppers)
CREATE TABLE IF NOT EXISTS customers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  phone         TEXT,
  city          TEXT,
  tags          TEXT[]   DEFAULT '{}',
  total_spent   NUMERIC  DEFAULT 0,
  order_count   INTEGER  DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  total        NUMERIC NOT NULL,
  status       TEXT NOT NULL DEFAULT 'completed', -- completed | refunded | pending
  category     TEXT,   -- e.g. "footwear", "coffee", "skincare"
  items        JSONB,  -- [{name, price, qty}]
  ordered_at   TIMESTAMPTZ DEFAULT now()
);

-- Segments (saved audience definitions)
CREATE TABLE IF NOT EXISTS segments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  filter_rules JSONB NOT NULL,  -- structured rule tree
  ai_prompt    TEXT,            -- the natural-language prompt that created this (if AI-generated)
  customer_count INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  segment_id   UUID REFERENCES segments(id),
  channel      TEXT NOT NULL,   -- whatsapp | sms | email | rcs
  message_body TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft',  -- draft | sending | sent | paused
  scheduled_at TIMESTAMPTZ,
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now(),
  -- Aggregate stats (denormalised for fast reads)
  stat_sent      INTEGER DEFAULT 0,
  stat_delivered INTEGER DEFAULT 0,
  stat_opened    INTEGER DEFAULT 0,
  stat_clicked   INTEGER DEFAULT 0,
  stat_converted INTEGER DEFAULT 0,
  stat_failed    INTEGER DEFAULT 0
);

-- Individual communications (one per customer per campaign)
CREATE TABLE IF NOT EXISTS communications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  channel      TEXT NOT NULL,
  message_body TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'queued',  -- queued | sent | delivered | opened | clicked | converted | failed
  sent_at      TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at    TIMESTAMPTZ,
  clicked_at   TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  failed_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- AI chat sessions (for the conversational interface)
CREATE TABLE IF NOT EXISTS chat_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT,
  messages   JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_orders_customer_id   ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_ordered_at    ON orders(ordered_at);
CREATE INDEX IF NOT EXISTS idx_orders_category      ON orders(category);
CREATE INDEX IF NOT EXISTS idx_comms_campaign_id    ON communications(campaign_id);
CREATE INDEX IF NOT EXISTS idx_comms_customer_id    ON communications(customer_id);
CREATE INDEX IF NOT EXISTS idx_comms_status         ON communications(status);
CREATE INDEX IF NOT EXISTS idx_comms_sent_at        ON communications(sent_at);
CREATE INDEX IF NOT EXISTS idx_customers_last_order ON customers(last_order_at);
CREATE INDEX IF NOT EXISTS idx_customers_total_spent ON customers(total_spent DESC);
CREATE INDEX IF NOT EXISTS idx_segments_name        ON segments(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_campaigns_status     ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at DESC);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running migrations...');
    await client.query(MIGRATION);
    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
