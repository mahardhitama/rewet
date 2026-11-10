# Sprite design

## How sprites work

- Tile grid: `TW = 32`, `TH = 16` (`src/render/isoMath.js`). Buffer: 320×180, upscaled with `image-rendering: pixelated`.
- `src/render/iso.js` builds a sprite cache once (`buildCache()`). Each sprite is an offscreen canvas made with `sprite(draw)`. The anchor is the top vertex of the tile: `(SW/2, HEAD)`.
- Helpers: `block` (tile side faces), `blob`, `tree`, and `canal()` for canal-type tiles.
- `drawWorld()` picks one cached sprite per tile, then draws small markers on top.
- Draw with `fillRect` only. No image files.

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
