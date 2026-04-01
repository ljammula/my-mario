# Super Mario Bros — World 1-1 Implementation Plan

## Current State Assessment

The project has a **substantial Phaser 3 + TypeScript codebase** (~40 source files) that **compiles and builds cleanly** but fails at runtime — only showing a loading/blank screen. The architecture is sound but there are likely several runtime bugs preventing the game from being playable.

### What exists:
- Phaser 3 game config with Boot → Preload → World + UI scene pipeline
- Full RLE-encoded sprite data (~2000 lines) for Mario, enemies, tiles, HUD
- Complete World 1-1 level data (224×15 grid with pipes, blocks, enemies, staircase, flagpole, castle)
- Mario entity with full physics (gravity, jump, run, crouch, fireballs)
- Enemy entities: Goomba, KoopaTroopa, PiranhaPlant, Shell
- Item entities: Mushroom, FireFlower, Star, CoinPopup
- AABB collision system (player↔tiles, player↔enemies, fireballs↔enemies)
- GameStateMachine with screen transitions (TITLE→INTRO→PLAYING→DEATH/WIN/GAMEOVER)
- AudioSystem with procedural synthesis (melodies + SFX)
- HUD overlay system (UIScene parallel scene)
- TileRenderer with viewport culling and object pooling
- Camera system, InputManager

### Likely failure points (why only a loading screen shows):
1. **Ground rows extend too high** — `world1-1.ts` fills rows 9–14 as ground, but Mario spawns at row 13 × 16 = 208px. If rows 9–13 are all solid ground, Mario spawns **inside** solid tiles and gets stuck.
2. **Sprite baking may silently fail** — If `createCanvas` textures don't render correctly, every sprite is invisible/black.
3. **InputManager may not wire to Phaser's keyboard** — If key listeners aren't connected, Enter never fires and the game stays on TITLE.
4. **Level height mismatch** — Constants say `LEVEL_ROWS = 16` but the grid is only 15 rows. Off-by-one causes collision lookups to fail.
5. **Camera zoom + coordinate system bugs** — Phaser's 2× zoom applied to a scene using logical coordinates can cause misalignment if objects aren't positioned consistently.

---

## Plan: 8 Sequential Phases

**Each phase produces a verifiable checkpoint.** Phases are ordered by dependency — later phases assume earlier ones work. Each phase can be assigned to a separate agent.

---

### Phase 1: Boot-to-Title Verification (CRITICAL — do this first)
**Goal:** Game loads, shows title screen, Enter advances to INTRO, then to PLAYING with a blue sky and ground visible.

**Files:** `src/main.ts`, `src/scenes/BootScene.ts`, `src/scenes/PreloadScene.ts`, `src/scenes/WorldScene.ts`, `src/scenes/UIScene.ts`, `src/systems/SpriteRegistry.ts`, `src/systems/SpriteData.ts`, `src/systems/InputManager.ts`

**Tasks:**
1. **Verify SpriteRegistry initializes without errors.** Open browser console — look for thrown errors in `initRegistry()` or `bakeSprite()`. If `scene.textures.createCanvas()` returns null, fix it. The `tile_sky` fallback texture used in `TileRenderer.buildFromGrid()` must exist before any Image uses it.

2. **Verify InputManager actually reads keyboard input.** Read `src/systems/InputManager.ts` — confirm it uses `window.addEventListener('keydown'/'keyup')` or Phaser's `this.input.keyboard`. The `pollInput()` method must return `{ start: true }` when Enter is pressed. If it's not wired up at all, wire it.

3. **Verify GameStateMachine TITLE→INTRO→PLAYING transition.** In `WorldScene._physicsStep()`, the state machine's `update(input)` is called — confirm `input.start` is `true` on Enter keypress. Add a temporary `console.log` if needed.

4. **Verify the title screen overlay is visible.** `UIScene` shows "SUPER MARIO BROS" / "PRESS ENTER TO START" — confirm the overlay rectangle and text objects are positioned correctly at canvas coordinates (not accidentally at logical coords being zoomed by Phaser).

**Verification:** Open `http://localhost:5173` → see title text → press Enter → see "WORLD 1-1" intro card for 3 seconds → see blue sky with ground tiles and Mario sprite visible on screen.

**Branch:** `feature/boot-to-title`

---

### Phase 2: Ground and Tile Rendering Fix
**Goal:** World 1-1 renders correctly — sky is blue, ground is brown, pipes/blocks/question marks all visible and positioned correctly.

**Files:** `src/data/levels/world1-1.ts`, `src/systems/TileRenderer.ts`, `src/config/constants.ts`

**Tasks:**
1. **Fix ground row range.** The spec says: row 0 = top, row 14 = ground level, row 15 = death pit. The grid in `world1-1.ts` is 15 rows (indices 0–14). But `LEVEL_ROWS = 16` in constants. The grid should either be 16 rows (with row 15 as death trigger, not in grid) or `LEVEL_ROWS` should match. Currently `buildGrid()` fills rows 9–14 as ground — this is **way too much ground**. In the original NES game, ground is only rows 13–14 (two tiles thick). Fix: ground should be rows 13–14 only. Rows 9–12 should be empty sky.

2. **Fix level height consistency.** `LEVEL_ROWS` = 16 in constants but `buildGrid()` creates 15 rows. Either add a 16th row to the grid or set `LEVEL_ROWS = 15`. The `TileRenderer.update()` iterates `for (let row = 0; row < LEVEL_ROWS; row++)` — if the grid only has 15 rows, accessing `grid[15]` returns `undefined`, silently skipping it. This is harmless but sloppy. Decide: **15 rows in grid, 16th row is virtual death zone only.** Update `LEVEL_ROWS` comments to clarify.

3. **Verify TileRenderer sprite key mapping.** Every tile ID used in the grid must map to a sprite key that exists in `SPRITE_DEFS`. Check: `G` → `tile_ground_top`/`tile_ground_fill`, `B` → `tile_brick`, `Q` → `tile_question_1`, etc. Make sure none return `null` from `_spriteKey()`.

4. **Verify pipe rendering.** Pipes use multi-character tile IDs (`PT`, `PR`, `PL`, `PB`). Check that `TileRenderer._spriteKey()` handles these correctly and that the corresponding sprites exist in `SPRITE_DEFS`.

**Verification:** Run the game → see blue sky background, brown ground strip at bottom (2 tiles thick), green pipes of varying heights, yellow question blocks floating at correct positions, brick blocks in clusters.

**Branch:** `feature/tile-rendering-fix`

---

### Phase 3: Mario Movement and Physics
**Goal:** Mario can walk, run, jump, and interact with solid tiles. Camera follows Mario.

**Files:** `src/entities/player/Mario.ts`, `src/systems/TileCollision.ts`, `src/systems/CameraSystem.ts`, `src/systems/InputManager.ts`, `src/config/physics.ts`

**Tasks:**
1. **Read and verify `Mario.update()` fully.** Check: horizontal acceleration/deceleration, gravity, jump initiation, variable-height jump, coyote time, ground detection, tile collision resolution. Mario's spawn position is `(48, 207)` — row 13 × 16 - 1 = 207. With ground at row 13 (y=208), Mario's bottom (y + h = 207 + 16 = 223) should land on the ground tile at row 13 (y=208). **Wait — if ground is at row 13, then ground top edge = 13*16 = 208. Mario at y=207 with h=16 has bottom at 223. The ground tile occupies y=[208, 224). Mario's feet at 223 are inside the ground tile. This needs the collision resolver to push Mario up.**

2. **Verify `resolvePlayerTileCollision` works with Mario's spawn position.** Mario spawns potentially overlapping with ground. The collision resolver must push him out correctly on the first frame. Test: does Mario's `grounded` flag get set to `true` after the first physics step?

3. **Verify camera follows Mario.** `CameraSystem.update(mario.x, levelWidthPx)` should set `cameraX = mario.x - 128`, clamped to `[0, levelWidth - 256]`. Then `applyToPhaser(scene)` should call `scene.cameras.main.setScroll(cameraX, 0)`. Confirm this chain works.

4. **Verify left boundary.** Mario should not walk left past x=0. Camera should not scroll left past 0.

5. **Verify Mario's sprite key changes with animation state.** `Mario.getSpriteKey()` must return valid keys like `mario_small_stand`, `mario_small_walk1`, `mario_small_jump` etc. These must all exist in `SPRITE_DEFS`.

**Verification:** Arrow keys move Mario left/right with acceleration. Space jumps with variable height. Running (hold X + direction) goes faster. Mario stops at left edge. Camera scrolls right as Mario moves. Mario cannot fall through ground. Mario falls into pits and dies.

**Branch:** `feature/mario-movement`

---

### Phase 4: Block Interactions
**Goal:** Mario can hit question blocks from below (coins/mushrooms emerge), break bricks as Super Mario, and collect floating coins.

**Files:** `src/scenes/WorldScene.ts` (`_handleBlockBonk`), `src/entities/items/Mushroom.ts`, `src/entities/items/FireFlower.ts`, `src/entities/items/Star.ts`, `src/entities/items/CoinPopup.ts`, `src/entities/items/Item.ts`

**Tasks:**
1. **Verify head-bonk detection.** `Mario.ts` must set `headBonkCol` and `headBonkRow` when Mario's head hits a tile from below (collision resolver's `onTopHit` callback). Confirm this callback fires and sets the correct col/row.

2. **Verify question block → used block transition.** When bonked, `grid[row][col]` changes from `Q` to `U` and `tileRenderer.setTile()` updates the visual. Coin/item spawns based on `BLOCKS` array content.

3. **Verify Mushroom physics.** Mushroom spawns above block, slides right at 1.5 px/frame, affected by gravity, reverses on wall hit. Player collision → collect → power-up to Super Mario.

4. **Verify brick breaking.** Super Mario hitting a brick from below: brick becomes empty (`.`), score +50, break sound plays. Small Mario: brick shakes but doesn't break.

5. **Verify coin popup animation.** Coin pops up from block, rises, fades. Score +200, coin counter +1.

**Verification:** Jump under a Q block → coin pops out and counter increments. Hit mushroom Q block → mushroom slides out → collect it → Mario grows to Super size. Super Mario hits brick → brick breaks.

**Branch:** `feature/block-interactions`

---

### Phase 5: Enemies — Goomba, Koopa, Piranha Plant
**Goal:** Enemies spawn, walk, and interact with Mario correctly. Stomping, shell kicks, and fireball kills work.

**Files:** `src/entities/enemies/Goomba.ts`, `src/entities/enemies/KoopaTroopa.ts`, `src/entities/enemies/PiranhaPlant.ts`, `src/entities/enemies/Shell.ts`, `src/entities/enemies/Enemy.ts`

**Tasks:**
1. **Verify enemy activation.** Enemies should only activate when near the camera viewport (`checkActivation(cameraX)`). Before activation, they stand still and invisible. Once active, they walk left.

2. **Verify Goomba behavior.** Walks left at constant speed, affected by gravity, reverses on wall hit, walks off ledges. Stomp → squish sprite → despawn after brief delay. Fireball → instant kill.

3. **Verify KoopaTroopa behavior.** Walks left, reverses on ledge (does NOT walk off). Stomp → enters shell state (stops moving). Kick shell (side contact with stopped shell) → slides at 8 px/frame. Shell kills other enemies on contact (chain kills). Stomp sliding shell → stops it.

4. **Verify PiranhaPlant behavior.** Rises from pipe on 2s cycle, pauses at top, retracts. Does not emerge if Mario is within 1 tile of the pipe. Damages Mario on contact. Killed by fireball.

5. **Verify stomp detection accuracy.** `isStomping()` checks: Mario.vy > 0, Mario.bottom > enemy.top, Mario.bottom < enemy.centerY, horizontal overlap. Mario bounces upward after stomp.

6. **Verify side-hit damage.** Contact that isn't a stomp → Mario takes damage (Small → death, Super → Small with invincibility frames).

**Verification:** Walk right → encounter Goomba pair at col 22-23 → stomp them → score popup 100. Encounter Koopa at col 57 → stomp → shell → kick shell → shell kills enemies in path. Piranha plant rises from pipe at col 97.

**Branch:** `feature/enemies`

---

### Phase 6: Power-ups and Fire Mario
**Goal:** Full power-up chain works: Small → Super (mushroom) → Fire (fire flower). Damage downgrade works. Fireballs kill enemies.

**Files:** `src/entities/player/Mario.ts` (form transitions, fireball spawning), `src/entities/player/Fireball.ts`, `src/entities/items/FireFlower.ts`, `src/entities/items/Star.ts`

**Tasks:**
1. **Verify form transitions.** Small + Mushroom → Super (height changes from 16 to 24, hitbox adjusts). Super + Fire Flower → Fire. Fire Mario + X key → shoots fireball. Damage: Fire → Super → Small → Death.

2. **Verify sprite key changes with form.** `getSpriteKey()` must return `mario_super_*` when Super, `mario_fire_*` when Fire. All these keys must exist in `SPRITE_DEFS`.

3. **Verify fireball mechanics.** Max 2 active. Launched at ~45° downward. Bounces on ground up to 5 times. Dies on wall hit. Kills enemies on contact (+200 pts).

4. **Verify Star invincibility.** Starman: 10s invincibility, kills enemies on contact. Mario sprite flickers/flashes. Timer expires → normal state.

5. **Verify hurt invincibility.** After taking damage (Super → Small), Mario has ~2s of invincibility with 10Hz flicker.

**Verification:** Get mushroom → grow to Super → get fire flower → become Fire Mario → shoot fireballs with X → fireballs bounce and kill Goombas. Take damage → shrink to Super. Take damage again → shrink to Small with flicker.

**Branch:** `feature/powerups-fire`

---

### Phase 7: Level Completion — Flagpole and End Sequence
**Goal:** Mario can reach the flagpole, grab it, get height-based bonus points, and the level-complete sequence plays.

**Files:** `src/scenes/WorldScene.ts` (`_checkTriggers`, `_triggerFlagpole`), `src/systems/GameStateMachine.ts`

**Tasks:**
1. **Verify flagpole trigger detection.** Flagpole is at col 210. When Mario's x + w overlaps col 210, `_triggerFlagpole()` fires. Height bonus calculated from Mario's y position.

2. **Verify WIN state transition.** `stateMachine.toWin()` → awards time bonus (remaining seconds × 50 pts) → WIN screen for 7 seconds → transitions to INTRO (next level, but we only have 1-1 so this could loop or show "coming soon").

3. **Verify staircase is climbable.** The staircase at cols 198–205 must have correct collision — Mario can walk up the steps (each 1 tile higher) and reach the flagpole.

4. **Add a reasonable end state.** Since only World 1-1 exists, after WIN → either restart 1-1 or show a "Thanks for playing" / "Coming Soon" screen instead of advancing to 1-2.

**Verification:** Navigate to end of level → climb staircase → touch flagpole → score bonus displays → level complete fanfare plays → game transitions appropriately.

**Branch:** `feature/flagpole-completion`

---

### Phase 8: Polish — HUD, Audio, Death/Respawn, Game Over
**Goal:** Full game loop works end-to-end including death, respawn, game over, and restart.

**Files:** `src/scenes/UIScene.ts`, `src/ui/HUDScene.ts`, `src/systems/AudioSystem.ts`, `src/systems/GameStateMachine.ts`, `src/state/hudData.ts`

**Tasks:**
1. **Verify HUD updates.** Score, coins, world number, and timer all display correctly and update in real-time during gameplay.

2. **Verify death sequence.** Mario falls in pit or enemy kills → death animation (pop up then fall) → 2s freeze → lives -1 → INTRO card → respawn at level start.

3. **Verify game over.** 0 lives → "GAME OVER" screen for 5s → return to TITLE. Score resets on new game.

4. **Verify audio plays.** Overworld music starts on first keypress. SFX for: jump, coin, stomp, death, level complete, powerup. Hurry mode at ≤100s doubles music tempo.

5. **Verify pause.** Enter during PLAYING → "PAUSED" overlay → Enter again → resume. All logic frozen during pause.

6. **Test full playthrough.** Start from title → play through entire 1-1 → reach flagpole. Die at least once to test respawn. Run out of lives to test game over. Restart.

**Verification:** Complete end-to-end playtest with no console errors. All systems working together smoothly.

**Branch:** `feature/polish-gameloop`

---

## Agent Assignment Strategy

Each phase can be assigned to a separate agent with these instructions:

1. **Always create the feature branch** before making changes: `git checkout -b feature/<name>` from `main`
2. **Read all files listed** in the phase before making any changes
3. **Run `npx vite build`** after changes to verify no compile errors
4. **Test in browser** with `npx vite --host` and verify the phase's acceptance criteria
5. **Commit working code** before moving to the next phase
6. **Do NOT skip ahead** — each phase assumes the previous phase works

### Parallel opportunities:
- Phases 1–3 are strictly sequential (each depends on the previous)
- Phase 4 (blocks) and Phase 5 (enemies) can run in parallel after Phase 3
- Phase 6 (power-ups) depends on Phase 4 + 5
- Phase 7 (flagpole) can run in parallel with Phase 6
- Phase 8 (polish) runs last

```
Phase 1 → Phase 2 → Phase 3 ──→ Phase 4 ──→ Phase 6 ──→ Phase 8
                              └→ Phase 5 ──┘
                              └→ Phase 7 ─────────────┘
```

---

## Key Technical Notes for All Agents

- **Coordinate system:** All game logic uses logical pixels (256×240 NES resolution). Phaser's camera zoom=2 handles upscaling to 512×480 canvas. Do NOT multiply by 2 in game logic.
- **Tile size:** 16×16 logical pixels. One tile = 16px.
- **Grid:** `grid[row][col]` where row 0 = top of screen, row 14 = ground level. Grid is 15 rows × 224 cols.
- **Sprites:** All procedurally generated as RLE pixel data, baked into Phaser CanvasTextures at startup. No external image files.
- **Physics:** Custom AABB — Phaser's arcade physics is present but configured with zero gravity. All collision is manual.
- **Audio:** Web Audio API procedural synthesis. No audio files.
- **No external assets.** Everything is code-generated.
- **Commit convention:** Use `git -c user.name="narsimha-jammula" -c user.email="laxminarsimha.jammula@gmail.com" commit` per CLAUDE.md.
- **Branch convention:** `feature/<short-description>` off `main` per CLAUDE.md.
