-- Allow platform-specific category sets (Supasifieds, SupaAuto, and future verticals).
-- Previous fixed enum-style check blocked new SupaAuto categories.

ALTER TABLE public.classified_listings
  DROP CONSTRAINT IF EXISTS classified_listings_category_check;

ALTER TABLE public.classified_listings
  ADD CONSTRAINT classified_listings_category_check
  CHECK (length(trim(category)) > 0);
