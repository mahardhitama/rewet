# Rewet: UI layout rework (design)

Date: 2026-11-10. Branch: `feat/procgen-map`. This spec changes the layout and the look of the HUD, the action bar, the menus, the reports and the intro. It does not change the game rules.

## 1. Intent

The user asked for these changes (impeccable `layout`):

1. The top UI and the bottom UI are centred.
2. Text sizes are consistent.
3. Top bar: one line, with each context in its own part. Each part has an icon and its own colour. The text is easy to read.
4. Bottom bar: larger buttons in a hotbar layout, with an icon on each button.
5. Main menu, year report and level report: centred. Metrics show as tables. Hover does not move the text and does not add `▶`; a tree icon shows instead. Each button has an icon at the right and centred text.
6. Main menu: a large centred "REWET" title. The intro uses the new sprites. The story text is centred on both axes. The intro map fits the viewport and comes from the map generator.

User decisions:

- Phone top bar: icon and number only. The label text shows on desktop, in the tooltip and in the accessible name. On a phone, the speed buttons and the Journal button go to a second short row.
- Hover tree: the tree shows at the left edge of the button. The purpose icon stays at the right. The text stays centred and does not move.
- Process: full spec, plan and subagent tasks.

Mode (impeccable): the intro and the menu are Experience. The level screen is Operate. The reports are Read.

Success criteria:

- At 390×844 and at 1280×800, the HUD and the action bar are centred horizontally.
- The HUD is one line at 1280×800. At 390×844, the contexts are one line and the buttons are a second line.
- All 10 actions show as square slots: one row at 1280×800 and 844×390, and 2 rows of 5 on a portrait phone. Each slot is at least 44×44 CSS px.
- The menu, the level select, the year report, the level report and the dialogs are centred on both axes.
- No button moves its text on hover or focus.
- The intro map fills the viewport with no crop of the map, and a new seed gives a different map.
- `npm test` passes. C1, C2 and C3 pass with no tolerance change.

## 2. Shared style (`index.html`)

- Fonts do not change: Silkscreen for labels, buttons and headings; VT323 for body text and values.
- Text size tokens on `:root`. Every font size in the CSS uses one of these:

| Token | Use | Value |
|---|---|---|
| `--fs-label` | Silkscreen labels and buttons | 14px |
| `--fs-body` | VT323 body text and values | 22px |
| `--fs-head` | Silkscreen headings in panels and dialogs | 24px |
| `--fs-title` | the "REWET" title | clamp(64px, 14vw, 144px) |

- A phone (max-width 600px) may use one smaller step for `--fs-body` (20px). It must not use more than one step.
- Context colour tokens. Each one has at least 4.5:1 contrast on `#14120e`:

| Token | Context |
|---|---|
| `--c-time` | year, season, week |
| `--c-funds` | funds |
| `--c-crew` | crews |
| `--c-good` | goodwill |
| `--c-wet` | wet now (the existing water cyan `#5ff0ff`) |
| `--c-score` | dry-season wet (scored) |

- Spacing uses a 4 px scale: 4, 8, 12, 16, 24, 32.

## 3. Icons (`src/icons.js`, new)

- Each icon is a 12×12 pixel grid, stored as data: a list of strings, one string per row, with one character per pixel. A space is clear; other characters are colours (the text colour, or a fixed colour).
- `icon(name, size)` returns an inline `<svg>` element with `shape-rendering="crispEdges"`, `aria-hidden="true"` and one `<rect>` for each run of pixels in a row. The fill is `currentColor` unless the icon fixes a colour.
- Icons: `time`, `funds`, `crew`, `goodwill`, `wet`, `score`, `pause`, `play`, `fast`, `data`, `journal`, the 10 actions (`tempBlock`, `permBlock`, `backfill`, `well`, `plant`, `mound`, `palud`, `pond`, `fireGroup`, `fireCrew`), `zoomIn`, `zoomOut`, `fit`, `new`, `continue`, `settings`, `credits`, `back`, `close`, `sound`, `replay`, `delete`, `level`, `sandbox`, `upgrade`, `menu` and `tree`.
- Icons are art. They need no source.
- No image files. No new dependencies.

## 4. Top bar (`#hud`, `src/ui.js`, `src/strings.js`)

- Position: the top centre of the screen (`left:50%`, `translateX(-50%)`). Width: as wide as the content, and never wider than the screen minus 16 px.
- One row: 6 context parts, a divider, then the buttons Pause, ×1, ×2, Data view and Journal.
- A context part has an icon, a label (desktop only), and a value. The icon and the label have the context colour. The value has the ink colour. A 2 px `--line` divider separates the parts.
- The label text and the accessible name come from `src/strings.js`. On a phone, the label is hidden; the part has `title` and `aria-label` with the full text (for example "Funds 3600").
- The dry-season part keeps the "(scored)" meaning in its label and in its accessible name.
- Buttons in the HUD use the icon and the text on desktop, and the icon only on a phone (with `aria-label`). Each button is at least 44×44 CSS px.
- The water depth legend shows only in the data view. It goes under the HUD row, centred.
- The keys hint (`#hudKeys`) moves under the bar on desktop and stays hidden on touch.
- Short landscape (max-height 500px): one row, with labels hidden as on a phone.

## 5. Action bar (`#bar`, `src/ui.js`)

- 10 square slots, centred, in group order: Rewetting (3), Revegetation (2), Revitalisation (3), Defence (2). There are no group tabs and no sideways scroll.
- Desktop and short landscape: one row. Portrait phone (max-width 600px and min-height 501px): 2 rows of 5. Row 1 is Rewetting and Revegetation. Row 2 is Revitalisation and Defence.
- Slot size: 64×64 CSS px on desktop, 44×44 CSS px at max-width 600px or max-height 500px. 5 slots of 44 px fit at 320 px.
- A slot shows the action icon at 2× (24 px) or 3× (36 px) and the cost under it in `--fs-label`. The slot has `aria-label` with the name, the cost and the weeks.
- The 4 groups (Rewetting, Revegetation, Revitalisation, Defence) show as a thin colour line above their slots and a small group gap between groups. The group name is in each slot's accessible name.
- A name line above the slots shows the name of the hovered, focused or selected action, in `--fs-label`. When no action is selected, it shows the existing hint text.
- The selected slot has the accent border. A slot that the player cannot afford keeps the `poor` style on its cost.
- The zoom buttons stay in a column at the right side of the screen, with icons. On a portrait phone, they stay in the bar row at the right of the slots.
- The map tap rules and the drag rules do not change.

## 6. Panels and buttons (menu, level select, reports, dialogs)

- `#menu`, `#levelSelect`, `#report`, `#debrief` and each `<dialog>` are centred on both axes (`left:50%`, `top:50%`, `translate(-50%,-50%)`). On a phone, they keep a 16 px gutter and scroll inside the panel when they are too tall.
- `.btn` layout: a 3-column grid. The left column (24 px) holds the hover tree. The centre holds the text, centred. The right column (24 px) holds the purpose icon.
- On hover and on `:focus-visible`, the tree icon shows in the left column, and the border and the text change to the accent colour. The text does not move. The `::before` "▶ " rule is removed.
- A disabled button shows no tree.
- Buttons in `src/journalView.js` (`.jb`) and in the find toast (`#findOpen`) get an icon at the right. Their hover follows the same rule.
- Metrics show as a `<table>` with 2 columns: the label (left, `--dim`) and the value (right, `--ink`). Rows have a 1 px `--line` border.
  - Year report: burnt so far, seedling survival, village goodwill, grant and funds, species seen. The species names go in a third row under "Species seen", in one cell that spans both columns.
  - Level report: the goals table has 3 columns: the goal, the result, and the pass mark. The data block is a 2-column table.
  - Main menu: a small table under the buttons with 2 rows: "Stars" (X of 18) and "Wildlife found" (X of 11).
- The text of each line stays as it is in `src/strings.js`. Only the split into a label and a value is new.

## 7. Main menu and intro

### 7.1 Menu

- The title "REWET" is centred, in `--fs-title`, with the existing green shadow.
- The subtitle is centred under the title.
- The buttons are a centred column, `min(360px, 100% - 32px)` wide.
- The restored intro map is the background.

### 7.2 Intro (`src/render/introStory.js`, new; `src/render/intro.js` is removed)

- The intro builds a world with the map generator. It uses a sandbox-type map with a new random seed each time the intro starts.
- The level renderer (`src/render/iso.js` `drawWorld`, through `src/render/view.js`) draws it at the fit zoom. The canvas uses the window size, as on the level screen. The map is not cropped.
- `src/render/introStory.js` is render-only and has no DOM access. It exports:
  - `buildStory(seed)` returns `{ game, start, end }`. `game` is the object that `drawWorld` reads. `start` is the degraded state: a dry water table, low cover, fire on some tiles. `end` is the restored state: a wet water table, high cover, no fire.
  - `storyAt(story, h)` writes the state at story time `h` (0 to 1) into `story.game`. Each tile has its own start time from `hash(i)`, so the change spreads over the map.
- Story order:
  1. Dry peat with smoke and fire.
  2. Blocks appear on the canals, upstream first.
  3. The water table rises, near the blocks first.
  4. Plants grow: ferns, then seedlings, shrubs and trees.
  5. Animals appear.
- The 3 story lines in `LINES` keep their text and their timing.
- The story line is centred on both axes, in `--fs-head` size VT323, on a `--panel` background with a 2 px `--line` border. It fades as now.
- The Skip button stays at the bottom right, with an icon. The global click skip rule and the `stopPropagation()` rule do not change.
- With `prefers-reduced-motion`, the intro goes to the menu at once, over the restored map.
- The intro values (the start and end water tables, cover and fire) are art, not real-world values.

## 8. Architecture

| Unit | Change |
|---|---|
| `index.html` | tokens, centred layout, HUD row, hotbar, `.btn` grid, tables, story line panel |
| `src/icons.js` | new: pixel icon data and `icon()` |
| `src/ui.js` | HUD parts, hotbar slots, report and debrief tables |
| `src/main.js` | intro through `introStory.js` and the map view; menu table |
| `src/render/introStory.js` | new: `buildStory`, `storyAt` |
| `src/render/intro.js` | removed |
| `src/strings.js` | label and value split for HUD parts and report rows |
| `src/journalView.js` | button icons |

The sim (`src/sim/*`) does not change.

## 9. Testing

- `test/icons.test.js`: each icon has 12 rows of 12 characters; `icon()` returns the same rects for the same name.
- `test/introStory.test.js`: the same seed gives the same story; `storyAt(s, 0)` has wet tiles under 20% and fire on at least one tile; `storyAt(s, 1)` has wet tiles over 80%, no fire and higher mean cover than at 0; the block count does not fall as `h` goes up.
- `npm test`: all tests pass, with C1 to C3.
- Browser at 390×844, 1280×800 and 844×390:
  - the HUD and the bar are centred;
  - the HUD is one row on desktop;
  - the 10 slots fit with no scroll;
  - the menu, reports and dialogs are centred;
  - hover and focus show the tree with no text shift;
  - the intro fills the viewport and the story line is centred;
  - each slot and button is 44×44 CSS px or more;
  - the focus order follows the visual order.
- Frame time on the level screen and in the intro: median about 16.7 ms at 1280×800.
- impeccable `detect` on the changed files has no unexplained finding.

## 10. Open items

- Icon art is a first pass. The user reviews the icon sheet before the plan's last task.
- The colour tokens get a contrast check in the plan. A token that fails moves to a lighter shade of the same hue.
