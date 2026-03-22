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
import { WORLD_1_1 } from '../data/levels/world1-1';
import {
  isStomping,
  isSideHit,
  entitiesOverlap,
} from '../systems/TileCollision';
import { Mario } from '../entities/player/Mario';
import { Enemy } from '../entities/enemies/Enemy';
import { Shell } from '../entities/enemies/Shell';
import { Item } from '../entities/items/Item';
import { Mushroom } from '../entities/items/Mushroom';
import { FireFlower } from '../entities/items/FireFlower';
import { Star } from '../entities/items/Star';
import { CoinPopup } from '../entities/items/CoinPopup';
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
  POOL_ENEMIES,
  POOL_FIREBALLS,
} from '../config/constants';
import { Screen, ItemType } from '../types/entities';
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
  private items:            Item[]   = [];
  private coinPopups:       CoinPopup[] = [];
  private itemImages:       Phaser.GameObjects.Image[] = [];
  private coinPopupImages:  Phaser.GameObjects.Image[] = [];

  // ── Fixed timestep accumulator ─────────────────────────────────────────────
  private accumulator:      number   = 0;

  // ── Previous screen state (for transition detection) ───────────────────────
  private _prevScreen:      Screen   = Screen.TITLE;

  // ── TileRenderer (SE2) ─────────────────────────────────────────────────────
  private tileRenderer!: TileRenderer;

  // ── Entity sprites (Phaser Images, pre-allocated) ──────────────────────────
  private marioImage!:      Phaser.GameObjects.Image;
  private enemyImages:      Phaser.GameObjects.Image[] = [];
  private fireballImages:   Phaser.GameObjects.Image[] = [];

  // ── Block shake animation tracking (pre-allocated pool, max 8 simultaneous) ─
  private readonly _shakePool: Array<{ col: number; row: number; timer: number; offsetY: number }> =
    Array.from({ length: 8 }, () => ({ col: 0, row: 0, timer: 0, offsetY: 0 }));
  private _shakeCount = 0;
  // O(1) lookup: key = row * LEVEL_COLS + col → current offsetY
  private readonly _shakeMap = new Map<number, number>();

  // ── Flagpole trigger ───────────────────────────────────────────────────────
  private _flagpoleTriggered = false;

  // ── Score popup system ────────────────────────────────────────────────────
  private _scoreTexts: Phaser.GameObjects.Text[] = [];
  private _scorePopups: Array<{x: number; y: number; value: number; timer: number}> = [];

  constructor() {
    super({ key: 'WorldScene' });
  }

  // ── Phaser Lifecycle ───────────────────────────────────────────────────────

  create(): void {
    // Load World 1-1 level data
    this.level = WORLD_1_1;
    this.grid  = this.level.grid;

    // Initialize systems
    this.inputManager = new InputManager();
    this.camera       = new CameraSystem();

    const callbacks: GameStateMachineCallbacks = {
      onHurryMode:     () => { audioSystem.setHurryMode(true); },
      onLivesLost:     () => { /* death jingle triggered at death point */ },
      onGameOver:      () => { /* game over music handled by screen transition */ },
      onLevelComplete: (_timeBonus: number) => { audioSystem.playSFX('level_complete' as SFXKey); },
      onExtraLife:     () => { audioSystem.playSFX('oneup' as SFXKey); },
    };

    this.stateMachine = new GameStateMachine(callbacks);

    // Spawn Mario
    this.mario = new Mario(this.level.marioStartX, this.level.marioStartY);

    // Spawn enemies from level data
    this._spawnEnemies(this.level.enemies);

    // Phaser camera: zoom 2× so all game objects can use logical (NES) coordinates
    this.cameras.main.setZoom(SCALE);
    this.cameras.main.setBounds(0, 0, this.level.widthPx, this.level.heightPx);
    this.cameras.main.setBackgroundColor(this.level.bgColor);

    // Initialize tile renderer
    this.tileRenderer = new TileRenderer(this, SpriteRegistry);
    this.tileRenderer.buildFromGrid(this.grid);

    // Mario sprite (logical coordinates; zoom handles 2× upscale)
    this.marioImage = this.add.image(this.mario.x, this.mario.y, 'mario_small_stand');
    this.marioImage.setOrigin(0, 0);
    this.marioImage.setDepth(10);

    // Pre-allocate enemy image pool
    for (let i = 0; i < POOL_ENEMIES; i++) {
      const img = this.add.image(0, 0, 'goomba_walk1');
      img.setOrigin(0, 0);
      img.setDepth(9);
      img.setVisible(false);
      this.enemyImages.push(img);
    }

    // Pre-allocate item image pool (max 8 items)
    for (let i = 0; i < 8; i++) {
      const img = this.add.image(0, 0, 'mushroom_red');
      img.setOrigin(0, 0).setDepth(8).setVisible(false);
      this.itemImages.push(img);
    }
    // Pre-allocate coin popup image pool (max 8)
    for (let i = 0; i < 8; i++) {
      const img = this.add.image(0, 0, 'coin_1');
      img.setOrigin(0, 0).setDepth(11).setVisible(false);
      this.coinPopupImages.push(img);
    }
    // Pre-allocate fireball image pool (max 2 active fireballs at once)
    for (let i = 0; i < POOL_FIREBALLS; i++) {
      const img = this.add.image(0, 0, 'fireball_1');
      img.setOrigin(0, 0).setDepth(12).setVisible(false);
      this.fireballImages.push(img);
    }
    // Pre-allocate 8 score popup text objects
    for (let i = 0; i < 8; i++) {
      const t = this.add.text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#ffffff',
        resolution: 2,
      });
      t.setOrigin(0.5, 1).setDepth(20).setVisible(false);
      this._scoreTexts.push(t);
    }

    // Wire audio on first user interaction
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

    // Render entities each display frame
    this._renderMario();
    this._renderFireballs();
    this._renderEnemies();
    this._renderItems();
    this._renderCoinPopups();
    this._updateAndRenderScorePopups();
  }

  // ── Physics Step ──────────────────────────────────────────────────────────

  private _physicsStep(): void {
    const gs = this.stateMachine.state;

    // Paused: no physics, but still poll input for unpause
    if (gs.screen === Screen.PAUSED) {
      this._prevScreen = gs.screen;
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
      this._prevScreen = gs.screen;
      const input = this.inputManager.pollInput();
      this.stateMachine.update(input);
      return;
    }

    // Non-playing screens (TITLE, INTRO, WIN, GAMEOVER) — only state machine ticks
    if (gs.screen !== Screen.PLAYING) {
      // Reset level on DEATH→INTRO (respawn after death) and WIN→INTRO (loop back to 1-1)
      if (gs.screen === Screen.INTRO &&
          (this._prevScreen === Screen.DEATH || this._prevScreen === Screen.WIN)) {
        this._respawnPlayer();
      }
      this._prevScreen = gs.screen;
      const input = this.inputManager.pollInput();
      this.stateMachine.update(input);
      this._updateHUD();
      return;
    }
    this._prevScreen = gs.screen;

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

    // 5b. Item updates
    for (const item of this.items) {
      if (!item.alive || item.collected) continue;
      item.update(this.grid);
    }

    // 5c. Coin popup updates
    for (const popup of this.coinPopups) {
      if (!popup.alive) continue;
      popup.update();
    }

    // 5d. Collision: Mario ↔ items
    for (const item of this.items) {
      if (!item.alive || item.collected) continue;
      if (entitiesOverlap(this.mario, item)) {
        item.collected = true;
        item.alive = false;
        const pts = this.mario.onPowerUp(item.type);
        this.stateMachine.addScore(pts);
        audioSystem.playSFX('powerup_collect' as SFXKey);
      }
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
          this._spawnScorePopup(enemy.x + enemy.w / 2, enemy.y, pts);
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
          this._spawnScorePopup(enemy.x + enemy.w / 2, enemy.y, SCORE.FIREBALL_KILL);
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

    // Cull dead items
    let ii = 0;
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].alive && !this.items[i].collected) this.items[ii++] = this.items[i];
    }
    this.items.length = ii;

    // Cull dead coin popups
    let ci = 0;
    for (let i = 0; i < this.coinPopups.length; i++) {
      if (this.coinPopups[i].alive) this.coinPopups[ci++] = this.coinPopups[i];
    }
    this.coinPopups.length = ci;

    // 11. Camera update
    this.camera.update(this.mario.x, this.level.widthPx);

    // 12. Game state machine tick
    this.stateMachine.update(input);

    // 13. Write HUD data for UIScene
    this._updateHUD();

    // 14. Block shake animations
    this._updateShakeBlocks();

    // 15. Trigger checks (flagpole, etc.)
    this._checkTriggers();
  }

  // ── Entity Rendering ──────────────────────────────────────────────────────

  private _renderMario(): void {
    if (!this.mario.flickerVisible) {
      this.marioImage.setVisible(false);
      return;
    }
    this.marioImage.setVisible(true);

    const key = this.mario.getSpriteKey();
    if (SpriteRegistry.hasTexture(key)) {
      this.marioImage.setTexture(key);
    }

    // Flip horizontally when facing left
    this.marioImage.setFlipX(this.mario.facing < 0);

    // Position: logical world coords; Phaser zoom handles 2× upscale
    this.marioImage.setPosition(this.mario.x, this.mario.y);
  }

  private _renderEnemies(): void {
    // Hide all pool slots first
    for (let i = 0; i < this.enemyImages.length; i++) {
      this.enemyImages[i].setVisible(false);
    }

    let slot = 0;
    for (let i = 0; i < this.enemies.length && slot < this.enemyImages.length; i++) {
      const enemy = this.enemies[i];
      if (!enemy.alive || !enemy.active) continue;

      const key = (enemy as { getSpriteKey?(): string }).getSpriteKey?.() ?? 'goomba_walk1';
      const img = this.enemyImages[slot++];

      if (SpriteRegistry.hasTexture(key)) {
        img.setTexture(key);
      }
      img.setFlipX(enemy.facing > 0);
      img.setPosition(enemy.x, enemy.y);
      img.setVisible(true);
    }
  }

  private _renderItems(): void {
    for (let i = 0; i < this.itemImages.length; i++) {
      this.itemImages[i].setVisible(false);
    }
    let slot = 0;
    for (const item of this.items) {
      if (!item.alive || item.collected || slot >= this.itemImages.length) continue;
      const img = this.itemImages[slot++];
      const key = item.getSpriteKey();
      if (SpriteRegistry.hasTexture(key)) img.setTexture(key);
      img.setPosition(item.x, item.y).setVisible(true);
    }
  }

  private _renderCoinPopups(): void {
    for (let i = 0; i < this.coinPopupImages.length; i++) {
      this.coinPopupImages[i].setVisible(false);
    }
    let slot = 0;
    for (const popup of this.coinPopups) {
      if (!popup.alive || slot >= this.coinPopupImages.length) continue;
      const img = this.coinPopupImages[slot++];
      const key = popup.getSpriteKey();
      if (SpriteRegistry.hasTexture(key)) img.setTexture(key);
      img.setPosition(popup.x, popup.y).setVisible(true);
    }
  }

  private _renderFireballs(): void {
    for (let i = 0; i < this.fireballImages.length; i++) {
      this.fireballImages[i].setVisible(false);
    }
    let slot = 0;
    for (const fb of this.mario.fireballs) {
      if (!fb.alive || slot >= this.fireballImages.length) continue;
      const img = this.fireballImages[slot++];
      const key = (fb as { getSpriteKey?(): string }).getSpriteKey?.() ?? 'fireball_1';
      if (SpriteRegistry.hasTexture(key)) img.setTexture(key);
      img.setPosition(fb.x, fb.y).setVisible(true);
    }
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
        // Spawn item from block data
        const blockDef = this.level.blocks.find(b => b.col === col && b.row === row);
        if (blockDef && blockDef.content) {
          const spawnX = col * TILE_SIZE;
          const spawnY = (row - 1) * TILE_SIZE; // one tile above the block
          if (blockDef.content === 'coin') {
            // Coin popup animation (not a physics item)
            if (this.coinPopups.length < 8) {
              this.coinPopups.push(new CoinPopup(spawnX, spawnY));
              this.stateMachine.addCoin();
              audioSystem.playSFX('coin' as SFXKey);
            }
          } else {
            // Physics item: mushroom, fire flower, star
            let item: Item | null = null;
            switch (blockDef.content) {
              case ItemType.MUSHROOM:
                item = new Mushroom(spawnX, spawnY);
                break;
              case ItemType.FIRE_FLOWER:
                item = new FireFlower(spawnX, spawnY);
                break;
              case ItemType.STAR:
                item = new Star(spawnX, spawnY);
                break;
            }
            if (item && this.items.length < 8) {
              this.items.push(item);
              audioSystem.playSFX('powerup_spawn' as SFXKey);
            }
          }
        }
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
    hudData.screen = gs.screen;
  }

  // ── Player Respawn ────────────────────────────────────────────────────────

  private _respawnPlayer(): void {
    // Reset Mario to start position and clear all state
    this.mario.reset(this.level.marioStartX, this.level.marioStartY);

    // Reset camera to beginning of level
    this.camera.cameraX = 0;

    // Respawn all enemies from level data
    this.enemies.length     = 0;
    this.shells.length      = 0;
    this.items.length       = 0;
    this.coinPopups.length  = 0;
    this._spawnEnemies(this.level.enemies);

    // Reset flagpole and score popups
    this._flagpoleTriggered = false;
    this._scorePopups.length = 0;
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

  // ── Flagpole Trigger ──────────────────────────────────────────────────────

  private _checkTriggers(): void {
    if (this._flagpoleTriggered) return;
    for (const trigger of this.level.triggers) {
      if (trigger.type !== 'flagpole') continue;
      // Flagpole x spans: trigger.col * TILE_SIZE  (the pole is at this col)
      const poleX = trigger.col * TILE_SIZE;
      const poleRight = poleX + TILE_SIZE;
      // Mario overlaps this column horizontally
      if (this.mario.x + this.mario.w > poleX && this.mario.x < poleRight) {
        this._triggerFlagpole(trigger.row);
        break;
      }
    }
  }

  private _triggerFlagpole(topRow: number): void {
    this._flagpoleTriggered = true;
    // Calculate height bonus: higher touch = more points
    // Rows 4..13, lower row number = higher on pole = more points
    const touchRow = Math.floor(this.mario.y / TILE_SIZE);
    let bonus = 100;
    if (touchRow <= topRow + 1) bonus = 5000;
    else if (touchRow <= topRow + 3) bonus = 2000;
    else if (touchRow <= topRow + 5) bonus = 1000;
    else if (touchRow <= topRow + 7) bonus = 500;
    this.stateMachine.addScore(bonus);
    audioSystem.playSFX('flagpole' as SFXKey);
    this.stateMachine.toWin();
  }

  // ── Score Popup System ────────────────────────────────────────────────────

  private _spawnScorePopup(worldX: number, worldY: number, value: number): void {
    if (this._scorePopups.length >= 8) return;
    this._scorePopups.push({ x: worldX, y: worldY, value, timer: 0 });
  }

  private _updateAndRenderScorePopups(): void {
    // Hide all text slots
    for (const t of this._scoreTexts) t.setVisible(false);

    let slot = 0;
    let alive = 0;
    for (let i = 0; i < this._scorePopups.length; i++) {
      const p = this._scorePopups[i];
      p.timer++;
      p.y -= 0.5;  // float upward in world coords

      if (p.timer < 60 && slot < this._scoreTexts.length) {
        const t = this._scoreTexts[slot++];
        t.setText(String(p.value));
        t.setPosition(p.x, p.y);
        t.setVisible(true);
        t.setAlpha(p.timer < 45 ? 1 : 1 - (p.timer - 45) / 15);
      }

      if (p.timer < 60) {
        this._scorePopups[alive++] = this._scorePopups[i];
      }
    }
    this._scorePopups.length = alive;
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
