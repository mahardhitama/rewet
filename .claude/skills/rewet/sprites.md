# Sprite design

## How sprites work

- Tile grid: `TW = 32`, `TH = 16` (`src/render/isoMath.js`). On the level screen, the buffer size comes from `cameraFor()`: the window size divided by the zoom scale. One buffer pixel is one map pixel at each scale.
- `src/render/iso.js` builds a sprite cache once (`buildCache()`). Each sprite is an offscreen canvas made with `sprite(draw)`. The anchor is the top vertex of the tile: `(SW/2, HEAD)`.
- Helpers: `block` (tile side faces), `texture` (peat shades and specks), `blob`, `pool` (flat ellipse), `tree`, `shrub`, `seedling` and `fern`.
- Plant forms: `cache.veg[VEG.X]` holds the sprites for each plant type. `drawWorld()` picks one from the tile hash. Each type has these forms:
  - Tree: 12 sprites. `crown()` builds a lumpy crown from many lit clumps, so a tree does not look like a disc on a stick. Types: young `tree`, mature `canopy` (buttress and fork; rx and ry set the shape), `emergent` (2-tier crown), `gelam` (pale trunk, narrow grey-green crown), `tiered` (cone), `twin` (2 stems) and `mixed` (dark crown, light new leaves). Palettes: `GREENS`, `JELUTONG`, `OLIVE`, `BLUE_GREEN`, `DARK`, `LIME`, `PUCUK` (red young leaves), `GELAM`. No palms in the tree list.
  - Shrub: 2 original forms, a group of 4 small shrubs and `lowShrub` (flat mound with flower specks).
  - Seedling: 2 original forms, a group of 5 tiny seedlings and `sapling` (taller stem with 2 leaf tiers).
  - Fern: 2 original forms, `tuft` (sedge blades) and one large fern with 2 small ones.
  - Keep the tallest tree inside `HEAD` (28 px above the tile top).
- Canal water: `canalStep()` picks 1 of 4 water steps from the water depth below the bank in metres (0.1 m, the 40 cm line, 1 m). Behind a block, `canalTarget()` in `src/sim/hydro.js` sets the water to the water-table depth of the peat beside the canal, so the canal and the peat change together.
- Canal tiles join their canal and river neighbours. `canalMask()` gives the joined neighbours. `canalZone()` gives the bank, wall, wet bed or water for each pixel. `canalSprite(key)` builds a canal sprite the first time a key is used, then keeps it in a cache.
- A canal that joins on a corner crosses the two side tiles. Each side tile draws a patch with the channel pixels.
- Flow: `rippleSprite(key, o, d, f)` builds light dashes on the water pixels of a canal sprite and keeps them in a cache. `d` is the `DIRS` index of the downstream tile. `f` is one of 8 frames.
  - `drawWorld()` draws the ripples on each open canal tile and on its corner patches. A block on the tile or downstream stops them.
  - The ripple period (8 ground units) divides the tile size (16), so the dashes line up across the tile joins.
  - With reduced motion, the ripples stay on frame 0.
- `drawWorld()` draws one cached sprite per tile, then the overlays (patch, pond, block, vegetation), then small markers.
- Draw with `fillRect` only. No image files.
- Fire: `cache.flame[size][variant][frame]` (3 sizes, 3 variants, 4 frames), `cache.ember[variant][frame]` for smouldering peat, and `cache.cool[variant][frame]` for 2 weeks after a fire goes out. Ember and cool sprites cover the whole tile top. `fireSize()` gives the size from the ticks since the tile was lit. `trackFire()` in `iso.js` records those ticks on the render side, so the sim does not change.
- Work crews (`src/render/crew.js`): 1 to 3 people at each job tile, and 1 guard at each fire group post. They are display only.
  - `FRAMES` holds the poses as row strings, 2 frames each, with the body on columns 4 to 8. `CREW` gives the crew size and the poses for each action.
  - `crewPlan()` picks the size, the poses, the clothes and the start point from a hash of the job key. People walk in from the nearest village tile.
  - A crew walks in for 800 ms and fades in. It works at least 600 ms. It walks away for 800 ms and fades out. `drawWorld()` adds the people to the animal pass, so the depth sort includes them.

## Palette

Reuse the named colours at the top of `iso.js`: `DRY`, `WET`, `GREEN`, `FOREST`, `WATER`. Make shades with `mix(colour, [0,0,0], t)`. Add a new named colour only when no shade of an existing one fits. Put it next to the others.

## Rules

1. A new sprite goes in the cache. Do not draw it per frame with many `fillRect` calls.
2. The sprite must look different from its neighbours in shape, not only in colour. Example: a fish pond needs a shape that an open canal and a temporary block do not have.
3. Build the edge-depth variant if the tile can be on the map edge (`EDGE`).
4. The data view (`D` key) replaces sprites with the heat colour. Markers must not cover the heat colour.

## Verify

1. Serve with `python3 -m http.server 8765`. Open the sandbox or the level that has the tile.
2. Take screenshots at scale 3 (desktop) and scale 2 (width below 600 px).
3. Zoom into the tile with the browser zoom action. Compare it with its neighbours.
4. Check the map edge and the data view.
5. Expect to move pixels by 1 px after the first look.

## Map effects (`src/render/fx.js`)

- `drawFx()` runs at the end of `drawWorld()`. It draws particles, rings, floating cost numbers, the action cursor, rain, cloud shadows, fireflies, embers and glints on wet peat.
- Effect positions are offsets from tile 0, like the smoke, so a pan or a zoom moves them with the map.
- Once per tick, `diffTick()` finds tiles that turned wet, fires that went out and finished jobs. It queues events. `frame()` in `src/main.js` drains them with `takeFxEvents()` and plays the sounds.
- `diffTick()` also shows two pop-ups in big pixel letters (`pixelText()`, 3x5 glyphs, A-Z and 0-9 only). The words are in `FX` in `src/strings.js`.
  - When a dam finishes near other blocked canal tiles (6 tiles or less), the map shows `CASCADE xN`.
  - When the dry season starts, a band with `DRY SEASON` slides across the map. The wet season gets no band, because it starts on the new-year tick, under the year report.
- Cloud shadows: `cloudShape()` builds 6 cumulus outlines once (22 to 31 round puffs in a dome on a flat base). Only their shadows are drawn: solid, squashed and clipped to the map, drifting east. The clouds themselves are not drawn. In rain there are more shadows and they are darker.
- The sky box: the map is the floor of a box whose walls rise `boxH()` px (the map height plus `BOX_UP`). `clipBox()` clips rain and the egret flock to its outline. Each raindrop falls straight down from the top of the box to its own spot on the map, then splashes.
- `backdrop()` fills the view behind the map with grey paper bands and an ordered dither. Toward the bottom, the bands take a faint forest-green tint in the wet season and a sand-khaki tint in the dry season. The dry pattern fades in with the same eased value as the dry-season air tint. `setBackdrop(false)` leaves the view clear, and `setBanner(false)` hides the season banner, for the press images.
- `air()` lays a faint warm tint over the view in the dry season and a brown smoke haze that thickens with the number of burning tiles (full at 25). It tints only drawn pixels (`source-atop`), so a clear backdrop stays clear. Peat fires cause real haze in Indonesia; the haze shows that fire harms the air far from the fire.
- `newFinds()` runs in `view.draw()` in a level. An animal whose species is not in `save.found` gets a pulsing gold twinkle above it, so the player taps it and finds a journal entry.
- `fireArrows()` runs in `view.draw()` after the map. A fire outside the visible band gets a pulsing arrow at the edge. The band leaves out the HUD, the action bar and the zoom buttons.
- The UI calls `placed()`, `denied()` and `setArmed()`. `main.js` calls `shake()` and `celebrate()`.
- With reduced motion, fx.js spawns no particles, no weather and no shake.
