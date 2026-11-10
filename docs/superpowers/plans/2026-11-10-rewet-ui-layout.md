# Rewet UI layout rework: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centre and restyle the HUD, the action bar, the menus and the reports, add pixel icons, and move the intro to the map generator and the level renderer.

**Architecture:**
- Text size and colour tokens on `:root`.
- A new pure icon module turns 12×12 pixel strings into inline SVG.
- The UI code in `src/ui.js` and `src/main.js` builds the new HUD parts, the hotbar slots and the metric tables from `src/strings.js`.
- A new render-only story module builds an intro world with `buildLevelWorld` and changes it over story time. The existing map view draws it.

**Tech Stack:** plain ES modules, DOM, canvas 2D, inline SVG. Tests run on `node --test`. No dependencies and no build step.

**Spec:** `docs/superpowers/specs/2026-11-10-rewet-ui-layout-design.md`

## Global Constraints

- No npm dependencies, no build step, no image or audio files.
- `src/sim/*` does not change. C1, C2 and C3 pass with no tolerance change. `npm test` passes after each task.
- All visible text is in `src/strings.js`. The text of existing lines does not change, except the split into a label and a value (spec section 6).
- Fonts: Silkscreen and VT323 only. Each `font-size` in `index.html` uses `var(--fs-label)`, `var(--fs-body)`, `var(--fs-head)` or `var(--fs-title)`. The exceptions are the phone step (`--fs-body: 20px` at max-width 600px) and the canvas chart font.
- Spacing values in new or changed CSS come from the 4 px scale: 4, 8, 12, 16, 24 and 32 px.
- Each button and each slot is at least 44×44 CSS px.
- Each control works with the keyboard and shows a focus ring. A button that can be pressed during the intro calls `e.stopPropagation()`.
- The canvas art is drawn with `fillRect` only. Icons are DOM SVG with `shape-rendering="crispEdges"`.
- Docs, comments and commit messages follow STE100. Each commit message ends with `Claude-Session: https://claude.ai/code/session_0122Eb6A4L6KroW9bbCsS8j2`.
- Stage files by name. Make one commit for each task.
- Browser checks use 390×844, 1280×800 and 844×390. Save the screenshots under the scratchpad folder that the dispatch names.

## Review Focus

1. Long HUD values (funds 5 digits or more, the "–" dry score, the "Data view" and "Map view" text change) at 390 px. The bar must not wrap into a third line and must not scroll. Test: Task 2 browser step with funds set to 123456 through `?debug`.
2. Focus order and the focus ring on the new slots and icon buttons. Space on a focused slot selects it and does not pause. Test: Task 3 browser step.
3. Short landscape 844×390. The HUD row, the hotbar and the zoom buttons must leave a map band of at least 40% of the height. Test: Task 3 browser step that measures `innerHeight - hud.bottom - bar.height`.
4. The intro under change: a resize in the middle of the story, Skip, "Replay intro" from Settings (no instant skip), and reduced motion. Test: Task 6 browser steps.
5. The find toast, which sits above the bar, and the journal from the HUD still work with the taller bar. Test: Task 3 browser step: a tap on an animal shows the toast above the slots, and it does not cover them.

---

### Task 1: Tokens, icons, buttons and centred panels

**Files:**
- Create: `src/icons.js`, `test/icons.test.js`
- Modify: `index.html` (tokens, `.btn`, `.jb`, `#findOpen`, `#skip`, panel position, every `font-size`), `src/main.js` (icons on the static buttons and the level select buttons), `src/journalView.js` (icons on `.jb`)

**Interfaces:**
- Produces:
  - `ICONS`: an object from name to 12 strings of 12 characters each.
  - `iconRects(name)`: returns `[{ x, y, w, fill }]`, one rect for each run of the same character in a row. `fill` is `'currentColor'` for `#`, or the hex from `PAL` for another letter.
  - `icon(name, px = 24)`: returns an `<svg>` with `viewBox="0 0 12 12"`, `width` and `height` set to `px`, `shape-rendering="crispEdges"` and `aria-hidden="true"`.
  - `PAL`: fixed colours for letters, for example `g` (leaf green) and `b` (bark brown).
  - `withIcon(button, name)`: puts the button's current text in a `<span class="t">`, adds `<span class="tree">` with `icon('tree')` on the left and the purpose icon on the right. It returns the button.
- Icon names: all names in spec section 3.

- [ ] **Step 1: Write the failing test** in `test/icons.test.js`:
  - each `ICONS` entry has 12 rows, and each row has 12 characters;
  - each character in a row is a space, `#`, or a key of `PAL`;
  - each name listed in spec section 3 is in `ICONS`;
  - `iconRects('tree')` deep-equals a second call;
  - the sum of the `w` values in `iconRects(n)` equals the count of non-space characters in `ICONS[n]`, for each `n`.
- [ ] **Step 2: Run** `node --test test/icons.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `src/icons.js`.** `icon()` uses `document.createElementNS`. Only `icon()` and `withIcon()` touch the DOM, so the test does not call them. Draw the icons as 12×12 pixel art that reads at 24 px. The tree icon has a round crown on a trunk, coloured with `PAL.g` and `PAL.b`.
- [ ] **Step 4: Run** `node --test test/icons.test.js`. Expected: PASS.
- [ ] **Step 5: CSS in `index.html`.**
  - Add `--fs-label`, `--fs-body`, `--fs-head` and `--fs-title` to `:root`, with the spec values. Add the phone step in the max-width 600px rule.
  - Replace each `font-size` with a token.
  - `.btn` becomes `display:grid; grid-template-columns:24px 1fr 24px; align-items:center; gap:8px; text-align:center`.
  - `.tree` has `visibility:hidden`. On `:hover:not(:disabled)` and `:focus-visible`, it has `visibility:visible`.
  - Remove the `.btn ...::before` rule.
  - `#menu`, `#levelSelect`, `#report`, `#debrief` and `dialog`: `left:50%; top:50%; transform:translate(-50%,-50%)`. Keep the 16 px gutter and the inner scroll. Remove the max-width 600px rule that moves `#menu`, `#report` and `#debrief` to the bottom.
  - `.jb`, `#findOpen` and `#skip` use the same 3-column grid at their own size.
- [ ] **Step 6: Wire the icons.** Call `withIcon` on each `.btn` in `index.html` and on each `.jb`, `#findOpen` and `#skip`. Use these names:

| Button | Icon |
|---|---|
| `bNew` | `new` |
| `bCont` | `continue` |
| `bJrnMenu` | `journal` |
| `bSet` | `settings` |
| `bCred` | `credits` |
| `bReplay` | `replay` |
| `bReset` | `delete` |
| dialog Close and `jClose` | `close` |
| `lsBack` | `back` |
| level buttons | `level` |
| sandbox | `sandbox` |
| upgrades | `upgrade` |
| `rpCont` | `play` |
| `dbMenu` | `menu` |
| `qYes` | `back` |
| `qNo` | `close` |
| `jPrev` and `jNext` | `back` and `continue` |
| `findOpen` | `journal` |
| `skip` | `fast` |

  Where code sets `textContent` after the wiring (for example `lsBack`, `rpCont`, `dbMenu`, `jPrev`, `jNext` and `findOpen`), set the text of `.t` instead. A level button keeps its `<small>` line inside `.t`.
- [ ] **Step 7: Browser check** at 390×844 and 1280×800:
  - the menu, the level select, Settings, Credits, the year report and the debrief are centred;
  - hover and focus show the tree, and the text does not move (compare the `.t` box before and after hover);
  - a disabled button shows no tree.
- [ ] **Step 8: Run** `npm test`. Expected: all pass.
- [ ] **Step 9: Commit:** `feat(ui): add pixel icons, text size tokens and centred panels`.

### Task 2: Top bar

**Files:**
- Modify: `index.html` (`#hud` markup and CSS), `src/ui.js` (`bind`, `renderUI`), `src/strings.js` (`HUD`)

**Interfaces:**
- Consumes: `icon(name, px)` from Task 1.
- Produces:
  - `HUD.parts(time, funds, crews, total, goodwill, wetNow, wetDry)` returns 6 objects `{ id, label, value, full }`. The ids are `time`, `funds`, `crew`, `goodwill`, `wet` and `score`.
  - `full` is the accessible text. It equals today's text for that item, for example `"Funds 3600"` and `"Dry-season wet – (scored)"`.
  - For `time`, `label` is `""` and `value` is today's `HUD.time` text. On a phone, `value` is the short form `"1/5 · Wet · wk 2"`.
  - `HUD.stats` is removed.

- [ ] **Step 1: Markup.**
  - `#hud` holds `#hudRow` (6 `.part` spans and a `.sep`) and `#hudBtns`.
  - Each `.part` has `data-id`, an icon, `<b class="l">` for the label and `<span class="v">` for the value.
  - `#legend` moves under `#hudRow`. It is visible only when `map.mode === 'data'`, so `renderUI` gets `data` and sets `hidden`.
  - `#hudKeys` moves to the end of `#bar` and is hidden on touch.
- [ ] **Step 2: CSS.**
  - `#hud`: `left:50%; transform:translateX(-50%); display:flex; align-items:center; gap:8px; white-space:nowrap; max-width:calc(100% - 16px)`.
  - `.part`: `display:flex; align-items:center; gap:4px; padding:0 8px; border-left:2px solid var(--line)`. The first part has no border.
  - The icon and `.l` take `color:var(--c-<id>)`. `.v` takes `--ink`.
  - Add the 6 `--c-*` tokens. Check each one with a 4.5:1 contrast computation against `#14120e`, and put the ratios in the report.
  - The HUD buttons (`.hb`) get an icon: `pause` or `play`, `play`, `fast`, `data` and `journal`. They show the text on desktop and the icon only at max-width 600px, with `aria-label`.
  - At max-width 600px and at max-height 500px: `.l` is hidden. Each part has `title` and `aria-label` set to `full`. On a portrait phone, `#hud` wraps into 2 rows: `#hudRow` and `#hudBtns`. In short landscape, it stays one row.
- [ ] **Step 3: `renderUI`** writes `.v` text only when it changes, as now, and sets `title` and `aria-label` from `full`.
- [ ] **Step 4: Browser check:**
  - at 1280×800, one row, centred;
  - at 390×844, 2 rows with no horizontal overflow (`hud.scrollWidth <= hud.clientWidth`), with funds set to 123456 through `?debug` (Review Focus 1);
  - at 844×390, one row;
  - the screen reader name of each part equals `full`.
- [ ] **Step 5: Run** `npm test`. Expected: all pass.
- [ ] **Step 6: Commit:** `feat(ui): split the HUD into coloured parts with icons on one line`.

### Task 3: Hotbar

**Files:**
- Modify: `index.html` (`#bar` markup and CSS), `src/ui.js` (`bind`, `arm`, `renderUI`), `src/strings.js` (`BAR`, `actionMeta` use)

**Interfaces:**
- Consumes: `icon()` from Task 1. `ACTIONS`, `ACTION_TEXT`, `R_NAMES` and `costOf` as now.
- Produces:
  - `#barName`: the name line.
  - `#slots`: one `<button class="slot" data-id data-r>` for each of the 10 actions, in group order: `rewet`, `reveg`, `revit`, `defense` (the order inside a group is the `ACTIONS` order). A slot has `icon(id, 36)` and `<small>` with the cost. `bind` adds the class `first` to the first slot of each group, and wraps the slots in 2 `.row` divs (rewet + reveg, revit + defense).
  - `#barTabs`, `#barMore`, `.grp` and `BAR.tabs` are removed.
  - `BAR.slot(name, group, meta)` returns the accessible name, for example `"Temp block, Rewetting, 100 · 1w"`.

- [ ] **Step 1: Markup and CSS.**
  - `#bar`: centred column. It holds `#barName` (Silkscreen `--fs-label`), `#slots`, the zoom group on a portrait phone, and `#hudKeys`.
  - `#slots` is `display:flex; justify-content:center; gap:4px`, and each `.row` is `display:flex; gap:4px`. On a portrait phone (max-width 600px and min-height 501px), `#slots` is `flex-direction:column; align-items:center`, so the 2 rows stack.
  - `.slot`: 64×64 px; 44×44 px at max-width 600px or max-height 500px.
  - A 3 px top border in the group colour. Add 4 tokens `--c-rewet`, `--c-reveg`, `--c-revit` and `--c-defense`; the defence colour may reuse an existing hue. `.slot.first:not(:first-child)` has an 8 px left margin, so the groups have a gap.
  - `.slot.on` has the accent border. `.slot.poor small` keeps `#c0583a`.
  - At 44 px, the icon is 24 px and the cost stays under it in `--fs-label`.
- [ ] **Step 2: `bind` and `arm`.**
  - `bind` builds the slots.
  - On `pointerenter` and `focus`, `#barName` shows `ACTION_TEXT[id][0]` and the cost.
  - On `pointerleave` and `blur`, it shows the selected action's name, or `SELECT_HINT` when no action is selected.
  - `arm` keeps its toggle rule.
  - A slot click still calls `b.blur()` after `arm`. Space on a focused slot reaches the button, because main.js returns early for a focused button (commit 4429c7d).
- [ ] **Step 3: `renderUI`** updates each slot's `small`, the `poor` class and `aria-label` from `BAR.slot(...)`.
- [ ] **Step 4: Zoom buttons** get the icons `zoomIn`, `zoomOut` and `fit`. Keep their `aria-label` text, which begins with the visible word.
- [ ] **Step 5: Browser check:**
  - the 10 slots fit with no scroll at 320×640, 390×844, 844×390 and 1280×800: one row on desktop and in short landscape, 2 rows on a portrait phone;
  - each slot is at least 44×44 CSS px;
  - Tab reaches the slots in order, and Space on a focused slot selects it with no pause (Review Focus 2);
  - at 844×390, the map band is at least 40% of `innerHeight` (Review Focus 3);
  - a tap on an animal shows the find toast above the slots (Review Focus 5);
  - an armed action still places on a tile.
- [ ] **Step 6: Run** `npm test`. Expected: all pass.
- [ ] **Step 7: Commit:** `feat(ui): replace the action groups with a centred hotbar of icon slots`.

### Task 4: Metric tables

**Files:**
- Modify: `src/ui.js` (`showYearReport`, `showDebrief`, a `table()` helper), `src/strings.js` (`REPORT`, `DEBRIEF`, `MENU`), `src/main.js` (menu table), `index.html` (`table` CSS, `#menuStats`)

**Interfaces:**
- Produces:
  - `REPORT.rows(burntPct, sv, goodwill, grant, funds)` returns `[[label, value]]` with 4 rows: burnt, seedling survival, village goodwill, and grant with funds.
  - `REPORT.speciesRow(names)` returns `[label, count, namesText]`.
  - `DEBRIEF.goalRows(r, p)` returns `[[mark + goal, result, passMark]]`. `DEBRIEF.figureRows(r)` returns the same shape with an empty pass mark.
  - `DEBRIEF.dataRows(co2, sv)` returns `[[label, value]]`.
  - `MENU.stars(x, n)` and `MENU.found(x, n)` return `[label, value]`.
  - `table(el, rows, { head })`: replaces the contents of `el` with a `<table>`. A row with 3 cells and `head` set gets a `<th scope="col">` header row.
  - `JOURNAL.count` stays for the journal header. `#menuFound` is removed from `bJrnMenu`.
- Values: the label text equals today's text before the colon, and the value equals today's text after it. Example: `"Burnt so far"` and `"0% of the site"`.

- [ ] **Step 1: Write the failing test** in `test/strings.test.js` (new):
  - for fixed inputs, each `REPORT.rows` row joined as `label + ': ' + value` equals today's `REPORT` line;
  - `DEBRIEF.goalRows` has 3 rows, and each row has 3 cells;
  - `MENU.found(3, 11)` deep-equals `['Wildlife found', '3 of 11']`.
- [ ] **Step 2: Run** `node --test test/strings.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the strings functions. Keep the old line functions only where something still calls them. Grep, and delete the unused ones.
- [ ] **Step 4: Run** `node --test test/strings.test.js`. Expected: PASS.
- [ ] **Step 5: UI.**
  - `showYearReport` puts a table in `#rpBody`. The species names go in a row with one cell that spans 2 columns.
  - `showDebrief` puts tables in `#dbGoals` (3 columns with a header) and `#dbData`. On a loss, `#dbGoals` shows the loss text as a paragraph, as now.
  - The menu gets `<table id="menuStats">` under the buttons with the stars (`totalStars(save)` of `MAX_LEVEL * 3`) and the wildlife count. `toMenu` and `bReset` update it.
  - Table CSS: `width:100%; border-collapse:collapse`, labels in `--dim` on the left, values in `--ink` on the right, and a 1 px `--line` row border.
- [ ] **Step 6: Browser check:** the year report, the debrief (passed, failed, loss and sandbox) and the menu at 390×844 and 1280×800. The tables do not overflow.
- [ ] **Step 7: Run** `npm test`. Expected: all pass.
- [ ] **Step 8: Commit:** `feat(ui): show report and menu metrics as tables`.

### Task 5: Intro story module

**Files:**
- Create: `src/render/introStory.js`, `test/introStory.test.js`

**Interfaces:**
- Consumes:
  - `LEVELS` and `buildLevelWorld` from `src/levels.js`;
  - `resolveLevel` from `src/sim/mapgen.js`;
  - `computeStrength` from `src/sim/drainage.js`;
  - `FAUNA` from `src/sim/fauna.js`;
  - `KIND`, `BLOCK` and `WET_WT` from `src/sim/world.js`.
- Produces:
  - `INTRO_LEVEL(seed)`: `{ ...LEVELS[5], size: 30, seed, sandbox: true }`. 30 tiles fit the viewport better than 40.
  - `buildStory(seed)` returns `{ game, start, end, at }`:
    - `game`: `{ world, S, tick: 0, jobs: [], fauna: [] }`. This is all that `drawWorld` reads.
    - `start` and `end`: `{ wt: Float32Array, cover: Float32Array }`.
    - `at`: one `Float32Array` with the start time of each tile, in [0, 1).
  - `storyAt(story, h)`: changes `story.game.world` (`wt`, `cover`, `fire` and `block`) and `story.game.fauna` to the state at `h`. `h` is clamped to [0, 1]. It is idempotent for the same `h`.
- Rules (game art values, not real-world values):
  - Start: on peat, `wt = max(built wt, 0.6)` and `cover = built cover × 0.15`. Fire is on the peat tiles where `hash(i) < 0.03`, and on at least 1 tile.
  - End: on peat, `wt = min(built wt, 0.15)` and `cover = max(built cover, 0.6 + 0.4 × hash(i + 7))`.
  - Blocks: the canal tiles with `hash(i + 3) < 0.12` get `BLOCK.PERM` at time `0.05 + 0.25 × (1 − zRank)`. `zRank` is the tile's bed height rank among canal tiles, in [0, 1], so higher tiles block first.
  - Water: a peat tile starts to change at `at[i] = 0.2 + 0.4 × hash(i + 11)` and finishes at `at[i] + 0.25`. Use linear interpolation of `wt`.
  - Cover follows the water with a lag of 0.1.
  - Fire goes out on a tile when its water change starts.
  - Animals: at build time, test each `FAUNA` rule on the end state. Keep up to 12 `{ species, i }` entries, at most 2 per species, in a fixed order from a seeded pick. Animal `k` shows when `h ≥ 0.8 + 0.015 × k`.
  - `S` is computed once at build time, so the flow cache in `drawWorld` does not rebuild each frame.

- [ ] **Step 1: Write the failing tests** in `test/introStory.test.js`:
  - `buildStory(42)` twice gives equal `start.wt`, `end.cover` and `at`;
  - after `storyAt(s, 0)`, fewer than 20% of the peat tiles have `wt <= WET_WT`, and at least 1 tile has fire;
  - after `storyAt(s, 1)`, more than 80% of the peat tiles have `wt <= WET_WT`, no tile has fire, mean cover is higher than at 0, and `game.fauna.length` is greater than 0;
  - the count of blocked tiles does not fall over h = 0, 0.1, …, 1;
  - `storyAt(s, 0.5)` called twice gives the same `wt`;
  - `buildStory(1)` and `buildStory(2)` give a different `world.kind`.
- [ ] **Step 2: Run** `node --test test/introStory.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** No `window`, `document` or canvas.
- [ ] **Step 4: Run** `node --test test/introStory.test.js`. Expected: PASS. Note the time of `buildStory` in the report. It must be under 150 ms in Node.
- [ ] **Step 5: Run** `npm test`. Expected: all pass.
- [ ] **Step 6: Commit:** `feat(render): build the intro story from a generated map`.

### Task 6: Intro and menu wiring

**Files:**
- Modify: `src/main.js` (intro, menu background, frame loop), `index.html` (`#intro`, `#line`, `#menu`, `h1`)
- Delete: `src/render/intro.js`

**Interfaces:**
- Consumes: `buildStory` and `storyAt` from Task 5. `map.draw(game, now)` and `map.leave()` from `src/render/view.js`.
- Produces: nothing for later tasks.

- [ ] **Step 1: main.js.**
  - `startIntro()` calls `story = buildStory(Math.floor(Math.random() * 2 ** 31))` and `map.leave()`.
  - The frame loop: when no level is shown, it calls `storyAt(story, h)` and then `map.draw(story.game, now)`. When `story` is null (first frame with reduced motion), it builds one.
  - Remove `BW`, `BH`, `shift`, `smoke` and `initIntro`.
  - The `h` timing stays: `clamp((t − 5.6) / 4.5)` in the intro, and it eases to 1 outside it.
  - `toMenu` keeps the story; the menu shows it at `h` = 1.
  - Delete `src/render/intro.js`. Grep for its imports.
- [ ] **Step 2: Markup and CSS.**
  - `#intro` is `position:fixed; inset:0; display:grid; place-items:center; pointer-events:none`.
  - `#line` is `--fs-head` VT323 on `--panel` with a 2 px `--line` border, 12 px by 16 px padding, `max-width:min(640px, 100% - 32px)` and centred text. Keep the opacity fade.
  - `#menu`: the `h1` is centred in `--fs-title`, the subtitle is centred, and the buttons are a centred column, `min(360px, 100% - 32px)` wide.
  - The canvas `aria-label` stays.
- [ ] **Step 3: Browser check:**
  - the intro at 390×844, 1280×800 and 844×390 shows the whole map, not cropped, with the line centred;
  - a resize during the intro keeps the map fitted;
  - Skip goes to the menu;
  - Settings, then "Replay intro", plays the full intro with no instant skip;
  - with reduced motion (CDP `Emulation.setEmulatedMedia` with `prefers-reduced-motion: reduce`), the menu opens at once over the restored map;
  - 2 loads show 2 different maps;
  - the intro frame time median is about 16.7 ms at 1280×800 (Review Focus 4).
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit:** `feat(ui): play the intro on a generated map and centre the menu`.

### Task 7: Icon review and final check

**Files:**
- Modify: `src/icons.js` and `index.html`, only for the changes from the user's icon review and for detector findings.

- [ ] **Step 1:** The controller shows the user an icon sheet (all icons at 4×) and screenshots before and after at 390×844 and 1280×800: the menu, the level, the year report and the debrief. The controller records the user's changes in the ledger.
- [ ] **Step 2:** Make the icon changes.
- [ ] **Step 3: Run** `<impeccable skill dir>/scripts/impeccable detect --json index.html src/ui.js src/main.js src/icons.js`. Fix each finding, or record why it stays.
- [ ] **Step 4:** Check the touch targets with `getBoundingClientRect` for each button and slot at 390×844. The result: none below 44×44.
- [ ] **Step 5: Run** `npm test`. Expected: all pass.
- [ ] **Step 6: Commit:** `fix(ui): apply the icon review and the detector findings`.
