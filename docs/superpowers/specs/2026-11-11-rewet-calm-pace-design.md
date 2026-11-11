# Rewet: calm pace and field notes

Date: 2026-11-11. Branch: `feat/chill-informational`.

## 1. Problem

- The level feels hasty. At ×1 a year takes 75 s, so one week takes about 1.4 s. A dry season ends before the player can read the map.
- The game does not tell the player enough. The player cannot ask a tile for its water-table depth. When something happens (dry season, fire, washout, arson), the game plays a sound but does not say why it happened.
- Level 1 shows all 10 action slots, but the how-to dialog teaches only 3 of them.

## 2. Ideas from similar games

| Game | Idea | What Rewet takes |
|---|---|---|
| Terra Nil (Free Lives, 2023) | No timers; the player sets the tempo. Reviews call it calm. | A slower default speed. ×2 stays for players who want the old pace. |
| Cities: Skylines, SimCity | Hover a tile to read its data. Info views. | A tile readout in the action bar. Rewet already has the data view. |
| RimWorld | Short letters explain each event, at the side of the screen, and do not stop the game. | Field notes: a short toast that says what happened and why. |
| Timberborn, Against the Storm | Players ask for an automatic pause on important events. | One automatic pause on the first fire of each year. |
| Most strategy tutorials | Show a tool when the game teaches it. | A level shows only the actions that its how-to dialog or an earlier level teaches. |

Sources: reviews of Terra Nil (gamepressure.com, "Reclaim the Wasteland At Your Own Pace"); Timberborn feature request "Auto Pause on selected events"; Against the Storm request "add option to auto pause before storm". RimWorld, Cities: Skylines and SimCity ideas come from play knowledge, not from a source opened in the session.

## 3. Changes

All changes are in the UI layer (`src/main.js`, `src/ui.js`, `src/strings.js`, `src/strings.id.js`). The sim does not change, so seeds, fixtures and calibration tests stay the same.

1. **Slower clock.** ×1 = 120 s for each year (one week is about 2.3 s). ×2 = 60 s.
2. **Tile readout.** With no action selected, the 2 lines above the slots show the tile under the pointer: its kind, its water-table depth and what that means. On a touch screen, a tap on a tile with no action selected shows the readout.
3. **Refusal preview.** With an action selected, the second line shows why the action cannot go on the tile under the pointer, before the tap.
4. **Season countdown.** In the last 6 weeks of the wet season, the tooltip of the HUD time says how many weeks are left until the dry season. A field note gives the same warning 4 weeks before. The HUD text itself does not change, because the HUD widths are measured on it.
5. **Field notes.** A toast explains these events, once for each level: the start of the dry season, a fire, a washout, arson on wet peat, a fire next to the village. Toasts wait in a queue. Each toast stays on the screen for a time that agrees with its length (3 s to 9 s).
6. **Fire pause.** The first fire of each year pauses the game, and a note tells the player to send a fire crew. Later fires in the same year do not pause the game.
7. **Taught actions only.** A level shows the action slots that the how-to dialogs of this level and of the earlier levels teach. The sandbox shows all slots.

## 4. Out of scope

- No new sim events. The game finds a new fire from `world.fire` in the UI layer.
- No settings switch for the fire pause. Add one if play tests show that it annoys players.
