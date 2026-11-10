# Design polish (impeccable)

**REQUIRED SKILL:** `impeccable` (installed at `~/.agents/skills/impeccable`). Use its commands: `critique` and `audit` to evaluate, then `polish`, `layout`, `typeset`, `clarify` or `quieter` to change.

## Before you start

1. Ask the user for the scope. "Final polish" has no scope. Which screens? Menu, HUD, level, debrief?
2. Ask the user before the first run of `scripts/impeccable` in a session. The launcher downloads a binary on its first run. If the user says no, follow impeccable's "Launcher unavailable" steps.
3. The repo has no `PRODUCT.md` or `DESIGN.md`. For a narrow refinement, continue on the existing code and offer `impeccable init` after. For a redesign, run `init` first.

## Modes (impeccable)

| Surface | Mode |
|---|---|
| Intro and main menu | Experience |
| Level: map, HUD, action bar | Operate |
| Debrief data view, year report | Read |

## Constraints impeccable does not know

- The art is pixel art. The canvas is a 320×180 buffer with `image-rendering: pixelated`. Do not add smooth gradients, blur or vector art to the canvas.
- No image or audio files. No npm dependencies. The font is Silkscreen from Google Fonts (`index.html` head), for all text. Ask before you add or change a font.
- Use the CSS tokens on `:root` in `index.html`. Add a token only when no existing token fits.
- Text goes in `src/strings.js`. Ask before you change factual copy. Ask before you remove the word "prototype".
- Read `ui-ux.md` for the touch and input rules.
- Cite a constraint only from a file in this repo. Do not bring in rules from other contexts.

## Verify

Take before and after screenshots at 390×844 and 1280×800 with the same screen state. Show both to the user.
