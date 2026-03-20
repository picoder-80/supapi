-- SupaMarket listings: relax category constraint so new slugs don't fail inserts.
-- Previous enum-style checks caused "violates check constraint listings_category_check"
-- whenever category sets evolve.

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_category_check;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_category_check
  CHECK (length(trim(coalesce(category, ''))) > 0);
