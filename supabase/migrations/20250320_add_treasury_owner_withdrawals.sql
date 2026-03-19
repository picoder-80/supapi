-- Ensure platform_config has treasury_owner_withdrawn_total_pi (for balance deduct)
INSERT INTO platform_config (key, value, description, updated_at) VALUES
  ('treasury_owner_withdrawn_total_pi', '0', 'Total owner treasury withdrawals (Pi)')
ON CONFLICT (key) DO NOTHING;

-- Treasury owner withdrawal history — each withdrawal recorded for stats + transaction history
CREATE TABLE IF NOT EXISTS treasury_owner_withdrawals (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  amount_pi        DECIMAL(18,7) NOT NULL,
  pi_txid          TEXT,
  recipient_uid    TEXT,
  admin_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_note       TEXT,
  execute_transfer BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treasury_owner_withdrawals_created ON treasury_owner_withdrawals(created_at DESC);
