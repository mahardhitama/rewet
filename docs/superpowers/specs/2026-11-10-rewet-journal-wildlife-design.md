# Rewet: canal network, journal and wildlife (design)

Date: 2026-11-10. Branch: `feat/procgen-map`. This spec adds to `2026-11-10-rewet-procgen-map-design.md`. That spec stays the authority for the map, the canal water and the view.

## 1. Intent

The user asked for these revisions:

1. A canal at the map edge must run to the edge. The side wall of the map shows the canal cut and the water depth.
2. Canals can join and split.
3. Trees, shrubs, seedlings and ferns have more variants.
4. All levels are open from the start. The game teaches, so the player picks the concept to learn.
5. A journal, drawn as a book, explains each concept.
6. On a restored (wetter, greener) map, more wildlife moves around. Only species of tropical peat swamp forest appear.
7. A click on a visible animal adds it to the journal.
8. The animals found are a game metric.

User decisions:

- Metric: a journal collection over all levels ("found X of N"), and a "species seen" line in each level report. It is not a pass line.
- Sources: research and cite each species and each concept fact now. Leave out a fact that has no source.
- Canal shapes: trunk merge, trunk fork and cross links.
- Journal access: the main menu and a HUD button. The HUD button pauses the level.

Success criteria:

- At each map edge, the canal cut shows in the side wall. The water in the cut is at the tile's `cWater` depth.
- A level can have merges, forks and links. The bed still falls at each step toward the outlet. C1, C2 and C3 pass with no tolerance change.
- Each vegetation type has 4 variants, picked by `hash(i)`.
- A new save and an old save both open all levels.
- The journal opens from the menu and from the HUD. It works with the keyboard and with touch. Each fact has a source ID.
- Animals appear only on tiles that meet their habitat rule. A same seed and the same actions give the same animals.
- A click on an animal with no action selected adds the animal to the journal. The level result does not change.

## 2. Canal ends at the map edge (render)

- A canal tile on a map edge has an arm to that edge when the canal continues off the map. The trunk inlet (high edge) and the trunk outlet (outlet edge, or the river) continue off the map.
- The side wall below that tile shows a notch: the bank, the wet bed, and the water surface at `cWater` below the bank. The notch depth uses the same pixel scale as the canal sprite.
- The notch is part of the cached canal sprite set. Add an edge key to the existing canal sprite key.

## 3. Canal network (mapgen)

New `level.map` fields, default 0:

| Field | Meaning |
|---|---|
| `merges` | number of trunk pairs that join into one trunk before the outlet |
| `forks` | number of trunks that split into two arms; both arms reach the outlet |
| `links` | number of short connector canals between two neighbouring trunks |

Rules:

- **Merge:** two neighbouring trunks run at least 4 tiles apart in the upper part. In the lower part, one trunk turns toward the other and joins it. From the join to the outlet there is one trunk. The bed at the join is lower than the bed of both arms.
- **Fork:** a trunk splits at a tile in its middle 60%. Each arm goes on to the outlet edge, at least 3 tiles from the other arm at the edge. Each arm bed falls at each step.
- **Link:** a straight connector, 3 to 8 tiles, on one row between two trunks. Its bed falls from the end at the higher trunk bed to the end at the lower trunk bed. Size: branch size.
- Every canal tile keeps a downhill neighbour (the `canal bed falls toward the outlet` test). `walkUp()` and the hydro model do not change.
- `blockPlan(level)` must still pass each level, and no action must still fail. Tune seeds and map fields as before. Record the values in section 8 of the procgen spec.

## 4. Vegetation variants (render)

- 4 variants for each of `FERN`, `SEEDLING`, `SHRUB` and `TREE`. Tree variants: a tall emergent tree with a high crown, a broad round crown, a pandan-like form with long leaves, and a young tree.
- `variant = hash(i) % 4`. The sprite cache grows from 8 to 16 vegetation sprites.
- Plant forms are art. They do not claim a species, so they need no source.

## 5. All levels open

- `DEFAULT_SAVE.unlocked = MAX_LEVEL`. `src/save.js` sets `unlocked` to `MAX_LEVEL` when it loads an older save.
- Stars stay and still record the best result. The level select shows all levels as open.

## 6. Journal

- A DOM overlay styled as a two-page book (pixel border, page spread). On a narrow screen, it shows one page at a time.
- Sections:
  - **Concepts:** the 3R framework, canals and drainage, the 0.4 m water rule, block cascades, fire, subsidence and carbon, revegetation, paludiculture, livelihoods.
  - **Wildlife:** one page per species. A found species shows its sprite, its names, its status and one fact. A species not yet found shows a silhouette and "not found yet".
- The header shows "Wildlife found X of N".
- Content is in `src/journal.js` as data: `{ id, title, body, sources: [refId] }`. Each `refId` points to an entry in `docs/references/`. A fact with no source is not in the journal.
- Controls: Left and Right arrows turn pages, Esc closes, Tab moves between controls. Buttons are at least 44×44 CSS px with a focus ring.
- The HUD button opens the journal and pauses the level. On close, the previous speed returns.
- A button that can be pressed during the intro calls `stopPropagation()`.

## 7. Wildlife

### 7.1 Species

- The species list and each habitat cue come from `docs/references/peat-swamp-wildlife.md`. Use only species with a source there.
- Each species has a habitat rule in game values (`NOT SOURCED`), for example `cover ≥ 0.6 and wt ≤ 0.4`, or "a canal or a river tile". Put the rules in one table in `src/sim/fauna.js`.

### 7.2 Simulation (`src/sim/fauna.js`, pure)

- `faunaTick(g)` runs once a week (each 4 ticks). It uses its own RNG, `mulberry32(world.seed ^ FAUNA_SALT)` with `FAUNA_SALT = 0xfa07a`. It never calls `world.rng`.
- Spawn: for each species, the number of suitable tiles sets a target count, with a cap per species and a cap of 24 animals in total. A new animal appears on a random suitable tile at a map edge or in a forest patch.
- Move: an animal steps to a random suitable neighbour tile. An animal on an unsuitable tile, or within 2 tiles of fire, leaves at the map edge or disappears.
- State: `g.fauna = [{ id, species, i, born }]`. `g.seen` is a `Set` of species seen in this level run (on the map at least once).
- Fauna does not change hydro, fire, cover or the score. `evaluate()` adds `speciesSeen` for the report only.

### 7.3 Render and input

- Small animal sprites (about 8 to 16 px), drawn after vegetation, with a slow idle step. Culled like tiles.
- A tap or click on an animal with no action selected marks the species as found. The hit area is at least the 44 px touch target around the sprite. When an action is selected, the click goes to the tile as now.
- First find of a species: a toast "New in your journal: <name>" with a button that opens its page.
- Found species are in the save (`save.found`, a list of species IDs) through `src/save.js`. The sim state does not hold them.

### 7.4 Metric

- Level report: "Species seen: K" and the names.
- Journal and main menu: "Wildlife found X of N".

## 8. Architecture

| Unit | Change |
|---|---|
| `src/sim/mapgen.js` | merges, forks, links |
| `src/sim/fauna.js` | new: species rules, `faunaTick` |
| `src/sim/game.js` | call `faunaTick`; `g.fauna`, `g.seen` |
| `src/sim/score.js` | `speciesSeen` in `evaluate()` |
| `src/render/iso.js` | edge notch, plant variants, animal sprites, animal hit test |
| `src/journal.js` | new: journal data |
| `src/ui.js`, `src/main.js`, `index.html`, `src/strings.js` | journal overlay, HUD button, toast, report line |
| `src/save.js` | `unlocked = MAX_LEVEL`, `found` |
| `docs/references/peat-swamp-wildlife.md` | new: sourced species list |

## 9. Testing

- mapgen: merges, forks and links appear when asked; every canal tile has a downhill neighbour; links touch two trunks; same seed gives the same map.
- levels: each level passes with `blockPlan` and fails with no action. C1 to C3 pass.
- save: an old save loads with all levels open and `found = []`.
- fauna: same seed and actions give the same `g.fauna`; `faunaTick` does not change `world.rng`; animals stand only on suitable tiles; no animal within 2 tiles of fire; a wet, green map has more animals than a dry, bare map.
- journal: each entry has at least one source ID, and each source ID exists in `docs/references/`.
- Browser: journal at 390×844 and 1280×800; animal click; edge notch in the dry and wet season.

## 10. Open items

- The species list depends on the research. If fewer than 6 species have sources, the journal shows fewer.
- Habitat rules are game values, `NOT SOURCED`.
