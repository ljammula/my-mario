# v2 Implementation Plan — Super Mario Bros Browser Game

**Principal Engineer:** Architecture and planning document
**Target branch:** `feature/v2`
**Date:** 2026-03-22
**Stack:** Phaser 3 + TypeScript + Vite

---

## 1. Architecture Decision

### Decision: Full Rewrite in Phaser 3 + TypeScript + Vite

Do not migrate the v1 vanilla JS codebase. Rewrite from scratch in TypeScript using Phaser 3 and Vite.

**Rationale:**

The v1 codebase is ~6,200 lines of vanilla JS organized as ES modules with a manual game loop, manual canvas 2D drawing, and no type safety. The work it captures breaks cleanly into two categories:

**Keep as reference, not as running code:**

- `js/constants.js` — All physics constants are correctly derived from spec.md. Transcribe them verbatim into `src/config/physics.ts` and `src/config/constants.ts`. This is the single most valuable artifact in v1.
- `js/collision.js` — The AABB tile collision logic (horizontal-then-vertical pass, 2px inset, `resolvePlayerTileCollision`, `resolveEnemyTileCollision`) is correct and matches the spec. Port this logic wholesale into `src/systems/TileCollision.ts`. Do not use Phaser arcade physics — use this custom implementation exactly as specified.
- `js/input.js` — The edge-triggered / polling distinction and key map are right. Port to `src/systems/InputManager.ts`.
- `js/level.js` (the World 1-1 grid builder) — The pipe layout, ground segments, and block coordinates are the canonical data. Transcribe into `src/data/levels/world1-1.ts`.

**Discard entirely:**

- `js/engine.js` — Replaces with Phaser scene architecture. The dynamic-import fallback/stub pattern is a v1 workaround that has no place in v2.
- `js/renderer.js` — All programmatic canvas 2D drawing (fillRect-based sprites) is replaced by NES-accurate palette-indexed pixel arrays rendered via Phaser's `Graphics` or `RenderTexture`. The color constants in renderer.js are approximately correct but will be revalidated against the NES palette.
- `js/enemies.js` — Has internal copies of physics constants (hardcoded `GRAVITY = 0.5`) and imports from `level.js` directly rather than through a shared system. Rewrite as proper TypeScript classes extending a base `Enemy` class.
- `js/audio.js` — Correct architecture. Port the `playTone` / `playNoise` helpers and all SFX synthesis specs into `src/systems/AudioSystem.ts`. The music sequencer loop logic can be lifted directly.
- `js/ui.js` — ScorePopup and Particle classes are fine. Port to `src/systems/ParticleSystem.ts` and `src/ui/ScorePopup.ts`.
- `js/player.js` — Port the state machine and physics logic into `src/entities/player/Mario.ts`. The Fireball inner class moves to `src/entities/items/Fireball.ts`.

**Why Phaser 3 specifically:**

Phaser gives us scene lifecycle management, a WebGL renderer (critical for 60fps with many sprites), texture atlas support, camera management primitives, and a game loop that handles `requestAnimationFrame` + delta time correctly. We use none of Phaser's physics engine. We use: Phaser scenes, Phaser cameras, Phaser's `GameObjects.Graphics` for sprite rendering from pixel arrays, Phaser's `GameObjects.Group` for object pooling, and Phaser's `Sound.WebAudioSoundManager` only as a fallback — primary audio is still Web Audio API directly because the spec requires procedural synthesis.

---

## 2. SE1 Task List — Core Systems Engineer

SE1 owns: project scaffolding, game loop/scene architecture, player physics and state machine, tile collision system, camera system, input manager, enemy base class and AI, game state machine, and all TypeScript interfaces.

### 2.1 Project Scaffolding

**Files to create:**

```
my-mario/
├── index.html                    (update: Vite entry, remove script tag)
├── vite.config.ts
├── tsconfig.json
├── package.json
├── src/
│   ├── main.ts                   (Phaser.Game config, scene registry)
│   ├── config/
│   │   ├── physics.ts            (all physics constants — transcribed from constants.js)
│   │   ├── constants.ts          (canvas, tile, HUD, game state constants)
│   │   └── audio.ts              (audio frequency constants)
│   ├── types/
│   │   ├── entities.ts           (Entity, PlayerState, EnemyType, ItemType interfaces)
│   │   ├── level.ts              (LevelData, TileGrid, EnemyDef, BlockDef, TriggerDef)
│   │   └── input.ts              (InputSnapshot interface)
│   ├── scenes/
│   │   ├── BootScene.ts
│   │   ├── PreloadScene.ts
│   │   ├── WorldScene.ts         (main gameplay scene — SE1 owns scaffold and update loop)
│   │   └── UIScene.ts            (parallel HUD scene — SE2 owns rendering, SE1 owns data feed)
│   ├── systems/
│   │   ├── InputManager.ts
│   │   ├── TileCollision.ts
│   │   ├── CameraSystem.ts
│   │   └── GameStateMachine.ts
│   ├── entities/
│   │   ├── Entity.ts             (base class)
│   │   ├── player/
│   │   │   ├── Mario.ts
│   │   │   └── Fireball.ts
│   │   └── enemies/
│   │       ├── Enemy.ts          (base enemy class — SE1)
│   │       ├── Goomba.ts
│   │       ├── KoopaTroopa.ts
│   │       ├── Shell.ts
│   │       ├── PiranhaPlant.ts
│   │       └── FlyingKoopa.ts
```

**`vite.config.ts`:** Standard Vite config. No special plugins. Output to `dist/`. Base URL: `./` for GitHub Pages compatibility.

**`tsconfig.json`:** `"strict": true`, `"target": "ES2020"`, `"moduleResolution": "bundler"`, `"lib": ["ES2020", "DOM"]`.

**`package.json` dependencies:**
```json
{
  "phaser": "^3.80.0",
  "typescript": "^5.4.0",
  "vite": "^5.2.0"
}
```

**`src/main.ts` — Phaser.Game config:**
```typescript
new Phaser.Game({
  type: Phaser.AUTO,
  width: 512,
  height: 480,
  backgroundColor: '#000000',
  pixelArt: true,                    // disables texture smoothing globally
  scene: [BootScene, PreloadScene, WorldScene, UIScene],
  render: {
    antialias: false,
    pixelArt: true,
    roundPixels: true,
  },
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
```

---

### 2.2 Physics Constants (`src/config/physics.ts`)

Transcribe exactly from `js/constants.js`. These are correct and verified against spec.md.

```typescript
// Gravity
export const GRAVITY             = 0.5;   // px/frame²
export const MAX_FALL_SPEED      = 8.0;   // px/frame

// Jump
export const JUMP_VELOCITY       = -8.5;  // px/frame (initial vy)
export const JUMP_HOLD_GRAVITY   = 0.25;  // px/frame² while jump held AND vy < 0
export const JUMP_RELEASE_GRAVITY= 0.5;   // px/frame² once released or vy >= 0

// Input feel
export const COYOTE_FRAMES       = 4;
export const JUMP_BUFFER_FRAMES  = 6;

// Horizontal
export const WALK_ACCELERATION   = 0.15;
export const RUN_ACCELERATION    = 0.25;
export const WALK_MAX_SPEED      = 2.5;
export const RUN_MAX_SPEED       = 5.0;
export const SKID_DECELERATION   = 0.35;
export const GROUND_FRICTION     = 0.12;
export const AIR_RESISTANCE      = 0.04;

// Death
export const DEATH_POP_VELOCITY  = -8.0;

// Fireball
export const FIREBALL_SPEED_X    = 6.0;
export const FIREBALL_SPEED_Y    = -4.0;
export const FIREBALL_GRAVITY    = 0.4;
export const FIREBALL_MAX_BOUNCES= 5;
export const FIREBALL_MAX_ACTIVE = 2;

// Enemy speeds
export const GOOMBA_SPEED        = 1.0;
export const KOOPA_SPEED         = 1.0;
export const KOOPA_SHELL_SPEED   = 8.0;
export const FLYING_KOOPA_SPEED  = 1.5;
export const PIRANHA_RISE_TIME   = 120;   // frames
export const PIRANHA_PAUSE_TIME  = 120;   // frames

// Camera
export const CAMERA_LEAD_X       = 128;   // logical px from left edge to Mario
```

---

### 2.3 Input Manager (`src/systems/InputManager.ts`)

Port directly from `js/input.js`. No changes to the model — the edge-triggered vs. polling distinction is correct.

```typescript
export interface InputSnapshot {
  left:     boolean;
  right:    boolean;
  down:     boolean;
  run:      boolean;     // X held
  jumpHeld: boolean;     // Space/Z held
  jump:     boolean;     // edge: pressed this frame
  fire:     boolean;     // edge: X pressed this frame
  start:    boolean;     // edge: Enter pressed this frame
}
```

- Attach listeners to `document` in constructor.
- `pollInput(): InputSnapshot` — called once per update tick at the top of `WorldScene.update()`. Consumes edge flags (jump, fire, start) after returning.
- Jump buffer implementation: if `jump` edge fires while airborne, set `jumpBufferTimer = JUMP_BUFFER_FRAMES`. Decrement each frame. `Mario.update()` checks `jumpBufferTimer > 0` instead of just the edge flag.
- Coyote time implementation: lives in `Mario.ts`, not InputManager. Mario tracks `coyoteTimer` frames since last grounded.

---

### 2.4 Tile Collision System (`src/systems/TileCollision.ts`)

Port from `js/collision.js` verbatim. This implementation is correct. Use TypeScript types throughout.

```typescript
export interface CollisionResult {
  left: boolean; right: boolean; top: boolean; bottom: boolean;
}

export interface CollisionCallbacks {
  onBottomHit?: (col: number, row: number) => void;
  onTopHit?:    (col: number, row: number) => void;
  onLeftHit?:   (col: number, row: number) => void;
  onRightHit?:  (col: number, row: number) => void;
}

export interface PhysicsEntity {
  x: number; y: number; w: number; h: number; vx: number; vy: number;
}

export function resolvePlayerTileCollision(
  entity: PhysicsEntity,
  grid: TileGrid,
  callbacks: CollisionCallbacks
): CollisionResult

export function resolveEnemyTileCollision(
  enemy: PhysicsEntity & { reverseOnWall: boolean },
  grid: TileGrid
): CollisionResult

export function resolveFireballTileCollision(
  fb: Fireball,
  grid: TileGrid,
  maxBounces: number
): void

export function isGrounded(entity: PhysicsEntity, grid: TileGrid): boolean
export function isLedgeAhead(entity: PhysicsEntity, grid: TileGrid): boolean
export function isStomping(mario: PhysicsEntity & { vy: number }, enemy: PhysicsEntity): boolean
export function isSideHit(mario: PhysicsEntity, enemy: PhysicsEntity): boolean
export function broadPhaseFilter<T extends PhysicsEntity>(bounds: PhysicsEntity, entities: T[], margin?: number): T[]
```

**Critical implementation note on the v1 collision bug:** The `resolvePlayerTileCollision` in v1 applies horizontal movement (`entity.x += entity.vx`) after resolution, then applies vertical movement in the second pass. This is correct. Do not change this ordering. The 2px inset on vertical pass (`x + 2` to `x + w - 3`) prevents corner-catching and must be preserved.

**Block interaction callbacks:** When `onTopHit` fires (Mario bonks a block from below), the WorldScene's callback must:
1. Look up the tile ID at `(col, row)`.
2. If `QUESTION` or `INVISIBLE`: reveal content, convert tile to `USED`, spawn item.
3. If `BRICK` and Mario is Super/Fire: remove tile from grid, spawn 4 debris particles.
4. If `BRICK` and Mario is Small: play shake animation (2px up over 2 frames, 2px back over 2 frames). Do NOT remove tile.
5. Zero Mario's `vy` immediately (already done by collision resolver).

---

### 2.5 Player State Machine (`src/entities/player/Mario.ts`)

Port from `js/player.js`. The state machine and physics logic are correct. Rewrite in TypeScript with strict types.

**State model:**

```typescript
enum MarioForm   { SMALL, SUPER, FIRE }
enum AnimState   { IDLE, WALK, SKID, JUMP, CROUCH, DEATH, GROW, SLIDE }
```

Invincibility is a separate overlay tracked with `invincibleTimer: number` (counts down from 600). Hurt invincibility uses `hurtInvincibleTimer: number` (counts down from 120, 10Hz flicker via `Math.floor(hurtInvincibleTimer / 6) % 2`).

**`update(input: InputSnapshot, grid: TileGrid, levelWidth: number): void`**

Step-by-step update order (must follow this exact sequence):

1. **Coyote timer:** If grounded last frame and not grounded this frame, start coyote countdown. If grounded this frame, reset to `COYOTE_FRAMES`.
2. **Crouch:** If `input.down` AND form is SUPER or FIRE AND grounded: set `crouching = true`, shrink hitbox to 12×16. Cannot enter crouch while airborne. Prevent uncrouch if ceiling directly above (check `isGrounded` for ceiling — check 1px above head).
3. **Horizontal input:** If not crouching:
   - If run key held AND direction held: apply `RUN_ACCELERATION`; clamp to `RUN_MAX_SPEED`.
   - If walk key held (no run): apply `WALK_ACCELERATION`; clamp to `WALK_MAX_SPEED`. If currently above `WALK_MAX_SPEED` (ran into non-run state), apply `AIR_RESISTANCE` not full deceleration — momentum preserved.
   - If direction reversal AND `|vx| > 1.5`: set `animState = SKID`, apply `SKID_DECELERATION`.
   - If no key: apply `GROUND_FRICTION` (grounded) or `AIR_RESISTANCE` (airborne).
4. **Jump:** If `jump` consumed OR `jumpBufferTimer > 0`, AND (`grounded` OR `coyoteTimer > 0`): set `vy = JUMP_VELOCITY`, clear `grounded`, clear `coyoteTimer`, clear `jumpBufferTimer`, set `isJumping = true`.
5. **Jump hold gravity:** If `isJumping` AND `input.jumpHeld` AND `vy < 0`: apply `JUMP_HOLD_GRAVITY`. Else apply `JUMP_RELEASE_GRAVITY`. If `vy >= 0`, clear `isJumping`.
6. **Cap fall speed:** `vy = Math.min(vy, MAX_FALL_SPEED)`.
7. **Tile collision:** Call `resolvePlayerTileCollision`. On bottom hit → `grounded = true`. On top hit → zero vy (already done), trigger block interaction callback.
8. **Pit check:** If `y > LEVEL_HEIGHT_PX + 32` (32px below bottom): trigger death.
9. **Fireballs:** If `input.fire` AND form is FIRE AND `activeFireballs.length < 2`: spawn Fireball at Mario's hand position.
10. **Animation state:** Determine from velocities, grounded state, crouching. Advance `animFrame` counter.
11. **Invincibility timers:** Decrement both. Starman invincibility overrides form at render time.
12. **Power-up transitions:** If `growTimer > 0`, run growth animation (alternate SMALL/SUPER sprite for 60 frames). Freeze input during growth.

**`onEnemyContact(enemy: Enemy): void`**
- If invincible (either type): deal with enemy, no damage to Mario.
- If hurtInvincibleTimer > 0: no effect.
- Else: downgrade form (FIRE→SUPER, SUPER→SMALL, SMALL→death), start hurtInvincibleTimer.

**`onPowerUp(type: ItemType): void`**
- MUSHROOM: if SMALL → start grow animation to SUPER.
- FLOWER: if SMALL → grow to SUPER (mushroom behavior); if SUPER or FIRE → transition to FIRE.
- STAR: set `invincibleTimer = 600`.
- ONE_UP: increment lives, show "1UP" popup.

**Hitboxes:**
```
Small Mario:  w=12, h=16  (2px inset each side from 16px sprite)
Super Mario:  w=12, h=24  (bottom-aligned; grows upward on power-up)
Crouching:    w=12, h=16  (Super/Fire crouching = same as Small)
```

---

### 2.6 Camera System (`src/systems/CameraSystem.ts`)

Phaser has a camera object. Do not use Phaser camera scroll directly — instead manage a logical `cameraX` number and pass it to all render calls. This keeps the coordinate system clean and matching v1's approach.

```typescript
export class CameraSystem {
  cameraX: number = 0;

  update(marioX: number, levelWidthPx: number, canvasLogicalWidth: number): void {
    const target = marioX - CAMERA_LEAD_X;
    const maxX   = levelWidthPx - canvasLogicalWidth;
    // No left-scroll: camera.x never decreases
    this.cameraX = Math.max(this.cameraX, Math.min(target, maxX));
    this.cameraX = Math.max(0, this.cameraX);
  }

  worldToScreen(worldX: number): number {
    return worldX - this.cameraX;
  }

  // Viewport bounds for culling (with margin)
  viewportLeft(margin: number = 32): number  { return this.cameraX - margin; }
  viewportRight(margin: number = 32): number { return this.cameraX + LOGICAL_WIDTH + margin; }
}
```

Tell Phaser's camera to follow `cameraX` via `scene.cameras.main.setScroll(cameraX * SCALE, 0)` at the end of each update. All GameObjects are placed in world (logical) coordinates; Phaser handles the final transform.

---

### 2.7 Game State Machine (`src/systems/GameStateMachine.ts`)

```typescript
enum Screen { TITLE, INTRO, PLAYING, PAUSED, DEATH, WIN, GAMEOVER }

interface GameState {
  screen:     Screen;
  score:      number;   // wraps at 999999
  coins:      number;   // wraps at 100 → +1 life
  lives:      number;
  world:      number;
  levelNum:   number;
  time:       number;   // seconds remaining (counted from TIME_LIMIT = 400)
  frameCount: number;
  hurryMode:  boolean;
  // Sub-timers
  introTimer:    number;
  gameoverTimer: number;
  winTimer:      number;
  titleBlink:    number;
  stompCombo:    number;  // consecutive stomps this airborne sequence
}
```

Screen transitions:

```
TITLE    + Enter           → INTRO (3s)
INTRO    + timer done      → PLAYING
PLAYING  + Enter           → PAUSED
PAUSED   + Enter           → PLAYING
PLAYING  + death trigger   → DEATH (120 frames, all logic frozen)
DEATH    + timer done      → lives > 0 ? INTRO : GAMEOVER
PLAYING  + flagpole touch  → WIN (time bonus, fanfare)
WIN      + timer done      → INTRO (next level)
GAMEOVER + timer done      → TITLE
```

**Time countdown:** In `PLAYING`, decrement `time` by `1/60` each frame. When `time <= 100` and not already `hurryMode`: set `hurryMode = true`, notify AudioSystem to double BPM. When `time <= 0`: trigger death.

**Score:** Always `Math.min(score + points, 999999)`. At exactly 999999, wrap to 0 on next increment.

**Coins:** At 100: lives++, coins = 0, play 1UP jingle.

**Stomp combo:** Reset to 0 when Mario lands. Increment before each stomp. Points = `STOMP_COMBO_POINTS[Math.min(stompCombo - 1, 7)]`. At stomp 9+: +1 life instead of points.

---

### 2.8 Enemy Base Class (`src/entities/enemies/Enemy.ts`)

```typescript
export abstract class Enemy {
  x: number; y: number;
  w: number; h: number;
  vx: number; vy: number;
  alive: boolean;
  active: boolean;  // false = offscreen, skip update
  facing: number;   // 1 = right, -1 = left
  reverseOnWall: boolean;
  animFrame: number;
  frameTimer: number;

  abstract update(grid: TileGrid, mario: Mario, dt: number): void;
  abstract onStomp(mario: Mario): void;
  abstract onFireball(): void;
  abstract onShell(): void;

  protected applyGravity(): void {
    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL_SPEED);
  }

  protected resolveTiles(grid: TileGrid): CollisionResult {
    return resolveEnemyTileCollision(this, grid);
  }

  isInViewport(cameraX: number): boolean {
    return this.x + this.w > cameraX - 32 && this.x < cameraX + LOGICAL_WIDTH + 32;
  }
}
```

**Activation rule:** Enemies only call `update()` if `active`. Set `active = true` when enemy first enters viewport + 2 tile margin. Set `active = false` (and `alive = false`) when enemy exits viewport on the left (scrolled past).

---

### 2.9 WorldScene Update Loop (`src/scenes/WorldScene.ts`)

```typescript
update(time: number, delta: number): void {
  if (gameState.screen === Screen.PAUSED) return;
  if (gameState.screen === Screen.DEATH && !mario.deathAnimDone()) return;

  const input = inputManager.pollInput();

  // 1. Player update
  mario.update(input, level.grid, level.widthPx);

  // 2. Enemy updates (active only)
  for (const enemy of enemies) {
    if (!enemy.isInViewport(camera.cameraX)) continue;
    enemy.update(level.grid, mario, delta);
  }

  // 3. Item updates (power-ups, fireballs)
  for (const item of items) item.update(level.grid);

  // 4. Collisions
  // 4a. Player vs enemies
  for (const enemy of enemies) {
    if (!enemy.alive || !enemy.active) continue;
    if (isStomping(mario, enemy)) {
      mario.bounceOffEnemy();
      enemy.onStomp(mario);
      gameState.addScore(STOMP_COMBO_POINTS[...]);
    } else if (isSideHit(mario, enemy)) {
      mario.onEnemyContact(enemy);
    }
  }
  // 4b. Fireballs vs enemies
  for (const fb of mario.fireballs) {
    for (const enemy of enemies) {
      if (fb.alive && enemy.alive && entitiesOverlap(fb, enemy)) {
        enemy.onFireball();
        fb.alive = false;
      }
    }
  }
  // 4c. Shell vs enemies (if shell is sliding)
  // 4d. Player vs items
  for (const item of items) {
    if (entitiesOverlap(mario, item)) item.collect(mario, gameState);
  }
  // 4e. Player vs coin tiles (handled in tile collision callback)

  // 5. Camera
  camera.update(mario.x, level.widthPx, LOGICAL_WIDTH);

  // 6. Game state
  stateMachine.update();

  // 7. Particles and score popups
  particleSystem.update();

  // 8. Audio tick
  audioSystem.tick();

  // 9. Cull dead entities
  enemies = enemies.filter(e => e.alive);
  items   = items.filter(i => i.alive);
}
```

**Fixed timestep:** Phaser's `update(time, delta)` gives real delta in ms. Physics runs at 60Hz logical steps. Do not multiply physics values by delta — they are already per-frame values. Cap delta at 50ms (= 3 frames) to prevent spiral of death on tab switch. If delta > 16.67ms, run multiple physics steps.

---

## 3. SE2 Task List — Graphics, Content, and Audio Engineer

SE2 owns: all sprite rendering, NES-accurate pixel art encoding, tile drawing, level data, all enemy sprites, HUD rendering, audio synthesis, particle VFX, and UIScene.

### 3.1 NES-Accurate Sprite Encoding Strategy

**Decision:** Sprites are encoded as palette-indexed 2D arrays in TypeScript source files. No external image files. No Aseprite. No Tiled. All pixel data lives in `.ts` files.

This matches what spec.md requires and what v1 attempted (programmatic drawing). The v2 improvement is that sprites are defined as static pixel arrays rather than imperative `fillRect` calls, making them inspectable, editable, and cacheable.

**Palette definition (`src/config/palette.ts`):**

The NES hardware palette is fixed. Define all colors used by the game as RGB hex strings matching the canonical NES palette. Cross-reference against https://www.nesdev.org/wiki/PPU_palettes for accuracy.

```typescript
// NES palette entries used by SMB
export const NES = {
  TRANSPARENT: null,
  BLACK:       '#000000',
  WHITE:       '#FCFCFC',
  SKY_BLUE:    '#5C94FC',   // NES $22
  RED:         '#D82800',   // NES $16
  DARK_RED:    '#881400',   // NES $06
  ORANGE:      '#FC7460',   // NES $26
  YELLOW:      '#FCD840',   // NES $28
  GREEN:       '#00A800',   // NES $1A
  DARK_GREEN:  '#006800',   // NES $0A
  LIGHT_GREEN: '#58D854',   // NES $2A
  TAN:         '#FCBCB0',   // NES $36  (Mario skin)
  BROWN:       '#AC7C00',   // NES $18  (Mario hat/overalls shadow)
  DARK_BROWN:  '#503000',   // NES $08
  GRAY:        '#BCBCBC',   // NES $10  (coin, flagpole)
  DARK_GRAY:   '#585858',   // NES $00
  PIPE_GREEN:  '#00A800',
  BRICK_RED:   '#D82800',
  GOLD:        '#FCD840',
} as const;

export type NESColor = typeof NES[keyof typeof NES];
```

**Sprite data format:**

```typescript
// Each sprite is a 2D array: rows × cols of NESColor (null = transparent)
export type SpriteData = (NESColor | null)[][];

export interface Sprite {
  width:  number;
  height: number;
  pixels: SpriteData;
}
```

**Rendering a sprite (`src/systems/SpriteRenderer.ts`):**

Pre-bake each sprite into a Phaser `RenderTexture` at game startup (in PreloadScene). During gameplay, render cached textures — do not iterate pixel arrays every frame.

```typescript
export function bakeSprite(
  scene: Phaser.Scene,
  key: string,
  sprite: Sprite,
  scale: number = 2
): void {
  const rt = scene.add.renderTexture(0, 0, sprite.width * scale, sprite.height * scale);
  const gfx = scene.add.graphics();
  for (let row = 0; row < sprite.height; row++) {
    for (let col = 0; col < sprite.width; col++) {
      const color = sprite.pixels[row][col];
      if (color === null) continue;
      gfx.fillStyle(hexToInt(color), 1);
      gfx.fillRect(col * scale, row * scale, scale, scale);
    }
  }
  rt.draw(gfx);
  rt.saveTexture(key);
  gfx.destroy();
  rt.destroy();
}
```

Baking happens once in PreloadScene for all sprites. All baked textures are stored in Phaser's texture cache under their key. Rendering is a single `scene.add.image(x, y, key)` call or `setTexture(key)` on a pooled `Image`.

**Flip:** Use `image.setFlipX(true)` for left-facing sprites instead of storing separate mirrored pixel arrays.

---

### 3.2 Full Sprite List (`src/assets/sprites/`)

Organize into files by category. All dimensions are in logical pixels (16×16 = one tile).

**`src/assets/sprites/mario.ts`**

| Key | Dims | Description |
|-----|------|-------------|
| `mario_small_idle` | 12×16 | Standing |
| `mario_small_walk1` | 12×16 | Walk frame 1 |
| `mario_small_walk2` | 12×16 | Walk frame 2 |
| `mario_small_walk3` | 12×16 | Walk frame 3 |
| `mario_small_jump` | 12×16 | Airborne |
| `mario_small_skid` | 12×16 | Braking |
| `mario_small_death` | 12×16 | Death pose |
| `mario_super_idle` | 12×24 | Standing (tall) |
| `mario_super_walk1` | 12×24 | Walk frame 1 |
| `mario_super_walk2` | 12×24 | Walk frame 2 |
| `mario_super_walk3` | 12×24 | Walk frame 3 |
| `mario_super_jump` | 12×24 | Airborne |
| `mario_super_skid` | 12×24 | Braking |
| `mario_super_crouch` | 12×16 | Crouching |
| `mario_fire_idle` | 12×24 | Fire form standing |
| `mario_fire_walk1` | 12×24 | |
| `mario_fire_walk2` | 12×24 | |
| `mario_fire_walk3` | 12×24 | |
| `mario_fire_jump` | 12×24 | |
| `mario_fire_skid` | 12×24 | |
| `mario_fire_crouch` | 12×16 | |
| `mario_climb` | 12×24 | Flagpole slide |

Fire Mario palette swap: hat/shirt = WHITE, overalls = RED. Share pixel layout with Super, only change palette indices.

**`src/assets/sprites/enemies.ts`**

| Key | Dims | Description |
|-----|------|-------------|
| `goomba_walk1` | 16×16 | |
| `goomba_walk2` | 16×16 | |
| `goomba_squish` | 16×8 | Flat after stomp |
| `koopa_walk1` | 16×24 | 1.5 tile tall |
| `koopa_walk2` | 16×24 | |
| `koopa_shell` | 16×16 | Stationary shell |
| `koopa_shell_spin1` | 16×16 | Sliding frame 1 |
| `koopa_shell_spin2` | 16×16 | Sliding frame 2 |
| `piranha_open` | 16×24 | Mouth open |
| `piranha_closed` | 16×24 | Mouth closed |
| `flying_koopa_walk1` | 16×24 | With wings |
| `flying_koopa_walk2` | 16×24 | |

**`src/assets/sprites/items.ts`**

| Key | Dims | Description |
|-----|------|-------------|
| `mushroom_red` | 16×16 | |
| `mushroom_1up` | 16×16 | Green |
| `fire_flower1` | 16×16 | Frame 1 |
| `fire_flower2` | 16×16 | Frame 2 |
| `starman1` | 16×16 | |
| `starman2` | 16×16 | |
| `fireball1` | 8×8 | |
| `fireball2` | 8×8 | |
| `fireball_explode` | 16×16 | |
| `coin1` | 8×16 | |
| `coin2` | 8×16 | |

**`src/assets/sprites/tiles.ts`**

| Key | Dims | Description |
|-----|------|-------------|
| `tile_ground_top` | 16×16 | Top row of ground |
| `tile_ground_fill` | 16×16 | Ground fill rows |
| `tile_brick` | 16×16 | |
| `tile_question1` | 16×16 | Animated frame 1 |
| `tile_question2` | 16×16 | Animated frame 2 (or 3) |
| `tile_used` | 16×16 | Depleted ? block |
| `tile_hard` | 16×16 | Indestructible |
| `tile_pipe_tl` | 16×16 | Pipe top-left cap |
| `tile_pipe_tr` | 16×16 | Pipe top-right cap |
| `tile_pipe_bl` | 16×16 | Pipe body-left |
| `tile_pipe_br` | 16×16 | Pipe body-right |
| `tile_flagpole` | 4×16 | Pole segment (4px wide) |
| `tile_flag` | 16×12 | Flag at top |
| `tile_castle_wall` | 16×16 | |
| `tile_castle_door` | 16×32 | Door (2 tiles tall) |
| `tile_castle_top` | 16×16 | Battlements |
| `tile_castle_window` | 16×16 | |

**`src/assets/sprites/hud.ts`**

| Key | Dims | Description |
|-----|------|-------------|
| `hud_coin_icon` | 8×8 | Rotating coin for HUD |
| `hud_digit_0` through `hud_digit_9` | 8×8 | |
| `hud_letter_*` | 8×8 | All letters needed: M,A,R,I,O,W,L,D,T,E,X,U,P,C,S,G,V,H,B,N |

---

### 3.3 Enemy Implementations

**Goomba (`src/entities/enemies/Goomba.ts`):**
- `vx = -GOOMBA_SPEED` on spawn (moves left).
- `reverseOnWall = true`: flips direction on wall contact.
- `update`: apply gravity, resolve tiles, check wall hit → reverse. Walk off ledges (no ledge check).
- `onStomp`: set `alive = false`, play squish animation for 30 frames then remove, +100 pts (or combo).
- `onFireball`: `alive = false` immediately, +200 pts.

**KoopaTroopa (`src/entities/enemies/KoopaTroopa.ts`):**

States: `walking | shell_still | shell_sliding`

- Walking: same as Goomba but 24px tall.
- `onStomp` while walking: transition to `shell_still`, bounce Mario upward, +100 pts.
- `onStomp` while shell_still: transition to `shell_sliding`, `vx = facing * KOOPA_SHELL_SPEED`.
- `onStomp` while shell_sliding: transition to `shell_still`, stop.
- Shell sliding: `reverseOnWall = true` (bounce). Does not fall off ledges — use `isLedgeAhead()` and reverse. Shell kills any enemy on contact.
- Side contact with Mario while sliding: damage Mario.
- Despawn if exits viewport.

**Shell (`src/entities/enemies/Shell.ts`):**

A separate entity spawned when a Koopa shell is kicked. Simpler than the Koopa state machine. Same sliding rules. Chains kills. Chain points: 200, 400, 800, 1600... (doubles each kill). Shell persists until it exits the right side of the viewport.

**PiranhaPlant (`src/entities/enemies/PiranhaPlant.ts`):**

State machine: `hidden (120f) → rising (60f) → extended (120f) → retracting (60f) → repeat`

- Anchored to pipe top: `baseY = pipeTopY`. Does not move laterally.
- Does not start rising if Mario is within 1 tile horizontally.
- Not stompable. Fireball kills it (+200). Starman kills it.

**FlyingKoopa (`src/entities/enemies/FlyingKoopa.ts`):**

- 3-tile vertical patrol: sine wave `y = spawnY + sin(frame * 0.05) * 24`.
- `vx = FLYING_KOOPA_SPEED` (direction of spawn facing).
- Reverses at level walls. Does NOT reverse at ledges while flying.
- `onStomp`: lose wings, transition to `KoopaTroopa.walking` behavior.

---

### 3.4 Level Data for World 1-1 (`src/data/levels/world1-1.ts`)

Transcribe the grid builder from `js/level.js` into TypeScript. The coordinates in `js/level.js` match the spec. Port the grid construction directly.

```typescript
import { LevelData, TileGrid, EnemyDef, BlockDef, TriggerDef } from '../../types/level';
import { TILE, LEVEL_COLS, LEVEL_ROWS } from '../../config/constants';

export const WORLD_1_1: LevelData = {
  world:      1,
  area:       1,
  theme:      'overworld',
  timeLimit:  400,
  music:      'overworld',
  background: '#5C94FC',
  widthTiles: 224,
  heightTiles: 15,
  checkpointX: 1792,  // ~col 112, mid-level
  endType:    'flagpole',
  spawnCol:   3,
  spawnRow:   13,
  grid:       buildGrid(),
  enemies:    ENEMY_DEFS,
  blocks:     BLOCK_CONTENTS,
  pipeLinks:  [],
  triggers:   TRIGGERS,
};
```

**Grid construction:** Port `buildGrid()` from `js/level.js` exactly. Ground at rows 9–14 for specified column ranges. Pipes at the specified columns and rows. Staircase built as `HARD` tiles per the step table in spec.md.

**Block contents (`BLOCK_CONTENTS: BlockDef[]`):**

From spec.md and standard World 1-1 layout:

```typescript
const BLOCK_CONTENTS: BlockDef[] = [
  // Q blocks with specific contents (col, row, content)
  { col: 16, row: 9,  type: 'Q', content: 'coin' },
  { col: 21, row: 9,  type: 'Q', content: 'mushroom' },  // first mushroom
  { col: 22, row: 9,  type: 'Q', content: 'coin' },
  { col: 23, row: 9,  type: 'Q', content: 'coin' },
  { col: 78, row: 6,  type: 'Q', content: 'coin' },
  { col: 78, row: 9,  type: 'Q', content: 'star' },
  { col: 94, row: 6,  type: 'Q', content: 'coin' },
  { col: 95, row: 6,  type: 'Q', content: 'coin' },
  { col: 110, row: 6, type: 'Q', content: 'flower' },
  // Bricks with coin rows — all brick tiles above listed cols
  // Hidden blocks: 1-up positions per original SMB layout
];
```

**Enemy spawn definitions (`ENEMY_DEFS: EnemyDef[]`):**

Transcribe exactly from spec.md section §27 (World 1-1 Reference Layout):

```typescript
const ENEMY_DEFS: EnemyDef[] = [
  { type: 'goomba',       col: 22,  row: 13 },
  { type: 'goomba',       col: 23,  row: 13 },
  { type: 'goomba',       col: 39,  row: 13 },
  { type: 'goomba',       col: 40,  row: 13 },
  { type: 'koopa_troopa', col: 57,  row: 12 },
  { type: 'goomba',       col: 80,  row: 13 },
  { type: 'goomba',       col: 81,  row: 13 },
  { type: 'piranha',      col: 97,  row: 11 },  // tall pipe
  { type: 'goomba',       col: 107, row: 13 },
  { type: 'goomba',       col: 108, row: 13 },
  { type: 'goomba',       col: 110, row: 13 },
  { type: 'goomba',       col: 111, row: 13 },
  { type: 'koopa_troopa', col: 128, row: 13 },
  { type: 'goomba',       col: 149, row: 13 },
  { type: 'goomba',       col: 150, row: 13 },
  { type: 'goomba',       col: 153, row: 13 },
  { type: 'goomba',       col: 154, row: 13 },
];
```

---

### 3.5 Tile Renderer (`src/systems/TileRenderer.ts`)

Renders only tiles within `[cameraX - 32, cameraX + LOGICAL_WIDTH + 32]` each frame.

```typescript
export class TileRenderer {
  drawTiles(
    scene: Phaser.Scene,
    grid: TileGrid,
    cameraX: number,
    frameCount: number
  ): void {
    const colStart = Math.max(0, Math.floor((cameraX - 32) / TILE_SIZE));
    const colEnd   = Math.min(LEVEL_COLS - 1, Math.ceil((cameraX + LOGICAL_WIDTH + 32) / TILE_SIZE));

    for (let row = 0; row < LEVEL_ROWS; row++) {
      for (let col = colStart; col <= colEnd; col++) {
        const tileId = grid[row][col];
        if (tileId === TILE.EMPTY) continue;
        const key = tileKeyForId(tileId, frameCount);  // handles question block animation
        const sx  = (col * TILE_SIZE - cameraX) * SCALE;
        const sy  = row * TILE_SIZE * SCALE + HUD.HEIGHT_C;
        // Use pooled Image objects to avoid allocation
        this.drawCachedTile(scene, key, sx, sy);
      }
    }
  }
}
```

**Question block animation:** `tileKeyForId` returns `tile_question1` or `tile_question2` based on `Math.floor(frameCount / 8) % 2`. Coin animation (from blocks): `coin1` or `coin2` at `Math.floor(frameCount / 4) % 2`.

---

### 3.6 HUD Rendering (`src/scenes/UIScene.ts`)

UIScene runs in parallel with WorldScene using `scene.launch('UIScene')`. It reads from a shared `gameState` singleton.

**Layout (canvas coordinates at 2× scale):**

| Element | Canvas X | Canvas Y |
|---------|----------|----------|
| Black bar background | 0 | 0 → 48px |
| "MARIO" | 24 | 16 |
| Score (6 digits) | 24 | 32 |
| Coin icon | 200 | 16 |
| "×" | 214 | 16 |
| Coin count (2 digits) | 228 | 16 |
| "WORLD" | 312 | 16 |
| World "1-1" | 318 | 32 |
| "TIME" | 424 | 16 |
| Time (3 digits) | 430 | 32 |

Font: NES-style 8×8 logical (16×16 canvas). Render via baked `hud_digit_*` and `hud_letter_*` sprites. White fill, black 1px shadow (+1,+1).

UIScene never scrolls. It is fixed at canvas position. Do not apply camera offset to HUD elements.

---

### 3.7 Audio System (`src/systems/AudioSystem.ts`)

Port from `js/audio.js`. All procedural synthesis via Web Audio API (not Phaser's sound manager).

**Initialization:** Create AudioContext on first user interaction (pointer or key event). Check `audioCtx.state === 'suspended'` and call `.resume()` before every sound.

**Gain chain:**
```
masterGain (0.7) → AudioContext.destination
  musicGain (0.5) → masterGain
  sfxGain   (0.8) → masterGain
```

**SFX — exact synthesis specs from spec.md:**

```typescript
export function playSfx(sfx: SFXType): void {
  switch (sfx) {
    case 'jump_small':
      playTone({ type: 'square', freq: 300, endFreq: 600, duration: 0.1,  gain: 0.3 });
      break;
    case 'jump_super':
      playTone({ type: 'square', freq: 200, endFreq: 500, duration: 0.15, gain: 0.3 });
      break;
    case 'coin':
      playTone({ type: 'sine',   freq: 988,  duration: 0.05, gain: 0.4 });
      playTone({ type: 'sine',   freq: 1319, duration: 0.15, gain: 0.4, startDelay: 0.05 });
      break;
    case 'powerup_spawn':
      playArpeggio(['C4','E4','G4','C5'], 0.1, 'square', 0.4);
      break;
    case 'powerup_collect':
      playArpeggio(['C5','D5','E5','F5','G5','A5','B5','C6'], 0.05, 'square', 0.5);
      break;
    case 'break_block':
      playNoise({ duration: 0.08, gain: 0.4, filterType: 'highpass', filterFreq: 2000 });
      break;
    case 'stomp':
      playTone({ type: 'square', freq: 200, endFreq: 100, duration: 0.1,  gain: 0.5 });
      break;
    case 'death':
      playArpeggio(['C5','Bb4','A4','Ab4','G4','F4','Eb4'], 0.1, 'square', 0.5);
      break;
    case 'one_up':
      playChord(['G4','E5'], 0.5, 'square', 0.5);
      break;
    case 'fireball':
      playNoise({ duration: 0.05, gain: 0.3, filterType: 'lowpass', filterFreq: 800 });
      break;
    case 'flagpole':
      playTone({ type: 'sine', freq: 660, endFreq: 220, duration: 1.0, gain: 0.5 });
      break;
  }
}
```

**Music:** Overworld theme at 120 BPM, switch to 240 BPM at `hurryMode`. The music sequencer runs via `setTimeout` scheduling ahead by 0.1s (AudioContext lookahead pattern). Separate sequences for: overworld, underground, underwater, castle, starman, death, level-clear, game-over.

**AudioSystem.tick():** Called each game frame. Checks if the next note needs scheduling. Does not use `setInterval` — uses AudioContext time for precise scheduling.

---

### 3.8 Particle System (`src/systems/ParticleSystem.ts`)

Port from `js/ui.js`. Two types:

**ScorePopup:** Text that floats up from event position. `vy = -0.5 px/frame`. Lifetime 60 frames. Fades linearly. Rendered in world space (subtract cameraX). Multiple can coexist.

**Particle (brick debris):** 4 particles per broken brick. Initial velocities: `(-2,-4), (2,-4), (-1,-3), (1,-3)`. Gravity 0.3. Color = brick orange. Rendered as 4×4 logical px squares. Lifetime 40 frames.

Use a pool of 64 pre-allocated Particle objects. Mark dead particles as available for reuse. Never allocate during gameplay.

**Power-up collect VFX:** Spawn 8 star particles radiating outward from collect position. Color = yellow. Lifetime 20 frames. No gravity.

---

### 3.9 Flagpole Sequence (SE2)

When Mario touches the flagpole:

1. Lock horizontal input.
2. Snap Mario to pole at exact x of pole.
3. Play `flagpole` SFX.
4. Mario slides down pole: `vy = 2`, gravity disabled. `animState = SLIDE`.
5. At bottom of pole (row 13): Mario walks right into castle door.
6. Calculate score based on grab height:
   - Pole is 10 tiles (rows 4–13). Contact row → bonus tier from spec.md scoring table.
7. Level complete fanfare plays.
8. Score time bonus: `gameState.time * 50` points, decremented visually at +50/frame until 0.

---

## 4. Integration Contract

This defines exactly how SE1 modules connect to SE2 modules. Both engineers must adhere to these interfaces without modification.

### 4.1 Shared Singleton: `gameState`

`src/systems/GameStateMachine.ts` exports a single mutable `gameState` object. All modules import it as a singleton. SE1 mutates it. SE2 reads it for HUD rendering.

```typescript
// src/systems/GameStateMachine.ts — exports singleton
export const gameState: GameState = { ... };
```

### 4.2 Level Data Interface

SE1 (WorldScene) reads level data. SE2 creates level data files.

```typescript
// src/types/level.ts
export interface LevelData {
  world:       number;
  area:        number;
  theme:       'overworld' | 'underground' | 'underwater' | 'athletic' | 'castle';
  timeLimit:   number;
  music:       string;
  background:  string;       // hex color
  widthTiles:  number;
  heightTiles: number;
  checkpointX: number;       // logical px x where checkpoint activates
  endType:     'flagpole' | 'castleAxe';
  spawnCol:    number;
  spawnRow:    number;
  grid:        TileGrid;     // string[][], 15 rows × 224 cols
  enemies:     EnemyDef[];
  blocks:      BlockDef[];   // question block / hidden block contents
  pipeLinks:   PipeLink[];
  triggers:    TriggerDef[];
}

export type TileGrid = string[][];

export interface EnemyDef {
  type:    EnemyType;
  col:     number;
  row:     number;
  facing?: number;  // default -1 (left)
}

export interface BlockDef {
  col:     number;
  row:     number;
  type:    'Q' | 'I';   // question or invisible
  content: 'coin' | 'mushroom' | 'flower' | 'star' | '1up';
}

export interface PipeLink {
  srcCol:  number;
  srcRow:  number;
  dstLevel: string;
  dstCol:  number;
  dstRow:  number;
}

export interface TriggerDef {
  type:    'checkpoint' | 'areaTransition' | 'warpZone';
  x:       number;  // logical px x
  payload: unknown;
}
```

### 4.3 Sprite Key Convention

SE2 bakes all sprites in PreloadScene. SE1 references sprites by string key. The key naming convention must be followed exactly:

```
{entity}_{form}_{state}[{frame}]
```

Examples: `mario_small_idle`, `mario_super_walk1`, `goomba_walk2`, `tile_question1`, `hud_digit_5`.

SE1 constructs sprite keys at runtime:

```typescript
function getMarioSpriteKey(mario: Mario): string {
  const form  = mario.form === MarioForm.SMALL ? 'small'
              : mario.form === MarioForm.FIRE  ? 'fire' : 'super';
  const state = mario.animState === AnimState.WALK
              ? `walk${mario.animFrame % 3 + 1}`
              : mario.animState.toLowerCase();
  return `mario_${form}_${state}`;
}
```

SE2 is responsible that every key this function can produce has a baked texture.

### 4.4 WorldScene → UIScene Data Feed

UIScene reads directly from `gameState` singleton each frame. No message passing needed. UIScene calls `scene.get('UIScene')` is not needed — the singleton is shared via import.

### 4.5 AudioSystem Interface

SE1 calls audio via:

```typescript
import { AudioSystem } from '../systems/AudioSystem';
const audio = AudioSystem.getInstance();

// SE1 calls:
audio.playSfx('jump_small');
audio.playSfx('stomp');
audio.startMusic('overworld');
audio.setHurryMode(true);
audio.stopMusic();
audio.pauseMusic();
audio.resumeMusic();
```

SE2 implements all of these in AudioSystem.

### 4.6 Block Interaction Callback

When SE1's tile collision calls `onTopHit(col, row)`, WorldScene calls into a `BlockInteractionSystem` that SE1 owns but uses SE2's content data:

```typescript
// SE1 owns this:
class BlockInteractionSystem {
  handleHit(col: number, row: number, mario: Mario, level: LevelData): void {
    const tileId = level.grid[row][col];
    const blockDef = level.blocks.find(b => b.col === col && b.row === row);

    if (tileId === TILE.QUESTION || tileId === TILE.INVISIBLE) {
      level.grid[row][col] = TILE.USED;
      if (blockDef) spawnItem(blockDef.content, col * TILE_SIZE, row * TILE_SIZE - TILE_SIZE);
      audio.playSfx('powerup_spawn');
    } else if (tileId === TILE.BRICK) {
      if (mario.form !== MarioForm.SMALL) {
        level.grid[row][col] = TILE.EMPTY;
        particleSystem.spawnBrickDebris(col * TILE_SIZE, row * TILE_SIZE);
        audio.playSfx('break_block');
        gameState.addScore(SCORE.BRICK_BREAK);
      } else {
        animateBlockShake(col, row);
        audio.playSfx('break_block');
      }
    }
  }
}
```

---

## 5. Performance Requirements

### 5.1 Frame Budget

Target: 60fps locked. 16.67ms per frame budget.

| System | Budget |
|--------|--------|
| Physics + collision | ≤ 3ms |
| Tile rendering (viewport cull) | ≤ 4ms |
| Enemy/item update + render | ≤ 3ms |
| Audio scheduling | ≤ 0.5ms |
| HUD rendering | ≤ 1ms |
| Particle system | ≤ 1ms |
| Overhead | ≤ 4ms |

### 5.2 Object Pooling — What Must Be Pooled

**Rule:** No `new` calls during active gameplay (`Screen.PLAYING`). All objects are pre-allocated.

| Pool | Size | Type |
|------|------|------|
| Fireballs | 2 | `Fireball` |
| Particles (debris, VFX) | 64 | `Particle` |
| ScorePopups | 16 | `ScorePopup` |
| Enemy instances | 32 | Mixed `Enemy[]` |
| Item instances (power-ups) | 8 | `Item` |
| Tile image objects | 320 | Phaser `Image` (20 cols × 16 rows) |

Implementation pattern:

```typescript
class Pool<T extends { alive: boolean }> {
  private items: T[];
  private factory: () => T;

  constructor(size: number, factory: () => T) {
    this.factory = factory;
    this.items = Array.from({ length: size }, factory);
    this.items.forEach(i => { i.alive = false; });
  }

  acquire(): T | null {
    const item = this.items.find(i => !i.alive);
    if (!item) return null;  // pool exhausted — log warning, do not throw
    item.alive = true;
    return item;
  }

  forEachActive(fn: (item: T) => void): void {
    this.items.filter(i => i.alive).forEach(fn);
  }
}
```

Phaser's `this.add.group({ classType, maxSize, runChildUpdate: false })` is used for the tile image pool. `runChildUpdate: false` because we update via our own loop.

### 5.3 Viewport Culling

**Tiles:** Only render columns within `[floor((cameraX-32)/16), ceil((cameraX+LOGICAL_WIDTH+32)/16)]`. At 2× scale this is ~18 columns visible + 4 margin = ~22 columns rendered. Max 22 × 15 = 330 tile images active at any time.

**Enemies:** Only call `update()` for enemies within viewport + 32px margin. Never activate enemies that are fully left of camera.x (already scrolled past). This is enforced in the WorldScene update loop.

**Particles:** No culling needed — lifetime is short (≤60 frames) and pool is bounded.

**Draw calls:** All sprites are Phaser GameObjects (Images). Phaser batches WebGL draw calls automatically. Minimize unique texture binds — all sprites should be in a single Phaser texture atlas if possible. Use `scene.textures.addCanvas('sprites', canvas)` to build one atlas from baked sprites.

### 5.4 Grid Access Optimization

The tile grid is `string[][]` — a 15-element array of 224-element arrays. Row-major access (grid[row][col]) is cache-friendly for horizontal collision scans. Do not convert to a flat array; the 2D structure is fine at this size.

For question block lookup, use a `Map<string, BlockDef>` keyed by `"col,row"` rather than `Array.find()` on every hit.

---

## 6. Critical Review Checklist

The reviewer must verify each item before accepting the PR for any phase.

### Phase 1 — Core (Player + Camera + Tiles + Pits + Flagpole)

- [ ] Physics constants exactly match spec.md values (GRAVITY=0.5, JUMP_VELOCITY=-8.5, etc.)
- [ ] Jump: short press rises ~3 tiles; full hold rises ~5 tiles. Test with a stopwatch and ruler against spec.
- [ ] Jump: releasing early cuts the arc (JUMP_HOLD_GRAVITY applies only while held and vy < 0)
- [ ] Coyote time: Mario can still jump exactly 4 frames after walking off a ledge. Test with a 5-frame walk-off — jump on frame 5 must fail.
- [ ] Jump buffer: pressing jump 6 frames before landing must register as a jump on landing. Frame 7 must not register.
- [ ] Run: holding X raises max speed to 5.0 px/frame. Releasing X while airborne preserves momentum (only AIR_RESISTANCE decelerates, not SKID).
- [ ] Skid: direction reversal while moving > 1.5 px/frame triggers skid animation and uses SKID_DECELERATION.
- [ ] Horizontal movement momentum preserved on jump (jump does not reset vx).
- [ ] Camera: never scrolls left. Mario positioned ~8 tiles from left edge of screen.
- [ ] Camera X clamped to [0, levelWidthPx - LOGICAL_WIDTH].
- [ ] Pit death: Mario death animation triggers when y > LEVEL_HEIGHT_PX + 32, not before.
- [ ] Death animation: Mario pops up (vy = -8), falls under normal gravity, all enemies frozen during animation.
- [ ] Hitboxes: Small Mario is 12×16 (not 16×16). Super Mario is 12×24.
- [ ] Viewport culling: only tiles in view are rendered. Open browser devtools Performance tab — no frame should exceed 16ms.
- [ ] 60fps: game locks to 60fps on a modern desktop. Verify with `requestAnimationFrame` timestamps.

### Phase 2 — Enemies + Question Blocks + Power-ups

- [ ] Goomba walks left, reverses on walls, walks off ledges.
- [ ] Goomba stomp: Mario bounces upward, Goomba enters squish state (30 frames then gone), +100 pts.
- [ ] Koopa stomp: enters shell_still state. Second stomp on still shell: slides at 8 px/frame. Stomp on sliding shell: stops it.
- [ ] Shell sliding: kills any enemy on contact. Chain scoring: 200, 400, 800... doubles each kill.
- [ ] Shell reverses on walls. Does not fall off ledges.
- [ ] Question block hit from below: spawns item, converts to USED block.
- [ ] Question block hit from above: no effect.
- [ ] Brick hit by Small Mario: block shakes (2px up/down), +50 pts, NOT destroyed.
- [ ] Brick hit by Super/Fire Mario: block destroyed, 4 debris particles, +50 pts.
- [ ] Mushroom spawns, slides right (or left if wall). Mario collects it: grows to Super.
- [ ] Fire Flower stays on top of block. Mario collects it: transitions to Fire form.
- [ ] Starman bounces (90% vertical restitution). Invincibility lasts 10s (600 frames). At ~3s remaining: music normalizes.
- [ ] Invincibility: Mario kills enemies on contact during starman.
- [ ] Damage chain: Fire→Super→Small→Death. Each transition gives 120-frame hurt invincibility.
- [ ] If Small Mario hits Fire Flower block: spawns Mushroom instead.

### Phase 3 — Fireball + Shell Combat

- [ ] Fireball: max 2 on screen. Pressing fire when 2 active does nothing.
- [ ] Fireball trajectory: launches ~45° downward (vx=6, vy=-4 initially).
- [ ] Fireball bounces on ground up to 5 times. Dies on wall or ceiling. Dies after 5 bounces.
- [ ] Fireball kills Goomba (+200), Koopa (+200). Does NOT kill Buzzy Beetle or Spiny.
- [ ] Piranha Plant: does not emerge within 1 tile of Mario. Cycle timing: hidden 2s, rising 1s, extended 2s, retracting 1s.

### Phase 4 — Audio

- [ ] AudioContext created on first user interaction (not before).
- [ ] All SFX match spec.md synthesis specifications exactly. Review frequency values.
- [ ] Overworld music plays at 120 BPM. Hurry mode doubles to 240 BPM at ≤100s remaining.
- [ ] Music stops on death, pauses on game pause, resumes on unpause.
- [ ] Coin SFX: two-tone sine (988Hz then 1319Hz). No square wave.
- [ ] Master gain = 0.7. Music gain = 0.5. SFX gain = 0.8.

### Phase 5 — NES Sprite Accuracy

- [ ] All sprite pixel arrays render at 32×32 canvas px per tile (2× scale), 24×48 for Super Mario.
- [ ] NES palette colors match the canonical palette (validate hex values against https://www.nesdev.org/wiki/PPU_palettes).
- [ ] Transparency is correct — null pixels are not drawn (no black fill).
- [ ] Sprites flip correctly for left-facing (setFlipX not mirrored array).
- [ ] Question block animates every 8 frames. Coin animates every 4 frames.
- [ ] HUD font renders at 16×16 canvas px per glyph with black shadow.
- [ ] Score wraps at 999999 → 0.
- [ ] Floating score popups appear at event position, rise 2 tiles over 60 frames, fade out.

### Phase 6 — HUD and Game Flow

- [ ] HUD bar is 48 canvas px tall, solid black.
- [ ] All HUD element positions match spec.md §10 table exactly (measured in canvas px).
- [ ] World intro card shows "WORLD X-X" for 3 seconds, then transitions to PLAYING.
- [ ] Pause: "PAUSED" centered, all logic frozen, HUD remains visible.
- [ ] Game Over: shows for 5 seconds, then returns to TITLE.
- [ ] Lives counter decrements on death. At 0 lives: Game Over.
- [ ] 100 coins → +1 life, coin counter resets, 1UP jingle plays.
- [ ] Time warning: music BPM doubles at ≤100s remaining (verify it's exactly 100, not 99).
- [ ] Time bonus at flagpole: `time * 50` added, decremented visually at +50/frame.
- [ ] Score displayed as 6-digit zero-padded number.

### Performance Checks (all phases)

- [ ] Object pool never exhausted during normal gameplay. Monitor pool warnings in console.
- [ ] No `new` calls in hot path during PLAYING screen. Verify with Chrome DevTools heap snapshot — allocation rate should be near zero during gameplay.
- [ ] Enemy objects are culled when scrolled off-screen left side.
- [ ] Tile rendering only processes visible columns. Confirm with a breakpoint in TileRenderer.drawTiles — `colEnd - colStart` should be ≤ 22.
- [ ] 60fps locked at 2× scale (512×480) on a mid-range laptop. Test in Chrome with CPU throttling 4×.

---

## Appendix: File Ownership Summary

| File | Owner |
|------|-------|
| `src/main.ts` | SE1 |
| `src/config/physics.ts` | SE1 |
| `src/config/constants.ts` | SE1 |
| `src/config/audio.ts` | SE2 |
| `src/config/palette.ts` | SE2 |
| `src/types/*.ts` | SE1 (SE2 reads only) |
| `src/scenes/BootScene.ts` | SE1 |
| `src/scenes/PreloadScene.ts` | SE2 (sprite baking) |
| `src/scenes/WorldScene.ts` | SE1 |
| `src/scenes/UIScene.ts` | SE2 |
| `src/systems/InputManager.ts` | SE1 |
| `src/systems/TileCollision.ts` | SE1 |
| `src/systems/CameraSystem.ts` | SE1 |
| `src/systems/GameStateMachine.ts` | SE1 |
| `src/systems/BlockInteractionSystem.ts` | SE1 |
| `src/systems/TileRenderer.ts` | SE2 |
| `src/systems/SpriteRenderer.ts` | SE2 |
| `src/systems/AudioSystem.ts` | SE2 |
| `src/systems/ParticleSystem.ts` | SE2 |
| `src/entities/Entity.ts` | SE1 |
| `src/entities/player/Mario.ts` | SE1 |
| `src/entities/player/Fireball.ts` | SE1 (physics) / SE2 (sprite) |
| `src/entities/enemies/Enemy.ts` | SE1 |
| `src/entities/enemies/Goomba.ts` | SE1 (AI) / SE2 (sprite) |
| `src/entities/enemies/KoopaTroopa.ts` | SE1 (AI) / SE2 (sprite) |
| `src/entities/enemies/Shell.ts` | SE1 |
| `src/entities/enemies/PiranhaPlant.ts` | SE1 (AI) / SE2 (sprite) |
| `src/entities/enemies/FlyingKoopa.ts` | SE1 (AI) / SE2 (sprite) |
| `src/entities/items/` | SE1 (physics) / SE2 (sprite) |
| `src/assets/sprites/*.ts` | SE2 |
| `src/data/levels/world1-1.ts` | SE2 |
| `index.html` | SE1 |
| `vite.config.ts` | SE1 |
| `tsconfig.json` | SE1 |
| `package.json` | SE1 |

---

## Delivery Order

Build in this exact sequence. Do not start phase N+1 until phase N passes the reviewer checklist for that phase.

| Phase | SE1 Deliverable | SE2 Deliverable |
|-------|----------------|----------------|
| 1 | Project scaffold, InputManager, TileCollision, Mario physics (no rendering), CameraSystem, GameStateMachine, WorldScene loop | Package.json / Vite / Phaser setup, PreloadScene with palette + placeholder sprites, TileRenderer, UIScene (HUD shell) |
| 2 | Enemy base class, Goomba, KoopaTroopa, Shell, BlockInteractionSystem, item physics | All NES sprite pixel arrays, item sprites, tile sprites, animated tiles |
| 3 | Fireball physics + combat collision, PiranhaPlant, FlyingKoopa | Fireball/explosion sprites, FlyingKoopa sprites, particle VFX |
| 4 | Full audio integration calls in WorldScene | AudioSystem complete (all SFX + music sequences) |
| 5 | Flagpole sequence, death animation, power-up state transitions | All Mario form sprites complete, score popup rendering, flagpole sprites |
| 6 | Full game state flow (title → intro → play → death → gameover), pipe system | World 1-1 level data file, remaining enemy sprites, castle tiles |
