-- orders: gig_id must be nullable (marketplace orders use listing_id only)
ALTER TABLE orders ALTER COLUMN gig_id DROP NOT NULL;
