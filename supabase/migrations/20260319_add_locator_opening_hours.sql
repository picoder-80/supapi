-- Add opening_hours to businesses (locator)
-- Format: [{"day":"Monday","time":"9am - 5pm"}, ...]

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT '[
    {"day":"Monday","time":""},
    {"day":"Tuesday","time":""},
    {"day":"Wednesday","time":""},
    {"day":"Thursday","time":""},
    {"day":"Friday","time":""},
    {"day":"Saturday","time":""},
    {"day":"Sunday","time":""}
  ]'::jsonb;
