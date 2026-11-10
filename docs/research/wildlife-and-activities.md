# Wildlife and activities: research note

Status: research only. No code. This note supports spec section 5 (`docs/superpowers/specs/2026-11-10-rewet-procgen-map-design.md`).

## Sourcing status

No source was opened for this note. Each species, behaviour and real-world number is `NOT SOURCED`. A species name is a candidate to research. It is not a fact. Do not put any of it in player-facing text before it is sourced (`.claude/skills/rewet/methodology.md`).

Local source: `docs/references/` has no wildlife file. Ask the user for a local copy of a species or habitat report. Use web search only if the user has no copy.

## Ground rules for all options

- Agents are render-only. They read the game state and never write it. `applyAction()` stays the only way to change the state.
- Agents never use `world.rng`. A draw from it changes the fire and arson sequence, and then the saved fixtures and the calibration tests change.
- Each option uses its own salted `mulberry32`, in the same way as the vegetation roll (`VEG_SALT = 0x5eed`, `mulberry32(seed ^ VEG_SALT)` in `src/sim/mapgen.js`).
  - Wildlife: `mulberry32(seed ^ 0xfa07a)` (name `FAUNA_SALT`).
  - Activities: `mulberry32(seed ^ 0xac71)` (name `ACT_SALT`).
- Prefer a stateless hash of (`seed`, tile, week) over a stored stream. Then a camera pan or a reload shows the same animals.
- The sim stays pure. Put the code in `src/render/`. Do not import from `src/render/` in `src/sim/`.
- Draw with `fillRect`, in the sprite cache style of `src/render/iso.js`. No image or audio assets.
- Every agent must teach one cause and effect. An agent with no link to a sim state is decoration. Skip it.

## Option 1: habitat presence (wildlife that appears or goes away)

- **Player sees:** small animal sprites (candidates: hornbill, primate, kingfisher; `NOT SOURCED`) on tiles of dense cover. They are rare on fern tiles and absent on burnt tiles. More appear as cover grows.
- **Sim state read:** `world.cover` through `vegOf()` (`TREE` and `SHRUB` tiles), `world.wt` against `WET_WT`, `world.fire`.
- **Teaching value:** revegetation and rewetting bring life back. Fire removes it. The player gets slow, visible feedback on the cover goal.
- **Cost:** a new `src/render/fauna.js` (about 80 lines) and one call in `drawWorld()`. About 3 small sprites. No sim change.
- **RNG:** yes, `FAUNA_SALT`, as a stateless hash per tile per week.
- **Sourcing needed:** which species live in the peat swamp forest of Central Kalimantan, and what cover and water they need. `NOT SOURCED`.

## Option 2: aquatic life in canals and ponds

- **Player sees:** fish ripples and shadows in a canal where the water is high. A drained canal shows none. Ponds show more.
- **Sim state read:** `world.cWater` and `world.cDepth` (the `canalStep()` level in `src/render/iso.js`), `game.S` against `DRAIN.canal` (tiles behind a block), `game.ponds`, `game.block`.
- **Teaching value:** a block raises the canal water and so gives fish a habitat. This links rewetting to the revitalisation goal (the `pond` action).
- **Cost:** about 40 lines in `fauna.js` plus one ripple sprite. No sim change.
- **RNG:** yes, `FAUNA_SALT`.
- **Sourcing needed:** fish species of peat canals and ponds, and the link between a block and fish stock. `NOT SOURCED`.

## Option 3: villagers and livelihood activity

- **Player sees:** small figures that walk from a village tile to a paludiculture tile or a pond. They harvest or fish and walk back. More figures appear as goodwill rises.
- **Sim state read:** `game.paluds` and `game.ponds`, `world.kind` (`KIND.VILLAGE`, `KIND.FARM`), `game.goodwill`, `world.wt` (a palud tile with `wt <= WET_WT` pays funds).
- **Teaching value:** rewetted land still gives income (`step()` pays funds at each year end for each wet palud tile). The figures make this income visible.
- **Cost:** about 100 lines. Walkers need a path on the tile grid. Use a straight line with a step around canals. The figures keep their position in a render-side array, not in the game state.
- **RNG:** yes, `ACT_SALT`, for the start time and the route.
- **Sourcing needed:** which paludiculture crops and fish activities real villages use, and who does the work. `NOT SOURCED`. Do not assume a gender or an age for the figures.

## Option 4: fire, smoke and crews

- **Player sees:** smoke columns over burning tiles. Fire crews walk to a fire. Haze thickens as the dry season peaks. Wind bends the smoke.
- **Sim state read:** `world.fire` (1 surface, 2 smouldering), `world.fireT`, `game.wind`, `game.jobs` (`fireCrew`), `seasonAt().dry`, `game.fireGroups`.
- **Teaching value:** smouldering fire on dry peat is hard to see and lasts long. Smoke shows the player where the fire still burns after the flames end.
- **Cost:** about 60 lines. Smoke is a few moving `fillRect` puffs per burning tile. Cap the puffs per frame (`optimize.md`).
- **RNG:** yes, `ACT_SALT`, for puff drift only. The fire itself stays in `fireTick()` on `world.rng`.
- **Sourcing needed:** none for the visual. Any text on smoke or haze health effects `NOT SOURCED`.

## Option 5: illegal logging and canal digging

- **Player sees:** a figure with a tool that walks along an illegal canal while it grows. It leaves when the player places a block on the path.
- **Sim state read:** `game.illegal` (next path index per canal, `-1` when stopped), `game.level.illegalCanals`, `world.block`, `game.goodwill`.
- **Teaching value:** new canals drain peat again. The figure shows that the threat is active and that a block stops it.
- **Cost:** about 50 lines. The path already exists in the level data, so the figure follows `g.illegal[c]`.
- **RNG:** none needed. The figure position is a function of `g.illegal`.
- **Sourcing needed:** how real illegal logging uses canals. `NOT SOURCED`. The topic is sensitive: do not show a real group as the culprit.

## Option 6: seasonal flood and dry-season cues

- **Player sees:** birds gather at wet tiles in the dry season. Tiles with `wt <= WET_WT` show standing water in the wet season. Dry tiles show cracks and dust.
- **Sim state read:** `seasonAt(tick).dry`, `world.wt`, `game.tick`.
- **Teaching value:** the player reads the season and the water table without the heat map.
- **Cost:** about 40 lines. It overlaps with Option 1.
- **RNG:** yes, `FAUNA_SALT`.
- **Sourcing needed:** the real flood and dry pattern for the setting. `NOT SOURCED`.

## Comparison

| Option | Lines (rough) | Sim change | New RNG | Main teaching |
|---|---|---|---|---|
| 1 habitat presence | 80 | none | `FAUNA_SALT` | cover and wet tiles bring wildlife back |
| 2 aquatic life | 40 | none | `FAUNA_SALT` | a block raises canal water |
| 3 villagers | 100 | none | `ACT_SALT` | rewetted land gives income |
| 4 fire and smoke | 60 | none | `ACT_SALT` | smouldering peat keeps burning |
| 5 illegal logging | 50 | none | none | a block stops a new canal |
| 6 seasonal cues | 40 | none | `FAUNA_SALT` | wet and dry season show on the map |

## Recommendation

Build Option 4 first and Option 1 second.

- Option 4 needs no species source. Its state already exists, and it fixes a real gap: smouldering fire is easy to miss.
- Option 1 has the strongest link to the three goals. Build it after the species list has a source.
- Option 2 follows Option 1 with the same sprite code.
- Option 3 needs the most code and the most sourcing. Do it last.

Before you build, tell the user that animals give feedback only. They do not change the sim. Score and funds stay the same.

## Open sourcing items

1. Species list for the peat swamp forest and its canals in Central Kalimantan. `NOT SOURCED`.
2. Habitat needs of each species: cover, water-table depth, season. `NOT SOURCED`.
3. Fish stock change after a canal block. `NOT SOURCED`.
4. Real village livelihoods on rewetted peat (paludiculture crops, fish ponds). `NOT SOURCED`.
5. How illegal logging uses canals. `NOT SOURCED`.
6. Newer-edition check for each source, recorded in `docs/references/`.
7. Any figure that names a real group or role: review with the user first.
