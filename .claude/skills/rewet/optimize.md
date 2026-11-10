# Code and performance optimization (ponytail)

**REQUIRED SKILLS:**
- `ponytail:ponytail` for each change: the smallest change that fully solves the problem.
- `ponytail:ponytail-review` on the diff before you commit.
- `ponytail:ponytail-audit` when the user asks for "what can I delete" or a whole-repo review.

## Measure first

Do not change code for speed before you measure.

1. Sim cost: time `step()` headless with a scratch script in the scratchpad, not in the repo. Baseline on level 6 (40×40): about 0.17 ms average and 1.2 ms maximum per step. At ×2 the game runs well below 1 tick per frame. The sim is rarely the cause of frame drops.
2. Frame cost: serve the game, open the level, set the speed, and record a Chrome Performance trace for 10 s. Compare `drawWorld`, `renderUI`, style and layout.
3. If no frame takes more than 16 ms, the cause is not the code. Ask the user for the device and browser.

## Known suspects (check, do not assume)

- `drawWorld()` in `src/render/iso.js`: work per tile per frame, new arrays or sets per frame.
- `renderUI()` in `src/ui.js`: DOM writes and `querySelectorAll` per frame when no value changed.

## What must stay true

1. `src/sim/**` gives the same result for the same seed and actions. Run `npm test`, which includes C1 to C3 and `loop.test.js`.
2. `node scripts/sim-run.js --level 1 --plan test/fixtures/l1-cascade.json` prints the same output before and after.
3. The picture does not change: compare screenshots with the same seed and tick (normal view, data view, hover, fire).
4. Show the before and after numbers. Without numbers, do not say "faster".
