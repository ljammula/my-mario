# My Mario

A Super Mario Bros (1985) web game implementation using HTML5 Canvas and vanilla JavaScript.

## How to Play

Open `index.html` in a browser. No build step required.

> **Note:** Must be served over HTTP (not `file://`) due to ES module imports.
> Quick start: `python3 -m http.server 8080` then open `http://localhost:8080`

## Controls

| Key | Action |
|-----|--------|
| Arrow Left / A | Move left |
| Arrow Right / D | Move right |
| Arrow Down / S | Crouch (Super/Fire Mario) |
| Space / Z | Jump (hold for higher jump) |
| X | Run / Throw fireball (Fire Mario) |
| Enter | Start / Pause |

## Features

- **World 1-1** full layout with pipes, brick blocks, question blocks, gaps, staircase, and flagpole
- **Player states:** Small Mario → Super Mario (Mushroom) → Fire Mario (Fire Flower) → Invincible (Star)
- **Enemies:** Goombas, Koopa Troopas (with shell mechanics), Piranha Plants
- **Items:** Super Mushroom, Fire Flower, Super Star, 1-Up Mushroom, Coins
- **Physics:** Gravity, variable-height jump, coyote time, jump buffering, momentum
- **Scoring:** Points for stomps, coins, blocks, combos; flagpole height bonus; time bonus
- **HUD:** Score, coin count, world, time remaining, lives
- **Audio:** Synthesized sound effects and background music via Web Audio API (no external files)
- **Particles:** Brick break debris, coin sparkles, score popups

## Architecture

```
index.html          — Entry point
js/
  constants.js      — Physics constants, tile IDs, colors, scoring tables
  input.js          — Keyboard input with edge-triggered jump/fire flags
  engine.js         — Game loop, state machine (TITLE/PLAYING/DEAD/WIN/GAMEOVER)
  player.js         — Mario entity, physics, state machine, animation
  collision.js      — AABB collision detection and resolution
  level.js          — World 1-1 tile map, spawn points, block contents
  enemies.js        — Goomba, KoopaTroopa, PiranhaPlant, Shell AI
  items.js          — Mushroom, FireFlower, Star, Fireball, Coin entities
  renderer.js       — All canvas drawing (tiles, enemies, items, HUD, screens)
  audio.js          — Web Audio API SFX and background music
  ui.js             — Score popups, particle effects
```

## Technical Details

- Canvas: 512×480px (2× NES resolution of 256×240)
- Target: 60fps with fixed-timestep game loop
- No external dependencies — pure HTML5/JS
- ES modules throughout
