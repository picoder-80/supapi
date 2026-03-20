-- Add optional photo attachments for Pi Locator business reviews
ALTER TABLE public.business_reviews
  ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}'::text[];

COMMENT ON COLUMN public.business_reviews.images IS 'Public storage URLs for Pi Locator review photos';
