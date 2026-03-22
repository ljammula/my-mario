# My Mario

A Super Mario Bros (1985) browser game — Phaser 3 + TypeScript + Vite.

NES-accurate physics, pixel-perfect sprites, procedural Web Audio synthesis. Deploys to GitHub Pages from `/docs`.

## Quick start

```bash
make install   # install dependencies
make dev       # start dev server at http://localhost:3000
```

## Controls

| Key | Action |
|-----|--------|
| ← / → Arrow | Move left / right |
| Space / Z | Jump (hold for higher jump, release early to cut arc) |
| X / Shift | Run · throw fireball (Fire Mario) |
| ↓ / S | Crouch (Super / Fire Mario only) |
| Enter | Start / Pause |

## Features

- **Physics** — momentum, variable-height jump, coyote time (4 frames), jump buffering (6 frames), skid
- **Player forms** — Small → Super (Mushroom) → Fire (Fire Flower) → Invincible (Starman) with correct damage downgrade chain
- **Enemies** — Goomba, Koopa Troopa (shell kick + chain kills), Piranha Plant, Shell entity
- **World 1-1** — full 224-tile layout: pipes, brick/question blocks, gaps, staircase, flagpole, castle
- **Scoring** — stomp combos (9th consecutive = 1-UP), flagpole height bonus, time bonus, score wraps at 999,999
- **HUD** — score, coins, world, timer (hurry mode at ≤100s)
- **Audio** — procedural Web Audio API synthesis, no external files
- **Sprites** — NES-palette pixel art, RLE-encoded, pre-baked at startup (zero frame allocation)
- **Performance** — zero heap allocation in game loop, viewport-culled tile renderer, object-pooled fireballs/particles

## Architecture

```
src/
  config/           — physics constants, tile IDs, scoring tables
  types/            — shared TypeScript interfaces
  systems/          — InputManager, TileCollision, CameraSystem,
                      GameStateMachine, SpriteRegistry, SpriteData,
                      AudioSystem, TileRenderer
  entities/
    player/         — Mario, Fireball
    enemies/        — Enemy (base), Goomba, KoopaTroopa, Shell, PiranhaPlant
  scenes/           — BootScene, PreloadScene, WorldScene, UIScene
  ui/               — HUDScene
  state/            — hudData (shared singleton)
  data/levels/      — world1-1.ts (full level data)
```

## Stack

| Tool | Role |
|------|------|
| Phaser 3 | Scene management, WebGL renderer, camera |
| TypeScript | Strict-mode throughout |
| Vite | Dev server, build, HMR |
| Vitest | Test runner + coverage |

Custom AABB collision — Phaser's physics engine is not used.

## Make targets

```bash
make install      # npm install
make dev          # vite dev server (port 3000)
make build        # tsc + vite build → docs/
make preview      # preview production build locally
make test         # run full test suite (362 tests)
make test-watch   # vitest watch mode
make coverage     # test coverage report
make deploy       # build + stage docs/ for commit
make clean        # remove docs/ and node_modules/
```

## Deployment

GitHub Pages serves from `main /docs`:

```bash
make deploy
git add docs/
git commit -m "deploy: $(date +%Y-%m-%d)"
git push
```

## Technical notes

- Canvas: 512×480px (2× NES logical resolution 256×240)
- All game logic runs in logical pixels (1 tile = 16px); renderer multiplies by 2
- Fixed 60fps physics timestep with delta accumulator (50ms cap)
- Sprites: palette-indexed RLE arrays decoded once at boot into Phaser `RenderTexture`
- Audio: single `AudioContext` created on first user interaction; separate music/SFX gain chains
