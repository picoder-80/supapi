-- Add missing metadata column for legacy deployments
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

