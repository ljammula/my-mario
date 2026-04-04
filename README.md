# My Mario

A Super Mario Bros (1985) World 1-1 browser clone — vanilla JS + HTML5 Canvas, no frameworks, no build step.

NES-accurate physics, pixel-art sprites drawn via Canvas 2D, procedural Web Audio synthesis. Playable on desktop and mobile. Deploys to GitHub Pages from `/docs`.

**Play:** https://ljammula.github.io/my-mario/

---

## Quick start

```bash
# No install needed — open directly in browser
open index.html

# Or serve locally (required for any ES-module work)
python3 -m http.server 8080
```

---

## Controls

### Keyboard

| Key | Action |
|-----|--------|
| ← / → Arrow | Move left / right |
| Space / Z | Jump (hold for higher jump) |
| X / Shift | Run · throw fireball (Fire Mario) |
| Enter | Start / Pause |

### Mobile / Touch

Touch controls appear automatically on touch devices (phones, tablets). A D-pad (◄ ►) and action buttons (A = jump, B = run/fire, START = pause) overlay the bottom of the screen. Multi-touch is supported — hold B and tap A to running-jump.

---

## Features

- **Physics** — momentum, variable-height jump, coyote time (4 frames), jump buffering (6 frames), skid
- **Player forms** — Small → Super (Mushroom) → Fire (Fire Flower) → Invincible (Starman), correct damage downgrade chain
- **Enemies** — Goomba (stomp/squish), Koopa Troopa (shell kick + chain kills), Piranha Plant
- **World 1-1** — full 224-tile layout: gaps, pipes, brick/question blocks, staircase, flagpole, castle
- **Items** — Super Mushroom, Fire Flower, Starman, coin popups from Q-blocks
- **Fireballs** — max 2 on screen, bouncing physics, enemy kill detection
- **Scoring** — stomp (+100), fireball kill (+200), flagpole height bonus, time bonus
- **HUD** — score, coins (×), world, countdown timer, lives
- **Audio** — procedural Web Audio API, no external files; overworld music + SFX (jump, stomp, coin, break, death, flagpole, etc.)
- **Mobile** — responsive canvas scaling, fixed-bottom touch controls, safe-area insets, landscape support

---

## Architecture

Fourteen single-responsibility modules loaded as classic `<script>` tags (no build step, works via `file://`):

```
js/
  constants.js   — physics constants, tile IDs, game state enum
  audio.js       — Web Audio API sound engine (AudioSystem)
  level.js       — buildLevel() tile map construction + Q-block contents
  state.js       — global game state variables + entity factories
  input.js       — keyboard + touch/mobile input handling
  tiles.js       — getTile / isSolid / tileAt helpers
  collision.js   — AABB tile collision (player + enemy) + rectsOverlap
  mario.js       — handleHeadBonk, updateMario, triggerMarioDeath, damageMario
  enemies.js     — Goomba, Koopa, Piranha state machines
  items.js       — Mushroom, star, fire flower, coin popup updates
  fireballs.js   — fireball physics + enemy hit detection
  camera.js      — camera follow logic
  render.js      — all canvas drawing functions + render()
  game.js        — state machine update() + fixed-step game loop
```

Load order in `index.html` satisfies all dependencies. No bundler required.

---

## Stack

| Tool | Role |
|------|------|
| HTML5 Canvas 2D | Renderer |
| Vanilla JS (ES2020) | All game logic |
| Web Audio API | Procedural music + SFX |
| Playwright | Automated gameplay tests |
| GitHub Actions | Deploy to GitHub Pages |

---

## Canvas & coordinate system

- Canvas element: 512×480 px
- Logical resolution: 256×240 (NES)
- Scale factor: 2× — all game logic in logical px; renderer multiplies by 2
- Fixed 60 fps physics timestep with delta accumulator (50 ms cap)
- One tile = 16 logical px (32 px on screen)

---

## Deployment

GitHub Pages serves from `main /docs`. The `docs/` folder mirrors the root `index.html` and all `js/` modules and is kept in sync with every commit.

The `.github/workflows/deploy.yml` uploads `docs/` directly — no build step needed.

---

## Testing

```bash
npm install        # installs Playwright
node test.js       # run gameplay tests (if present)
npm run playthrough # headless 10-transition browser playthrough + error capture
```

Automated Playwright tests cover: module loading, PLAYING state, Mario movement, pause/resume, Q-block bonk, mushroom spawn, goomba AI, fireball, damage chain, death by pit, camera follow, tile helpers.
