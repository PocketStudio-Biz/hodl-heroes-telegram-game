# Quality gates

Branch: `cursor/quality-gates-7f63`. Do not push to `main`.

## What is broken before this change

`npm run build` cannot succeed on `main`:

- `tsconfig.json` references `tsconfig.app.json` and `tsconfig.node.json`, which are not in the repo.
- `index.html` loads `src/main.tsx`, which is not in the repo.
- `src/game/hodl.ts` imports `./engine` and `./storage`, which are not in the repo.
- `src/App.tsx` imports pages and a layout that are not in the repo, from `react-router-dom`, which is not installed (`react-router` is).
- `vite.config.ts` imports `plugin-inspect-react-code`, which the slimmed `package.json` no longer depends on.
- There is no lockfile, so `npm ci` cannot run. There is no lint, no test, and no workflow.

## Gates to add

CI on pull requests and on pushes to `main`:

- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

Lint is ESLint flat config with `typescript-eslint` recommended rules. ESLint 9 is what an earlier `package.json` declared, and `npm` now reports that release unsupported, so the gate uses ESLint 10 with the same flat config. Tests are Vitest. If the existing source fails lint across the board, ratchet and write that down in `AGENTS.md` instead of reformatting the game.

## Behavior under test

Pure run rules move into `src/game/rules.ts` and `HodlGame` calls them.

Bug, reproduced before the fix: `nextBlock` incremented the block and then treated `block > winBlocks` as a win. `blockAfterClear(12, 12)` returned block 13. A boss-rush run (victory on block 5) won on block 6. The tests expect the cleared block. After the fix they pass, and the submitted round is `winBlocks`.

Also cover formulas the loop already uses: SAT pickup value, shop prices, hit damage, heart pickups (no heal in hardcore), and heal-between-blocks.

## Secrets

No `.env` is tracked. The Supabase value in `src/lib/supabase.ts` is the public anon key (JWT role `anon`), which this app documents as client-safe. Do not copy it into the plan, the PR, or logs. Do not rotate it as part of this change. There is no service-role key in the tree.

## Out of scope unless a gate forces it

- Rewriting the canvas renderer.
- Replacing the leaderboard backend.
- Mass-formatting `hodl.ts`.
