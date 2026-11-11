# Rewet: work crews at action points, implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the player orders an action, 1 to 3 people walk to the tile, work there with a pose that fits the action, and walk away when the job ends. The people fade in while they walk in and fade out while they walk away. Each village tile with a fire group gets a guard who stands at the post.

**Architecture:** Render only. The crews read `game.jobs` and `game.fireGroups` and change no game state. `src/sim/*` does not change, so the calibration tests and the save do not change. All new code goes in `src/render/iso.js`, next to the animal code that it copies (`ANIMALS`, `animalSprite`, `slideState`, `fadeAlpha`).

**Tech Stack:** Plain ES modules, canvas `fillRect` art, `node --test`. No build step, no dependencies.

**Spec:** This plan holds the design (section "Design"). The change is display only, so it has no separate spec file.

## Global Constraints

- Invoke the `rewet` skill first. Read `sprites.md`, `workflow.md` and `ste100-lint.md`. Use STE100 for docs, comments and commits.
- `src/sim/*` does not change. The crews never call `applyAction()` and never write to `game`.
- All art is drawn with `fillRect`. A person sprite goes in a cache, as `animalSprite()` does. No image files.
- The data view (`D` key) shows no crews.
- With `prefers-reduced-motion`, a crew does not walk and uses frame 0 only. The fade stays, because a fade is not motion.
- `npm test` passes after each task.

## Design

### Crew size and poses for each action

Each job gets a crew of a fixed size range. A hash of the job key picks the size in the range. Each person gets 1 pose from the pose list of the action. Each pose has 2 frames.

| Action (`ACTIONS` id) | Crew size | Poses (1 per person, picked by hash) |
|---|---|---|
| `tempBlock` (sandbag block) | 2 to 3 | carry a sack on the shoulder; bend and stack a sack; stamp the sacks flat |
| `permBlock` (plank block) | 2 to 3 | swing a hammer; carry a plank; hold a post upright |
| `backfill` | 3 | dig with a shovel; throw peat from the shovel; push a wheelbarrow |
| `well` (fire well) | 1 to 2 | push the pump handle up and down; hold the pipe upright; kneel at the hose |
| `plant` | 2 to 3 | kneel and set a seedling; make a hole with a planting stick; carry a seedling tray |
| `mound` | 1 to 2 | dig with a hoe; kneel and pat the mound |
| `palud` (paludiculture plot) | 1 to 2 | dig with a hoe; carry a basket on the head; kneel and pull weeds |
| `pond` (fish pond) | 2 | throw a net; scoop with a bucket; dig with a shovel |
| `fireCrew` | 3 | spray a hose with a water arc; beat the flames with a fire beater; spray from a backpack pump |
| `fireGroup` (build) | 2 | raise the post; swing a hammer |
| Guard (finished `fireGroup`) | 1 | stand; look left and right; walk 2 px to and fro; shade the eyes with a hand |

Clothes: each person gets 1 of 4 palettes (shirt, trousers, hat). The hat is a wide straw hat, a cap, a head scarf or no hat. The fire crew always wears a yellow shirt and a helmet, so the player sees fire work at a glance.

### Where the people stand

- The job tile gets up to 3 spots around its centre: centre, left and right, each with a hash offset of ±2 px. The `plant` job puts its people on different tiles of its `tiles` list.
- A person walks in a straight screen line from a start point to the spot. The start point is 2 tiles from the spot, in the direction of the nearest village tile. With no village on the map, the start point is 2 tiles toward the bottom of the screen.
- A person faces the direction of the walk. At work, a person faces the tile centre. A mirror of the sprite gives the other direction.

### Life of a crew

1. **Walk in**, 800 ms. The alpha goes from 0 to 1 in the first half of the walk. The walk uses 2 leg frames.
2. **Work.** The person loops the 2 frames of the pose, 1 frame each 300 ms, with a hash phase.
3. **Walk away**, 800 ms, when the job leaves `game.jobs`. The alpha goes from 1 to 0 in the second half of the walk. The walk turns back from the point where the person stands now.
4. The render state of the crew is deleted when the walk away ends.

Minimum stay: a crew works at least 600 ms before it walks away. At speed 4, a 1-week job lasts about 360 ms, so without this rule the crew turns around before it arrives. The crew is display only, so a late exit changes nothing in the game.

The job key is `id:i:doneAt`. A `fireCrew` job has `doneAt = Infinity`, so its key is `fireCrew:i:Infinity`, which is unique while the fire burns. When a fire stops a build job on the same tile, the build crew walks away and the fire crew walks in.

### Guards

Each tile in `game.fireGroups` gets 1 guard next to the red post. The guard fades in when the `fireGroup` job ends and stays. The guard changes pose every 4 s to 6 s (hash phase), so 2 guards do not move together.

### Draw order and taps

- The people join the animal pass in `drawWorld()`. That pass sorts by the drawn y, so a person behind a tree stays behind it.
- People are not tappable. They add no entry to `hits`.
- The work flag stays. It marks the job when the map is zoomed out, and while the crew is faded.

### Not in this plan

- No new sounds. The existing sim event sounds stay.
- No path finding. A person walks in a straight line over canals and plants.
- No crew for the player cursor or for the action preview.

## Review Focus

1. A job that ends at speed 4 before the walk in ends: the crew still arrives, works at least 600 ms, then walks away. No person jumps.
2. A fire that stops a build job: the build crew walks away and the fire crew walks in. No person stays on the map after both jobs end.
3. A level restart or a level change clears all crew state. No crew from the old level fades out on the new map.
4. The data view shows no person. Reduced motion shows no walk.
5. 5 jobs and 6 guards at the same time: the frame time does not change by a visible amount.

---

### Task 1: Person sprites and pose table

**Files:**
- Modify: `src/render/iso.js` (new `PEOPLE`, `POSES`, `personSprite()` next to `ANIMALS` and `animalSprite()`)
- Test: `test/iso.test.js`

- [ ] **Step 1: Write the failing tests.** Each pose in `POSES` has 2 frames. All frames have the same row count and no row is wider than the sprite size `PS`. Each character in a row is `.` or a key of the palette. Each action id in the design table, and `guard` and `walk`, has a pose list with the number of poses that the table gives.
- [ ] **Step 2: Run** `node --test test/iso.test.js`. Expect the new tests to fail.
- [ ] **Step 3: Implement.** Use the row-string format of `ANIMALS`. Palette keys: `k` skin, `s` shirt, `p` trousers, `h` hat, plus fixed keys for tools (`t` wood, `m` metal, `w` water, `g` seedling green, `b` sack). `personSprite(pose, frame, pal, flip)` builds a canvas the first time, then keeps it in a `Map`. Size: `PS = 12` (a person is about 10 px tall, smaller than a tree crown).
- [ ] **Step 4: Run** `npm test`. Expect a pass.
- [ ] **Step 5: Commit** `feat(render): add person sprites and work poses`.

### Task 2: Crew plan for a job

**Files:**
- Modify: `src/render/iso.js` (new pure `crewPlan(job, w, h, kind)`)
- Test: `test/iso.test.js`

- [ ] **Step 1: Write the failing tests.**
  - The crew size is in the range of the design table for each action id.
  - The same job gives the same plan on each call.
  - 2 tiles with the same action get different plans for at least 1 of 20 tile pairs.
  - A `plant` job with 3 tiles puts its people on different tiles.
  - The start point is 2 tiles from the spot, toward the nearest village tile. With no village, it is toward the bottom of the screen.
- [ ] **Step 2: Run** `node --test test/iso.test.js`. Expect the new tests to fail.
- [ ] **Step 3: Implement.** Use `hash()` with the job key and the person index. Return `[{ tile, pose, pal, ox, oy, from: [tx, ty] }]`, with tile coordinates, not screen pixels. `drawWorld()` changes them to screen pixels with `pos`.
- [ ] **Step 4: Run** `npm test`. Expect a pass.
- [ ] **Step 5: Commit** `feat(render): plan the crew of each job`.

### Task 3: Crew life state

**Files:**
- Modify: `src/render/iso.js` (new `crews` map, pure `crewState()` and `crewPhase()`, `resetSlides()` also clears `crews`)
- Test: `test/iso.test.js`

- [ ] **Step 1: Write the failing tests.**
  - A new job: alpha 0 at `now`, 1 at `now + 400`, walk progress 1 at `now + 800`.
  - A job that leaves `game.jobs` at `now + 200`: the crew keeps walking in, works until `now + 1400` (800 ms walk and 600 ms stay), then walks away. Alpha is 0 at `now + 2200`.
  - The state entry is deleted after the walk away ends.
  - `resetSlides()` clears the crew state.
- [ ] **Step 2: Run** `node --test test/iso.test.js`. Expect the new tests to fail.
- [ ] **Step 3: Implement.** Copy the shape of `slideState()`: a `Map` from job key to `{ plan, seenAt, leaveAt, f }`, a frame number to find jobs that left, and a `map` argument for the tests. Use `slidePos()` for the walk position.
- [ ] **Step 4: Run** `npm test`. Expect a pass.
- [ ] **Step 5: Commit** `feat(render): walk crews in and out of jobs`.

### Task 4: Draw the crews

**Files:**
- Modify: `src/render/iso.js` (`drawWorld()`, the animal pass)

- [ ] **Step 1: Implement.** In the animal pass, add 1 draw entry for each crew person. Give each entry a sprite field, so the sort and the draw loop serve animals and people. Skip all people in the data view. Use frame 0 and no walk when `REDUCED` is true. Add no entry to `hits`.
- [ ] **Step 2: Run** `npm test`. Expect a pass.
- [ ] **Step 3: Check in the game.** Serve with `python3 -m http.server 8765`. Open level 1. Order a temporary block, planting and a well. Take screenshots at scale 3 and at scale 2 (width below 600 px). Check the walk in, the work loop, the walk away and the fades at speed 1 and speed 4.
- [ ] **Step 4: Commit** `feat(render): draw work crews at job tiles`.

### Task 5: Guards at fire group posts

**Files:**
- Modify: `src/render/iso.js` (`drawWorld()`, guard entries from `game.fireGroups`)
- Test: `test/iso.test.js`

- [ ] **Step 1: Write the failing test.** A guard pose changes at least once in 6 s. 2 guards on different tiles do not have the same pose at the same time for the full 6 s.
- [ ] **Step 2: Run** `node --test test/iso.test.js`. Expect the new test to fail.
- [ ] **Step 3: Implement.** Put each guard next to the red post (`sx + 12`). Use the guard key `guard:i` in the crew state map, so the guard fades in once.
- [ ] **Step 4: Run** `npm test`. Expect a pass.
- [ ] **Step 5: Check in the game.** Order a fire group on a village tile. Check that the guard fades in when the job ends and stays after a save and a load.
- [ ] **Step 6: Commit** `feat(render): add guards at fire group posts`.

### Task 6: Review and finish

- [ ] **Step 1:** Do a review with `superpowers:requesting-code-review`. Use the 5 items in "Review Focus".
- [ ] **Step 2:** Do `superpowers:verification-before-completion`: `npm test` and the checks in the game.
- [ ] **Step 3:** Update `.claude/skills/rewet/sprites.md`: add the person sprites and the crew life to "How sprites work".
- [ ] **Step 4:** Merge with `superpowers:finishing-a-development-branch`.
