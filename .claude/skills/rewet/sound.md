# Sound design

All sound is WebAudio synthesis in `src/audio.js`. No audio files.

## Where sounds start

| Trigger | Where |
|---|---|
| A sim event (fire, block done, year end) | The sim pushes an event to `g.events`. `tickLevel()` in `src/main.js` drains the events and calls the sound. |
| A UI action (button, hover) | `src/main.js` and `src/ui.js`, like the existing `blip()` calls |
| A loop that follows a state (rain in the wet season) | `frame()` in `src/main.js`, with an on/off flag so that it changes only on a state change |

`src/sim/**` never calls audio. A new event must not add an `rng()` call.

## Rules

1. Each sound obeys `isMuted()`. A loop also stops when the user mutes.
2. Throttle a sound that a sim event can start many times in one frame. Example: fire on many tiles.
3. Keep gain at or below the `blip()` level (0.035). Fade loops in and out over at least 0.3 s.
4. Stop or fade loops when the level pauses, and on the year report, the debrief and the menu. The wet season starts on the same tick as `yearEnd`, so a wet-season sound starts under the report screen. Start it after the player continues.
5. Create the `AudioContext` only after a user gesture. Call `ac.resume()` if its state is `suspended` (iOS).

## Verify

An agent cannot hear the output. You cannot say "the sound works".

1. Test the trigger: a unit test asserts the event, and a check asserts that the function was called.
2. Give the user exact steps to listen. Example: open `http://localhost:8765/?debug`, start level 1, use `rewet.game` in the console to start a fire, then listen for the crackle with mute off and with mute on.
3. Report the sound as "not checked by ear" until the user confirms it.
