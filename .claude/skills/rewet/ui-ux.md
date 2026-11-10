# UI, UX and usability

## Map

| Part | Where |
|---|---|
| Layout, CSS tokens, buttons, `@media (max-width:600px)` | `index.html` |
| HUD fill, action bar, map input (tap, drag, hover) | `src/ui.js`, `src/render/view.js` |
| Camera scale, `screenToTile`, `clampPan` | `src/render/isoMath.js` |
| All text | `src/strings.js` |

## Rules

- UI reads game state. It changes state only through `applyAction()`.
- Touch targets: 44×44 CSS px for buttons (WCAG 2.2 SC 2.5.5). Never below 24×24 (SC 2.5.8). A map tile at scale 2 is 32×16 px, which is below 24 px high.
- A change to how input works (tap to confirm, long press, new gestures) changes the game feel. Ask the user before you build it.
- Each control works with the keyboard and shows a focus ring.
- A button that starts the intro calls `e.stopPropagation()`. The global click listener skips the intro.

## Check these each time (plan "Review Focus")

1. A second tap on a busy tile is refused with `"busy"`. No double charge.
2. Resize or rotation in a level: `screenToTile` still hits the tapped tile.
3. A hidden tab, then shown again: no freeze, no skipped year report.

## Verify

1. Run `npm test`.
2. Serve with `python3 -m http.server 8765`.
3. Check in the browser at 390×844 with touch, and at 1280×800. Use reticle (`reticle_act_and_wait`) or the Chrome tools.
4. Measure each changed target in the inspector.
5. For a heuristic review of a screen, use `impeccable` `critique` or `audit` (see `design-polish.md`).
