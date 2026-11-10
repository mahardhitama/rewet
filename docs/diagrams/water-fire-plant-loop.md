# Water, fire and plant loop

The core gameplay loop of one sim tick: blocks raise the water table, wet peat does not burn, and seedlings grow only on wet peat. Source: `step()` in `src/sim/game.js`, `fireTick()` and `ignitable()` in `src/sim/fire.js`. Constants are named, not copied. Related: the gameplay spec `docs/superpowers/specs/2026-11-10-rewet-gameplay-design.md`.

```mermaid
flowchart TD
  A["applyAction: the player orders a job"] --> B["finish: tempBlock / permBlock / backfill"]
  A --> L["finish: plant (5x5 stamp) adds g.seedlings"]
  A --> K["finish: fireCrew / well"]
  B --> C["redrain: computeStrength + computeDistance give S"]
  C --> D["hydroTick: wt moves to the drained depth, weight S x exp(-dist/L)"]
  D --> E{"wt <= WET_WT ?"}
  E -- "yes: wet peat" --> F["ignitable() is false: the tile cannot burn"]
  E -- "yes: wet peat" --> M["inBand(wt): cover += SEEDLING_GROWTH, natural regrowth beside cover >= 0.6"]
  E -- "no: dry peat" --> G["fireTick: ignite with FIRE.base x env.dry x (wt - WET_WT)"]
  E -- "no: dry peat" --> O["seedling out of band for 12 ticks: it dies"]
  H["arson in the dry season: level.arson x (1 - goodwill / 100)"] --> I
  G --> I["onLit: cover = 0, seedlings lost, goodwill drops next to a village"]
  I --> J["fireTick: spread FIRE.spreadP (x2 downwind), smoulder re-flares on dry peat"]
  J --> G
  K -- "puts out" --> J
  L --> M
  M -- "more cover, more wildlife and stars" --> A
```
