-- Seed 4 complete SupaMarket demo listings for first 4 users.
-- Compatible with both schemas:
--   - with listings.category_deep
--   - without listings.category_deep
-- Also auto-detects a valid category from current DB to satisfy listings_category_check.
-- Idempotent: guarded by title check.

DO $$
DECLARE
  has_category_deep boolean;
  category_ok text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listings'
      AND column_name = 'category_deep'
  ) INTO has_category_deep;

  -- Prefer an existing category already in table; if empty, fallback to a few common slugs.
  SELECT l.category
  INTO category_ok
  FROM listings l
  WHERE l.category IS NOT NULL
  LIMIT 1;

  IF category_ok IS NULL THEN
    category_ok := 'electronics-gadgets';
  END IF;

  IF has_category_deep THEN
    INSERT INTO listings (
      seller_id, title, description, price_pi, category, subcategory, category_deep,
      condition, buying_method, images, stock, status, location, country_code,
      ship_worldwide, views, likes, is_boosted, boost_tier, boost_expires_at, type,
      created_at, updated_at
    )
    WITH user_pool AS (
      SELECT id, row_number() OVER (ORDER BY created_at ASC, id ASC) AS rn
      FROM users
      ORDER BY created_at ASC, id ASC
      LIMIT 4
    ),
    seed AS (
      SELECT * FROM (
        VALUES
          (1, 'Demo Market: iPhone 15 Pro Max 256GB (Like New)', 'Full set with box, cable, and receipt. Battery health 98%. No scratches, always with case and tempered glass. Fast deal preferred.', 189.5000000::numeric, 'phones-tablets', 'smartphones', 'like_new', 'both', ARRAY['https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=1400&q=80','https://images.unsplash.com/photo-1567581935884-3349723552ca?w=1400&q=80','https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=1400&q=80']::text[], 1, 'active', 'Kuala Lumpur', 'MY', false, 214, 33, true, 'gold', NOW() + INTERVAL '6 days', 'physical'),
          (2, 'Demo Market: Herman Miller Style Ergonomic Chair', 'Mesh back, adjustable lumbar, smooth wheels, very comfortable for long coding sessions. Good condition and fully functional.', 42.0000000::numeric, 'furniture', 'general', 'used', 'meetup', ARRAY['https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=1400&q=80','https://images.unsplash.com/photo-1519710164239-da123dc03ef4?w=1400&q=80']::text[], 2, 'active', 'Shah Alam', 'MY', false, 98, 12, false, NULL, NULL, 'physical'),
          (3, 'Demo Market: Adobe CC 1-Year License Key', 'Legit reseller account. Instant delivery after payment confirmation. Includes installation guide and support.', 15.7500000::numeric, 'software-licenses', 'general', 'new', 'ship', ARRAY['https://images.unsplash.com/photo-1626785774573-4b799315345d?w=1400&q=80','https://images.unsplash.com/photo-1545239351-1141bd82e8a6?w=1400&q=80']::text[], 8, 'active', 'Johor Bahru', 'MY', true, 176, 27, true, 'silver', NOW() + INTERVAL '3 days', 'digital'),
          (4, 'Demo Market: DJI Mini 3 Combo + Extra Battery', 'Well maintained, rarely flown. Includes carrying bag, ND filters, and 2 batteries. Great for travel content creators.', 128.0000000::numeric, 'cameras-photography', 'general', 'like_new', 'both', ARRAY['https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=1400&q=80','https://images.unsplash.com/photo-1506947411487-a56738267384?w=1400&q=80','https://images.unsplash.com/photo-1512820790803-83ca734da794?w=1400&q=80']::text[], 1, 'active', 'Penang', 'MY', false, 132, 19, false, NULL, NULL, 'physical')
      ) AS t(
        rn, title, description, price_pi, subcategory, category_deep, condition,
        buying_method, images, stock, status, location, country_code, ship_worldwide,
        views, likes, is_boosted, boost_tier, boost_expires_at, type
      )
    )
    SELECT
      u.id, s.title, s.description, s.price_pi, category_ok, s.subcategory, s.category_deep,
      s.condition, s.buying_method, s.images, s.stock, s.status, s.location, s.country_code,
      s.ship_worldwide, s.views, s.likes, s.is_boosted, s.boost_tier, s.boost_expires_at, s.type,
      NOW() - make_interval(days => (5 - s.rn)),
      NOW() - make_interval(days => (5 - s.rn))
    FROM seed s
    JOIN user_pool u ON u.rn = s.rn
    WHERE NOT EXISTS (SELECT 1 FROM listings l WHERE l.title = s.title);

  ELSE
    INSERT INTO listings (
      seller_id, title, description, price_pi, category, subcategory,
      condition, buying_method, images, stock, status, location, country_code,
      ship_worldwide, views, likes, is_boosted, boost_tier, boost_expires_at, type,
      created_at, updated_at
    )
    WITH user_pool AS (
      SELECT id, row_number() OVER (ORDER BY created_at ASC, id ASC) AS rn
      FROM users
      ORDER BY created_at ASC, id ASC
      LIMIT 4
    ),
    seed AS (
      SELECT * FROM (
        VALUES
          (1, 'Demo Market: iPhone 15 Pro Max 256GB (Like New)', 'Full set with box, cable, and receipt. Battery health 98%. No scratches, always with case and tempered glass. Fast deal preferred.', 189.5000000::numeric, 'phones-tablets', 'like_new', 'both', ARRAY['https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=1400&q=80','https://images.unsplash.com/photo-1567581935884-3349723552ca?w=1400&q=80','https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=1400&q=80']::text[], 1, 'active', 'Kuala Lumpur', 'MY', false, 214, 33, true, 'gold', NOW() + INTERVAL '6 days', 'physical'),
          (2, 'Demo Market: Herman Miller Style Ergonomic Chair', 'Mesh back, adjustable lumbar, smooth wheels, very comfortable for long coding sessions. Good condition and fully functional.', 42.0000000::numeric, 'furniture', 'used', 'meetup', ARRAY['https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=1400&q=80','https://images.unsplash.com/photo-1519710164239-da123dc03ef4?w=1400&q=80']::text[], 2, 'active', 'Shah Alam', 'MY', false, 98, 12, false, NULL, NULL, 'physical'),
          (3, 'Demo Market: Adobe CC 1-Year License Key', 'Legit reseller account. Instant delivery after payment confirmation. Includes installation guide and support.', 15.7500000::numeric, 'software-licenses', 'new', 'ship', ARRAY['https://images.unsplash.com/photo-1626785774573-4b799315345d?w=1400&q=80','https://images.unsplash.com/photo-1545239351-1141bd82e8a6?w=1400&q=80']::text[], 8, 'active', 'Johor Bahru', 'MY', true, 176, 27, true, 'silver', NOW() + INTERVAL '3 days', 'digital'),
          (4, 'Demo Market: DJI Mini 3 Combo + Extra Battery', 'Well maintained, rarely flown. Includes carrying bag, ND filters, and 2 batteries. Great for travel content creators.', 128.0000000::numeric, 'cameras-photography', 'like_new', 'both', ARRAY['https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=1400&q=80','https://images.unsplash.com/photo-1506947411487-a56738267384?w=1400&q=80','https://images.unsplash.com/photo-1512820790803-83ca734da794?w=1400&q=80']::text[], 1, 'active', 'Penang', 'MY', false, 132, 19, false, NULL, NULL, 'physical')
      ) AS t(
        rn, title, description, price_pi, subcategory, condition,
        buying_method, images, stock, status, location, country_code, ship_worldwide,
        views, likes, is_boosted, boost_tier, boost_expires_at, type
      )
    )
    SELECT
      u.id, s.title, s.description, s.price_pi, category_ok, s.subcategory,
      s.condition, s.buying_method, s.images, s.stock, s.status, s.location, s.country_code,
      s.ship_worldwide, s.views, s.likes, s.is_boosted, s.boost_tier, s.boost_expires_at, s.type,
      NOW() - make_interval(days => (5 - s.rn)),
      NOW() - make_interval(days => (5 - s.rn))
    FROM seed s
    JOIN user_pool u ON u.rn = s.rn
    WHERE NOT EXISTS (SELECT 1 FROM listings l WHERE l.title = s.title);
  END IF;
END $$;
