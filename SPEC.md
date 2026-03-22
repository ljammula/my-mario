# Super Mario Bros — Web Game Product Specification

**Reference:** Super Mario Bros (Nintendo, NES, 1985)
**Platform:** Web browser (HTML5 Canvas, vanilla JavaScript, no external frameworks)
**Version:** 1.0
**Date:** 2026-03-21

---

## Table of Contents

1. [Controls](#1-controls)
2. [Player States](#2-player-states)
3. [Physics](#3-physics)
4. [Enemies](#4-enemies)
5. [Power-ups](#5-power-ups)
6. [Blocks & Tiles](#6-blocks--tiles)
7. [Scoring](#7-scoring)
8. [Level Design](#8-level-design)
9. [HUD](#9-hud)
10. [Win / Lose Conditions](#10-win--lose-conditions)
11. [Audio](#11-audio-web-audio-api)
12. [Technical Architecture](#12-technical-architecture)

---

## 1. Controls

All controls are keyboard-based. No mouse interaction is required during gameplay.

| Action         | Primary Key     | Alternate Key |
|----------------|-----------------|---------------|
| Move Left      | Arrow Left      | A             |
| Move Right     | Arrow Right     | D             |
| Crouch         | Arrow Down      | S             |
| Jump           | Space           | Z             |
| Run / Fire     | X               | —             |
| Start / Pause  | Enter           | —             |

### Input Behavior

- **Jump (Space / Z):** Variable-height jump. Holding the key extends the jump arc; releasing early cuts it short (see Physics section).
- **Run (X):** Held simultaneously with a direction key to run. Also fires a fireball when Mario is in Fire state and X is pressed (not held — each press fires one ball, max 2 on screen at once).
- **Crouch (Down / S):** Only active when Mario is Super or Fire state. No effect in Small state. Mario cannot move while crouching but can still slide on ice (if implemented in later worlds).
- **Enter:** On title/game-over screen, starts the game. During gameplay, toggles pause. Paused state freezes all game logic and rendering updates; the HUD remains visible.
- **Key repeat:** Movement keys use continuous polling each frame (not key-repeat events). Jump and fire keys trigger on keydown only; they must be released and pressed again to re-trigger.

---

## 2. Player States

Mario has five distinct states. Transitions between states are governed by power-up pickup and damage events.

### 2.1 Small Mario (default)

- Height: 1 tile (16px logical, 32px canvas)
- Cannot break brick blocks (hitting from below gives points and shakes block)
- Cannot crouch
- Hit by enemy: death (no shrink)
- Hit by projectile: death

### 2.2 Super Mario

- Height: 2 tiles (32px logical, 64px canvas)
- Can break brick blocks by jumping into them from below
- Can crouch (reduces hitbox to 1-tile height)
- Hit by enemy or projectile: shrinks to Small Mario + brief invincibility (~2 seconds, 10Hz flicker)
- Transition in: mushroom collected → Mario grows via a 4-frame animation over ~0.5 seconds

### 2.3 Fire Mario

- Same size and capabilities as Super Mario
- Can throw fireballs: press X (not held) to launch a fireball
  - Max 2 fireballs on screen simultaneously; pressing X when 2 are active does nothing
  - Fireball arc: launches at 45° downward angle, bounces on ground up to 5 times, then disappears
  - Fireball speed: 6 logical px/frame horizontal, bounces with inverted vertical velocity (-4 initial, reduced each bounce)
  - Fireball kills Goombas, Koopa Troopas (in-shell or walking), and Piranha Plants
  - Fireball does not affect shells that are already sliding
- Hit by enemy or projectile: reverts to Super Mario (no fireball) + brief invincibility
- Transition in: fire flower collected → brief flash animation (color cycle, ~0.5 seconds)

### 2.4 Invincible Mario (Star)

- Overlaid on current size state (Small/Super/Fire — retains underlying state)
- Duration: 10 seconds (600 frames at 60fps)
- Visual: Mario sprite flickers through rainbow palette (cycle every 4 frames)
- Effect: contact with any enemy kills the enemy (same as stomp — grants stomp combo points)
- At ~3 seconds remaining: background music returns to normal tempo as warning
- On expiry: returns to previous state (Small/Super/Fire) without any flash

### 2.5 Death State

- Triggered when Small Mario hits an enemy, any Mario falls into a pit, or time reaches 0
- Animation: Mario pops upward (~4 tiles) then falls off-screen (no gravity cancel; fixed upward velocity +8 px/frame, then gravity applies normally)
- During death animation: all enemies and game logic freeze; only Mario animates
- After animation completes (~2 seconds): decrement lives, show "World X-X" intro screen, respawn or show Game Over

### State Transition Table

```
Small Mario  + Mushroom      → Super Mario
Small Mario  + Fire Flower   → Super Mario (flower acts as mushroom if small)
Small Mario  + Star          → Invincible Small Mario
Super Mario  + Fire Flower   → Fire Mario
Super Mario  + Star          → Invincible Super Mario
Fire Mario   + Star          → Invincible Fire Mario
Any state    + enemy hit     → one step down (Fire→Super, Super→Small, Small→Death)
Any state    + pit/time      → Death
```

---

## 3. Physics

All physics values are in **logical pixels per frame** at 60fps. The canvas renders at 2x scale. One tile = 16 logical px.

### 3.1 Gravity

```
GRAVITY           = 0.5 px/frame²   (added to vertical velocity each frame)
MAX_FALL_SPEED    = 8.0 px/frame    (terminal velocity, clamp vy to this)
```

### 3.2 Jump Arc

```
JUMP_VELOCITY_SMALL    = -8.5 px/frame  (initial vy on jump press)
JUMP_VELOCITY_SUPER    = -8.5 px/frame  (same — size does not affect jump height)
JUMP_HOLD_GRAVITY      = 0.25 px/frame² (reduced gravity while jump key held AND vy < 0)
JUMP_RELEASE_GRAVITY   = 0.5 px/frame²  (normal gravity once key released or vy >= 0)
```

- Jump is only possible when Mario is grounded (on a tile or top of an enemy shell)
- Coyote time: 4 frames — Mario can jump up to 4 frames after walking off a ledge
- No double-jump

**Jump feel:**
- Short press (~3 frames): Mario rises ~3 tiles
- Full hold: Mario rises ~5 tiles (full NES-accurate arc)

### 3.3 Horizontal Movement

```
WALK_ACCELERATION     = 0.15 px/frame²
RUN_ACCELERATION      = 0.25 px/frame²
WALK_MAX_SPEED        = 2.5 px/frame
RUN_MAX_SPEED         = 5.0 px/frame
SKID_DECELERATION     = 0.35 px/frame²  (when changing direction without stopping)
GROUND_FRICTION       = 0.12 px/frame²  (deceleration when no key held, grounded)
AIR_RESISTANCE        = 0.04 px/frame²  (deceleration when no key held, airborne)
```

- **Run** is active when the X key is held AND a direction key is held
- Speed is clamped to WALK_MAX_SPEED unless running; can exceed walk cap only via run
- Releasing X while airborne at run speed: Mario retains momentum; horizontal speed decelerates only by air resistance until landing

### 3.4 Momentum / Skidding

- If Mario is moving right and the player presses left (or vice versa): skid animation plays, SKID_DECELERATION applied until vx = 0, then acceleration in new direction
- Skid visual: Mario sprite shows skid frame (reversed foot direction); dust particle effect optional
- Momentum is preserved on jumps: jump does not reset horizontal velocity

### 3.5 Crouching

- Only available in Super or Fire state
- Pressing Down/S while grounded: Mario enters crouch, hitbox shrinks to 1-tile height (top half removed)
- Cannot move or jump while crouching
- Crouch is cancelled by releasing the Down key
- If crouching under a low ceiling and the player tries to stand: Mario remains crouched until space allows

---

## 4. Enemies

All enemies default to moving **left** at spawn. Enemies reverse direction when hitting a wall or the edge of a platform (unless they walk off edges — Goombas walk off, Koopas also walk off by default in World 1).

### 4.1 Goomba

- Sprite size: 1×1 tile
- Move speed: 1.0 px/frame (left)
- Walk off ledges: yes
- **Stomp (Mario lands on top):** Goomba flattens into squish sprite, removed after 0.5 seconds; +100 pts (or combo pts)
- **Fireball hit:** Goomba dies, flips upside-down, flies off-screen upward; +200 pts
- **Star contact:** same as fireball hit
- **Shell hit:** same as fireball hit
- **Mario side/bottom contact:** Mario takes damage (state transition down)
- Goomba does not interact with blocks; it walks through them from the sides if spawned inside (spawn point is always clear)

### 4.2 Koopa Troopa (Green, Walking)

- Sprite size: 1×2 tiles (shell is 1×1)
- Move speed: 1.0 px/frame
- Walk off ledges: yes (Green Koopa)
- **Stomp (first hit while walking):** Koopa retracts into shell; shell sits still on ground; +100 pts
- **Stomp again on still shell:** Shell begins sliding at 8 px/frame in the direction Mario approached from
- **Fireball / Star / enemy contact while walking:** Koopa flips, flies off; +200 pts

#### Shell Behavior

- Sliding speed: 8.0 px/frame
- Shell kills any enemy it contacts (Goomba, walking Koopa, other shell) — each kill in sequence gives combo points starting at 200 for first kill, doubling after
- Shell bounces off walls (reverses horizontal velocity); shell does not fall off ledges unless the ledge is past the shell's width
- Mario can stomp a sliding shell to stop it; Mario can then kick it again
- If Mario is hit by a sliding shell: damage (state down), unless invincible
- Shell despawns if it slides off-screen

### 4.3 Piranha Plant

- Sprite size: 1×2 tiles (inside pipe)
- Behavior: rises from pipe top over 2 seconds, pauses 2 seconds at full extension, retracts over 2 seconds, pauses 2 seconds hidden, repeats
- Rise height: 2 tiles above pipe rim
- Does NOT emerge if Mario is standing within 1 tile of the pipe opening (horizontally)
- **Cannot be stomped** (Mario cannot land on top — Piranha Plant's hitbox is always "danger")
- **Fireball hit:** Plant dies (disappears); +200 pts
- **Star contact:** same as fireball
- **Shell hit:** same as fireball

### 4.4 Flying Koopa (Red, later levels)

- Sprite size: 1×2 tiles (with wings)
- Move speed: 1.5 px/frame
- Patrols a vertical range (3 tiles up, 3 tiles down from spawn point) in a sine wave
- Walk off ledges: no (turns around at ledge)
- **Stomp:** loses wings, becomes walking Green Koopa behavior; +100 pts
- **Fireball / Star / Shell:** flips and flies off; +200 pts

---

## 5. Power-ups

Power-ups are spawned from Question Mark blocks or, occasionally, hidden brick blocks. They emerge from the top of the block and animate upward before landing on the block and beginning to move.

### 5.1 Super Mushroom

- Spawned from ? block when Mario is Small
- On appear: pops up from block, lands on top, then moves right (or left if wall on right) at 1.5 px/frame
- Affected by gravity (falls off ledges)
- Collected on contact: Mario grows to Super state; +1000 pts
- If Mario is already Super or above: no effect (never spawned in that case — block logic checks state)

### 5.2 Fire Flower

- Spawned from ? block when Mario is Super or Fire
- Does NOT move — sits on top of the block after emerging
- Collected on contact: Mario becomes Fire Mario; +1000 pts
- If Mario is Small: block spawns Mushroom instead (game checks player state at moment of hit)

### 5.3 Super Star

- Spawned from specific ? blocks (defined in level data)
- On appear: bounces — initial upward velocity, affected by gravity, bounces off ground and blocks
- Bounce restitution: 90% of vertical velocity on each bounce
- Moves right at 2.0 px/frame horizontal (constant, not affected by walls in original — reverses on wall hit in this implementation)
- Collected on contact: Invincibility state for 10 seconds; +1000 pts
- Star despawns if it falls off-screen

### 5.4 1-Up Mushroom

- Spawned from specific hidden brick blocks (defined in level data)
- Behavior identical to Super Mushroom movement (moves, falls off ledges)
- Collected on contact: +1 life; brief "1-UP" text displayed in HUD; no state change
- Distinct visual: green cap (vs red for Super Mushroom)

### 5.5 Coins

- Two types: static coins in ? blocks (1 per hit, ? block becomes depleted gray), and inline coins in bonus rooms (not in World 1-1)
- Collected on contact (Mario walks through or hits block from below): +200 pts, +1 to coin counter
- At 100 coins: +1 life, coin counter resets to 0, brief jingle plays
- Coin collect animation: coin sprite pops upward from block and fades; Mario does not need to physically touch it if it came from a block he hit

---

## 6. Blocks & Tiles

All tiles are 16×16 logical pixels (32×32 on canvas at 2x scale). The world is defined as a 2D grid.

### 6.1 Ground Tiles

- Solid on all sides
- Mario cannot break them
- Enemies walk on them
- Drawn as the standard brown/tan NES ground pattern (top row: light tan; rows below: darker tan with pattern)
- Tile ID: `G`

### 6.2 Brick Blocks

- Solid on all sides
- **Small Mario hits from below:** Block shakes (moves up 2px then back over 4 frames), enemies on top are bounced and killed; +50 pts; block does NOT break
- **Super/Fire Mario hits from below:** Block breaks into 4 debris particles that arc outward and fall off-screen; +50 pts; tile is removed from grid
- **Enemies:** walk on top, cannot break
- Tile ID: `B`

### 6.3 Question Mark Blocks (?)

- Solid on all sides
- Contains either a coin, mushroom, fire flower, or star (defined per-block in level data)
- **Hit from below (any Mario size):** Content is revealed (see Power-ups section); block becomes a depleted "used" block (dark grey, no ? mark, solid, cannot be hit again)
- **Hit from above (Mario lands on top):** No effect
- Tile ID: `Q` (depleted: `U`)

### 6.4 Hard / Invisible Blocks

- Solid on all sides
- Cannot be broken by any means
- Invisible blocks: same as hard blocks but not drawn (used for invisible item blocks in some levels)
- Tile ID: `H` (hard), `I` (invisible — same behavior, not drawn)

### 6.5 Pipes

- Made of two tiles wide, variable height
- Solid on all sides for Mario and enemies
- Top two tiles of a pipe have a distinct "pipe cap" sprite
- Piranha Plants emerge from pipes marked with a `P` flag in level data
- Mario cannot enter pipes in World 1-1 (warp pipe entry is not required for MVP)
- Tile IDs: `PT` (pipe top-left), `PR` (pipe top-right), `PL` (pipe body-left), `PB` (pipe body-right)

### 6.6 Flagpole

- Located at the end of the level
- A tall vertical pole (1 tile wide, 10 tiles tall) with a flag at the top
- When Mario touches the pole: flagpole grab animation plays
  - Mario slides down the pole (velocity: 3 px/frame downward)
  - Points awarded based on height of contact (see Scoring)
  - Mario reaches bottom, walks right into castle
  - Level complete fanfare plays
- The flag itself drops to the bottom when Mario grabs the pole
- Tile ID: `FP` (pole), `FF` (flag at top)

### 6.7 Castle

- Decorative structure at end of level (rightmost tiles)
- Mario walks into castle entrance to complete level
- Tile IDs: `CA` (castle wall), `CD` (castle door)

---

## 7. Scoring

Score is a 6-digit number (max 999999, wraps to 0 if exceeded). Displayed in HUD.

### 7.1 Point Values

| Event                        | Points      |
|------------------------------|-------------|
| Goomba stomp                 | 100         |
| Koopa stomp (to shell)       | 100         |
| Brick block break (Super+)   | 50          |
| Coin collected               | 200         |
| Power-up collected           | 1000        |
| Fireball enemy kill          | 200         |
| Shell enemy kill (1st)       | 200         |
| Shell enemy kill (2nd)       | 400         |
| Flagpole (lowest section)    | 100         |
| Flagpole (mid section)       | 1000 / 2000 |
| Flagpole (top section)       | 5000        |

### 7.2 Multi-Stomp Combo (Bouncing on enemies consecutively without touching ground)

Each consecutive stomp in a single airborne sequence:

| Stomp #  | Points |
|----------|--------|
| 1st      | 100    |
| 2nd      | 200    |
| 3rd      | 400    |
| 4th      | 800    |
| 5th      | 1000   |
| 6th      | 2000   |
| 7th      | 4000   |
| 8th      | 8000   |
| 9th+     | 1UP (extra life) |

Combo resets when Mario touches the ground.

### 7.3 Flagpole Height Scoring

The pole is 10 tiles tall. Mario's height at contact determines score:

| Contact tile from bottom | Points |
|--------------------------|--------|
| 1 (lowest)               | 100    |
| 2–3                      | 500    |
| 4–5                      | 1000   |
| 6–7                      | 2000   |
| 8–9                      | 4000   |
| 10 (top)                 | 5000   |

### 7.4 Score Display

- Floating score text appears at location of scored event, rises 2 tiles over 60 frames, then fades out
- Color: white text with black 1px outline
- Multiple score texts can appear simultaneously

---

## 8. Level Design

### 8.1 Grid Specification

- Tile size: 16×16 logical pixels
- Canvas render: 32×32 pixels per tile (2x scale)
- Level width: 224 tiles (3584 logical px, 7168 canvas px)
- Level height: 15 tiles visible (240 logical px, 480 canvas px) + 1 tile below viewport (pit death zone)
- Row 0 = top of screen, Row 14 = ground level, Row 15 = pit (instant death)
- Column 0 = level start, Column 223 = castle end

### 8.2 Tile ID Reference

| ID  | Description                    |
|-----|--------------------------------|
| `.` | Empty (air)                    |
| `G` | Ground tile                    |
| `B` | Brick block                    |
| `Q` | Question mark block            |
| `H` | Hard block (indestructible)    |
| `I` | Invisible item block           |
| `PT`| Pipe top-left                  |
| `PR`| Pipe top-right                 |
| `PL`| Pipe body-left                 |
| `PB`| Pipe body-right                |
| `FP`| Flagpole segment               |
| `FF`| Flag (top of pole)             |
| `CA`| Castle wall                    |
| `CD`| Castle door                    |

Question mark block contents are specified separately in the level data as `Q:coin`, `Q:mushroom`, `Q:flower`, `Q:star`.

### 8.3 World 1-1 Layout

Time limit: **400 seconds**

Mario spawn point: Column 3, Row 13 (standing on ground).

#### Enemy Spawn List (World 1-1)

| Enemy Type     | Spawn Column | Spawn Row | Notes                    |
|----------------|--------------|-----------|--------------------------|
| Goomba         | 22           | 13        |                          |
| Goomba         | 23           | 13        | Pair                     |
| Goomba         | 39           | 13        |                          |
| Goomba         | 40           | 13        | Pair                     |
| Koopa Troopa   | 57           | 12        | On elevated platform     |
| Goomba         | 80           | 13        |                          |
| Goomba         | 81           | 13        |                          |
| Piranha Plant  | 97           | 11        | In tall pipe             |
| Goomba         | 107          | 13        |                          |
| Goomba         | 108          | 13        |                          |
| Goomba         | 110          | 13        |                          |
| Goomba         | 111          | 13        |                          |
| Koopa Troopa   | 128          | 13        |                          |
| Goomba         | 149          | 13        |                          |
| Goomba         | 150          | 13        |                          |
| Goomba         | 153          | 13        |                          |
| Goomba         | 154          | 13        |                          |

#### Block / Tile Layout (condensed description by region)

Engineers should construct the 2D grid from this region-by-region description. The full 15-row × 224-column grid is defined as all-air (`.`) by default; only non-air tiles are listed.

**Row 14 (ground, full length except gaps):**
- Columns 0–68: Ground `G`
- Columns 69–70: Gap (empty — pit)
- Columns 71–85: Ground `G`
- Columns 86–88: Gap
- Columns 89–96: Ground `G` (connects to pipe area)
- Columns 97–103: Ground `G`
- Columns 104–107: Gap
- Columns 108–197: Ground `G`
- Columns 198–209: Staircase (see staircase section)
- Columns 210–223: Ground `G` (castle base)

**Row 13 (ground second row, same columns as row 14):** Same pattern as row 14 — ground is 2 tiles deep minimum.

**Rows 12–11–10–9 (underground ground fill):** Rows 12–9 for columns 0–68, 71–85, 89–223 are also `G` to fill the underground; visible area starts from row 9 upward.

> Implementation note: Ground is drawn from row 9 to row 14 for all ground columns. Only the top row (row 9) shows the "top of ground" sprite; rows 10–14 show the "fill" ground sprite.

**Pipes:**

| Pipe Col (left) | Height (tiles above ground) | Has Piranha |
|------------------|-----------------------------|-------------|
| 28–29            | 2 (rows 12–13)              | No          |
| 38–39            | 3 (rows 11–13)              | No          |
| 46–47            | 3 (rows 11–13)              | No          |
| 57–58            | 4 (rows 10–13)              | No          |
| 97–98            | 3 (rows 11–13)              | Yes         |

Pipe tile layout for a 2-wide, H-height pipe with left column C and top at row R:
- (R, C) = `PT`, (R, C+1) = `PR`
- For rows R+1 to 13: (row, C) = `PL`, (row, C+1) = `PB`

**Question Mark Blocks (? blocks):**

| Column | Row | Contents       |
|--------|-----|----------------|
| 16     | 9   | `Q:coin`       |
| 21     | 5   | `Q:mushroom`   |  ← Hidden mushroom block (treat as `I` type)
| 22     | 9   | `Q:coin`       |
| 24     | 9   | `Q:coin`       |
| 77     | 9   | `Q:coin`       |
| 78     | 5   | `Q:mushroom`   |
| 79     | 9   | `Q:coin`       |
| 80     | 9   | `Q:coin`       |
| 109    | 5   | `Q:coin`       |
| 110    | 9   | `Q:star`       |
| 113    | 5   | `Q:coin`       |

**Brick Blocks:**

| Column Range | Row | Notes                        |
|--------------|-----|------------------------------|
| 17–20        | 9   | Row of bricks                |
| 23           | 9   | Single brick between ?blocks |
| 25–26        | 9   | Bricks                       |
| 78–82        | 9   | Bricks                       |
| 77–80        | 5   | Elevated bricks              |
| 108–112      | 5   | Elevated bricks              |
| 130–133      | 9   | Bricks                       |
| 130          | 5   | Single elevated brick        |
| 148–155      | 9   | Long brick row               |

**Elevated Platform (Columns 29–33, Row 8):**
- Columns 29–33, Row 8: `H` (hard blocks forming a platform over the first pipe zone)

**Staircase (end of level, columns 198–209):**

The staircase is a right-ascending set of hard blocks leading to the flagpole.

| Step | Columns  | Rows covered (from bottom) |
|------|----------|-----------------------------|
| 1    | 198      | 13                          |
| 2    | 199      | 12–13                       |
| 3    | 200      | 11–13                       |
| 4    | 201      | 10–13                       |
| 5    | 202      | 9–13                        |
| 6    | 203      | 8–13                        |
| 7    | 204      | 7–13                        |
| 8    | 205      | 6–13                        |
| —    | 206–209  | Ground only (13)            |

All staircase blocks are tile type `H`.

**Flagpole (columns 210–211):**

| Row | Col 210 | Col 211 |
|-----|---------|---------|
| 4   | `FF`    | `.`     |
| 5   | `FP`    | `.`     |
| 6   | `FP`    | `.`     |
| 7   | `FP`    | `.`     |
| 8   | `FP`    | `.`     |
| 9   | `FP`    | `.`     |
| 10  | `FP`    | `.`     |
| 11  | `FP`    | `.`     |
| 12  | `FP`    | `.`     |
| 13  | `FP`    | `.`     |

**Castle (columns 212–223):**

```
Row  8:  . . . CA CA CA CA CA CA CA CA .
Row  9:  . . CA CA CA CA CA CA CA CA CA CA
Row 10:  . . CA CA CA CA CA CA CA CA CA CA
Row 11:  . . CA CA CA CA CA CA CA CA CA CA
Row 12:  . . CA CA CD CD CA CA CA CA CA CA
Row 13:  G  G  CA CA CD CD CA CA CA CA CA CA
```

(Castle tiles fill columns 214–223 for rows 8–13 with CA, two center columns 216–217 rows 12–13 are CD for the door.)

### 8.4 Camera / Scrolling

- Camera X follows Mario: camera.x = Mario.x - 128 (keep Mario 8 tiles from left edge)
- Camera X minimum: 0 (never scroll left of level start)
- Camera X maximum: levelWidth - canvasLogicalWidth (stop at right edge)
- **No scrolling left:** If Mario moves left, camera does not scroll left once Mario is past the leftmost visible edge. Mario can still move left within visible space, but camera.x never decreases.
- Camera Y: fixed (no vertical scrolling in World 1-1)

### 8.5 Time Limit

- 400 seconds displayed in HUD
- Counts down in real time (decrement 1 per 60 frames)
- At 100 seconds remaining: music tempo doubles ("hurry up" mode)
- At 0 seconds: Mario dies (death animation, regardless of state)
- Time does not count down during pause or death animation

---

## 9. HUD

The HUD is drawn on top of the canvas at the top of the screen. HUD occupies rows 0–1 of the visible area (32 logical px, 64 canvas px). Game world renders below.

### 9.1 Layout

```
[MARIO]   [SCORE]       [COIN ICON × COUNT]   [WORLD]   [TIME]
                                                          [LIVES × N]
```

Exact positions (canvas coordinates, 2x scale):

| Element         | Canvas X  | Canvas Y | Alignment |
|-----------------|-----------|----------|-----------|
| "MARIO" label   | 24        | 16       | Left      |
| Score value     | 24        | 32       | Left      |
| Coin icon       | 200       | 16       | Center    |
| "×" separator   | 214       | 16       | —         |
| Coin count (00) | 228       | 16       | Left      |
| "WORLD" label   | 312       | 16       | Left      |
| World number    | 318       | 32       | Left      |
| "TIME" label    | 424       | 16       | Left      |
| Time value      | 430       | 32       | Left      |

- Score: 6 digits, zero-padded (e.g., "000300")
- Coin count: 2 digits, zero-padded (e.g., "×14")
- World: formatted as "1-1"
- Time: 3 digits (e.g., "368")
- Font: pixel font, 8×8 per character (16×16 on canvas at 2x), white with black shadow 1px offset down-right
- HUD background: solid black bar, full canvas width, 48 canvas px tall

### 9.2 Lives Display

- Lives shown on the level intro screen ("WORLD X-X" screen between deaths): "MARIO × N"
- Not shown during gameplay in HUD (original NES behavior)
- Lives counter starts at 3

### 9.3 Pause Overlay

- When paused: render "PAUSED" text centered on canvas in white pixel font, large (16px logical)
- HUD remains visible; game world is frozen but visible

---

## 10. Win / Lose Conditions

### 10.1 Winning

- Mario touches the flagpole (column 210, any row 4–13)
- Flagpole animation plays (slide down, flag lowers, walk to castle)
- Level complete fanfare sound plays
- Score tally screen shown (time remaining → bonus points: remaining seconds × 50 pts)
- Transition to next level (World 1-2 stub — show "Coming Soon" screen for MVP)

### 10.2 Losing a Life

Mario loses a life when:
1. **Enemy contact** (and Mario is Small): death animation triggers
2. **Falling into a pit** (Mario.y > levelHeight + 1 tile): instant death animation
3. **Time reaches 0**: death animation triggers

Death sequence:
1. All enemies freeze
2. Mario death animation: pop up (+8 px/frame initial vy), then fall (gravity applies)
3. Wait for Mario to fall off-screen (~2 seconds total)
4. Decrement lives counter
5. If lives > 0: show "WORLD 1-1" intro card (black screen, HUD with lives count, 3-second pause), then respawn Mario at column 3
6. If lives = 0: Game Over screen

### 10.3 Game Over

- Black screen with "GAME OVER" text centered, white pixel font
- Display for 5 seconds, then return to Title Screen
- Score is NOT saved between game overs (no persistence for MVP)

### 10.4 Title Screen

- Black background
- "SUPER MARIO BROS" text (large, centered)
- "PRESS ENTER TO START" blinking text (toggle every 30 frames)
- Decorative Mario sprite
- One player only (no 2-player for MVP)

---

## 11. Audio (Web Audio API)

All audio is **procedurally synthesized** using the Web Audio API. No external audio files. No copyrighted Nintendo audio may be used. All sounds are approximations using oscillators, gain nodes, and frequency scheduling.

### 11.1 Background Music

- Approximation of an upbeat looping theme using square wave oscillators
- Tempo: 120 BPM normal, 240 BPM in "hurry" mode (≤100 seconds remaining)
- Implementation: sequence of [frequency, duration_in_beats] pairs scheduled via AudioContext.currentTime
- Loop seamlessly when sequence ends
- Stop on death, pause on game pause, resume on unpause

**Suggested base melody sequence (first bar approximation):**
```
E5(0.125), E5(0.125), REST(0.125), E5(0.125), REST(0.125), C5(0.125), E5(0.25),
G5(0.5), REST(0.5), G4(0.5), REST(0.5)
```
(Engineers may use a freely-licensed Mario-style chiptune melody or compose a new one — the above is a structural hint only and must not reproduce Nintendo's copyrighted composition.)

### 11.2 Sound Effects

All SFX use the Web Audio API OscillatorNode or AudioBufferSourceNode.

| Sound           | Type        | Behavior Description                                                         |
|-----------------|-------------|------------------------------------------------------------------------------|
| Jump (small)    | Square wave | Frequency sweep: 300Hz → 600Hz over 0.1s, gain 0.3                         |
| Jump (super)    | Square wave | Frequency sweep: 200Hz → 500Hz over 0.15s, gain 0.3                        |
| Coin            | Sine wave   | Two-tone: 988Hz (0.05s) then 1319Hz (0.15s), gain 0.4                      |
| Power-up appear | Square wave | Rising arpeggio: C4→E4→G4→C5, each 0.1s                                    |
| Power-up get    | Square wave | Rising scale: C5→D5→E5→F5→G5→A5→B5→C6, each 0.05s, gain 0.5              |
| Break block     | Noise burst | White noise, 0.08s, gain 0.4, highpass filter 2000Hz                        |
| Stomp enemy     | Square wave | Frequency: 200Hz → 100Hz over 0.1s, gain 0.5                               |
| Death (Mario)   | Square wave | Descending sequence: C5→B4→Bb4→A4→Ab4→G4→Gb4→F4→E4→Eb4, 0.1s each        |
| Level complete  | Square wave | Ascending fanfare arpeggio (freely composed, ~3 seconds)                    |
| 1-UP            | Square wave | Rising two-tone chord: G4+E5, 0.5s, gain 0.5                               |
| Fireball        | White noise | Short burst 0.05s, lowpass 800Hz, gain 0.3                                  |
| Flagpole        | Sine wave   | Descending slide: 660Hz → 220Hz over 1.0s                                   |

### 11.3 Audio Engine Requirements

- Single AudioContext created once on first user interaction (to comply with browser autoplay policy)
- All sounds are non-blocking (fire and forget, do not await)
- Background music is a separate gain chain; SFX on another gain chain — both feed into master gain
- Master volume: 0.7 (adjustable via a future settings menu)
- Music and SFX respect pause state (music suspends AudioContext or stops scheduling when paused)

---

## 12. Technical Architecture

### 12.1 File Structure

```
my-mario/
├── index.html        # Entry point — canvas element, script imports
├── engine.js         # Game loop, input handling, collision detection
├── player.js         # Mario state machine, physics application, animation
├── enemies.js        # Enemy classes: Goomba, KoopaTroopa, Shell, PiranhaPlant, FlyingKoopa
├── level.js          # Level data (tile grid, enemy spawns, block contents), camera logic
├── renderer.js       # All canvas draw calls: tiles, sprites, HUD, particles, overlays
├── audio.js          # Web Audio API: music sequencer, SFX functions
└── ui.js             # Title screen, Game Over screen, pause overlay, score popups
```

### 12.2 index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Super Mario Bros</title>
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

### 12.3 Canvas & Coordinate System

- Canvas element: 512×480 pixels (rendered on screen)
- Logical resolution: 256×240 (NES resolution)
- Scale factor: 2× (all logical coordinates × 2 = canvas coordinates)
- All game logic operates in logical coordinates; renderer multiplies by 2 before drawing
- Origin (0, 0) = top-left of visible canvas
- Camera offset is subtracted from world coordinates before rendering

### 12.4 Game Loop (engine.js)

```
requestAnimationFrame loop:
  1. Calculate delta time (cap at 50ms to avoid spiral of death)
  2. Process input state
  3. If not paused:
     a. Update player (physics, state machine, animation frame)
     b. Update enemies (AI, physics, animation)
     c. Update power-ups (physics, movement)
     d. Check collisions (player↔tiles, player↔enemies, player↔power-ups, enemies↔tiles, shell↔enemies)
     e. Update camera
     f. Update HUD values (score, timer, coins)
     g. Update particles / score popups
     h. Update audio (music scheduler)
  4. Render:
     a. Clear canvas
     b. Draw background (sky color)
     c. Draw tiles (only tiles within camera view + 2 tile margin)
     d. Draw power-ups
     e. Draw enemies
     f. Draw player
     g. Draw particles
     h. Draw HUD
     i. Draw overlays (pause, game over, etc.)
  5. requestAnimationFrame(loop)
```

Target: 60fps. Delta time is used for timer countdown but physics runs at fixed 60fps steps.

### 12.5 Collision Detection (engine.js)

- All entities use AABB (Axis-Aligned Bounding Box) collision
- Tile collision: check tiles at entity's four corners each frame; resolve penetration axis-by-axis (horizontal first, then vertical)
- Player hitbox: slightly inset from sprite bounds (2px logical on each horizontal side) to feel fair
- Enemy hitboxes: exact sprite bounds
- Stomp detection: Mario's bottom edge hits enemy's top half → stomp; Mario's side hits enemy → damage
- Stomp condition: Mario.vy > 0 AND Mario.bottom > enemy.top AND Mario.bottom < enemy.center

### 12.6 Sprite System (renderer.js)

No external image files. All sprites are drawn programmatically using canvas 2D API shapes (fillRect, arc, etc.) or from a procedurally generated ImageData spritesheet.

**Sprite approach:**
- Define sprites as 2D arrays of color indices (palette-based, NES-style)
- Each sprite is 16×16 or 16×32 logical pixels
- A palette object maps color indices to hex color strings
- renderer.drawSprite(spriteId, x, y, palette, flipX) — renders a sprite at logical coordinates

**Required sprites (minimum set):**
- Mario: walk1, walk2, walk3, stand, jump, crouch, skid, death (× Small and Super/Fire variants)
- Goomba: walk1, walk2, squish
- Koopa: walk1, walk2, shell, shell-spin1, shell-spin2
- Piranha Plant: open, closed
- Mushroom (red), Mushroom (green/1UP), Fire Flower, Star (2 frames)
- Fireball, Fireball explosion
- Coin (2 frames)
- Tiles: ground-top, ground-fill, brick, question-block (2 frames), used-block, hard-block
- Pipe: top-left, top-right, body-left, body-right
- Flagpole, flag, castle tiles
- HUD coin icon, digit sprites (0–9), letter sprites (A–Z)

### 12.7 Module Interfaces

#### engine.js exports / owns:
- `gameState`: `{ screen: 'title'|'intro'|'playing'|'paused'|'death'|'gameover'|'win', score, coins, lives, world, level, time }`
- `inputState`: `{ left, right, up, down, jump, run, start }` — updated each frame from keyboard events
- `init()`: bootstrap, attach event listeners, start loop
- `collision.checkTile(entity, grid)`: returns collision sides
- `collision.checkEntity(a, b)`: returns overlap rect or null

#### player.js exports:
- `class Mario { state, x, y, vx, vy, facing, animFrame, ... }`
- `mario.update(inputState, grid, dt)`
- `mario.onEnemyContact(enemy)`
- `mario.onPowerUp(type)`

#### enemies.js exports:
- `class Goomba { x, y, vx, vy, alive, animFrame }`
- `class KoopaTroopa { x, y, vx, vy, state: 'walking'|'shell'|'sliding', alive }`
- `class Shell { x, y, vx, vy, alive }`
- `class PiranhaPlant { x, y, state: 'hidden'|'rising'|'extended'|'retracting', timer }`
- `class FlyingKoopa { x, y, vx, vy, spawnY, state: 'flying'|'walking', alive }`
- Each class has `update(grid, mario, dt)` and `draw(renderer, camera)` methods

#### level.js exports:
- `WORLD_1_1`: `{ grid: string[][], enemies: EnemyDef[], blocks: BlockDef[], timeLimit: 400 }`
- `camera`: `{ x, y, update(mario, levelWidth) }`
- `getTile(col, row)`: returns tile ID string
- `setTile(col, row, id)`: mutates grid (used for breaking bricks, depleting ?blocks)

#### renderer.js exports:
- `Renderer` class wrapping `CanvasRenderingContext2D`
- `renderer.drawTile(tileId, col, row, cameraX)`
- `renderer.drawSprite(spriteId, x, y, options)`
- `renderer.drawHUD(gameState)`
- `renderer.drawBackground()`
- `renderer.drawParticles(particles)`

#### audio.js exports:
- `audio.init()`: create AudioContext on first user gesture
- `audio.playMusic()` / `audio.stopMusic()` / `audio.pauseMusic()` / `audio.resumeMusic()`
- `audio.setHurryMode(bool)`
- `audio.sfx.jump(isBig)` / `audio.sfx.coin()` / `audio.sfx.stomp()` / `audio.sfx.death()` / etc.

#### ui.js exports:
- `ui.drawTitle(ctx)`
- `ui.drawGameOver(ctx)`
- `ui.drawIntro(ctx, world, level, lives)`
- `ui.drawPause(ctx)`
- `ui.addScorePopup(x, y, value)` / `ui.updatePopups(dt)` / `ui.drawPopups(renderer)`

### 12.8 Performance Requirements

- Target 60fps on a modern desktop browser (Chrome, Firefox, Safari)
- Tile rendering: only draw tiles within `[cameraX - tileSize, cameraX + canvasWidth + tileSize]`
- Enemy update: skip update for enemies more than 3 screen widths ahead of camera (not yet spawned)
- Enemy despawn: remove enemies that are more than 1 screen width behind camera (fell off screen)
- No dynamic memory allocation in the hot render loop (reuse draw call arguments)
- `requestAnimationFrame` is the only timer; do not use `setInterval` or `setTimeout` for game logic

### 12.9 Browser Compatibility

- Target: Chrome 90+, Firefox 88+, Safari 14+
- Use ES6 modules (`type="module"`)
- No transpilation required (no Babel, no Webpack)
- Web Audio API: check for `AudioContext` support; degrade gracefully (no audio) if unavailable
- Canvas 2D API: universally supported in target browsers

---

## Appendix A: Physics Constants Reference

```javascript
// physics.js (or inline in engine.js)
export const PHYSICS = {
  GRAVITY:              0.5,   // px/frame²
  JUMP_HOLD_GRAVITY:    0.25,  // px/frame² while holding jump and rising
  MAX_FALL_SPEED:       8.0,   // px/frame
  JUMP_VELOCITY:       -8.5,   // px/frame (initial, both Mario sizes)
  WALK_ACCEL:           0.15,  // px/frame²
  RUN_ACCEL:            0.25,  // px/frame²
  WALK_MAX_SPEED:       2.5,   // px/frame
  RUN_MAX_SPEED:        5.0,   // px/frame
  SKID_DECEL:           0.35,  // px/frame²
  GROUND_FRICTION:      0.12,  // px/frame²
  AIR_RESISTANCE:       0.04,  // px/frame²
  COYOTE_FRAMES:        4,     // frames of grace after ledge
  FIREBALL_SPEED_X:     6.0,   // px/frame
  FIREBALL_SPEED_Y:    -4.0,   // px/frame (initial upward, will bounce)
  SHELL_SPEED:          8.0,   // px/frame
  ENEMY_WALK_SPEED:     1.0,   // px/frame
  FLYING_KOOPA_SPEED:   1.5,   // px/frame
  MUSHROOM_SPEED:       1.5,   // px/frame
  STAR_SPEED_X:         2.0,   // px/frame
  STAR_BOUNCE_RESTITUTION: 0.9,
  INVINCIBILITY_DURATION: 600, // frames (~10 seconds at 60fps)
  SHRINK_INVINCIBILITY:   120, // frames (~2 seconds after being hit)
};
```

---

## Appendix B: Color Palette

NES-approximate colors used for sprite drawing:

| Name             | Hex       | Usage                            |
|------------------|-----------|----------------------------------|
| Sky Blue         | `#6B8CFF` | Background                       |
| Mario Red        | `#D82800` | Mario cap, shirt                 |
| Mario Skin       | `#FCBCB0` | Mario face, hands                |
| Mario Brown      | `#7C4000` | Mario overalls (small/super)     |
| Mario Blue       | `#0058F8` | Mario overalls (main color)      |
| Goomba Brown     | `#8C3800` | Goomba body                      |
| Goomba Tan       | `#E0A868` | Goomba feet                      |
| Koopa Green      | `#009400` | Koopa body                       |
| Koopa Yellow     | `#E4BC28` | Koopa shell                      |
| Ground Top       | `#E09050` | Ground tile top row              |
| Ground Fill      | `#C87028` | Ground tile fill                 |
| Brick Orange     | `#D04000` | Brick block face                 |
| Brick Dark       | `#8C2800` | Brick mortar lines               |
| Question Yellow  | `#FCD860` | ? block                          |
| Question Dark    | `#784000` | ? block border                   |
| Pipe Green       | `#00A800` | Pipe body                        |
| Pipe Dark Green  | `#007000` | Pipe shadow                      |
| Coin Yellow      | `#FCD860` | Coin                             |
| White            | `#FCFCFC` | HUD text, effects                |
| Black            | `#000000` | Outlines, HUD background         |
| Fire Orange      | `#FC7460` | Fireball                         |
| Star Yellow      | `#FCD860` | Star power-up                    |

---

## Appendix C: MVP Scope vs. Future Work

### MVP (Version 1.0) — This Spec

- World 1-1 fully playable
- All player states (Small, Super, Fire, Invincible, Death)
- All listed enemies (Goomba, Koopa, Shell, Piranha Plant; Flying Koopa optional)
- All power-ups
- Full HUD
- Full audio (synthesized)
- Title, Game Over, Win screens

### Future Work (not in scope for 1.0)

- World 1-2 through 8-4
- Warp pipes / underground levels
- Bowser and other bosses
- Red Koopa Troopa (turn at ledge)
- Buzzy Beetles, Lakitu, Spiny, Hammer Bros
- Swimming levels
- Ice physics
- High score persistence (localStorage)
- Mobile touch controls
- Gamepad API support
- Settings menu (volume, controls)
- 2-player alternating mode

---

*This document is the authoritative specification for the Super Mario Bros web game implementation. All implementation decisions not covered here should default to matching the original NES behavior as closely as possible.*
