# Rewet

Rewet is a browser pixel-art game about peatland restoration. The player blocks drainage canals, rewets the peat, prevents fire, replants and helps local livelihoods. The game follows Indonesia's 3R framework: Rewetting, Revegetation, Revitalisation.

## Develop locally

You need:

- Python 3, to serve the files.
- Node.js 20 or later, to run the tests.

The game has no build step and no npm dependencies.

### Run the game

1. Start a static server in the repo root:

   ```bash
   python3 -m http.server 8765
   ```

2. Open http://localhost:8765 in a browser.

Do not open `index.html` from `file://`. Browsers do not load ES modules from `file://`.

### Run the tests

```bash
npm test                                   # all tests
node --test test/hydro.test.js             # one test file
node --test --test-name-pattern="C1" test/hydro.calibration.test.js   # one test by name
```

### Run a level without a browser

```bash
node scripts/sim-run.js --level 1 --plan test/fixtures/l1-cascade.json
```

## Project layout

| Path | Contents |
|---|---|
| `index.html` | Page layout and CSS |
| `src/sim/` | Simulation. Pure and deterministic, with no DOM access, so it runs under `node --test`. |
| `src/render/` | Canvas rendering. It only reads the game state. |
| `src/ui.js`, `src/main.js` | DOM UI and game loop |
| `test/` | Unit tests and calibration tests |
| `scripts/` | Command-line tools |
| `docs/` | Design spec, plan and sourced real-world values |

Read `CLAUDE.md` and the spec in `docs/superpowers/specs/` before you change gameplay.

## Deploy

Netlify serves the repo root as a static site (`netlify.toml`).
