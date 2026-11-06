# HODL HEROES — Supabase Setup Guide

## What This Does
Connects your game to a **free global database** so every player's score is saved and visible to everyone.

## Cost
**$0** — Supabase free tier includes 500MB storage + 2GB bandwidth/month.

---

## Step-by-Step Setup

### 1. Create Supabase Account (2 minutes)
1. Go to **https://supabase.com**
2. Sign up with GitHub (fastest)
3. Verify email

### 2. Create New Project
1. Click **"New Project"**
2. Name: `hodl-heroes`
3. Pick a region close to your players
4. Click **"Create"** and wait ~2 minutes

### 3. Run Setup SQL
1. In project dashboard, click **"SQL Editor"** (left sidebar)
2. Click **"New query"**
3. Open `supabase-setup.sql` from this repo
4. Copy ALL SQL and paste into editor
5. Click **"Run"**

### 4. Get API Keys
1. Go to **Project Settings** (gear icon) → **API**
2. Copy:
   - **Project URL** (`https://...supabase.co`)
   - **anon public key** (`eyJhbG...`)

### 5. Add Keys to Game
1. Open `src/lib/supabase.ts`
2. Replace:
   ```typescript
   const SUPABASE_URL = '';
   const SUPABASE_ANON_KEY = '';
   ```
   With your actual values
3. Save → Rebuild (`npm run build`)

### 6. Done!
The leaderboard badge switches from **"Local Only"** to **"🟢 Global Live"**.

## Security
- `anon` key is **public by design** — safe in frontend
- Row Level Security prevents deletion/modification
- Players can only insert scores and read leaderboard

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Local Only" shows | Check URL and key are filled in correctly |
| Scores not appearing | Open DevTools (F12) → Console → check for red errors |
| "Failed to fetch" | Supabase project still spinning up — wait 2 min |
