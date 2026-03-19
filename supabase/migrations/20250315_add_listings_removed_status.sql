-- Add 'removed' to listings status (archived/soft-removed, distinct from 'deleted')
-- Enables Archived section in My Listings and admin soft-remove

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_status_check;
ALTER TABLE listings ADD CONSTRAINT listings_status_check CHECK (
  status IN ('active','paused','sold','deleted','removed')
);
