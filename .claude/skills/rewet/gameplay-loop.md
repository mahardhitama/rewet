# Gameplay loop

Source of truth: spec sections 3 to 5 (`docs/superpowers/specs/2026-11-10-rewet-gameplay-design.md`).

## Map of the loop

| Part | Where |
|---|---|
| Actions (cost, weeks, 3R group, validity) | `ACTIONS` in `src/sim/game.js` |
| Tick order (season, jobs, hydro, fire, threats, growth, year end) | `step()` in `src/sim/game.js` |
| Events for UI and sound | `g.events`, drained in `tickLevel()` in `src/main.js` |
| Goals and score | `src/sim/score.js` |
| Levels | `src/levels.js` |
| Action buttons | `src/ui.js` builds them from `ACTIONS`, grouped by `r` |
| Text | `src/strings.js` (`ACTION_TEXT`, `REASON`, `HINTS`) |

## Procedure for a new or changed rule

1. Brainstorm with the user (`superpowers:brainstorming`). Agree on the purpose and the starting numbers. Do not pick balance numbers alone.
2. Copy the pattern of the nearest existing action. Example: a per-village action copies `fireGroup`.
3. Keep determinism. A new `rng()` call on the default path changes every seed. Put new chance rolls behind the condition that needs them, so old seeds and fixtures stay the same.
4. Write tests first: validity, the effect, and "same seed without the new action gives the same state as before".
5. Check balance headless with `node scripts/sim-run.js --level N --plan <plan.json>`.
   - Save each plan you use as a fixture in `test/fixtures/` (see `l1-cascade.json`, `l1-reveg.json`).
   - Compare a plan with the new rule against a plan without it.
   - The new rule must not replace rewetting. A run with no blocks must not pass a level.
6. Update spec section 3 (action table) and section 8 (open items) with the tuned numbers and the runs that set them.
7. A game-tuning number that is not from the real world is not a sourced value. Say so in section 8. Real-world claims go through `methodology.md`.
