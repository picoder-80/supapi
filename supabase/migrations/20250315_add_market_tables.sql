-- Market add-ons: seller_earnings, platform_config, admin_revenue, disputes
-- Also adds transactions.txid for Pi completion

-- transactions.txid (Pi blockchain tx id)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS txid TEXT;

-- platform_config (key-value for commission, hold days, etc.)
CREATE TABLE IF NOT EXISTS platform_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL DEFAULT '',
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure columns exist (table may have been created elsewhere with minimal schema)
ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

INSERT INTO platform_config (key, value, description) VALUES
  ('market_commission_pct', '5', 'Marketplace commission percentage'),
  ('commission_market', '5', 'Alias for market commission'),
  ('seller_hold_days', '3', 'Days to hold seller earnings before withdrawal')
ON CONFLICT (key) DO NOTHING;

-- seller_earnings (escrow per order)
CREATE TABLE IF NOT EXISTS seller_earnings (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id       UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  platform       TEXT NOT NULL DEFAULT 'market',
  gross_pi       DECIMAL(18,7) NOT NULL,
  commission_pct DECIMAL(5,2) NOT NULL DEFAULT 5,
  commission_pi  DECIMAL(18,7) NOT NULL DEFAULT 0,
  net_pi         DECIMAL(18,7) NOT NULL,
  status         TEXT NOT NULL DEFAULT 'escrow'
                 CHECK (status IN ('escrow','pending','paid','cancelled')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_earnings_seller ON seller_earnings(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_earnings_order ON seller_earnings(order_id);
CREATE INDEX IF NOT EXISTS idx_seller_earnings_status ON seller_earnings(status);

-- admin_revenue (commission recorded when escrow released)
CREATE TABLE IF NOT EXISTS admin_revenue (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform       TEXT NOT NULL DEFAULT 'market',
  order_id       UUID REFERENCES orders(id) ON DELETE SET NULL,
  gross_pi       DECIMAL(18,7) NOT NULL,
  commission_pi  DECIMAL(18,7) NOT NULL,
  commission_pct DECIMAL(5,2),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_revenue_platform ON admin_revenue(platform);
CREATE INDEX IF NOT EXISTS idx_admin_revenue_created ON admin_revenue(created_at DESC);

-- disputes (market orders)
CREATE TABLE IF NOT EXISTS disputes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  opened_by     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason        TEXT NOT NULL,
  evidence      JSONB NOT NULL DEFAULT '[]'::jsonb,
  status        TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','resolved')),
  ai_decision    TEXT,
  ai_reasoning  TEXT,
  ai_confidence DECIMAL(3,2),
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disputes_order ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
