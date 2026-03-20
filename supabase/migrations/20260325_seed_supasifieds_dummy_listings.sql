-- Seed 4 dummy Supasifieds listings for UI/demo.
-- Safe to run multiple times: guarded by title check.

WITH owner AS (
  SELECT id
  FROM users
  ORDER BY created_at ASC
  LIMIT 1
)
INSERT INTO classified_listings (
  seller_id,
  title,
  description,
  category,
  subcategory,
  category_deep,
  price_display,
  images,
  status,
  location,
  country_code,
  contact_phone,
  contact_whatsapp,
  views,
  is_boosted,
  boost_tier,
  boost_expires_at,
  created_at,
  updated_at
)
SELECT
  owner.id,
  seed.title,
  seed.description,
  seed.category,
  seed.subcategory,
  seed.category_deep,
  seed.price_display,
  seed.images,
  'active',
  seed.location,
  seed.country_code,
  seed.contact_phone,
  seed.contact_whatsapp,
  seed.views,
  seed.is_boosted,
  seed.boost_tier,
  CASE
    WHEN seed.is_boosted THEN NOW() + INTERVAL '7 days'
    ELSE NULL
  END,
  NOW(),
  NOW()
FROM owner
CROSS JOIN (
  VALUES
    (
      'Demo: iPhone 14 Pro 256GB',
      'Like new condition. Battery health 92%. Box and cable included.',
      'electronics-gadgets',
      'phones-tablets',
      'smartphones',
      '125 π',
      ARRAY[
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=1200&q=80'
      ]::text[],
      'Kuala Lumpur',
      'MY',
      '+60123456789',
      '60123456789',
      142,
      TRUE,
      'gold'
    ),
    (
      'Demo: Condo for rent near LRT',
      '2 bedrooms, fully furnished, 1 carpark. Immediate move-in available.',
      'electronics-gadgets',
      'phones-tablets',
      'smartphones',
      '65 π / month',
      ARRAY[
        'https://images.unsplash.com/photo-1494526585095-c41746248156?w=1200&q=80'
      ]::text[],
      'Petaling Jaya',
      'MY',
      '+60199887766',
      '60199887766',
      88,
      TRUE,
      'silver'
    ),
    (
      'Demo: Part-time Graphic Designer',
      'Remote role, flexible hours. Portfolio required.',
      'electronics-gadgets',
      'computers-laptops',
      'laptops',
      '1.5 π / hour',
      ARRAY[
        'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80'
      ]::text[],
      'Johor Bahru',
      'MY',
      '+60112223344',
      '60112223344',
      53,
      FALSE,
      NULL
    ),
    (
      'Demo: Used Yamaha Y15ZR',
      '2019 model, good engine condition, service record available.',
      'electronics-gadgets',
      'audio-visual',
      'speakers-soundbars',
      '210 π',
      ARRAY[
        'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=1200&q=80'
      ]::text[],
      'Shah Alam',
      'MY',
      '+60134561234',
      '60134561234',
      34,
      FALSE,
      NULL
    )
) AS seed(
  title,
  description,
  category,
  subcategory,
  category_deep,
  price_display,
  images,
  location,
  country_code,
  contact_phone,
  contact_whatsapp,
  views,
  is_boosted,
  boost_tier
)
WHERE NOT EXISTS (
  SELECT 1
  FROM classified_listings c
  WHERE c.title = seed.title
);
