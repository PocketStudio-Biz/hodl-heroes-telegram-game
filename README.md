# HODL HEROES: Moon or Rekt

A crypto-themed bullet-hell roguelike game built as a **Telegram Mini App**. Dodge bears, stack SAT, mine blocks, and climb the global leaderboard.

## Play Now

**Telegram:** `t.me/<your_bot>` (after BotFather setup)

## Features

- **5 Game Modes:** Roguelike, Survival, Boss Rush, Endless, Hardcore
- **Crypto Theme:** SAT economy, BLOCK progression, BULL RUN combos, REKT game over
- **Telegram Mini App:** Haptic feedback, username integration, share score
- **Global Leaderboard:** Live rankings via Supabase (free tier)
- **Pixel-Art UI:** Retro 3D bevel borders, scanlines, TON blue accents

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v3 + shadcn/ui |
| Animation | Framer Motion |
| Game Engine | HTML5 Canvas 2D + requestAnimationFrame |
| Backend | Supabase (PostgreSQL) — free tier |
| Platform | Telegram Mini Apps SDK |

## Game Modes

| Mode | HP | Victory | Upgrades | Special |
|------|-----|---------|----------|---------|
| **Roguelike** | 180 | 12×block enemies | Yes | Boss every 5 blocks |
| **Survival** | 200 | Infinite | No | Auto-advance, no shop |
| **Boss Rush** | 180 | 1 boss/block | Yes | Only Whale Bosses |
| **Endless** | 180 | Infinite | Yes | Shop between rounds |
| **Hardcore** | **1** | 15×block enemies | No | No heal between rounds |

## Setup

### 1. Clone & Install
```bash
git clone https://github.com/PocketStudio-Biz/hodl-heroes-telegram-game.git
cd hodl-heroes-telegram-game
npm install
npm run build
```

### 2. Configure Supabase (Global Leaderboard)
1. Create free project at [supabase.com](https://supabase.com)
2. Run `supabase-setup.sql` in SQL Editor
3. Copy URL + anon key from Project Settings → API
4. Paste into `src/lib/supabase.ts`
5. Rebuild: `npm run build`

### 3. Deploy to Telegram
1. Publish the built `dist/` folder to any static host (HTTPS required)
2. Open @BotFather → `/newapp`
3. Paste your HTTPS URL + upload `app-icon.png`
4. Share `t.me/<your_bot>/<app_name>`

## Monetization Roadmap

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Free game + global leaderboard | Done |
| 2 | "HODL Pro" $4.99 upgrade (Stripe) | Planned |
| 3 | Sponsor display for crypto projects | Planned |
| 4 | Play-to-earn tokens (TON) | Future |

## License

MIT — feel free to fork, modify, and build your own Telegram Mini App game.

---

Built by [PocketStudio](https://github.com/PocketStudio-Biz)
