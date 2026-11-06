-- ================================================================
-- HODL HEROES: Global Leaderboard Setup
-- Run this in Supabase SQL Editor (one-time setup)
-- ================================================================

-- 1. Create the leaderboard table
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id BIGSERIAL PRIMARY KEY,
  player TEXT NOT NULL,
  gold INTEGER NOT NULL DEFAULT 0,
  enemies INTEGER NOT NULL DEFAULT 0,
  round INTEGER NOT NULL DEFAULT 1,
  max_combo INTEGER NOT NULL DEFAULT 0,
  time INTEGER NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'roguelike',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Index for fast top-score lookups
CREATE INDEX IF NOT EXISTS idx_leaderboard_gold 
  ON leaderboard_entries(gold DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

-- 4. Allow anyone to submit scores (no auth required)
CREATE POLICY "Allow public insert" 
  ON leaderboard_entries FOR INSERT 
  TO anon WITH CHECK (true);

-- 5. Allow anyone to read the leaderboard
CREATE POLICY "Allow public select" 
  ON leaderboard_entries FOR SELECT 
  TO anon USING (true);

-- 6. Optional: create a view for the top 50 (faster queries)
CREATE OR REPLACE VIEW leaderboard_top_50 AS
SELECT 
  id,
  player,
  gold,
  enemies,
  round,
  max_combo,
  time,
  mode,
  created_at
FROM leaderboard_entries
ORDER BY gold DESC
LIMIT 50;

-- 7. Optional: clean up old entries (keeps last 1000 scores)
-- Run this periodically or set up a cron job
DELETE FROM leaderboard_entries
WHERE id NOT IN (
  SELECT id FROM leaderboard_entries
  ORDER BY gold DESC
  LIMIT 1000
);
