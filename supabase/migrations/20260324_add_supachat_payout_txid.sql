-- Track A2U payout txid for SupaChat transfers (when Pi is sent to recipient's wallet)
ALTER TABLE public.supachat_transfers
  ADD COLUMN IF NOT EXISTS payout_txid TEXT;
