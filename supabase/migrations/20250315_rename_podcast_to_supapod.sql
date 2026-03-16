-- Rename podcast tables to supapod (platform naming)

ALTER TABLE podcasts RENAME TO supapods;

ALTER TABLE podcast_episodes RENAME COLUMN podcast_id TO supapod_id;
ALTER TABLE podcast_episodes RENAME TO supapod_episodes;

ALTER TABLE podcast_tips RENAME TO supapod_tips;

-- Update index names for clarity
ALTER INDEX IF EXISTS idx_podcasts_creator RENAME TO idx_supapods_creator;
ALTER INDEX IF EXISTS idx_podcasts_category RENAME TO idx_supapods_category;
ALTER INDEX IF EXISTS idx_podcasts_status RENAME TO idx_supapods_status;
ALTER INDEX IF EXISTS idx_podcasts_created RENAME TO idx_supapods_created;

ALTER INDEX IF EXISTS idx_podcast_episodes_podcast RENAME TO idx_supapod_episodes_supapod;
ALTER INDEX IF EXISTS idx_podcast_episodes_published RENAME TO idx_supapod_episodes_published;

ALTER INDEX IF EXISTS idx_podcast_tips_episode RENAME TO idx_supapod_tips_episode;
ALTER INDEX IF EXISTS idx_podcast_tips_from RENAME TO idx_supapod_tips_from;
