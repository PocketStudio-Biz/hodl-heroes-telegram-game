# AGENTS.md

Instructions for coding agents working in this repository.

## Plan folder

Talk through the approach first. Then write the plan at `plans/<slug>.md`. Then build. Do not skip the plan file.

`plans/README.md` explains that order. A plan file is not a finished build.

## Measurable gates

A build is done only when every CI gate passes. The commands are:

- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

`npm run check` is the same typecheck as `npm run typecheck`. If a gate cannot be run or does not pass, stop and report that. Do not claim the task is done.

Lint covers the whole tree (`eslint .` with `typescript-eslint` recommended rules). There is no baseline and no changed-files ratchet. If a future change fails lint across existing files, ratchet (changed files only, or a baseline) and document that here instead of mass-reformatting `src/game/hodl.ts`.

## Isolate / Build / Prove / Ship

- **Isolate:** one branch per task. Do not push to the default branch, merge, force-push, rebase, or amend commits that are already pushed.
- **Build:** keep the service layer separate from orchestration. Pure run rules live in `src/game/rules.ts`. The canvas loop, React shell, Supabase client, and Telegram wrapper call those rules; they do not re-encode them.
- **Prove:** reproduce a bug before fixing it, and put the before/after proof in the PR.
- **Ship:** one PR. Name the gates, the exact commands, the evidence, and anything found but not fixed.

## rstack skills

https://github.com/PocketStudio-Biz/hermes-skills/tree/main/rstack

## This repo

The committed game is a canvas loop hosted by React. `src/main.tsx` mounts `App`, and `App` mounts the canvas shell in `src/pages/Home.tsx`. Screens (title, shop, win, leaderboard) are drawn by `HodlGame`, not by React routes.

`npm run build` on the previous tree could not succeed: the TypeScript project references, `src/main.tsx`, `src/game/engine.ts`, and `src/game/storage.ts` were imported and not present, and `vite.config.ts` imported an uninstalled plugin. Those files exist so the gates above are real.
