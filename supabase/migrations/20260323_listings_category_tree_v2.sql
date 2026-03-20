-- SupaMarket: 3-level category tree (slug-based top level) + category_deep column.
-- Replaces listings_category_check from 20250315_fix_listings_category_check.sql.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS category_deep text NOT NULL DEFAULT '';

-- Map legacy category slugs to a valid default leaf before tightening CHECK.
UPDATE listings SET
  category = 'electronics-gadgets',
  subcategory = 'phones-tablets',
  category_deep = 'smartphones'
WHERE category IS NULL
   OR category NOT IN (
    'electronics-gadgets',
    'fashion-apparel',
    'home-living',
    'food-groceries',
    'health-beauty',
    'baby-kids',
    'books-media-music',
    'sports-outdoors',
    'pets-animals',
    'hobbies-crafts',
    'software-digital',
    'industrial-business',
    'travel-experiences'
  );

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_category_check;

ALTER TABLE listings ADD CONSTRAINT listings_category_check CHECK (
  category IN (
    'electronics-gadgets',
    'fashion-apparel',
    'home-living',
    'food-groceries',
    'health-beauty',
    'baby-kids',
    'books-media-music',
    'sports-outdoors',
    'pets-animals',
    'hobbies-crafts',
    'software-digital',
    'industrial-business',
    'travel-experiences'
  )
);

CREATE INDEX IF NOT EXISTS idx_listings_category_deep ON listings (category_deep);
