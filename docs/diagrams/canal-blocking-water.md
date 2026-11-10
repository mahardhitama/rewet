# Canal blocking and the water table

How an open canal drains the peat, how each block type changes that, and how the water rises with distance and time. Plain words for players. Code: `DRAIN` in `src/sim/drainage.js`, `hydroTick()` and `HYDRO` in `src/sim/hydro.js`, `finish()` in `src/sim/game.js`. Boxes marked "field data" come from Ritzema et al. 2014 (`docs/references/peat-hydrology-and-emissions.md`). All other numbers are game values.

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 320}}}%%
flowchart TD
  subgraph BAU["Business as usual"]
    A["Canal left open"] --> B["The canal drains<br/>at full strength"]
    B --> C["The water table drops most<br/>near the canal. Dry season:<br/>0.9 m deep at 10 m,<br/>0.35 m deep at 400 m<br/>(field data)"]
    C --> D["Dry peat burns and sinks"]
  end
  subgraph BLK["Blocked canal"]
    F{"Which block?"}
    F -- "temporary, cheap" --> G["Keeps about 35%<br/>of the drainage.<br/>Can wash out<br/>in the wet season"]
    F -- "permanent" --> H["Keeps about 10%<br/>of the drainage.<br/>Stays in place"]
    F -- "backfill" --> I["The canal becomes peat.<br/>No drainage"]
    G -- "upgrade" --> H
    G --> J["One block protects up to<br/>6 canal tiles (300 m) upstream.<br/>A long canal needs<br/>a chain of blocks"]
    H --> J
    I --> J
    J --> K["Week by week the water rises:<br/>most near the canal, less with<br/>distance, no effect past 400 m.<br/>Mean water table: 1.12 m deep<br/>before, 0.37 m after (field data)"]
    K --> M{"Water above<br/>the surface?"}
    M -- "yes" --> N["Build a mound:<br/>it lifts the tile 20 cm"]
    M -- "no" --> O["Plant: seedlings<br/>grow in wet peat"]
    N --> O
  end
  D -- "you block the canal" --> F
```

Render: [canal-blocking-water.png](canal-blocking-water.png)
