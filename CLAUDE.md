# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An **unofficial, non-commercial fan remake** of Arknights' seasonal auto-chess tower-defense mode 「卫戍协议：盟约」 — browser client, Node.js server, solo or 1–4 player co-op. Not affiliated with Hypergryph/Yostar. The upstream project is deliberately non-commercial: **do not add monetization of any kind** (ads, paid tiers, tips, paid distribution).

## Language rules (strictly enforced)

- **All player-facing text is Simplified Chinese.** Names and descriptions come from official data tables.
- **All code, comments, identifiers and commit content are English.**
- Documentation is written in Simplified Chinese for player-facing docs (`README.md`, `CHANGELOG.md`, `docs/PLAYING.md`, `docs/DEPLOY.md`, `docs/WINDOWS.md`); the internal architecture docs (`docs/DESIGN.md`, `SIM.md`, `META.md`, `DATA.md`, `ASSETS.md`, `BALANCE.md`) are English.

## Commands

```bash
npm install                 # postinstall runs tools/vendor.mjs → copies libs into public/vendor/
npm run setup               # env check + download ~270 MB of art/audio from public mirrors (resumable)
npm start                   # server on http://localhost:3000
npm run dev                 # same, with node --watch

npm test                    # = node --test  (all unit + integration suites)
node --test test/content/bonds_core.test.js            # one suite
node --test --test-name-pattern="facing" test/sim/     # filter by test name

npm run doctor              # diagnose Node version, missing assets, port use, LAN IP, firewall
npm run build-data          # regenerate data/*.json from official tables (see below)
npm run launch              # scripts/launch.mjs
npm run assets              # vendor + fetch-assets
```

Asset- and browser-gated suites only run when their env var is set — **they skip silently otherwise**, so a green `node --test` does not mean they ran:

```bash
SP_E2E=1      node --test test/ui/mock.e2e.test.js        # needs local Chrome (CHROME_PATH overrides)
SP_REAL_E2E=1 node --test test/ui/real.e2e.test.js        # needs Chrome + downloaded assets
RENDER_E2E=1  node --test 'test/render/*.browser.test.js' # some need locally extracted board textures
```

CI (`.github/workflows/ci.yml`) runs on Ubuntu + Windows × Node 22/24 with `SP_E2E=0 SP_REAL_E2E=0 RENDER_E2E=0` and no assets, then a server smoke test (`/healthz`, `/`, `/vendor/pixi.min.js`).

## Architecture

**One simulation engine, two runtimes.** `server/sim/` is pure ESM with no Node APIs and no bundler; the server serves it read-only at `/sim/*.js` and the browser imports the *same* modules. `server/index.js` serves only `/sim/` (`.js` only), `/data.js` (a generated browser stand-in of `server/data.js`), `/shared/`, and `public/`. Consequence: anything under `server/sim/` must stay runtime-agnostic, deterministic (seeded `battle.rng()` only — no `Math.random`, no `Date.now`), and side-effect-free at import time.

**Server-authoritative meta, client-side combat.** The server validates every client *intent*, owns economy/shop/board/bonds/rounds, and pushes views; each player's browser simulates its own battle with the shared engine (as the official client does), then reports a `battleResult`. `SP_COMBAT=server` moves simulation to the server; `SP_VERIFY=off|sample|all` makes the server recompute reported results. Rooms and matches live **in server memory** — a restart ends all matches.

Layering:

| Path | Role |
|---|---|
| `shared/` | imported by both server and browser: enums/phases (`constants.js`), the **normative** wire protocol (`protocol.js`), bond/high-ground/loadout helpers |
| `server/index.js`, `net.js`, `lobby.js`, `data.js` | static server, WS session registry + rate limit + validation, rooms/seats/reconnect, data indexes |
| `server/match/` | match state machine, per-player state and prep intents, pool/shop, bonds, prep-phase effect dispatcher, waves, unite, final assault, results, bot |
| `server/sim/` | the deterministic battle engine (`Battle.js`) + `content/` (kits, bonds, garrisons, items, bands, enemies, bosses, devices, choices) |
| `public/js/` | boot/router, `net.js` WS client, observable `store.js`, `screens/`, `ui/`, `render/` (PixiJS 7 + pixi-spine, three.js 3D board, Preact + htm — no build step) |
| `public/js/battle/runner.js` | drives the shared sim in the browser; reports results back over WS |
| `data/` | generated JSON, committed; `data/assets.json` is written by the asset fetcher, `data/local-assets.json` is per-machine and git-ignored |
| `tools/`, `scripts/` | setup/doctor, data build, asset fetch, local client extraction, start scripts |

### Content modules

Every domain file in `server/sim/content/` exports **two** halves: `install(battle)` (battle side, called once per `Battle` from `content/index.js`) and `registerMeta(registry)` (prep side, called once at server boot from `match/effectsMeta.js`). Operator kits are keyed by base `chessId` in `content/kits/tier1..6.js`. Numeric values must be **data-driven from official blackboards** — do not hard-code a number that exists as a blackboard key. Each effect needs a test under `test/content/*.test.js` using `test/helpers/battleHarness.js`.

## Documentation is the contract

`docs/DESIGN.md` is the **single source of truth** for implementers. Precedence: DESIGN.md > `docs/research/` (and within a research file, its "Addendum (critic)" beats the body) > choose the simplest faithful behaviour and record it in the module's header comment. On geometry/simulation details also read `docs/SIM.md` (engine + SkillSpec reference), `docs/META.md` (match/prep effects), `docs/DATA.md` (generated data conventions), `docs/BALANCE.md`, `docs/ASSETS.md`.

`test/docs-consistency.test.js` asserts that code and prose still agree — and that corrected wording does not regress. **If you change behaviour described in a doc, update the doc in the same commit**; if you change a doc, expect that test to check the code actually matches. DESIGN.md §2's file tree lags the code in places (e.g. `shared/format.js` / `shared/rules.js` no longer exist) — trust the tree on disk and the per-directory headers in SIM.md/META.md for the current file list.

## Generated data — never hand-edit

`data/*.json` (except `assets.json` and `local-assets.json`) is produced by `node tools/build-data.mjs` from official zh_CN client tables joined with `docs/research/*.json`. Change the build script and rebuild; a stale `data/` is caught by the offline-rebuild test. Builds are deterministic (byte-identical for the same inputs), write atomically, and leave previous output untouched on integrity failure. `data/stages.json` path fields derive from `server/sim/grid.js`, so a pathing change requires a rebuild.

## Content and licensing constraints

Never commit game assets or vendored third-party builds: `public/assets/`, `public/fonts/`, `public/vendor/`, `data/local-assets.json` and `.cache/` are git-ignored, and assets are **not** covered by the project's GPL-3.0 licence. Code is GPL-3.0-or-later.

## Before committing

Run `node --test` and update the affected docs. Keep the change scoped to the files you own; a module's header comment is where inferred/assumed behaviour belongs (`[ASSUMED]` is the established marker).
