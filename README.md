[![make.fun](https://make.fun/badge/turkey-run-game-01.svg)](https://make.fun/bounty/turkey-run-game-01)
[![rank](https://make.fun/badge/turkey-run-game-01/tranquilnaturevista-code/turkey-run-game-01/rank.svg)](https://make.fun/bounty/turkey-run-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=turkey-run-game-01)
[![reward](https://make.fun/badge/turkey-run-game-01/tranquilnaturevista-code/turkey-run-game-01/reward.svg)](https://make.fun/bounty/turkey-run-game-01?utm_source=github&utm_medium=readme&utm_campaign=turkey-run-game-01)

# Gobble Run — The Great Turkey Escape

Thanksgiving is coming — and you are the dinner. Outrun the farmer from
the farmyard, through the cornfield and into the kitchen, and reach the
forest 600 metres away to escape.

**Entry for the [make.fun bounty "Make the best turkey escape game"](https://make.fun/bounty/turkey-run-game-01)** ($250, 20 places, closes 2026-11-29 02:00 UTC).

## How to play

Open `game/index.html` in desktop Chrome (or run `node serve.ts` and open http://localhost:8080). No network, no install, no build step.

- **Jump:** **Space**, **↑**/**W**, or click — clear fences, hay bales, pumpkins and ovens, and grab the corn flying in arcs.
- **Duck:** hold **↓**/**S** — slide under the farmer's thrown carving knives and the hanging kitchen pans.
- **Dash:** **Shift**/**X** — a burst of speed that puts distance between you and the farmer (short cooldown).
- **Hide:** run through a haystack on the ground and the farmer loses you for a moment — his search buys you 130 pixels of breathing room.
- **Collect:** corn cobs (+10) and golden feathers (+25) slow the farmer down too.
- **Pause:** **P** or **Esc**. **M** mutes the synthesised gobbles and chimes.

The farmer creeps closer every second. Hit an obstacle and he gains 70
pixels on you; lose all 3 hearts, or let him catch you, and you are caught
for dinner. Reach 600m and you escape to the forest.

## The three zones

| Zone | Distance | Dangers |
| --- | --- | --- |
| Farmyard | 0–200m | Fences, hay bales, pumpkins, thrown knives |
| Cornfield | 200–400m | Faster pace, more knives, taller corn to hide the hazards |
| Kitchen | 400–600m | Hot ovens to jump, hanging pans to duck under, knives thrown twice as often |

## Files

- `game/index.html` — the game page (canvas, no network requests)
- `game/src/config.js` — all tuning numbers, colours and zone palettes
- `game/src/world.js` — the rules: the turkey, the chasing farmer, hazards, pickups, zones
- `game/src/render.js` — all drawing: turkey, farmer, farmyard, cornfield, kitchen, HUD, panels
- `game/src/input.js` — keyboard and pointer input (jump, duck, dash, pause, mute)
- `game/src/sound.js` — synthesised WebAudio effects (no audio files)
- `game/src/random.js` — seeded RNG, so screenshot scenes are repeatable
- `game/src/shots.js` — the staged scenes behind `?shot=start|play|kitchen|end`
- `game/src/main.js` — boot, the fixed-step loop and the five screens
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
- `shots.json` — the four screenshot scenes (cover first)

## Screenshots

Real renders of the game itself, taken in headless Chromium from the
`?shot=` scenes: `1-cover.jpg` (mid-run in the farmyard), `2-start.jpg`
(title screen), `3-kitchen.jpg` (the kitchen zone), `4-end.jpg` (caught).
