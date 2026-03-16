-- SupaCast: Full podcast platform
-- podcasts (show/channel), episodes (audio), tips (Pi monetization)

CREATE TABLE IF NOT EXISTS podcasts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  cover_url       TEXT,
  category        TEXT NOT NULL DEFAULT 'others'
                  CHECK (category IN (
                    'arts','business','comedy','education','fiction','government',
                    'health','history','kids','leisure','music','news','religion',
                    'science','society','sports','technology','true_crime','tv_film','others'
                  )),
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','paused','archived')),
  total_plays     INT NOT NULL DEFAULT 0,
  total_episodes  INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_podcasts_creator ON podcasts(creator_id);
CREATE INDEX IF NOT EXISTS idx_podcasts_category ON podcasts(category);
CREATE INDEX IF NOT EXISTS idx_podcasts_status ON podcasts(status);
CREATE INDEX IF NOT EXISTS idx_podcasts_created ON podcasts(created_at DESC);

CREATE TABLE IF NOT EXISTS podcast_episodes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  podcast_id      UUID NOT NULL REFERENCES podcasts(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  audio_url       TEXT NOT NULL,
  duration_sec    INT NOT NULL DEFAULT 0,
  file_size_bytes BIGINT,
  plays           INT NOT NULL DEFAULT 0,
  episode_number  INT,
  status          TEXT NOT NULL DEFAULT 'published'
                  CHECK (status IN ('draft','published','archived')),
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_podcast_episodes_podcast ON podcast_episodes(podcast_id);
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_published ON podcast_episodes(podcast_id, status, published_at DESC);

CREATE TABLE IF NOT EXISTS podcast_tips (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  episode_id      UUID NOT NULL REFERENCES podcast_episodes(id) ON DELETE CASCADE,
  from_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_pi       DECIMAL(18,7) NOT NULL CHECK (amount_pi > 0),
  message         TEXT,
  pi_payment_id   TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','completed','failed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_podcast_tips_episode ON podcast_tips(episode_id);
CREATE INDEX IF NOT EXISTS idx_podcast_tips_from ON podcast_tips(from_user_id);
