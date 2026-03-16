-- Fix listings_category_check: allow all app categories
-- Drop if exists (may have been added by external setup with different values)
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_category_check;

-- Add constraint matching src/lib/market/categories.ts
ALTER TABLE listings ADD CONSTRAINT listings_category_check CHECK (
  category IN (
    'autos','leisure','property','jobs_services','pets','travel',
    'electronics','home_personal','b2b','food','swap','others'
  )
);
