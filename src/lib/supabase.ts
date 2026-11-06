import { createClient } from '@supabase/supabase-js';

/* ------------------------------------------------------------------ */
/*  Supabase client — LIVE global leaderboard backend                  */
/*  Project: supabase-orange-garden (us-east-1)                        */
/*  Table: leaderboard_entries (created via migration)                 */
/* ------------------------------------------------------------------ */

const SUPABASE_URL = 'https://fhatidlphelthgwfxtft.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoYXRpZGxwaGVsdGhnd2Z4dGZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MjcyODksImV4cCI6MjA3NzEwMzI4OX0.xS6DPK-6aCYOu1XHA7MamjHFl2mLs11saMlwPZ0iFbc';

export const isSupabaseActive = true;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ------------------------------------------------------------------ */
/*  SQL to run in Supabase SQL Editor (one-time setup)                 */
/* ------------------------------------------------------------------ */
export const LEADERBOARD_SETUP_SQL = `
-- Create leaderboard table
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

-- Index for fast top-score lookups
CREATE INDEX IF NOT EXISTS idx_leaderboard_gold 
  ON leaderboard_entries(gold DESC);

-- Row Level Security: anyone can insert, anyone can read
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert" 
  ON leaderboard_entries FOR INSERT 
  TO anon WITH CHECK (true);

CREATE POLICY "Allow public select" 
  ON leaderboard_entries FOR SELECT 
  TO anon USING (true);
`;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export interface LeaderboardEntry {
  id?: number;
  player: string;
  gold: number;
  enemies: number;
  round: number;
  max_combo: number;
  time: number;
  mode: string;
  created_at?: string;
}

/* ------------------------------------------------------------------ */
/*  API                                                                */
/* ------------------------------------------------------------------ */
export async function submitScore(entry: LeaderboardEntry): Promise<boolean> {
  try {
    const { error } = await supabase.from('leaderboard_entries').insert({
      player: entry.player.slice(0, 30),
      gold: entry.gold,
      enemies: entry.enemies,
      round: entry.round,
      max_combo: entry.max_combo,
      time: entry.time,
      mode: entry.mode,
    });
    return !error;
  } catch {
    return false;
  }
}

export async function fetchGlobalLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  try {
    const { data, error } = await supabase
      .from('leaderboard_entries')
      .select('*')
      .order('gold', { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data || []).map((e, i) => ({ ...e, rank: i + 1 })) as LeaderboardEntry[];
  } catch {
    return [];
  }
}

export async function fetchPlayerRank(player: string): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('leaderboard_entries')
      .select('player, gold')
      .order('gold', { ascending: false });
    if (error || !data) return null;
    const idx = data.findIndex((e) => e.player === player);
    return idx >= 0 ? idx + 1 : null;
  } catch {
    return null;
  }
}
