# Rewet: gameplay loop and success criteria (design spec)

Date: 2026-11-10
Status: draft, waiting for user review
Builds on: `index.html` (intro and main menu prototype)
Sources: `docs/references/peat-hydrology-and-emissions.md`

## 1. Intent

**What the user said:**
- A conservation and restoration game, similar to Penjaga Rimba but not the same.
- Purposes: teach real restoration, outreach, a fun strategy game, and a pitch/demo for their org, with **teaching real restoration as the main focus**.
- Audience: the public first, with an optional data view for students and stakeholders.
- Time in seasons, played live.
- The player is a planner with a budget, using the 3R action set.
- Win by meeting targets at the end, with one star per R.
- Hydrology-lite simulation.
- Gentle terrain with micro-relief.
- Drainage strength falls with distance from canals and rivers.

**What I assumed:**
- Peatland setting, browser game for desktop and mobile, single player.
- English UI first.
- Sites are fictional but based on real Indonesian peat landscapes.

**Success for the project:** after one level, a member of the public can explain three things:
1. Canals dry out peat.
2. Blocking canals in a cascade rewets the peat.
3. Wet peat doesn't burn, and plants need it wet.

Students and stakeholders can open the data view and see why: water depth, the 40 cm line, and CO2 estimates.

## 2. Hydrology model

### 2.1 Grid and scale

- One tile = **50 m × 50 m** (0.25 ha).
- Sites range from 22×22 tiles (1.1 km) up to 40×40 tiles (2 km).
- 4 ticks per in-game week, about 52 weeks per year.

**Per-tile state** (typed arrays):

| Field | Type | Meaning |
|---|---|---|
| `z` | `Float32` | Surface height, in metres |
| `wt` | `Float32` | Water-table depth below the surface, in metres. Positive = below the surface, negative = water standing above it. |
| `kind` | `Uint8` | peat, canal, river, village, farm |
| `block` | `Uint8` | 0 none, 1 temporary, 2 permanent, 3 backfilled |
| `cover` | `Float32` | Native vegetation cover, 0 to 1 |
| `fire` | `Uint8` | 0 none, 1 surface fire, 2 smouldering |
| `dist` | `Float32` | Distance to the nearest active drainage tile, in metres |

### 2.2 Terrain: gentle dome plus micro-relief

`z = dome(x, y) + micro(x, y)`
- `dome` is a smooth rise from the river or edge to the centre. It should total about 2–4 m over the site.
  - Tune this so the slope looks flat. Ritzema 2014 (p.4) gives average dome slopes of 0.5 m km⁻¹ toward one side and 1.5 m km⁻¹ toward the Kahayan River. At 2 km wide, 1–1.5 m of dome rise matches the real data; 2–4 m is a readability exaggeration.
- `micro` is seeded value noise, smoothed with a radius of 2–3 tiles, with an amplitude of **±0.3 m**, so it forms low mounds and dips.
- Peat subsides (see 2.5), so `z` changes over the years.

**On screen:** each tile is drawn 0–2 pixels higher or lower according to `micro`. The data view can show contour lines.

### 2.3 Drainage distance factor

A drainage tile pulls the water table down, and the pull fades with distance. This is fitted to Ritzema et al. 2014, Table 4 (Kalampangan Canal, depth versus distance):

| Distance from canal | 10 m | 100 m | 400 m | 1000 m |
|---|---|---|---|---|
| Dry season, observed | -0.88 | -0.54 | -0.35 | -0.33 |
| Dry season, model (L = 100 m) | -0.88 | -0.55 | -0.34 | -0.33 |
| Rainy season, observed | -0.50 | -0.13 | -0.05 | -0.06 |
| Rainy season, model (L = 45 m) | -0.50 | -0.12 | -0.06 | -0.06 |

**Model:**

```
f(d) = exp(-d / L_season)        L_dry = 100 m (2 tiles), L_wet = 45 m (0.9 tiles)
f(d) = 0 when d > 400 m (8 tiles)   // shortcut: the effect is under 2% there; skipping it saves work
```

- `L` blends smoothly between `L_wet` and `L_dry` across the season.
- `dist` comes from a breadth-first distance field from every **active** drainage tile. It is recomputed only when a block is built or destroyed, or when a canal is dug.

**Drainage strength `S` of the nearest source:**

| Source | S |
|---|---|
| Open canal | 1.0 |
| River (natural) | 0.6 |
| Canal section above a temporary block | `S_block_temp`, about 0.35 |
| Canal section above a permanent block | `S_block_perm`, about 0.2 |
| Backfilled canal | 0, so it is no longer a drainage tile |

- A block lowers `S` for the canal tiles **upstream** of it, up to the next block or the canal's high end.
- Blocks leak (Ritzema 2014 p.8: "lateral seepage along and below the dams"), so `S` never reaches 0.
- The `S_block` values are **game tuning, not published values**. They are calibrated by target C2 in section 2.6.
- **Cascade rule:** one block only lowers `S` within a limited head, the < 0.5 m rule (Ritzema 2014 p.11). A canal section longer than `maxHeadTiles` (about 6 tiles, tuned) above a block keeps `S = 1.0` past that length. So a long canal needs several blocks in a cascade.

### 2.4 Water balance each tick

For each peat tile:

```
wt += ET(season, cover) - rain(season)                  // vertical
wt += k_drain * S * f(dist) * (wt_eq_drained - wt)      // pull toward drained depth
lateral: water level h = z - wt; move water to 4 neighbours toward lower h, rate k_lat
wt = clamp(wt, -0.3, 1.5)                               // standing water max 30 cm; floor at 1.5 m
```

- `wt_eq_drained`: the depth that strong drainage pushes toward. Dry season about 0.9 m, wet season about 0.5 m, matching the 10 m column of Table 4.
- `rain` and `ET` (evapotranspiration, i.e. water lost to evaporation and plants) are tuned so a tile **far from drainage** settles at about 0.33 m in the dry season and about 0.06 m in the wet season, the 1000 m column of Table 4.
- Dense cover lowers `ET` a little.
- **Lateral flow** gives the micro-relief effect: dips collect water and stay wet longer, while mounds dry out first.
- Lateral flow must **conserve water** (checked by test T1).
- **El Niño year:** dry season 1.5× longer, and rain −50%.

### 2.5 Peat state and its effects

| `wt` (m) | State | Effects |
|---|---|---|
| < 0 | Flooded | Seedlings take drowning damage after 3 weeks. Paludiculture is fine. |
| 0–0.40 | Wet, healthy | Can't burn. Seedlings survive. Counts toward the Rewetting goal. |
| > 0.40 | Dry, degraded | Can burn. Seedlings die off slowly. Peat subsides. |

- **Threshold:** fire risk rises below 0.40 m (Ritzema 2014 p.2, citing Wösten et al. 2008). The Indonesian 0.4 m damage criterion (PP 57/2016, Art. 23) is **NOT SOURCED yet**; only secondary text has been seen.
- **Subsidence:** `dz/yr (cm) = 0.1 × wt (cm)` when `wt > 0` (Ritzema 2014 p.2, citing Wösten & Ritzema 2001).
  - Applied as `z -= 0.001 * wt_cm / 208` per tick, at 208 ticks per year.
  - As a result, canals "eat" into the dome and the area near them drains even more (Ritzema 2014 p.8). Players see this as dips forming along open canals.

### 2.6 Calibration targets

These are automated tests in `test/hydro.calibration.test.js`.

- **C1, transect:** a flat 1D strip with one open canal, run to steady state under dry and then wet forcing. Depths at 0.2, 2, 8 and 20 tiles must match Table 4 within ±0.10 m.
- **C2, blocking:**
  - Start: a degraded site with an open, unblocked canal, at an average depth of about 1.1 m (Ritzema 2014 p.10: 1.12 m before).
  - After one year with a full cascade of blocks, the transect average must be 0.30–0.45 m (paper: 0.37 m).
  - Dry-season depths must still go past 0.40 m on degraded tiles (paper: the dams can't hold the water through long droughts).
- **C3, cascade beats a single block:** on the level-4 map, the best 3-block cascade rewets ≥ 1.5× more tiles than the best single block.

## 3. Core loop

- **Level length:** 3–5 years, at about 75 seconds per year.
  - **Wet season** (about 45 s): build window. Blocks and planting cost −20%.
  - **Dry season** (about 30 s): fire risk, arson attempts, defending.
- **Pause, ×1 and ×2 speed:** the sim tick rate changes; the frame rate does not.
- **Year report** (pauses the game): water-depth chart, burnt area, seedling survival, goodwill and funds.

**Resources:**
- **Funds:** a grant at the start of each year, plus a bonus for each goal on track.
- **Crews:** 3 at the start. Each action takes a crew away for its build time.

**Actions:**

| R | Action | Cost / time (initial tuning) | Rule |
|---|---|---|---|
| Rewetting | Temporary block | low / 1 week | Canal tile only. `S_block_temp`. Can wash out in an extreme wet week if the head is too long. |
| Rewetting | Permanent block | medium / 3 weeks | Upgrades a temporary block. `S_block_perm`. |
| Rewetting | Backfill | high / 6 weeks | Canal tile becomes peat. Removes drainage. |
| Rewetting | Deep well | low / 1 week | Fire crews within 3 tiles put fires out 2× faster. |
| Revegetation | Plant seedlings | low / 1 week | Survive only at 0–0.40 m. Grow to full cover in about 2 years. |
| Revegetation | Planting mound | low / 1 week | `z += 0.2` on one tile, which keeps seedlings out of floodwater. |
| Revegetation | Natural regrowth | free | Cover spreads slowly into wet tiles next to cover ≥ 0.6. |
| Revitalisation | Paludiculture | medium / 2 weeks | Needs a wet tile next to a village. +goodwill per year; income if the tile stays wet. |
| Revitalisation | Fish pond | medium / 2 weeks | Canal tile behind a block. +goodwill. |
| Revitalisation | Fire-care group | medium / 2 weeks | Per village. Fires within 6 tiles are spotted at once; −50% arson. |
| Defense | Fire crew | crew only / until out | Surface fire: 2 days. Smouldering: 2 weeks, and it flares up again if `wt > 0.40`. |

**Threats:**
- **Fire:** ignites only on tiles with `wt > 0.40`, with a chance that rises with depth and with dry season. Spreads downwind to dry neighbours. Can turn into smouldering fire underground.
- **Arson:** attempts per dry season = `base × (1 − goodwill/100)`.
- **Illegal canal:** from level 4. A new canal line is dug from the edge over 2 weeks and shown on the map. Blocking it early is cheap.
- **El Niño:** announced in the year report one year before it arrives.

## 4. Success criteria

Judged at the end of the last dry season:

| Goal | Measure | Level 1 pass line | Level 6 pass line |
|---|---|---|---|
| Rewetting (main) | % of peat tiles with average `wt` ≤ 0.40 m over the final dry season | ≥ 60% | ≥ 75% |
| Revegetation | Average native cover on tiles that aren't canals or farms | ≥ 40% | ≥ 55% |
| Revitalisation | Goodwill | ≥ 60 | ≥ 70 |

- **Pass and stars:** the Rewetting goal passes the level and gives ★1. Each other goal met gives +★, for ★3 at most.
- **Lose early** if any of these happens:
  - total burnt area exceeds 35% of the site,
  - funds and crews are all used up with no actions in progress,
  - goodwill reaches 0.

**Score** (separate from stars):
- Hectares kept wet × years.
- A CO2 estimate, which uses only the sourced IPCC 2013 Wetlands Supplement values:
  - **Drainage avoided:** each tile that was drained at the start and is wet at the end avoids the Table 2.1 factor for its land use, e.g. "Cropland and fallow, drained" 14 t CO2-C ha⁻¹ yr⁻¹ (p.2.13). Rewetted tropical soil = 0 (Table 3.1, p.3.12).
  - **Fire:** burnt tiles count fuel consumption 353 t d.m. ha⁻¹ (Table 2.6, p.2.40) × 464 g kg⁻¹ (Table 2.7, p.2.41).
  - Shown as **"estimate, t C"** until the 44/12 C-to-CO2 factor is sourced (see section 8).
- A bonus for leftover funds.

**Debrief:**
- **Public view:** stars, the before/after diorama, and one plain-language line per goal.
- **Data view:** water-depth chart, a heatmap with the 40 cm contour, the CO2 estimate, and seedling survival.
- **One hint**, aimed at the weakest goal.

## 5. Levels

| # | Site (fictional) | Size | Years | Teaches | Unlock |
|---|---|---|---|---|---|
| 1 | Small drained plot | 22² | 3 | Blocks, the 40 cm line, distance factor | start |
| 2 | Burnt former forest | 24² | 3 | Planting, drowning in dips, mounds | 1 |
| 3 | Village edge | 26² | 4 | Goodwill, paludiculture, arson | 2 |
| 4 | Canal network | 30² | 4 | Cascades, backfill, illegal canals | 3 |
| 5 | El Niño year | 30² | 4 | Wells, fire crews, smouldering fire | 4 |
| 6 | Full peat dome | 40² | 5 | Everything, with higher pass lines | 5 |

- **Upgrades bought with stars:** +1 crew (★3), blocks −25% cost (★3), fire crews 30% faster (★4).
- **Sandbox:** unlocked after level 6. A random seed, no targets, data view on by default, and shareable by seed.

## 6. Architecture

- **Stack:** plain JavaScript with native ES modules, no framework, no build step. Run it from a local server (`python3 -m http.server`).

```
index.html          menu + HUD markup, CSS; loads src/main.js
src/main.js         boot, screens (intro/menu/level/debrief), game loop
src/sim/world.js    typed-array grid state, seeded RNG
src/sim/terrain.js  dome + micro-relief
src/sim/drainage.js distance field (BFS from active drainage), S per canal section
src/sim/hydro.js    water-balance tick, lateral flow, subsidence
src/sim/fire.js     ignition, wind spread, smouldering
src/sim/actors.js   crews, action queue, arson, illegal canals
src/sim/score.js    3R measures, stars, CO2 estimate, early-loss checks
src/levels.js       level data
src/render/iso.js   sprite cache, iso drawing, height offsets
src/render/view.js  camera, normal/data layers
src/ui.js           HUD, action bar, tile info, year report, debrief
src/audio.js        WebAudio synth (from prototype)
src/save.js         localStorage `rewet_v1`, versioned and validated
test/*.test.js      node --test, sim only
scripts/sim-run.js  headless run of a level plus a plan file, printing 3R results
```

**Rules:**
- `sim/` never touches the page or the canvas.
- The sim is deterministic for a given seed and list of actions.
- Ticks run at a fixed rate, separate from the frame rate.
- The intro diorama from the prototype is reused as the menu background.

**Errors:**
- Invalid actions are refused, with a short reason shown on the tile.
- A sim exception pauses the game and shows an error panel.
- A corrupt save is replaced with a fresh one, without crashing.

**Tests:**
- T1: water is conserved under lateral flow (sealed grid, no rain or ET).
- T2: a block raises `wt` upstream.
- T3: wet peat never ignites.
- T4: stars and pass lines are exact at the boundaries.
- T5: the same seed and actions give an identical end state.
- Plus calibration targets C1–C3 (section 2.6).

## 7. Out of scope for v1

- Backend and accounts.
- Multiplayer.
- Translations (strings are kept in one module).
- Mid-level saves.
- A full hydraulic model (Darcy flow with real conductivity values).
- CH4 and N2O, and DOC.

## 8. Open items

1. **0.4 m regulation text:** need the PP 57/2016 PDF to cite Art. 23. Until then the game cites fire risk at > 0.40 m from Ritzema 2014.
2. **44/12 conversion:** source it (IPCC 2006 Guidelines) before showing "t CO2". Until then show "t C".
3. **2019 Refinement:** check whether the 2019 Refinement changes wetlands organic-soil factors.
4. **Initial tuning numbers:** costs, times, `S_block`, `maxHeadTiles`, `k_*`. Set them through calibration tests C1–C3 and play testing.
