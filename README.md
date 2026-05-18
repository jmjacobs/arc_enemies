# Arc Enemies

A turn-based 2D artillery game for two players, inspired by the 1991 classic GORILLAS.BAS — lob character-specific projectiles at each other across a city skyline.

## How to run

```
cd arc-enemies
python3 -m http.server 8000
```

Then open **http://localhost:8000** in Chrome, Safari, or Firefox.

> A local server is needed because the game uses ES modules, which browsers won't load from plain file paths.

## Source files

| File | What it does |
|------|-------------|
| `src/game.js` | Entry point — starts the game, owns the main loop |
| `src/config.js` | All tunable numbers and colours live here (canvas size, gravity, etc.) |
| `src/render.js` | Draws everything onto the canvas (title, skyline, characters, projectiles) |
| `src/world.js` | Builds the city — generates buildings and player positions |
| `src/physics.js` | Moves projectiles through the air, applies gravity and wind, checks collisions |
| `src/input.js` | Listens for keyboard/mouse events from both players |
| `src/sound.js` | Plays sound effects and music via the Web Audio API |

## Build phases

- [x] **Phase 0** — Project skeleton + title screen
- [ ] **Phase 1** — Procedural city skyline
- [ ] **Phase 2** — Player characters + turn UI
- [ ] **Phase 3** — Projectile physics (arc, gravity, wind)
- [ ] **Phase 4** — Collision detection + explosions
- [ ] **Phase 5** — Scoring + round end screen
- [ ] **Phase 6** — Character-specific projectiles and abilities
- [ ] **Phase 7** — Polish: animations, sound, pixel font
