# Water, fire and plant loop

How water, fire and plants affect each other in Rewet, in plain words for players. The code version of this loop is `step()` in `src/sim/game.js`. Related: the gameplay spec `docs/superpowers/specs/2026-11-10-rewet-gameplay-design.md`.

```mermaid
flowchart TD
  A["You block the canals"] --> B["Less water drains away"]
  B --> C["The water in the peat rises"]
  C --> D{"Is the peat wet?<br/>(water within 40 cm of the surface)"}
  D -- "yes" --> E["Wet peat does not burn"]
  D -- "yes" --> F["Seedlings and forest grow"]
  D -- "no" --> H["Seedlings die"]
  D -- "no" --> G["Dry peat can catch fire,<br/>mostly in the dry season"]
  L["You plant seedlings"] --> F
  F --> W["More forest, more wildlife,<br/>more stars"]
  I["People start fires.<br/>Fewer when villagers trust you"] --> J
  G --> J["Fire burns the plants<br/>and spreads with the wind"]
  K["You send fire crews<br/>and dig wells"] -- "put out" --> J
  J --> X["Forest and stars are lost"]
```

Render: [water-fire-plant-loop.png](water-fire-plant-loop.png)
