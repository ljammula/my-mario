# My Mario — Product Specification

**Platform:** Web browser (HTML5 Canvas, vanilla JavaScript, no external frameworks)
**Reference:** Super Mario Bros (Nintendo, NES, 1985)
**Status:** Active
**Version:** 1.0
**Owner:** Product
**Last updated:** 2026-03-22

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Success Criteria](#2-success-criteria)
3. [Target Users](#3-target-users)
4. [Out of Scope (v1)](#4-out-of-scope-v1)
5. [Game Loop](#5-game-loop)
6. [Player States](#6-player-states)
7. [Controls](#7-controls)
8. [Movement Physics](#8-movement-physics)
9. [Camera](#9-camera)
10. [HUD](#10-hud)
11. [World Structure](#11-world-structure)
12. [Stage Completion](#12-stage-completion)
13. [Checkpoints](#13-checkpoints)
14. [Tiles & Terrain](#14-tiles--terrain)
15. [Blocks & Interactions](#15-blocks--interactions)
16. [Pipes](#16-pipes)
17. [Enemies](#17-enemies)
18. [Power-ups](#18-power-ups)
19. [Fireball Mechanics](#19-fireball-mechanics)
20. [Underwater Mode](#20-underwater-mode)
21. [Moving Platforms](#21-moving-platforms)
22. [Secrets](#22-secrets)
23. [Scoring](#23-scoring)
24. [Lives & Game Flow](#24-lives--game-flow)
25. [Audio](#25-audio)
26. [Data Model](#26-data-model)
27. [Technical Architecture](#27-technical-architecture)
28. [Rendering](#28-rendering)
29. [Technical Behaviors](#29-technical-behaviors)
30. [Delivery Phases](#30-delivery-phases)
31. [Implementation Notes](#31-implementation-notes)

---

## 1. Product Vision

Deliver a browser-playable Super Mario Bros. clone that faithfully reproduces the *feel* of the 1985 Nintendo original — its movement physics, game loop, enemy set, power-up system, and 32-area world structure — without requiring a cycle-perfect NES ROM emulation. The target experience: a player who grew up with the original should feel at home within seconds.

---

## 2. Success Criteria

The product ships when all of the following are true:

- Movement is momentum-based; running changes jump distance noticeably
- Mario can complete both flagpole and castle-ending stages
- Damage downgrade chain (Fire → Super → Small → death) works correctly
- Mushroom / Fire Flower / Starman power-up logic is fully correct
- Enemies interact with shells and fireballs as expected
- Timer, score, coins, lives, and mid-level checkpoints all function
- All 32 areas can be represented and loaded from data

---

## 3. Target Users

Browser-based casual and retro gamers. No install required. Keyboard controls with optional gamepad support as a stretch goal.

---

## 4. Out of Scope (v1)

- Cycle-accurate NES emulation or ROM loading
- Multiplayer (2-player alternating)
- Level editor / user-generated content
- Mobile touch controls
- Gamepad support (nice-to-have post-launch)
- Save state persistence across sessions

---

## 5. Game Loop

```
Spawn at area start (or midpoint checkpoint)
  → Scroll right through level
  → Jump gaps · defeat enemies · collect coins and power-ups
  → Reach level end:
      Overworld/Athletic/Underground → Flagpole + castle entry
      Castle → Axe/bridge trigger + Bowser defeat
  → Award time bonus (except final castle)
  → Advance to next area
```

**Loss conditions**

| Condition | Result |
|-----------|--------|
| Small Mario contacts damaging enemy or hazard | Death |
| Mario falls into pit | Death |
| Timer reaches zero | Death |
| Mario contacts lava/fire (castle) while small | Death |

**Death flow:** All enemies freeze → death animation (Mario pops up ~4 tiles then falls off-screen) → lives − 1 → respawn at area start or midpoint → if 0 lives, Game Over screen.

---

## 6. Player States

| Form | How Obtained | Size | Special Ability |
|------|-------------|------|-----------------|
| Small Mario | Start / after damage | 1 tile (16px logical) | — |
| Super Mario | Collect Mushroom | 2 tiles (32px logical) | Break bricks from below; can crouch |
| Fire Mario | Collect Fire Flower (while Super) | 2 tiles | Shoot fireballs (max 2 on screen) |
| Invincible Mario | Collect Starman (overlays current form) | — | Immune to enemies; kills on contact for 10s |

**Damage downgrade chain:** Fire → Super → Small → Death

Invincibility overlays current form; it does not replace or reset size/fire state. On a downgrade hit, brief invincibility (~2 seconds, 10Hz flicker) applies.

**State transition table**

```
Small Mario  + Mushroom      → Super Mario
Small Mario  + Fire Flower   → Super Mario  (flower acts as mushroom if small)
Small Mario  + Star          → Invincible Small Mario
Super Mario  + Fire Flower   → Fire Mario
Super Mario  + Star          → Invincible Super Mario
Fire Mario   + Star          → Invincible Fire Mario
Any state    + enemy hit     → one step down (Fire→Super, Super→Small, Small→Death)
Any state    + pit / time    → Death
```

**Death animation:** Mario pops upward (+8 px/frame initial vy), then falls off-screen with normal gravity. All enemies and game logic freeze during animation (~2 seconds total).

---

## 7. Controls

All controls are keyboard-based. No mouse interaction required during gameplay.

| Action | Primary Key | Alternate Key |
|--------|-------------|---------------|
| Move Left | Arrow Left | A |
| Move Right | Arrow Right | D |
| Crouch | Arrow Down | S |
| Jump | Space | Z |
| Run / Fire | X | Shift |
| Pause / Start | Enter | — |

**Input behavior**

- **Jump:** Variable height. Holding extends arc; releasing early cuts it.
- **Run (X, held):** Raises max speed cap. Also fires a fireball when Fire Mario — each keydown fires one ball (not held); max 2 on screen.
- **Crouch (Down):** Super/Fire state only. Hitbox shrinks to 1-tile height. Cannot move or jump while crouching. Cancelled by releasing Down. Mario stays crouched if a low ceiling prevents standing.
- **Enter:** Starts game from title/game-over screen; toggles pause during gameplay.
- **Key repeat:** Movement uses continuous per-frame polling. Jump and fire trigger on keydown only; must be released and re-pressed.

---

## 8. Movement Physics

All values are **logical pixels per frame** at 60fps. Canvas renders at 2× scale. One tile = 16 logical px.

### Gravity

```
GRAVITY           = 0.5  px/frame²   (applied every frame)
MAX_FALL_SPEED    = 8.0  px/frame    (terminal velocity)
```

### Jump Arc

```
JUMP_VELOCITY     = -8.5 px/frame    (initial vy; same for Small and Super)
JUMP_HOLD_GRAVITY = 0.25 px/frame²   (reduced gravity while jump held AND vy < 0)
JUMP_RELEASE_GRAVITY = 0.5 px/frame² (normal gravity once released or vy ≥ 0)
```

- Jump only possible when grounded (tile or top of shell)
- Coyote time: 4 frames after walking off a ledge
- No double-jump
- Short press (~3 frames): rises ~3 tiles; full hold: rises ~5 tiles
- Hitting a block underside cancels upward motion immediately

### Horizontal Movement

```
WALK_ACCELERATION  = 0.15 px/frame²
RUN_ACCELERATION   = 0.25 px/frame²
WALK_MAX_SPEED     = 2.5  px/frame
RUN_MAX_SPEED      = 5.0  px/frame
SKID_DECELERATION  = 0.35 px/frame²  (direction reversal)
GROUND_FRICTION    = 0.12 px/frame²  (no key held, grounded)
AIR_RESISTANCE     = 0.04 px/frame²  (no key held, airborne)
```

- Run active only when X held AND direction key held
- Speed clamped to WALK_MAX_SPEED unless running
- Releasing X while airborne at run speed: momentum preserved; decelerates only by air resistance until landing

### Skidding

If opposite direction pressed while moving quickly:
- Skid animation plays
- SKID_DECELERATION applied until vx = 0
- Then acceleration in new direction
- Momentum preserved on jumps (jump does not reset horizontal velocity)

---

## 9. Camera

- Side-scrolling 2D; `camera.x = Mario.x − 128` (Mario stays ~8 tiles from left edge)
- Camera X minimum: 0 (never scroll left of level start)
- Camera X maximum: levelWidth − canvasLogicalWidth
- No left-scroll: camera.x never decreases once Mario moves right past the visible left edge
- Camera Y: fixed in standard levels; minimal vertical adjustment only in special sections

---

## 10. HUD

```
MARIO     ×COINS     WORLD     TIME
000000      00       1-1       400
```

**Canvas positions (2× scale)**

| Element | Canvas X | Canvas Y |
|---------|----------|----------|
| "MARIO" label | 24 | 16 |
| Score (6 digits, zero-padded) | 24 | 32 |
| Coin icon | 200 | 16 |
| "×" separator | 214 | 16 |
| Coin count (2 digits) | 228 | 16 |
| "WORLD" label | 312 | 16 |
| World number ("1-1") | 318 | 32 |
| "TIME" label | 424 | 16 |
| Time (3 digits) | 430 | 32 |

- Font: 8×8 logical (16×16 canvas), white with black shadow 1px down-right
- HUD background: solid black bar, full canvas width, 48 canvas px tall
- Lives shown on the level intro screen between deaths, not in gameplay HUD

---

## 11. World Structure

- **8 worlds × 4 areas = 32 total areas**
- World x-4 is always a castle
- Area themes cycle through: Overworld · Underground · Underwater · Athletic · Castle
- World 8 is the hardest; ends with the true final Bowser

---

## 12. Stage Completion

**Non-castle stages**
1. Staircase leads to flagpole (10 tiles tall, 1 tile wide)
2. Mario grabs pole; grab height determines bonus points (see Scoring)
3. Mario slides down pole, walks into small castle
4. Level complete fanfare plays
5. Remaining time × 50 pts added to score

**Castle stages**
1. Mario reaches bridge with axe trigger
2. Touching axe collapses the bridge
3. Bowser (or decoy) falls
4. Worlds 1–7: defeated Bowser revealed as a decoy enemy
5. World 8-4: true Bowser defeated; rescue chamber / ending sequence

---

## 13. Checkpoints

- One hidden midpoint checkpoint per eligible area
- Activates when Mario crosses a specific x-coordinate trigger
- On death: respawn at checkpoint if activated, else area start
- Castle areas and certain endgame areas: no checkpoint (original behavior)

---

## 14. Tiles & Terrain

Tile size: 16×16 logical px (32×32 canvas at 2× scale). World defined as a 2D grid.

| Tile | ID | Behavior |
|------|----|----------|
| Ground block | `G` | Fully solid; drawn top row + fill rows |
| Brick block | `B` | Breakable by Super/Fire Mario from below |
| Question block | `Q` | Spawns item on hit; becomes `U` (used) after |
| Unbreakable block | `H` | Fully solid, never breaks |
| Invisible item block | `I` | Same as `H` but not drawn |
| Pipe (top-left) | `PT` | Solid; pipe cap sprite |
| Pipe (top-right) | `PR` | Solid; pipe cap sprite |
| Pipe (body-left) | `PL` | Solid |
| Pipe (body-right) | `PB` | Solid |
| Coin tile | — | Collectible |
| Flagpole segment | `FP` | End-of-level pole |
| Flag | `FF` | Top of flagpole; lowers on grab |
| Castle wall | `CA` | Decorative solid |
| Castle door | `CD` | Decorative solid |

**Collision categories:** solid · top-solid platform · pole (climb/slide) · damaging · non-solid trigger

**Level geometry**
- Level width: 224 tiles (3584 logical px)
- Level height: 15 tiles visible + 1 tile pit zone (row 15 = instant death)
- Row 0 = top of screen; Row 14 = ground level

---

## 15. Blocks & Interactions

**Brick block**
- Small Mario hits from below: block shakes (moves 2px up then back over 4 frames), enemies on top bounced/killed; +50 pts; does NOT break
- Super / Fire Mario hits from below: breaks into 4 debris particles; +50 pts; tile removed from grid

**Question block**
- One item per block; item type set in level data (`Q:coin` · `Q:mushroom` · `Q:flower` · `Q:star`)
- Hit from below: content revealed; block becomes inert used block
- Hit from above: no effect

**Hidden block**
- Invisible until hit from below
- Typically contains coin or 1-up

**Coin**
- +200 pts, +1 to coin counter
- Coin animation: pops upward from block and fades
- 100 coins → +1 life, counter resets, jingle plays

---

## 16. Pipes

| Type | Behavior |
|------|----------|
| Decorative | Solid only |
| Enemy-spawn | Piranha Plant emerges/retracts on cycle |
| Enterable | Player enters downward with correct directional input |
| Exit | Player emerges upward |
| Warp zone | Routes player to a different world |

Pipe travel: directional input required → control disabled → transition animation → arrive at linked destination.

---

## 17. Enemies

All enemies default to moving left at spawn. Enemies reverse on solid wall contact.

### Enemy Table

| Enemy | Behavior | Defeat Methods |
|-------|----------|----------------|
| Goomba | Walks horizontally; walks off ledges; 1×1 tile | Stomp (+100) · fireball (+200) · starman · shell (+200) |
| Koopa Troopa (Green) | Walks horizontally; walks off ledges; 1×2 tile | Stomp → shell (+100); shell kick; fireball (+200); starman |
| Flying Koopa (Red) | Patrols 3-tile vertical sine wave; 1.5 px/frame; turns at ledge | Stomp → loses wings → walking Koopa (+100); fireball (+200); starman |
| Piranha Plant | Rises/pauses/retracts on 2s cycle; 2 tiles above pipe rim; does not emerge within 1 tile of Mario | Fireball (+200) · starman · shell |
| Hammer Bro | Patrols short platform range; throws hammer arcs | Stomp · fireball · starman |
| Lakitu | Moves near screen top; drops Spinies | Fireball · starman |
| Spiny | Dropped by Lakitu; hazardous to stomp | Fireball · starman · shell |
| Buzzy Beetle | Koopa variant; resistant to fireballs | Stomp (→ shell) · starman · shell |
| Blooper | Underwater; drifting pursuit | Starman · fireball |
| Cheep-Cheep | Swimming or jumping fish variant by level | Starman · fireball |
| Podoboo | Lava fireball leaper in castles | Cannot be defeated |
| Bullet Bill | Horizontal projectile from cannons | Stomp · fireball · starman |
| Bowser | Castle boss; walks, jumps, fire breath, hammers (scales by world) | Bridge drop (always) · fireballs (decoys only) |

### Shell Behavior

- Still shell: stomp again or touch from side → slides at 8.0 px/frame
- Sliding shell kills any enemy on contact; chain: 1st kill +200, doubles each subsequent kill
- Shell bounces off walls; does not fall off ledges
- Mario can stomp a sliding shell to stop it, then kick again
- Shell hit by Mario (not from above): damage state down unless invincible
- Shell despawns if it slides off-screen

### Enemy Collision Rules

- **Stomp:** Mario.vy > 0 AND Mario.bottom > enemy.top AND Mario.bottom < enemy.center → stompable enemy defeated; Mario bounces upward
- **Side or bottom contact:** damages player unless invincible
- **Fireball contact:** defeats most enemies; Buzzy Beetle and Spiny resist
- **Terrain contact:** reverse direction on solid walls

---

## 18. Power-ups

| Item | Spawn Condition | Movement | Effect |
|------|----------------|----------|--------|
| Super Mushroom | Hit `Q` block while Small | Slides right (or left if wall), 1.5 px/frame; affected by gravity | +1000 pts; → Super Mario |
| Fire Flower | Hit `Q` block while Super/Fire | Stays on top of block after emerging | +1000 pts; → Fire Mario |
| Starman | Specific `Q` blocks | Bounces; 90% vertical restitution; 2.0 px/frame horizontal | +1000 pts; 10s invincibility |
| 1-Up Mushroom | Hidden / reward blocks | Same movement as Mushroom | +1 life; "1-UP" shown in HUD |

- If Mario is Small and hits a Fire Flower block, block spawns Mushroom instead (checked at hit time)
- Starman despawns if it falls off-screen
- At ~3 seconds of invincibility remaining: music returns to normal tempo as warning
- On invincibility expiry: returns to previous form with no flash

---

## 19. Fireball Mechanics

- Max 2 active fireballs on screen at once; pressing fire when 2 active does nothing
- Launches at ~45° downward angle; 6 px/frame horizontal
- Bounces on ground up to 5 times with inverted vertical velocity (−4 initial, reduced each bounce)
- Disappears on wall collision or after 5 bounces
- Damages compatible enemies on contact; does not affect sliding shells

---

## 20. Underwater Mode

Applies to all underwater areas.

- Run disabled
- Jump → swim stroke (upward impulse per press)
- Buoyant slow-fall between strokes
- Reduced gravity; slower horizontal speed
- Underwater enemy set active (Blooper, Cheep-Cheep)
- Level exits are area-specific (no standard flagpole)

---

## 21. Moving Platforms

| Type | Notes |
|------|-------|
| Horizontal moving | Constant lateral motion |
| Vertical moving | Constant vertical motion |
| Falling platform | Drops after player contact |
| Balance / lift pair | Two linked platforms counterbalance |
| Short-cycle platform | Athletic and castle sections |

Player inherits platform velocity while standing. Velocity removed cleanly on exit. Crushing against ceiling: instant death or safe stop (TBD with engineering).

---

## 22. Secrets

- Hidden blocks (invisible until hit from below)
- Underground coin rooms (pipe entry)
- Vine to sky bonus area (vine item from question block)
- Warp zones (pipes routing to higher worlds)
- 1-up secrets (precise jump or hidden block)
- Shortcut pipes

---

## 23. Scoring

Score is a 6-digit number (max 999999; wraps to 0 if exceeded).

### Point Values

| Event | Points |
|-------|--------|
| Goomba stomp | 100 |
| Koopa stomp (to shell) | 100 |
| Brick block break (Super+) | 50 |
| Coin collected | 200 |
| Power-up collected | 1000 |
| Fireball enemy kill | 200 |
| Shell kill (1st) | 200 |
| Shell kill (2nd) | 400 |
| Flagpole (lowest section) | 100 |
| Flagpole (mid sections) | 500 · 1000 · 2000 · 4000 |
| Flagpole (top) | 5000 |
| Time remaining at level end | seconds × 50 |
| 100 coins | +1 life |

### Multi-Stomp Combo

Each consecutive stomp in a single airborne sequence (resets on ground contact):

| Stomp # | Points |
|---------|--------|
| 1st | 100 |
| 2nd | 200 |
| 3rd | 400 |
| 4th | 800 |
| 5th | 1000 |
| 6th | 2000 |
| 7th | 4000 |
| 8th | 8000 |
| 9th+ | +1 life |

### Flagpole Height Scoring

Pole is 10 tiles tall. Contact tile from bottom determines score:

| Contact tile | Points |
|-------------|--------|
| 1 (lowest) | 100 |
| 2–3 | 500 |
| 4–5 | 1000 |
| 6–7 | 2000 |
| 8–9 | 4000 |
| 10 (top) | 5000 |

### Score Display

Floating score text appears at event location, rises 2 tiles over 60 frames, then fades. White text, black 1px outline. Multiple texts can appear simultaneously.

---

## 24. Lives & Game Flow

- Configurable starting life count (default: 3)
- Death → lives − 1 → show "WORLD X-X" intro card (3s) → reload area from start or checkpoint
- 0 lives → Game Over screen (5s) → Title Screen
- Score not persisted across game overs (no save for v1)
- After full 8-world completion: optionally unlock World Select / Hard Mode (post-launch)

**Title screen:** Black background · "MY MARIO" centered · "PRESS ENTER TO START" blinking (30-frame toggle) · decorative Mario sprite.

**Pause:** "PAUSED" text centered on canvas; HUD remains; all game logic frozen.

---

## 25. Audio

All audio is **procedurally synthesized** using the Web Audio API. No external audio files. No copyrighted Nintendo audio.

Single AudioContext created on first user interaction (browser autoplay policy). Music and SFX on separate gain chains feeding into master gain (default 0.7).

### Music States

| State | Notes |
|-------|-------|
| Title screen | Upbeat looping theme, square wave oscillators |
| Overworld | 120 BPM normal; 240 BPM when ≤100s remaining ("hurry" mode) |
| Underground | Separate theme |
| Underwater | Separate theme |
| Castle | Separate theme |
| Invincibility | Starman theme overlays; prior track resumes after |
| Death | Descending jingle; stops background music |
| Level clear | ~3s fanfare |
| Castle clear | Separate fanfare |
| Game over | Jingle |
| Ending | Ending theme |

Music stops on death, pauses on game pause, resumes on unpause.

### Sound Effects

| Sound | Synthesis |
|-------|-----------|
| Jump (small) | Square wave, 300Hz → 600Hz sweep over 0.1s, gain 0.3 |
| Jump (super) | Square wave, 200Hz → 500Hz sweep over 0.15s, gain 0.3 |
| Coin | Sine, two-tone: 988Hz (0.05s) then 1319Hz (0.15s), gain 0.4 |
| Power-up spawn | Square wave, rising arpeggio C4→E4→G4→C5, 0.1s each |
| Power-up collect | Square wave, rising scale C5→C6, 0.05s per note, gain 0.5 |
| Break block | White noise burst, 0.08s, gain 0.4, highpass 2000Hz |
| Stomp enemy | Square wave, 200Hz → 100Hz over 0.1s, gain 0.5 |
| Death | Square wave descending: C5→Eb4, 0.1s per note |
| Level complete | Ascending fanfare arpeggio, freely composed, ~3s |
| 1-UP | Square wave, G4+E5 chord, 0.5s, gain 0.5 |
| Fireball | White noise burst, 0.05s, lowpass 800Hz, gain 0.3 |
| Flagpole | Sine, descending slide 660Hz → 220Hz over 1.0s |
| Pipe enter/exit | Short whoosh |
| Bowser bridge collapse | Low rumble |

---

## 26. Data Model

```
Entity          Player              Level               Trigger
──────          ──────              ─────               ───────
id              form                world               type
type            invincibleTimer     area                bounds
position        onGround            theme               payload
velocity        jumpHoldTimer       widthTiles
bbox            runHeld             heightTiles
facing          facing              timeLimit
state           score               checkpointX
active          coins               tileLayers[]
despawnPolicy   lives               entities[]
                checkpointId        pipeLinks[]
                                    triggers[]
                                    endType: flagpole | castleAxe
```

**Trigger types:** checkpoint · areaTransition · warpZone · spawn · cutscene

---

## 27. Technical Architecture

### File Structure

```
my-mario/
├── index.html     # Entry point — canvas element, script imports
├── engine.js      # Game loop, input handling, collision detection
├── player.js      # Mario state machine, physics, animation
├── enemies.js     # Enemy classes: Goomba, KoopaTroopa, Shell, PiranhaPlant, FlyingKoopa, ...
├── level.js       # Level data (tile grid, enemy spawns, block contents), camera logic
├── renderer.js    # All canvas draw calls: tiles, sprites, HUD, particles, overlays
├── audio.js       # Web Audio API: music sequencer, SFX functions
└── ui.js          # Title screen, Game Over, pause overlay, score popups
```

### Canvas & Coordinate System

- Canvas element: 512×480 px (on screen)
- Logical resolution: 256×240 (NES resolution)
- Scale factor: 2× — all game logic in logical px; renderer multiplies by 2 before drawing
- Origin (0,0) = top-left of visible canvas
- Camera offset subtracted from world coordinates before rendering

### index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Mario</title>
  <style>
    body { background: #000; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
    canvas { image-rendering: pixelated; }
  </style>
</head>
<body>
  <canvas id="gameCanvas" width="512" height="480"></canvas>
  <script type="module" src="engine.js"></script>
</body>
</html>
```

### Game Loop (engine.js)

```
requestAnimationFrame loop:
  1. Calculate delta time (cap at 50ms to avoid spiral of death)
  2. Process input state
  3. If not paused:
     a. Update player (physics, state machine, animation)
     b. Update enemies (AI, physics, animation)
     c. Update power-ups (physics, movement)
     d. Check collisions (player↔tiles, player↔enemies, player↔power-ups, enemies↔tiles, shell↔enemies)
     e. Update camera
     f. Update HUD values (score, timer, coins)
     g. Update particles / score popups
     h. Update audio (music scheduler)
  4. Render:
     a. Clear canvas
     b. Draw background
     c. Draw tiles (only within camera view + 2 tile margin)
     d. Draw power-ups
     e. Draw enemies
     f. Draw player
     g. Draw particles
     h. Draw HUD
     i. Draw overlays (pause, game over, etc.)
  5. requestAnimationFrame(loop)
```

Target: 60fps. Delta time used for timer countdown; physics runs at fixed 60fps steps.

### Collision Detection

- All entities use AABB (Axis-Aligned Bounding Box)
- Tile collision: check entity's four corners each frame; resolve penetration axis-by-axis (horizontal first, then vertical)
- Player hitbox: 2px logical inset on each horizontal side (feels fair)
- Enemy hitboxes: exact sprite bounds
- Stomp condition: `Mario.vy > 0 AND Mario.bottom > enemy.top AND Mario.bottom < enemy.center`

### Module Interfaces

**engine.js**
```
gameState: { screen: 'title'|'intro'|'playing'|'paused'|'death'|'gameover'|'win',
             score, coins, lives, world, level, time }
inputState: { left, right, up, down, jump, run, start }
init()
collision.checkTile(entity, grid) → collision sides
collision.checkEntity(a, b) → overlap rect | null
```

**player.js**
```
class Mario { state, x, y, vx, vy, facing, animFrame, ... }
mario.update(inputState, grid, dt)
mario.onEnemyContact(enemy)
mario.onPowerUp(type)
```

**enemies.js**
```
class Goomba        { x, y, vx, vy, alive, animFrame }
class KoopaTroopa   { x, y, vx, vy, state: 'walking'|'shell'|'sliding', alive }
class Shell         { x, y, vx, vy, alive }
class PiranhaPlant  { x, y, state: 'hidden'|'rising'|'extended'|'retracting', timer }
class FlyingKoopa   { x, y, vx, vy, spawnY, state: 'flying'|'walking', alive }
// Each: update(grid, mario, dt), draw(renderer, camera)
```

**level.js**
```
WORLD_1_1: { grid: string[][], enemies: EnemyDef[], blocks: BlockDef[], timeLimit: 400 }
camera: { x, y, update(mario, levelWidth) }
getTile(col, row) → tile ID
setTile(col, row, id)   // used for breaking bricks, depleting ?blocks
```

### World 1-1 Reference Layout

Time limit: 400s. Mario spawn: Column 3, Row 13.

**Ground rows (Row 14 ground pattern):**

| Columns | Tile |
|---------|------|
| 0–68 | `G` |
| 69–70 | Gap (pit) |
| 71–85 | `G` |
| 86–88 | Gap |
| 89–103 | `G` |
| 104–107 | Gap |
| 108–197 | `G` |
| 198–209 | Staircase (`H`) |
| 210–223 | `G` (castle base) |

**Pipes (left column, height above ground, has Piranha):**

| Left col | Height | Piranha |
|----------|--------|---------|
| 28–29 | 2 tiles | No |
| 38–39 | 3 tiles | No |
| 46–47 | 3 tiles | No |
| 57–58 | 4 tiles | No |
| 97–98 | 3 tiles | Yes |

**Enemy spawns:**

| Enemy | Col | Row | Notes |
|-------|-----|-----|-------|
| Goomba | 22 | 13 | |
| Goomba | 23 | 13 | Pair |
| Goomba | 39 | 13 | |
| Goomba | 40 | 13 | Pair |
| Koopa Troopa | 57 | 12 | Elevated platform |
| Goomba | 80–81 | 13 | Pair |
| Piranha Plant | 97 | 11 | Tall pipe |
| Goomba | 107–108 | 13 | Pair |
| Goomba | 110–111 | 13 | Pair |
| Koopa Troopa | 128 | 13 | |
| Goomba | 149–150 | 13 | Pair |
| Goomba | 153–154 | 13 | Pair |

**Staircase (end of level, cols 198–209):**

| Step | Col | Rows |
|------|-----|------|
| 1 | 198 | 13 |
| 2 | 199 | 12–13 |
| 3 | 200 | 11–13 |
| 4 | 201 | 10–13 |
| 5 | 202 | 9–13 |
| 6 | 203 | 8–13 |
| 7 | 204 | 7–13 |
| 8 | 205 | 6–13 |

---

## 28. Rendering

- 16×16 tile grid
- No external image files — all sprites drawn programmatically (canvas 2D API or palette-based ImageData)
- Each sprite defined as 2D array of color indices; `renderer.drawSprite(id, x, y, palette, flipX)`

**Required sprite animations:** idle · walk · skid · jump · swim · crouch · climb pole · death · power transition (× Small and Super/Fire variants)

**Animated elements:** question blocks (active + used states) · coins · fireballs · enemy walk cycles · brick debris particles

**Minimum sprite set:**
- Mario: walk1/2/3, stand, jump, crouch, skid, death (Small + Super/Fire)
- Goomba: walk1/2, squish
- Koopa: walk1/2, shell, shell-spin1/2
- Piranha Plant: open, closed
- Mushroom (red), Mushroom (green/1-UP), Fire Flower, Starman (2 frames)
- Fireball, Fireball explosion
- Coin (2 frames)
- Tiles: ground-top, ground-fill, brick, question-block (2 frames), used-block, hard-block, pipe set
- Flagpole, flag, castle tiles
- HUD: coin icon, digits 0–9, letters A–Z

---

## 29. Technical Behaviors

| Behavior | Requirement |
|----------|-------------|
| Coyote time | 4 frames after walking off ledge |
| Input buffering | Minimal |
| Enemy activation | Only when near camera viewport |
| Offscreen despawn | Yes, for performance |
| Shell hazard persistence | Long enough to create multi-kill opportunities |
| Flagpole grab | Snaps reliably on contact |
| Pipe entry | Requires intentional directional alignment |
| Time warning | Music tempo doubles at ≤100s remaining |
| Score wrap | Wraps 999999 → 0 |

---

## 30. Delivery Phases

Build and validate in this order. Do not begin phase N+1 until phase N passes playtest.

| Phase | Scope |
|-------|-------|
| **1 — Core** | Player movement · camera · solid tiles · pits · flagpole completion |
| **2 — Enemies** | Goomba · Koopa · Question blocks · Mushroom · Fire Flower |
| **3 — Combat** | Super/Fire damage downgrade · fireball · shell mechanics |
| **4 — Traversal** | Pipes · subareas · warp zones |
| **5 — Castles** | Castle level · Bowser · bridge ending |
| **6 — Water** | Underwater movement · underwater enemies |
| **7 — Platforms** | Moving platforms · falling platforms |
| **8 — Polish** | Secrets · remaining enemies · audio · scoring · full 32-area data |

---

## 31. Implementation Notes

Start with a clean, deterministic modern implementation reproducing the player-facing behaviors above. Once it plays well, layer in fidelity details:

- Exact skid timing and turn radius
- Precise jump arc curves
- Enemy spawn window edge cases
- Shell bounce corner cases
- World-scaling Bowser patterns
- Warp zone exact destinations

Do not attempt ROM-level accuracy in the first pass. Playability and feel come before precision.
