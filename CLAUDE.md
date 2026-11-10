# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Rewet**: a browser pixel-art peatland restoration game. Its goal is to teach real restoration practice:
- block drainage canals,
- rewet the peat,
- prevent fire,
- replant,
- revitalise local livelihoods (Indonesia's 3R framework: Rewetting, Revegetation, Revitalisation).

The game is inspired by penjagarimba.jilf.id but must not copy it.

## Skill router

- For each task in this repo, invoke the `rewet` skill first (`.claude/skills/rewet/`). Do this before other skills such as `impeccable`, `ponytail`, `ste100` or `superpowers:*`.
- The router sends you to the area files that hold this repo's procedures. It covers code, docs, diagrams, research, sound, sprites, design, performance, written text and git workflow.

## Current state and source of truth

- The gameplay is built: the sim is in `src/sim/`, rendering in `src/render/`, and the UI in `src/ui.js` and `src/main.js`. `index.html` holds the layout and the CSS.
- Read these before you change gameplay:
  - Spec: `docs/superpowers/specs/2026-11-10-rewet-gameplay-design.md`
  - Plan: `docs/superpowers/plans/2026-11-10-rewet-gameplay.md` (13 TDD tasks; it fixes the file layout, function signatures and starting numbers)
  - Sourced values: `docs/references/peat-hydrology-and-emissions.md`
- Follow the plan's "Global Constraints". If you change a tuned value, update the spec's section 8 (open items).

## Commands

- **Run:** `python3 -m http.server 8765`, then open http://localhost:8765. ES modules don't load from `file://`.
- **Tests:** `npm test` (= `node --test`, Node ≥ 20).
- **Single test file:** `node --test test/hydro.test.js`
- **Single test by name:** `node --test --test-name-pattern="C1" test/hydro.calibration.test.js`
- **Headless level run:** `node scripts/sim-run.js --level 1 --plan test/fixtures/l1-cascade.json`
- There is no build step, no linter and no npm dependencies. Don't add dependencies.

## Architecture (per spec section 6)

- **Simulation and rendering are kept fully separate.**
  - `src/sim/*` holds a pure, deterministic simulation over typed arrays: a seeded `mulberry32` RNG and a fixed tick, at 4 ticks per week and 208 ticks per year.
  - It must never touch `window`, `document` or a canvas; that is what lets it run under `node --test`.
  - Rendering (`src/render/`) and the DOM UI (`src/ui.js`) only read game state. The only way they change it is `applyAction()`.
- **Hydrology core** (`drainage.js` and `hydro.js`):
  - A chamfer distance field (in metres, tile = 50 m) is computed from every active drainage tile, together with a per-tile drainage strength `S`.
  - Each tick pulls the water table toward the drained depth with weight `S × exp(−dist/L)`, where L = 100 m in the dry season and 45 m in the wet season, with a 400 m cutoff. Lateral flow on head `z − wt` conserves water.
  - Blocks lower `S` for up to 6 canal tiles upstream, so long canals need a cascade of blocks.
  - The distance field is recomputed only when a block, backfill or new canal changes the drainage.
- **Calibration tests are the guard rails.**
  - C1 must match Ritzema et al. 2014 Table 4: water depth versus distance from a canal.
  - C2 must reproduce that paper's dam result: 1.12 m before blocking, 0.37 m after.
  - C3: a cascade of blocks must beat a single block.
  - If a rule change breaks these tests, re-tune the constants; don't loosen the tolerances.
- **Units:** `wt` is the water-table depth in metres, positive below the surface. Wet/healthy means `wt ≤ 0.40`. Carbon is shown as **t C**; don't show t CO2 until the 44/12 factor is sourced.

## Domain facts

- Every number about the real world (emission factors, water thresholds, subsidence rates) must come from a source opened in the session, with page or table cited, recorded in `docs/references/`.
- Mark a value `NOT SOURCED` rather than giving it from memory. The 0.4 m rule is sourced: PP 57/2016 Article 23(3)(a), key `PP57` in `docs/references/peat-hydrology-and-emissions.md`.

## Rendering and save notes

- **Rendering:**
  - The canvas has the size of the window divided by the map zoom, upscaled with `image-rendering: pixelated`. `src/render/view.js` sets it.
  - The intro and the menu draw a generated map (`src/render/introStory.js`) through the same view, at the fit zoom (`map.whole`).
  - All art is drawn with `fillRect`. Map sprites are built once into a cache in `src/render/iso.js`. No image or audio assets.
  - Sound is WebAudio synthesis in `src/audio.js`.
- **`localStorage` key:** `rewet_v1`, read and written only through `src/save.js`. It migrates the old prototype keys `rewet_save` and `rewet_mute`.
- **Gotcha:** a global click/keydown listener skips the intro. Any button that starts the intro must call `stopPropagation()`, as `#bReplay` does.
