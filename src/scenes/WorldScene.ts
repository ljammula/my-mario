/**
 * WorldScene.ts
 * Main gameplay scene. Orchestrates all systems.
 *
 * Physics runs at a fixed 60fps timestep using a step accumulator.
 * Delta is capped at 50ms (3 frames) to prevent spiral-of-death on tab switch.
 *
 * Update order each tick:
 * 1. Input poll
 * 2. Mario update (physics + state machine)
 * 3. Enemy updates (active only)
 * 4. Item updates
 * 5. Collision resolution (player↔enemies, fireballs↔enemies, player↔items)
 * 6. Camera update
 * 7. Game state machine update
 * 8. HUD data write
 * 9. Rendering (SE2 owns, called via Phaser's scene update pipeline)
 */

import { InputManager } from '../systems/InputManager';
import { CameraSystem } from '../systems/CameraSystem';
import { GameStateMachine, GameStateMachineCallbacks } from '../systems/GameStateMachine';
import { TileRenderer } from '../systems/TileRenderer';
import * as SpriteRegistry from '../systems/SpriteRegistry';
import { audioSystem, MusicTrack, SFXKey } from '../systems/AudioSystem';
import {
  isStomping,
  isSideHit,
  entitiesOverlap,
} from '../systems/TileCollision';
import { Mario } from '../entities/player/Mario';
import { Enemy } from '../entities/enemies/Enemy';
import { Shell } from '../entities/enemies/Shell';
import { Goomba } from '../entities/enemies/Goomba';
import { KoopaTroopa } from '../entities/enemies/KoopaTroopa';
import { PiranhaPlant } from '../entities/enemies/PiranhaPlant';
import { hudData } from '../state/hudData';
import {
  TILE_SIZE,
  TILE,
  LEVEL_HEIGHT_PX,
  LEVEL_COLS,
  LEVEL_ROWS,
  SCALE,
  SCORE,
} from '../config/constants';
import { Screen } from '../types/entities';
import { TileGrid, LevelData, EnemyDef } from '../types/level';
import { EnemyType } from '../types/entities';

// Fixed timestep constants
const STEP_MS       = 1000 / 60;   // 16.667ms per physics step
const MAX_DELTA_MS  = 50;          // cap delta to 3 frames to prevent spiral-of-death

export class WorldScene extends Phaser.Scene {
  // ── Systems ────────────────────────────────────────────────────────────────
  private inputManager!:    InputManager;
  private camera!:          CameraSystem;
  private stateMachine!:    GameStateMachine;

  // ── Level data ─────────────────────────────────────────────────────────────
  private level!:           LevelData;
  private grid!:            TileGrid;

  // ── Entities ───────────────────────────────────────────────────────────────
  private mario!:           Mario;
  private enemies:          Enemy[]  = [];
  private shells:           Shell[]  = [];

  // ── Fixed timestep accumulator ─────────────────────────────────────────────
  private accumulator:      number   = 0;

  // ── TileRenderer (SE2) ─────────────────────────────────────────────────────
  private tileRenderer!: TileRenderer;

  // ── Block shake animation tracking (pre-allocated pool, max 8 simultaneous) ─
  private readonly _shakePool: Array<{ col: number; row: number; timer: number; offsetY: number }> =
    Array.from({ length: 8 }, () => ({ col: 0, row: 0, timer: 0, offsetY: 0 }));
  private _shakeCount = 0;
  // O(1) lookup: key = row * LEVEL_COLS + col → current offsetY
  private readonly _shakeMap = new Map<number, number>();

  constructor() {
    super({ key: 'WorldScene' });
  }

  // ── Phaser Lifecycle ───────────────────────────────────────────────────────

  create(): void {
    // Load World 1-1 level data
    // SE2 will provide the level data module; for now we create a minimal grid.
    this.level = this._buildLevel();
    this.grid  = this.level.grid;

    // Initialize systems
    this.inputManager = new InputManager();
    this.camera       = new CameraSystem();

    const callbacks: GameStateMachineCallbacks = {
      onHurryMode:     () => { audioSystem.setHurryMode(true); },
      onLivesLost:     () => { /* death jingle already triggered at death point */ },
      onGameOver:      () => { /* game over music handled by screen transition */ },
      onLevelComplete: (_timeBonus: number) => { audioSystem.playSFX('level_complete' as SFXKey); },
      onExtraLife:     () => { audioSystem.playSFX('oneup' as SFXKey); },
    };

    this.stateMachine = new GameStateMachine(callbacks);

    // Spawn Mario
    this.mario = new Mario(this.level.marioStartX, this.level.marioStartY);

    // Spawn enemies from level data
    this._spawnEnemies(this.level.enemies);

    // Phaser camera: set world bounds
    this.cameras.main.setBounds(0, 0, this.level.widthPx * SCALE, this.level.heightPx * SCALE);

    // Set background color
    this.cameras.main.setBackgroundColor(this.level.bgColor);

    // Initialize tile renderer (SE2)
    this.tileRenderer = new TileRenderer(this, SpriteRegistry);
    this.tileRenderer.buildFromGrid(this.grid);

    // Wire audio on first user interaction via keyboard input listener
    this.input.keyboard?.once('keydown', () => {
      audioSystem.init();
      audioSystem.playMusic('overworld' as MusicTrack);
    });
  }

  update(_time: number, delta: number): void {
    // Cap delta to prevent spiral of death after tab switch
    const cappedDelta = Math.min(delta, MAX_DELTA_MS);
    this.accumulator += cappedDelta;

    // Run as many fixed physics steps as the accumulator allows
    while (this.accumulator >= STEP_MS) {
      this._physicsStep();
      this.accumulator -= STEP_MS;
    }

    // Apply camera to Phaser after all physics steps
    this.camera.applyToPhaser(this);

    // Update tile renderer each display frame (not per physics step)
    this.tileRenderer.update(this.camera.cameraX);
  }

  // ── Physics Step ──────────────────────────────────────────────────────────

  private _physicsStep(): void {
    const gs = this.stateMachine.state;

    // Paused: no physics, but still poll input for unpause
    if (gs.screen === Screen.PAUSED) {
      const input = this.inputManager.pollInput();
      this.stateMachine.update(input);
      return;
    }

    // Death: only advance death animation, no other logic
    if (gs.screen === Screen.DEATH) {
      if (!this.mario.deathAnimDone()) {
        this.mario.update(
          { left: false, right: false, down: false, run: false,
            jumpHeld: false, jump: false, fire: false, start: false },
          this.grid,
          this.level.widthPx
        );
      }
      const input = this.inputManager.pollInput();
      this.stateMachine.update(input);
      return;
    }

    // Non-playing screens (TITLE, INTRO, WIN, GAMEOVER) — only state machine ticks
    if (gs.screen !== Screen.PLAYING) {
      const input = this.inputManager.pollInput();
      this.stateMachine.update(input);
      this._updateHUD();
      return;
    }

    // ── PLAYING ────────────────────────────────────────────────────────────

    // 1. Poll input (set airborne BEFORE poll so jump buffer sees correct state)
    this.inputManager.playerAirborne = !this.mario.grounded;
    const input = this.inputManager.pollInput();

    // Track grounded-before for stomp combo reset
    const wasGrounded = this.mario.grounded;

    // 2. Mario update
    this.mario.update(input, this.grid, this.level.widthPx);

    // Reset stomp combo when Mario lands
    if (!wasGrounded && this.mario.grounded) {
      this.stateMachine.onLand();
    }

    // 3. Pit check: Mario fell below level
    if (this.mario.y > LEVEL_HEIGHT_PX + 32) {
      this.mario._startDeath();
      this.stateMachine.triggerDeath();
    }

    // 4. Block interaction (head bonk)
    if (this.mario.headBonkCol >= 0 && this.mario.headBonkRow >= 0) {
      this._handleBlockBonk(this.mario.headBonkCol, this.mario.headBonkRow);
    }

    // 5. Enemy updates
    for (const enemy of this.enemies) {
      enemy.checkActivation(this.camera.cameraX);
      if (!enemy.alive || !enemy.active) continue;
      enemy.update(this.grid, this.mario, STEP_MS);
    }

    // Shell updates
    for (const shell of this.shells) {
      if (!shell.alive) continue;
      shell.update(this.grid, this.mario, STEP_MS);
    }

    // 6. Collision: Mario ↔ enemies
    for (const enemy of this.enemies) {
      if (!enemy.alive || !enemy.active) continue;

      if (isStomping(this.mario, enemy)) {
        // Stomp: Mario bounces, enemy takes stomp damage
        this.mario.bounceOffEnemy();
        enemy.onStomp(this.mario);
        audioSystem.playSFX('stomp' as SFXKey);
        const pts = this.stateMachine.onStomp();
        if (pts > 0) {
          // SE2: spawn score popup at enemy position
        }
      } else if (isSideHit(this.mario, enemy)) {
        // Side contact: Mario takes damage
        const damaged = this.mario.onEnemyContact();
        if (damaged) {
          // hurt sound handled below (death or hurt)
        }
        if (this.mario.dead) {
          audioSystem.playSFX('death' as SFXKey);
          this.stateMachine.triggerDeath();
        }
      }
    }

    // 7. Collision: fireballs ↔ enemies
    for (const fb of this.mario.fireballs) {
      if (!fb.alive) continue;
      for (const enemy of this.enemies) {
        if (!enemy.alive || !enemy.active) continue;
        if (entitiesOverlap(fb, enemy)) {
          enemy.onFireball();
          this.mario.killFireball(fb);
          this.stateMachine.addScore(SCORE.FIREBALL_KILL);
          // SE2: spawn score popup at enemy position
          break;
        }
      }
    }

    // 8. Collision: shells ↔ enemies (chain kills)
    for (const shell of this.shells) {
      if (!shell.alive) continue;
      for (const enemy of this.enemies) {
        if (!enemy.alive || !enemy.active) continue;
        if (entitiesOverlap(shell, enemy)) {
          enemy.onShell();
          const pts = shell.getChainKillPoints();
          this.stateMachine.addScore(pts);
          // SE2: spawn score popup at enemy position
        }
      }
    }

    // 9. Collision: Mario ↔ shells
    for (const shell of this.shells) {
      if (!shell.alive) continue;
      if (isStomping(this.mario, shell)) {
        this.mario.bounceOffEnemy();
        shell.onStomp(this.mario);
      } else if (isSideHit(this.mario, shell)) {
        const damaged = this.mario.onEnemyContact();
        if (damaged && this.mario.dead) {
          this.stateMachine.triggerDeath();
        }
      }
    }

    // 10. Cull dead entities (in-place compact — zero allocation)
    let ei = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      if (this.enemies[i].alive) this.enemies[ei++] = this.enemies[i];
    }
    this.enemies.length = ei;

    let si = 0;
    for (let i = 0; i < this.shells.length; i++) {
      if (this.shells[i].alive) this.shells[si++] = this.shells[i];
    }
    this.shells.length = si;

    // 11. Camera update
    this.camera.update(this.mario.x, this.level.widthPx);

    // 12. Game state machine tick
    this.stateMachine.update(input);

    // 13. Write HUD data for UIScene
    this._updateHUD();

    // 14. Block shake animations
    this._updateShakeBlocks();
  }

  // ── Block Interaction ─────────────────────────────────────────────────────

  private _handleBlockBonk(col: number, row: number): void {
    const tileId = this.grid[row]?.[col];
    if (!tileId) return;

    switch (tileId) {
      case TILE.QUESTION:
      case TILE.INVISIBLE: {
        // Reveal content, convert to USED
        this.grid[row][col] = TILE.USED;
        this.tileRenderer.setTile(col, row, TILE.USED);
        audioSystem.playSFX('bump' as SFXKey);
        // SE2: spawn item based on level block data at (col, row)
        this.stateMachine.addScore(0); // points from item collection handled separately
        break;
      }

      case TILE.BRICK: {
        if (this.mario.isSuper) {
          // Super/Fire Mario: break the brick
          this.grid[row][col] = TILE.EMPTY;
          this.tileRenderer.setTile(col, row, TILE.EMPTY);
          this.stateMachine.addScore(SCORE.BRICK_BREAK);
          audioSystem.playSFX('break_block' as SFXKey);
          // SE2: spawn 4 debris particles at (col * TILE_SIZE, row * TILE_SIZE)
        } else {
          // Small Mario: shake the brick (visual feedback only)
          if (this._shakeCount < this._shakePool.length) {
            const slot = this._shakePool[this._shakeCount++];
            slot.col = col; slot.row = row; slot.timer = 8; slot.offsetY = 0;
            this._shakeMap.set(row * LEVEL_COLS + col, 0);
          }
          audioSystem.playSFX('bump' as SFXKey);
        }
        break;
      }

      default:
        // USED, HARD, etc. — no interaction
        break;
    }
  }

  // ── Block Shake Animation ─────────────────────────────────────────────────

  private _updateShakeBlocks(): void {
    let alive = 0;
    for (let i = 0; i < this._shakeCount; i++) {
      const sb = this._shakePool[i];
      sb.timer--;
      // 2px up over first 4 frames, then return over next 4 frames
      sb.offsetY = sb.timer >= 4 ? -2 : 0;

      if (sb.timer > 0) {
        // Keep slot — compact in place
        if (alive !== i) this._shakePool[alive] = this._shakePool[i];
        this._shakeMap.set(sb.row * LEVEL_COLS + sb.col, sb.offsetY);
        alive++;
      } else {
        this._shakeMap.delete(sb.row * LEVEL_COLS + sb.col);
      }
    }
    this._shakeCount = alive;
  }

  /**
   * Get the current Y offset for a tile that is in shake animation.
   * SE2's tile renderer reads this to offset the tile's draw position.
   */
  getBlockShakeOffset(col: number, row: number): number {
    return this._shakeMap.get(row * LEVEL_COLS + col) ?? 0;
  }

  // ── HUD Data Feed ─────────────────────────────────────────────────────────

  private _updateHUD(): void {
    const gs = this.stateMachine.state;
    hudData.score  = gs.score;
    hudData.coins  = gs.coins;
    hudData.world  = `${gs.world}-${gs.levelNum}`;
    hudData.time   = Math.max(0, Math.floor(gs.time));
    hudData.lives  = gs.lives;
    hudData.hurry  = gs.hurryMode;
  }

  // ── Enemy Spawning ────────────────────────────────────────────────────────

  private _spawnEnemies(defs: EnemyDef[]): void {
    for (const def of defs) {
      const worldX = def.col * TILE_SIZE;
      const worldY = def.row * TILE_SIZE;
      let enemy: Enemy;

      switch (def.type) {
        case EnemyType.GOOMBA:
          enemy = new Goomba(worldX, worldY);
          break;
        case EnemyType.KOOPA_TROOPA:
          enemy = new KoopaTroopa(worldX, worldY);
          break;
        case EnemyType.PIRANHA_PLANT:
          enemy = new PiranhaPlant(def.col, def.row);
          break;
        default:
          continue;
      }

      this.enemies.push(enemy);
    }
  }

  // ── Level Builder (minimal stub — SE2 provides full level data) ───────────

  private _buildLevel(): LevelData {
    // Build an empty grid
    const grid: TileGrid = [];
    for (let row = 0; row < LEVEL_ROWS; row++) {
      grid.push(new Array(LEVEL_COLS).fill(TILE.EMPTY));
    }

    // Ground rows 14 and 15
    for (let col = 0; col < LEVEL_COLS; col++) {
      grid[14][col] = TILE.GROUND;
      grid[15][col] = TILE.GROUND;
    }

    return {
      world:       1,
      level:       1,
      grid,
      widthPx:     LEVEL_COLS * TILE_SIZE,
      heightPx:    LEVEL_ROWS * TILE_SIZE,
      cols:        LEVEL_COLS,
      rows:        LEVEL_ROWS,
      enemies:     [],
      blocks:      [],
      triggers:    [],
      marioStartX: 48,
      marioStartY: 13 * TILE_SIZE,
      bgColor:     '#5C94FC',
    };
  }

  // ── Public Accessors (for SE2 rendering) ───────────────────────────────────

  /** Current camera system — SE2 uses cameraX for culling and screen placement */
  get cameraSystem(): CameraSystem {
    return this.camera;
  }

  /** Mario entity — SE2 reads position, animState, facing, flickerVisible */
  get marioEntity(): Mario {
    return this.mario;
  }

  /** Active enemies — SE2 renders each one at their world position */
  get enemyList(): Enemy[] {
    return this.enemies;
  }

  /** Active shells — SE2 renders each one */
  get shellList(): Shell[] {
    return this.shells;
  }

  /** Current tile grid — SE2 reads to render tiles */
  get tileGrid(): TileGrid {
    return this.grid;
  }

  /** Current game state — SE2 reads screen for overlay rendering */
  get gameState() {
    return this.stateMachine.state;
  }
}
