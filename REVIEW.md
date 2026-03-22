# Code Review — v2 Implementation

---

## Critical (fix before merge)

### PERF-001: `enemies.filter()` and `shells.filter()` called every physics step during PLAYING
**File:** `src/scenes/WorldScene.ts` **Lines:** 275–276
**Issue:** `.filter()` allocates a new array on every physics tick (up to 60× per second during PLAYING). With 32 enemies in a pool this creates 32-element arrays per frame — a guaranteed GC pressure source.
```ts
this.enemies = this.enemies.filter(e => e.alive);
this.shells  = this.shells.filter(s => s.alive);
```
**Fix:** Replace with an in-place swap-remove loop that writes alive entries back without allocation. The dead flag (`alive = false`) already exists; a compact loop avoids any heap object.

---

### PERF-002: `shakeBlocks.push()` with anonymous object literal during PLAYING
**File:** `src/scenes/WorldScene.ts` **Line:** 317
**Issue:** Every time Small Mario bumps a brick, a `new` object `{ col, row, timer, offsetY }` is allocated and `.push()`-ed into the `shakeBlocks` array during PLAYING state. On the same tick `shakeBlocks.filter()` (line 345) also runs, creating another array. Neither is pooled.
**Fix:** Pre-allocate a fixed-size circular buffer for shake blocks (max ~4 simultaneous). Reuse slots in-place.

---

### PERF-003: `shakeBlocks.filter()` called every physics tick
**File:** `src/scenes/WorldScene.ts` **Line:** 345
**Issue:** Same allocation pattern as PERF-001 — `.filter()` creates a new array every frame regardless of whether any blocks are shaking.
**Fix:** In-place compact loop (swap-remove), or a fixed-capacity pool with a `count` index.

---

### PERF-004: `shakeBlocks.find()` called from `getBlockShakeOffset()` during rendering — O(n) per visible tile
**File:** `src/scenes/WorldScene.ts` **Line:** 353
**Issue:** `getBlockShakeOffset(col, row)` calls `.find()` on the shake list. If the SE2 renderer calls this per visible tile (up to ~300 tiles per frame), this is O(tiles × shakeBlocks) every frame.
**Fix:** Use a `Map<string, number>` keyed by `"col,row"` (consistent with how `TileRenderer.slotMap` works) so lookup is O(1).

---

### PERF-005: `Mario.activeFireballCount` getter calls `.filter()` every call; `_tryFireball` also calls `.find()`
**File:** `src/entities/player/Mario.ts` **Lines:** 113–115, 389
**Issue:** `activeFireballCount` (called at line 386 before every fire attempt) calls `.filter()` on the 2-slot array. With pool size 2 the array is tiny, but this is still a spec violation — zero allocation is the rule during PLAYING. Immediately after, `.find()` runs a second scan.
**Fix:** Maintain an explicit `_activeCount: number` counter incremented on `reset()` and decremented when `fb.alive` transitions to false. Remove both `.filter()` and `.find()`.

---

### PERF-006: `TileRenderer.update()` builds a `visible[]` array on every frame
**File:** `src/systems/TileRenderer.ts` **Lines:** 98–106
**Issue:**
```ts
const visible: { col: number; row: number; id: string }[] = [];
// ... then visible.push(...)
```
A new array of plain objects is allocated every frame (up to ~300 entries) in the PLAYING hot path. This is a direct violation of the zero-allocation rule stated in the file's own contract.
**Fix:** Iterate over visible tiles directly in the second loop rather than collecting them into an intermediate array. The pool assignment loop can consume `(col, row, id)` inline.

---

### PERF-007: `TileRenderer.slotMap` uses template-string keys — string concatenation every frame
**File:** `src/systems/TileRenderer.ts` **Lines:** 134, 149
**Issue:** `` `${col},${row}` `` creates a new string on every visible tile every frame (and again in `setTile`). String concatenation is GC pressure during PLAYING.
**Fix:** Use a flat numeric key `row * LEVEL_COLS + col` as a `Map<number, TileSlot>` key — integer key lookups are allocation-free and faster in V8.

---

### PERF-008: `SpriteRegistry.bakeSprite()` calls `rt.draw(gfx, ...)` per pixel — O(w×h) WebGL draw calls
**File:** `src/systems/SpriteRegistry.ts` **Lines:** 40–54
**Issue:** For every non-transparent pixel the code clears a Graphics object, sets fill style, calls `fillRect(0,0,1,1)`, then calls `rt.draw(gfx, col, row)`. A single 16×16 sprite has up to 256 pixels, each a separate WebGL draw call. For the full sprite atlas this bake can take hundreds of milliseconds on a low-end device and can block the browser main thread.
**Fix:** This only affects startup/PreloadScene, not the game loop. However, a `CanvasTexture` with raw pixel writes via `ctx.putImageData()` (if available in the Phaser build) would be orders-of-magnitude faster. Alternatively batch draws per-color rather than per-pixel. Flag as a startup-performance issue.

---

### LOGIC-001: Score wrap semantics are wrong
**File:** `src/systems/GameStateMachine.ts` **Lines:** 252–258
**Issue:** The spec (spec.md line 460) states: "Score wraps to 0 if exceeded." The code caps at 999,999 with `Math.min()` — that is not wrapping. The wrap logic (lines 252–254) only triggers when score is *exactly* 999,999, and then it resets to `Math.min(points, 999_999)` — which still saturates rather than wraps. A score of 999,800 + 300 should become 100 (the overage), not 999,999.
**Fix:** `this.state.score = (this.state.score + points) % 1_000_000` — wrapping modulo on each addition.

---

### LOGIC-002: STOMP_COMBO_POINTS[4] is 1000 but spec says 1000 for the 5th stomp — verify the 5th entry
**File:** `src/config/constants.ts` **Line:** 86
```ts
export const STOMP_COMBO_POINTS = [100, 200, 400, 800, 1000, 2000, 4000, 8000] as const;
```
**Issue:** Spec table (spec.md lines 486–494):
- 5th stomp = 1000 ✅
- 6th stomp = 2000 ✅
- 7th stomp = 4000 ✅
- 8th stomp = 8000 ✅
These values match. No bug here — marked for confirmation only.

---

### LOGIC-003: WorldScene does NOT wire `TileRenderer` — Q→used and brick-break visuals are broken
**File:** `src/scenes/WorldScene.ts` **Lines:** 296–327
**Issue:** `_handleBlockBonk()` mutates `this.grid[row][col]` directly (line 301 for Q→USED, line 311 for brick break to EMPTY) but never calls `TileRenderer.setTile()`. `TileRenderer` has its own copy of the grid reference and its `setTile()` method exists precisely to update the visual after a tile mutation. If the renderer is instantiated elsewhere (expected SE2 wiring), the visual will not update on bonk until the next `TileRenderer.update()` sweep, which will silently show the old tile for one frame, OR if TileRenderer holds a reference to the same grid array object (which it does — `buildFromGrid(grid)` stores the reference), the _next_ `update()` call will re-read the mutated tile and show it correctly. So the visual does eventually update — but the `setTile()` method exists for immediate visual correction (same frame). Not calling it means a 1-frame visual glitch on Q→USED transitions.
**Fix:** After mutating `this.grid`, call `tileRenderer.setTile(col, row, newTileId)` to guarantee same-frame visual update.

---

### LOGIC-004: HUDScene imports a different `hudData` than WorldScene writes to
**File:** `src/ui/HUDScene.ts` **Line:** 40; `src/scenes/WorldScene.ts` **Line:** 34; `src/scenes/UIScene.ts` **Line:** 25
**Issue:** WorldScene imports `hudData` from `'./UIScene'` (the `UIScene.ts` singleton). HUDScene imports its own `hudData` from `'../ui/HUDScene.ts'` (a separate declaration). These are **two different object instances**. WorldScene writes to `UIScene.hudData`; HUDScene reads from `HUDScene.hudData`. The HUD will always display the initial default values (score=0, time=400, etc.) and never update during gameplay.
**Fix:** HUDScene must import `hudData` from `'../scenes/UIScene'` (or a shared module), not export its own. Alternatively, WorldScene must write to `HUDScene.hudData`. Currently both exports exist independently and are never connected.

---

### LOGIC-005: Shell chain-kill points cap at 8000 but spec says doubling continues (spec: "doubles each subsequent kill")
**File:** `src/entities/enemies/Shell.ts` **Line:** 19; `src/entities/enemies/KoopaTroopa.ts` **Line:** 144
**Issue:** The spec (spec.md line 379) says "1st kill +200, doubles each subsequent kill." The spec table in the audit requirements specifies the doubling as: 200, 400, 800, 1600, then continuing to double. But `CHAIN_KILL_POINTS` in Shell.ts is `[200, 400, 800, 1600, 3200, 5000, 8000]` — this diverges after 1600: spec would expect 3200 then 6400 (doubling), but the table has 5000 then 8000. The `KoopaTroopa.shellChainKillPoints()` independently caps at 8000 with a `*2` formula but starts from 200 and doubles correctly until cap. The two entities use incompatible chain-kill tables. Additionally the Shell test verifies 5000 at kill 6 (not 6400 as doubling would give), confirming the code and test are consistent but **may be wrong vs. spec if strict doubling is intended**.
**Fix:** Clarify with the spec author whether strict doubling (200→400→800→1600→3200→6400) or the NES game's actual table (which tops at 5000 for 6th kill) applies. The two systems (Shell and KoopaTroopa) must use the same table.

---

### INTEGRATION-001: AudioSystem.init() not called from any scene — no sound during gameplay
**File:** `src/systems/AudioSystem.ts` **Line:** 125; `src/scenes/WorldScene.ts` `create()`; `src/scenes/PreloadScene.ts` `create()`
**Issue:** `AudioSystem.init()` must be called on first user interaction. Neither `WorldScene` nor `PreloadScene` calls `audioSystem.init()`. The `GameStateMachineCallbacks` in `WorldScene.create()` are all stubs (`/* SE2: ... */` comments). No SFX calls (`audioSystem.playSFX(...)`) appear anywhere in WorldScene.
**Fix:** Wire `audioSystem.init()` to the first user interaction (e.g., the Enter key press on the title screen handler). Add SFX calls at stomp, jump, coin, and bonk events.

---

### INTEGRATION-002: `TileRenderer` is never instantiated in `WorldScene`
**File:** `src/scenes/WorldScene.ts` (entire file)
**Issue:** `TileRenderer` exists and is well-implemented but is never constructed or updated anywhere in `WorldScene`. The scene has no rendering calls for tiles at all. Tiles will not be drawn during gameplay.
**Fix:** Construct a `TileRenderer` in `WorldScene.create()` after `initRegistry()`, call `buildFromGrid(this.grid)`, and call `tileRenderer.update(this.camera.cameraX)` in the render step.

---

### INTEGRATION-003: WorldScene uses `UIScene.hudData` but `HUDScene` (the actual renderer) reads its own isolated `hudData`
**File:** See LOGIC-004 above — same root cause, this is the integration failure consequence: the HUD renders stale data every frame.

---

## High (fix before ship)

### PERF-009: `AudioSystem.playTone()` and `playNoise()` allocate Web Audio nodes on every SFX call
**File:** `src/systems/AudioSystem.ts` **Lines:** 171–173, 200–202, 207
**Issue:** Every `playSFX()` call creates `new OscillatorNode`, `new GainNode` (and optionally `new BiquadFilterNode`, `new AudioBuffer`, `new BufferSourceNode`) via the AudioContext factory methods. These are Web Audio API allocations, not JavaScript GC-able plain objects, but they do consume audio thread resources. For high-frequency events (every stomp, every coin) this can cause audio glitching.
**Issue (additional):** `playNoise()` calls `ctx.createBuffer()` and fills it with `Math.random()` values every time — this is O(sampleRate × duration) work on the audio thread. For a 0.05s clip at 44100 Hz: ~4400 random numbers computed synchronously.
**Fix:** Pre-bake noise buffers once at `init()` time. Re-use oscillator+gain node chains via a small pool (AudioContext nodes are reusable by reconnecting).

---

### PERF-010: `_scheduleNote()` in music system creates `new OscillatorNode` + `GainNode` per note
**File:** `src/systems/AudioSystem.ts` **Lines:** 284–293
**Issue:** Every music note creates two new Web Audio nodes. At 120 BPM with ~16 notes/bar, this is ~32 node allocations/second continuous during gameplay.
**Fix:** Use a ScriptProcessorNode (deprecated but supported) or AudioWorkletNode to render the melody with no per-note allocation. Alternatively, use a small pool of oscillator+gain pairs and swap frequencies.

---

### PERF-011: `_renderWorld()` in HUDScene calls `world.split('')` every frame the world string changes
**File:** `src/ui/HUDScene.ts` **Line:** 200
**Issue:** `'1-1'.split('')` allocates an array of strings every time the world label changes. This is guarded by `if (d.world !== this.lastWorld)` so it only fires on level transition — acceptable frequency. However, the `_charKey()` method also builds a local `Record<string, string>` letterMap object literal (`{}`) on every call. This is called per-character per-update when any HUD value changes.
**Fix:** Hoist `letterMap` to a module-level constant so it is allocated once.

---

### LOGIC-006: `InputManager.playerAirborne` is set *after* `pollInput()` is called, so jump buffer is one frame late
**File:** `src/scenes/WorldScene.ts` **Lines:** 168–170
```ts
const input = this.inputManager.pollInput();  // uses stale playerAirborne
this.inputManager.playerAirborne = !this.mario.grounded;  // updated AFTER poll
```
**Issue:** `pollInput()` uses `this.playerAirborne` to decide whether to set `jumpBufferTimer`. But `playerAirborne` is set from `mario.grounded` *after* the poll. So on the frame Mario leaves the ground, `playerAirborne` is still `false` (last frame's value), meaning a jump press on that exact frame will NOT set the buffer when it should. This is a 1-frame delay in jump buffer tracking.
**Fix:** Update `playerAirborne` before calling `pollInput()`:
```ts
this.inputManager.playerAirborne = !this.mario.grounded;
const input = this.inputManager.pollInput();
```

---

### LOGIC-007: Piranha Plant proximity check uses `TILE_SIZE` (16px) but spec says "within 1 tile"
**File:** `src/entities/enemies/PiranhaPlant.ts` **Lines:** 63–67
**Issue:** `isMarioNearby()` uses `Math.abs(marioCenterX - pipeCenter) <= TILE_SIZE` (i.e., ≤16px). The spec says "does not emerge within 1 tile (16px) of Mario." The pipe is 2 tiles wide, so `pipeCenter = pipeX + TILE_SIZE`. A 1-tile radius from pipe center means the plant stays hidden when Mario's center is within 16px of the pipe center. This matches the implementation. **Correct — no bug.**

---

### LOGIC-008: Goomba double-direction-flip on wall hit
**File:** `src/entities/enemies/Goomba.ts` **Lines:** 56–61
**Issue:** `resolveEnemyTileCollision` with `reverseOnWall=true` already negates `enemy.vx` when a wall is hit (TileCollision.ts line 214: `enemy.vx = enemy.reverseOnWall ? -Math.abs(enemy.vx) : 0`). Then Goomba.update() at line 59 does `this.vx = -this.vx` again — a second negation. The Goomba test (Goomba.test.ts line 83) acknowledges this as "double-negation is the actual code behavior" — meaning the Goomba bounces back to its original direction after hitting a wall, which is **wrong**: it should reverse on wall hit. The wall collision effectively has no effect on direction.
**Fix:** Remove the `this.vx = -this.vx` at line 59 in Goomba.ts; the collision resolver already handles direction reversal. Update the test to verify the correct single-negation behavior.

---

### LOGIC-009: `resolvePlayerTileCollision` applies `entity.x += entity.vx` AFTER snapping vx to 0 on wall hit
**File:** `src/systems/TileCollision.ts` **Lines:** 126–148
**Issue:** When a wall hit is detected, `entity.vx` is zeroed and `entity.x` is snapped. Then at line 148, `entity.x += entity.vx` is applied — but `vx` is now 0 so this is a no-op. This means the snap position is used as the final X, which is correct. However, if `vx > 0` and no wall is hit, `entity.x += entity.vx` moves the entity correctly. The concern is when the horizontal pass snaps but then the vertical pass uses the new snapped `entity.x` — this is correct behavior. No bug.

---

### LOGIC-010: Coin scoring: spec says coin = 200pts, `addCoin()` calls `addScore(SCORE.COIN)` where `SCORE.COIN = 200`
**File:** `src/config/constants.ts` **Line:** 76; `src/systems/GameStateMachine.ts` **Line:** 264
**Issue:** Spec (spec.md line 469) does not show coins in the scoring table. The NES game awards 200 per coin, and `SCORE.COIN = 200` matches. The `addCoin()` function awards this score. **Correct.**

---

### LOGIC-011: `WorldScene._handleBlockBonk()` does not call `TileRenderer.setTile()` — already documented as LOGIC-003/INTEGRATION-002
See LOGIC-003.

---

### LOGIC-012: `KoopaTroopa.shellChainKillPoints()` caps at 8000 but starts chain at 200 per instance — conflates KoopaTroopa chain with Shell chain
**File:** `src/entities/enemies/KoopaTroopa.ts` **Lines:** 142–146; `src/entities/enemies/Shell.ts` **Lines:** 79–83
**Issue:** `KoopaTroopa` has its own `comboPoints` and `shellChainKillPoints()` method that doubles on each call. `Shell` has `CHAIN_KILL_POINTS` table and `getChainKillPoints()`. Both are tested separately. WorldScene uses `shell.getChainKillPoints()` for shell chain kills (line 253). `KoopaTroopa.shellChainKillPoints()` appears to be dead code — it is never called from WorldScene. The chain kill for a KoopaTroopa kicked into enemies is handled via the Shell entity. **Dead code risk**: `KoopaTroopa.shellChainKillPoints()` will never be called in practice, but it still doubles `this.comboPoints` on each call, which has no effect.
**Fix:** Either remove `KoopaTroopa.shellChainKillPoints()` or document that it is only called when KoopaTroopa itself (in SLIDING state) kills enemies — but WorldScene's shell chain loop only uses `Shell` entities.

---

## Medium (fix soon)

### TYPE-001: `SpriteRegistry.getTexture()` throws on unknown key — callers do not catch
**File:** `src/systems/SpriteRegistry.ts` **Lines:** 88–89
**Issue:** `getTexture(key)` throws an `Error` if the key is not in the texture cache. Every entity's `getSpriteKey()` can return a key that was never registered (e.g., a typo in a sprite key string). At runtime this would crash the game on the first render frame. There is no try/catch anywhere in the rendering pipeline.
**Fix:** Either return a fallback texture (e.g., `getTexture('tile_used')`) with a `console.warn`, or add a `hasTexture()` guard before every `getTexture()` call in the rendering path.

---

### TYPE-002: `gameState` getter in WorldScene returns `any` (implicit)
**File:** `src/scenes/WorldScene.ts` **Line:** 455
```ts
get gameState() {
  return this.stateMachine.state;
}
```
No explicit return type. `stateMachine.state` is typed as `GameState`, but the getter is implicitly `any` to external consumers if TypeScript inference fails. Add `: GameState` return type annotation.

---

### TYPE-003: `Entity.ts` imports `PhysicsEntity` from `TileCollision.ts` — creates a circular-risk dependency
**File:** `src/entities/Entity.ts` **Line:** 7
**Issue:** `Entity` implements `PhysicsEntity` from `TileCollision`. `TileCollision` is a physics/systems module. `Enemy` imports from both `Entity` and `TileCollision`. This is not a circular import (no cycle exists), but `PhysicsEntity` should live in a shared types file (`src/types/`) rather than in a systems file, to keep the dependency graph clean.

---

### LOGIC-013: `WorldScene` creates enemies with `new Goomba/KoopaTroopa/PiranhaPlant` during `create()` — not during PLAYING
**File:** `src/scenes/WorldScene.ts` **Lines:** 379–391
**Issue:** Enemy spawning in `_spawnEnemies()` happens at scene creation (INTRO state), not during PLAYING. The spec requires a 32-slot pool of enemies pre-allocated at startup. The current code does pre-allocate during `create()`, which is correct and outside the game loop. **No bug in timing.** However, the enemy array (`this.enemies`) has no capacity limit — if level data defines more than 32 enemies, the code will allocate beyond the pool spec. The `POOL_ENEMIES = 32` constant is defined but not enforced here.

---

### LOGIC-014: `_buildLevel()` allocates `new Array(LEVEL_COLS).fill(TILE.EMPTY)` for each of 16 rows — only during `create()`, not during PLAYING
**File:** `src/scenes/WorldScene.ts` **Lines:** 399–402
**Issue:** This is in `create()`, not `update()`. Not a game-loop performance issue. But noted: the grid is rebuilt from scratch on each level load. For the pooling philosophy, the grid could be pre-allocated once and reset, but this is a minor concern.

---

### LOGIC-015: Death screen — Mario.update() is called with a dead-zero input snapshot that allocates a new object literal
**File:** `src/scenes/WorldScene.ts` **Lines:** 145–150
**Issue:**
```ts
this.mario.update(
  { left: false, right: false, down: false, run: false,
    jumpHeld: false, jump: false, fire: false, start: false },
  ...
)
```
An anonymous object literal is allocated every physics tick during DEATH state. Pre-allocate as a module-level constant `DEAD_INPUT`.

---

### LOGIC-016: HUDScene `_charKey()` letterMap object literal allocated on every call
**File:** `src/ui/HUDScene.ts` **Lines:** 223–230
**Issue:** A full `Record<string, string>` is instantiated on every `_charKey()` call. This is called for every changed digit every frame.
**Fix:** Hoist to a module constant.

---

### LOGIC-017: `PiranhaPlant` constructor places plant `x` at `pipeCol * TILE_SIZE + (TILE_SIZE - 7)` — this is 9px offset inside a 2-tile pipe (32px wide). Centering would be `pipeCol * TILE_SIZE + 9` (logical pixels).
**File:** `src/entities/enemies/PiranhaPlant.ts` **Line:** 38
**Issue:** `TILE_SIZE - 7 = 9`. With plant width=14, the center of the plant would be at `pipeCol * TILE_SIZE + 9 + 7 = pipeCol * TILE_SIZE + 16`, which is the center of tile `pipeCol`. A 2-tile pipe occupies cols `pipeCol` and `pipeCol+1`, so the pipe center is `pipeCol * TILE_SIZE + TILE_SIZE`. The plant is placed in the left half of the pipe, not the center. The `isMarioNearby()` check uses `pipeX + TILE_SIZE` as pipe center (right edge of left tile), so it's consistent with the plant position but not with a visually centered plant in a 2-tile pipe.
**Severity:** Low — only affects visual centering, not gameplay.

---

## Low (nice to have)

### STYLE-001: `TileRenderer._spriteKey()` checks `registry.hasTexture(key)` and returns null — but the Q-block branch (lines 186–190) reads from `TILE_SPRITE` first, which already returns the key for 'Q' as `'tile_question_1'`, then the Q branch overwrites it. The fallback check on line 193 is never reached for 'Q'. Dead code path in the 'Q' branch.

### STYLE-002: `AudioSystem` STARMAN_MELODY references `NOTE.Eb4` (311.13 Hz) and `NOTE.Eb5` at line 93 — `Eb5` is not in the `NOTE` map. This will produce `undefined` frequency at runtime, causing a silent note or NaN frequency on the OscillatorNode.
**File:** `src/systems/AudioSystem.ts` **Line:** 93 (`NOTE.Eb5`)
**Fix:** Add `Eb5: 622.25` to the `NOTE` map.

### STYLE-003: `InputManager` edge latch does not prevent OS key-repeat events from re-setting `keyDown[e.code] = true` every repeat tick. The latch prevents the `_jump = true` edge, but `keyDown` is always kept true. This is correct — the latch is on the edge flag, not on `keyDown`. But the test at line 194 ("simulate key-repeat: another keydown") does not test with `repeat: true` dispatched without a prior keyup, which means it doesn't actually test key-repeat suppression (the handler reads `e.code`, not `e.repeat`). **The current code is correct but the test is incomplete** — documented in Test Coverage Gaps below.

---

## Spec Compliance

| Check | Status | Notes |
|-------|--------|-------|
| GRAVITY = 0.5 | ✅ | physics.ts line 9 |
| MAX_FALL_SPEED = 8.0 | ✅ | physics.ts line 10 |
| JUMP_VELOCITY = -8.5 | ✅ | physics.ts line 13 |
| JUMP_HOLD_GRAVITY = 0.25 | ✅ | physics.ts line 14; applied only when vy < 0 AND jump held (Mario.ts line 565) |
| JUMP_RELEASE_GRAVITY = 0.5 | ✅ | physics.ts line 15 |
| COYOTE_FRAMES = 4 | ✅ | physics.ts line 18 |
| JUMP_BUFFER_FRAMES = 6 | ✅ | physics.ts line 19 |
| WALK_MAX = 2.5 | ✅ | physics.ts line 24 |
| RUN_MAX = 5.0 | ✅ | physics.ts line 25 |
| SKID_DECEL = 0.35 | ✅ | physics.ts line 26 |
| Shell speed = 8.0 px/frame | ✅ | KOOPA_SHELL_SPEED = 8.0 |
| Fireball max = 2 | ✅ | FIREBALL_MAX_ACTIVE = 2; POOL_FIREBALLS = 2 |
| Fireball speed = 6.0 px/frame | ✅ | FIREBALL_SPEED_X = 6.0 |
| Player hitbox 2px inset each side | ✅ | MARIO_HITBOX_INSET = 2; used in resolvePlayerTileCollision vertical pass (col+2, col-3) and isGrounded |
| Stomp condition: vy>0 AND bottom>enemy.top AND bottom<enemy.centerY | ✅ | TileCollision.ts isStomping() |
| Fire→Super→Small→Death damage chain | ✅ | Mario.ts onEnemyContact() |
| Small Mario + FireFlower → Super (not Fire) | ✅ | Mario.ts onPowerUp() lines 155–163 |
| Coin-to-life at exactly 100, counter resets to 0 | ✅ | GameStateMachine.addCoin() line 266: `>= 100` |
| Score wraps at 999999 | ❌ | Score is **clamped** at 999,999, not wrapped. See LOGIC-001 |
| Timer hurry mode at ≤100s | ✅ | GameStateMachine line 197: `<= HURRY_TIME` where HURRY_TIME=100 |
| Piranha Plant: does NOT emerge within 1 tile of Mario | ✅ | PiranhaPlant.isMarioNearby() uses TILE_SIZE radius |
| Shell chain kills: 200, 400, 800, 1600... doubling | ⚠️ | Shell CHAIN_KILL_POINTS diverges from strict doubling at kill 6 (5000 vs 6400). See LOGIC-005 |
| 9th consecutive stomp → extra life | ✅ | GameStateMachine.onStomp() line 291: `>= 9` |
| AudioContext created before user interaction | ✅ | AudioSystem.init() guards with `if (this.ctx) return`; but init() is never called from any scene. See INTEGRATION-001 |
| HUDScene reads from correct shared hudData | ❌ | HUDScene has its own isolated `hudData`; WorldScene writes to UIScene's `hudData`. Different objects. See LOGIC-004 |
| TileRenderer.setTile() updates Q→used and brick breaks | ⚠️ | WorldScene never calls setTile(); updates propagate only on next TileRenderer.update() call — 1-frame visual glitch |

---

## Test Coverage Gaps

### TCG-001: Coyote time tested at COYOTE_FRAMES-2 (pass) and COYOTE_FRAMES (fail) — but NOT at exact frame 4 (pass) and exact frame 5 (fail)
**File:** `src/__tests__/Mario.test.ts` **Lines:** 267–305
The tests use `COYOTE_FRAMES - 2` frames before jump, which confirms that coyoteTimer=1 at the check point allows jump. But there is no test that verifies pressing jump on frame COYOTE_FRAMES-1 (coyoteTimer=1 at check, the last valid frame) succeeds, nor that pressing on frame COYOTE_FRAMES (coyoteTimer=0 at check, the first invalid frame) fails. The tests should be: "press jump on air frame 3 → succeeds (coyoteTimer=1 at check)" and "press jump on air frame 4 → fails (coyoteTimer=0 at check)."

### TCG-002: Jump buffer not tested at exactly frame 6 (pass) and frame 7 (fail)
**File:** `src/__tests__/Mario.test.ts` **Lines:** 309–333
The buffer expiry test runs `JUMP_BUFFER_FRAMES` more frames after the press and asserts timer=0. There is no test that asserts: "at frame JUMP_BUFFER_FRAMES-1 the buffer is still active (>0)" and "at frame JUMP_BUFFER_FRAMES+1 the buffer is expired (=0)." The exact boundary is not pinned.

### TCG-003: Stomp combo table tested up through stomp #8, but individual stompCombo entries in the code table are [100, 200, 400, 800, **1000**, 2000, 4000, 8000] — the 5th entry is 1000, not 1024 (non-power-of-2). Test covers this correctly via `it.each` but does not test that stomp #5 is specifically 1000 (not 800 or 2000). Given the spec confirms 5th=1000, this is fine — the test does verify it.

### TCG-004: Enemy tests do NOT verify that a STOMPED/FLIPPED Goomba does not damage Mario
**File:** `src/__tests__/Goomba.test.ts` **Lines:** 207–231
The "damagesMario" tests only verify `goombaState` and `alive`, not that WorldScene's `isSideHit()` call would return false for a stomped enemy. Since WorldScene checks `!enemy.alive || !enemy.active` before calling `isSideHit()`, a STOMPED Goomba (alive=true, active=true) could still side-hit Mario for 30 frames. **This is a real bug**: STOMPED Goomba has `alive=true` and `active=true`. WorldScene line 209 checks `if (!enemy.alive || !enemy.active) continue;` — STOMPED Goomba passes this check. Then `isSideHit(mario, stompedGoomba)` would return true (they can overlap) and damage Mario. There is no `isStomping` check from WorldScene's perspective for a STOMPED-state Goomba — the stomp was already processed, but the STOMPED Goomba remains a hitbox threat.
**Fix:** WorldScene's enemy collision loop must skip enemies in STOMPED and FLIPPED states. Or Goomba must expose a `canDamageMario(): boolean` method that returns false in STOMPED/FLIPPED states.

### TCG-005: No test verifies that Piranha Plant's `onStomp()` does NOT kill it (and thus Mario takes damage from it)
**File:** `src/__tests__/PiranhaPlant.test.ts` **Line:** 218
The test only checks that `alive` and `piranhaState` are unchanged after `onStomp()`. It does not verify that WorldScene's `isSideHit()` would then damage Mario (no `canDamageMario` contract tested).

### TCG-006: `broadPhaseFilter` in TileCollision.ts has zero tests
**File:** `src/systems/TileCollision.ts` **Lines:** 377–391
The `broadPhaseFilter` function is exported and used conceptually for optimization, but there is no test for it in TileCollision.test.ts. More critically, `broadPhaseFilter` itself calls `.filter()` — if used inside the game loop it would be a GC source. No tests confirm its correctness or its non-use during PLAYING.

### TCG-007: Score wrap behavior is tested but tests verify the WRONG behavior
**File:** `src/__tests__/GameStateMachine.test.ts` **Lines:** 78–85
The test "score wraps after hitting 999999 exactly: next addScore starts from new value" passes because the code behavior (LOGIC-001) matches what the test expects. But the test is wrong per the spec — it expects `addScore(500)` after score=999,999 to yield 500 (which is what the buggy code does). The correct wrap behavior (999,999 + 500 = 0 + (1,000,499 mod 1,000,000) = 499) should be tested instead. The test is a false positive: it passes precisely because it encodes the wrong behavior.

### TCG-008: Key-repeat suppression test does not exercise the actual suppression path
**File:** `src/__tests__/InputManager.test.ts` **Line:** 194
The test dispatches `new KeyboardEvent('keydown', { code: 'Space', repeat: true })` but `InputManager._onKeyDown` never checks `e.repeat` — it only checks `edgeLatch.jump`. The test passes because `edgeLatch.jump` is true after the first poll, not because `e.repeat` was handled. This is a false positive: the test would pass even if OS key-repeat events with `repeat: false` were dispatched.

### TCG-009: No test for `getBlockShakeOffset()` returning a non-zero value
**File:** `src/scenes/WorldScene.ts` **Lines:** 352–355
`getBlockShakeOffset()` is not tested at all. Its `.find()` call (PERF-004) goes untested.

### TCG-010: No integration test verifying `hudData` is shared between WorldScene and HUDScene
The split `hudData` bug (LOGIC-004) is completely untested.

---

## Verdict

**Do not ship.**

### Blockers

1. **LOGIC-004** (Critical): The HUD will always show zeros. WorldScene writes to `UIScene.hudData`, HUDScene reads from its own `HUDScene.hudData`. Two disconnected singletons. Score, coins, lives, and time never update on screen.

2. **LOGIC-001** (Critical): Score wrap is broken — the game clamps at 999,999 instead of wrapping. The spec explicitly requires wrap-to-0.

3. **PERF-001/002/003** (Critical): `.filter()`, `.push()`, and anonymous object allocations in the game loop's hot path every physics tick, in direct violation of the pooling contract stated in the codebase's own documentation.

4. **PERF-005** (Critical): `activeFireballCount` calls `.filter()` and `_tryFireball` calls `.find()` on every fire-attempt frame — both prohibited allocations in the PLAYING loop.

5. **PERF-006** (Critical): `TileRenderer.update()` allocates a `visible[]` array of up to ~300 objects every frame.

6. **INTEGRATION-001** (Critical): `audioSystem.init()` is never called. No sound plays.

7. **INTEGRATION-002** (Critical): `TileRenderer` is never instantiated in `WorldScene`. Tiles are not rendered.

8. **TCG-004** (High): STOMPED Goomba can still side-hit Mario for 30 frames after being stomped. This is both a test gap and an untested gameplay bug.

9. **LOGIC-008** (High): Goomba direction reversal is double-negated — a Goomba that hits a wall does not reverse direction. The wall collision has no net effect on the Goomba's direction.

10. **STYLE-002** (Medium): `NOTE.Eb5` is undefined in the AudioSystem — Starman melody will produce a NaN frequency on one note, causing audio glitches or a silent note.

The physics constants, stomp combo table, coyote/buffer timings, and damage chain logic are all correct and well-tested. The test suite for `GameStateMachine`, `Mario`, individual enemy state machines, `TileCollision`, `InputManager`, and `CameraSystem` is comprehensive and verifies real behavior (not just code execution). These areas are merge-ready. The integration layer, performance guarantees, HUD data sharing, and tile rendering wiring are not.
