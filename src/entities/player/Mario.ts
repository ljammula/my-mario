/**
 * Mario.ts
 * Full player state machine, physics, and fireball management.
 * Ported from js/player.js and extended with TypeScript types.
 *
 * Physics update order (per frame):
 * 1. Coyote timer
 * 2. Crouch
 * 3. Horizontal input
 * 4. Jump buffer + coyote check → jump execution
 * 5. Variable jump gravity
 * 6. Cap fall speed
 * 7. Tile collision (resolvePlayerTileCollision)
 * 8. Pit check
 * 9. Fireballs
 * 10. Animation state
 * 11. Invincibility timers
 */

import { Entity } from '../Entity';
import { Fireball } from './Fireball';
import {
  GRAVITY, MAX_FALL_SPEED,
  JUMP_VELOCITY, JUMP_HOLD_GRAVITY, JUMP_RELEASE_GRAVITY,
  COYOTE_FRAMES, JUMP_BUFFER_FRAMES,
  WALK_ACCELERATION, RUN_ACCELERATION,
  WALK_MAX_SPEED, RUN_MAX_SPEED,
  SKID_DECELERATION, GROUND_FRICTION, AIR_RESISTANCE,
  DEATH_POP_VELOCITY,
  INVINCIBLE_DURATION, HURT_INVINCIBLE_FRAMES,
  FIREBALL_MAX_ACTIVE,
} from '../../config/physics';
import {
  SMALL_MARIO_W, SMALL_MARIO_H,
  SUPER_MARIO_W, SUPER_MARIO_H,
  TILE_SIZE, LEVEL_WIDTH_PX,
  SOLID_TILES, POOL_FIREBALLS,
  DEATH_ANIM_FRAMES,
  WALK_FRAME_DURATION, RUN_FRAME_DURATION,
  STOMP_COMBO_POINTS,
} from '../../config/constants';
import {
  resolvePlayerTileCollision,
  CollisionCallbacks,
} from '../../systems/TileCollision';
import { InputSnapshot } from '../../types/input';
import { TileGrid } from '../../types/level';
import { MarioForm, AnimState, ItemType } from '../../types/entities';

// ─── Re-export for external use ───────────────────────────────────────────────
export { MarioForm, AnimState };

export class Mario extends Entity {
  // ── State machines ───────────────────────────────────────────────────────
  form:      MarioForm = MarioForm.SMALL;
  animState: AnimState  = AnimState.IDLE;
  facing:    number     = 1;    // 1 = right, -1 = left

  // ── Grounded / air tracking ───────────────────────────────────────────────
  grounded:        boolean = false;
  coyoteTimer:     number  = 0;
  jumpBufferTimer: number  = 0;
  isJumping:       boolean = false;

  // ── Crouch ────────────────────────────────────────────────────────────────
  crouching: boolean = false;

  // ── Invincibility ─────────────────────────────────────────────────────────
  starInvincible: boolean = false;
  starTimer:      number  = 0;
  hurtInvincible: boolean = false;
  hurtTimer:      number  = 0;

  // ── Death ─────────────────────────────────────────────────────────────────
  dead:       boolean = false;
  deathTimer: number  = 0;

  // ── Animation ─────────────────────────────────────────────────────────────
  frameCounter:   number  = 0;
  walkFrame:      number  = 0;
  walkFrameTimer: number  = 0;
  growTimer:      number  = 0;
  flickerVisible: boolean = true;

  // ── Head bonk tracking (read by WorldScene to handle block interaction) ───
  headBonkCol: number = -1;
  headBonkRow: number = -1;

  // ── Fireballs (pre-allocated pool) ───────────────────────────────────────
  fireballs: Fireball[];
  private _activeFireballs = 0;

  constructor(startX: number, startY: number) {
    super(startX, startY, SMALL_MARIO_W, SMALL_MARIO_H);

    // Pre-allocate fireball pool — zero `new` during PLAYING
    this.fireballs = [];
    for (let i = 0; i < POOL_FIREBALLS; i++) {
      this.fireballs.push(new Fireball());
    }
  }

  // ── Computed helpers ───────────────────────────────────────────────────────

  get isInvincible(): boolean {
    return this.starInvincible || this.hurtInvincible;
  }

  get isSuper(): boolean {
    return this.form === MarioForm.SUPER || this.form === MarioForm.FIRE;
  }

  /** Number of currently active fireballs (explicit counter — no .filter() allocation) */
  get activeFireballCount(): number {
    return this._activeFireballs;
  }

  // ── Hitbox management ─────────────────────────────────────────────────────

  private _updateDimensions(): void {
    const prevH = this.h;
    if (this.isSuper) {
      this.w = SUPER_MARIO_W;
      this.h = this.crouching ? SMALL_MARIO_H : SUPER_MARIO_H;
    } else {
      this.w = SMALL_MARIO_W;
      this.h = SMALL_MARIO_H;
    }
    // If Mario grew taller, adjust y so bottom stays in place
    if (this.h > prevH) {
      this.y -= (this.h - prevH);
    }
    // If Mario shrank, shift y down
    if (this.h < prevH) {
      this.y += (prevH - this.h);
    }
  }

  // ── Power-up collection ───────────────────────────────────────────────────

  /**
   * Called when Mario collects a power-up.
   * Returns the score value to award (handled by WorldScene → GameStateMachine).
   */
  onPowerUp(type: ItemType): number {
    switch (type) {
      case ItemType.MUSHROOM:
        if (this.form === MarioForm.SMALL) {
          this.form = MarioForm.SUPER;
          this.growTimer = 30;
          this._updateDimensions();
        }
        return 1000;

      case ItemType.FIRE_FLOWER:
        if (this.form === MarioForm.SMALL) {
          // Fire flower acts as mushroom if small
          this.form = MarioForm.SUPER;
          this.growTimer = 30;
          this._updateDimensions();
        } else {
          this.form = MarioForm.FIRE;
          this.growTimer = 20;
          this._updateDimensions();
        }
        return 1000;

      case ItemType.STAR:
        this.starInvincible = true;
        this.starTimer      = INVINCIBLE_DURATION;
        return 1000;

      case ItemType.ONE_UP:
        return 0; // extra life handled by WorldScene → GameStateMachine

      case ItemType.COIN:
        return 200;

      default:
        return 0;
    }
  }

  // ── Enemy contact ─────────────────────────────────────────────────────────

  /**
   * Called when Mario is hit by an enemy.
   * Downgrades form or triggers death.
   * Returns whether damage was dealt.
   */
  onEnemyContact(): boolean {
    if (this.isInvincible) return false;

    switch (this.form) {
      case MarioForm.FIRE:
        this.form = MarioForm.SUPER;
        this._updateDimensions();
        this._startHurtInvincible();
        return true;

      case MarioForm.SUPER:
        this.form = MarioForm.SMALL;
        this._updateDimensions();
        this._startHurtInvincible();
        return true;

      case MarioForm.SMALL:
        this._startDeath();
        return true;

      default:
        return false;
    }
  }

  private _startHurtInvincible(): void {
    this.hurtInvincible = true;
    this.hurtTimer      = HURT_INVINCIBLE_FRAMES;
  }

  _startDeath(): void {
    if (this.dead) return;
    this.dead       = true;
    this.deathTimer = 0;
    this.vy         = DEATH_POP_VELOCITY;
    this.vx         = 0;
    this.grounded   = false;
    this.animState  = AnimState.DEATH;
  }

  /**
   * Reset Mario to starting position and clear all state.
   * Called when respawning after death (INTRO screen).
   */
  reset(startX: number, startY: number): void {
    this.x = startX;
    this.y = startY;
    this.vx = 0;
    this.vy = 0;
    this.w = SMALL_MARIO_W;
    this.h = SMALL_MARIO_H;
    this.form = MarioForm.SMALL;
    this.animState = AnimState.IDLE;
    this.facing = 1;
    this.grounded = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.isJumping = false;
    this.crouching = false;
    this.starInvincible = false;
    this.starTimer = 0;
    this.hurtInvincible = false;
    this.hurtTimer = 0;
    this.dead = false;
    this.deathTimer = 0;
    this.frameCounter = 0;
    this.walkFrame = 0;
    this.walkFrameTimer = 0;
    this.growTimer = 0;
    this.flickerVisible = true;
    this.headBonkCol = -1;
    this.headBonkRow = -1;
    this._activeFireballs = 0;
    for (const fb of this.fireballs) {
      fb.alive = false;
    }
  }

  // ── Fireball kill (called externally — keeps counter correct) ─────────────

  /**
   * Kill a specific fireball and decrement the active counter.
   * Use this instead of setting fb.alive = false directly.
   */
  killFireball(fb: Fireball): void {
    if (!fb.alive) return;
    fb.alive = false;
    this._activeFireballs--;
    if (this._activeFireballs < 0) this._activeFireballs = 0;
  }

  // ── Stomp bounce ──────────────────────────────────────────────────────────

  /**
   * Called by WorldScene after successful stomp.
   * Bounces Mario upward.
   */
  bounceOffEnemy(): void {
    this.vy       = JUMP_VELOCITY * 0.6;
    this.grounded = false;
    this.isJumping= false;
  }

  // ── Death animation ───────────────────────────────────────────────────────

  deathAnimDone(): boolean {
    return this.deathTimer >= DEATH_ANIM_FRAMES;
  }

  private _updateDead(): void {
    this.deathTimer++;
    // Pop upward then fall (no tile collision during death)
    this.vy += GRAVITY;
    this.y  += this.vy;
  }

  // ── Invincibility timers ──────────────────────────────────────────────────

  private _updateInvincibility(): void {
    if (this.starInvincible) {
      this.starTimer--;
      if (this.starTimer <= 0) {
        this.starInvincible = false;
        this.starTimer      = 0;
      }
    }

    if (this.hurtInvincible) {
      this.hurtTimer--;
      // Flicker: visible = true when Math.floor(hurtTimer / FLICKER_RATE) % 2 === 0
      this.flickerVisible = Math.floor(this.hurtTimer / 6) % 2 === 0;
      if (this.hurtTimer <= 0) {
        this.hurtInvincible  = false;
        this.hurtTimer       = 0;
        this.flickerVisible  = true;
      }
    }
  }

  // ── Headroom check for standing up from crouch ───────────────────────────

  private _hasHeadroomToStand(grid: TileGrid): boolean {
    const targetH    = SUPER_MARIO_H;
    const targetTopY = this.y + this.h - targetH;  // where top would be if standing
    const colL  = Math.floor((this.x + 2) / TILE_SIZE);
    const colR  = Math.floor((this.x + this.w - 3) / TILE_SIZE);
    const topRow = Math.floor(targetTopY / TILE_SIZE);
    const curRow = Math.floor(this.y / TILE_SIZE);

    if (topRow >= curRow) return true; // no ceiling tiles above
    for (let col = colL; col <= colR; col++) {
      if (SOLID_TILES.has(grid[topRow]?.[col] ?? '.')) return false;
    }
    return true;
  }

  // ── Horizontal movement ───────────────────────────────────────────────────

  private _updateHorizontal(input: InputSnapshot): void {
    const running    = input.run;
    const movingLeft = input.left;
    const movingRight= input.right;

    const maxSpeed = running ? RUN_MAX_SPEED  : WALK_MAX_SPEED;
    const accel    = running ? RUN_ACCELERATION : WALK_ACCELERATION;

    if (movingRight && !movingLeft) {
      if (this.vx < 0) {
        // Skidding — was going left, now pressing right
        this.animState = AnimState.SKID;
        this.vx += SKID_DECELERATION;
        if (this.vx > 0) this.vx = 0;
      } else {
        this.facing = 1;
        this.vx += accel;
        if (this.vx > maxSpeed) {
          // Momentum bleed: run→walk transition applies friction not full decel
          this.vx -= this.grounded ? GROUND_FRICTION : AIR_RESISTANCE;
          if (this.vx < maxSpeed) this.vx = maxSpeed;
        }
      }
    } else if (movingLeft && !movingRight) {
      if (this.vx > 0) {
        // Skidding — was going right, now pressing left
        this.animState = AnimState.SKID;
        this.vx -= SKID_DECELERATION;
        if (this.vx < 0) this.vx = 0;
      } else {
        this.facing = -1;
        this.vx -= accel;
        if (this.vx < -maxSpeed) {
          this.vx += this.grounded ? GROUND_FRICTION : AIR_RESISTANCE;
          if (this.vx > -maxSpeed) this.vx = -maxSpeed;
        }
      }
    } else {
      // No direction key — apply friction/air resistance
      this._applyFriction(this.grounded ? GROUND_FRICTION : AIR_RESISTANCE);
    }

    // Hard clamp to run max (guards against edge-case transitions)
    if (this.vx > RUN_MAX_SPEED)  this.vx = RUN_MAX_SPEED;
    if (this.vx < -RUN_MAX_SPEED) this.vx = -RUN_MAX_SPEED;
  }

  private _applyFriction(amount: number): void {
    if (this.vx > 0) {
      this.vx -= amount;
      if (this.vx < 0) this.vx = 0;
    } else if (this.vx < 0) {
      this.vx += amount;
      if (this.vx > 0) this.vx = 0;
    }
  }

  // ── Tile collision resolution ─────────────────────────────────────────────

  private _resolveTiles(grid: TileGrid): void {
    this.headBonkCol = -1;
    this.headBonkRow = -1;

    const callbacks: CollisionCallbacks = {
      onBottomHit: (_col: number, _row: number) => {
        this.grounded = true;
      },
      onTopHit: (col: number, row: number) => {
        this.headBonkCol = col;
        this.headBonkRow = row;
      },
    };

    resolvePlayerTileCollision(this, grid, callbacks);

    // Keep Mario within level horizontal bounds
    if (this.x < 0) {
      this.x  = 0;
      this.vx = 0;
    }
    if (this.x + this.w > LEVEL_WIDTH_PX) {
      this.x  = LEVEL_WIDTH_PX - this.w;
      this.vx = 0;
    }
  }

  // ── Fireball launch ───────────────────────────────────────────────────────

  private _tryFireball(): void {
    if (this._activeFireballs >= FIREBALL_MAX_ACTIVE) return;

    // Find a dead fireball slot (no .find() — manual loop, zero allocation)
    let fb: Fireball | null = null;
    for (let i = 0; i < this.fireballs.length; i++) {
      if (!this.fireballs[i].alive) { fb = this.fireballs[i]; break; }
    }
    if (!fb) return;

    // Launch from Mario's hand position (right or left side at chest height)
    const launchX = this.facing === 1
      ? this.x + this.w          // right side
      : this.x - 8;              // left side
    const launchY = this.y + 4;  // chest height

    fb.reset(launchX, launchY, this.facing);
    this._activeFireballs++;
  }

  // ── Animation state ───────────────────────────────────────────────────────

  private _updateAnimState(input: InputSnapshot): void {
    if (this.dead) {
      this.animState = AnimState.DEATH;
      return;
    }

    if (this.crouching) {
      this.animState = AnimState.CROUCH;
      return;
    }

    if (!this.grounded) {
      this.animState = AnimState.JUMP;
      return;
    }

    const absVx = Math.abs(this.vx);

    if (absVx < 0.1) {
      // Standing still — clear skid
      this.animState = AnimState.IDLE;
      this.walkFrame = 0;
      this.walkFrameTimer = 0;
      return;
    }

    // Check for skid: moving but pressing opposite direction
    const movingRight = input.right && !input.left;
    const movingLeft  = input.left  && !input.right;
    const skidding    = (movingRight && this.vx < -1.5) || (movingLeft && this.vx > 1.5);

    if (skidding) {
      this.animState = AnimState.SKID;
      return;
    }

    // Walk or run animation
    const isRunning  = absVx > WALK_MAX_SPEED;
    const frameDur   = isRunning ? RUN_FRAME_DURATION : WALK_FRAME_DURATION;
    this.animState   = isRunning ? AnimState.RUN : AnimState.WALK;

    this.walkFrameTimer++;
    if (this.walkFrameTimer >= frameDur) {
      this.walkFrameTimer = 0;
      this.walkFrame      = (this.walkFrame + 1) % 3;
    }
  }

  // ── Sprite key for rendering ──────────────────────────────────────────────

  /**
   * Returns the sprite key string for the current animation state.
   * SE2's SpriteRegistry must have this key pre-baked.
   */
  getSpriteKey(): string {
    const formStr = this.form === MarioForm.SMALL
      ? 'small'
      : this.form === MarioForm.SUPER
        ? 'super'
        : 'fire';

    switch (this.animState) {
      case AnimState.IDLE:
      case AnimState.GROW:
        return `mario_${formStr}_stand`;
      case AnimState.WALK:
      case AnimState.RUN:
        return `mario_${formStr}_walk${this.walkFrame + 1}`;
      case AnimState.SKID:
        return `mario_${formStr}_skid`;
      case AnimState.JUMP:
        return `mario_${formStr}_jump`;
      case AnimState.CROUCH:
        return `mario_${formStr}_crouch`;
      case AnimState.DEATH:
        return `mario_small_death`;
      default:
        return `mario_${formStr}_stand`;
    }
  }

  // ── Main Update ───────────────────────────────────────────────────────────

  /**
   * Update Mario for one logical frame.
   *
   * @param input       Input snapshot for this frame
   * @param grid        Tile grid for collision
   * @param levelWidth  Level width in logical pixels (for bounds clamping)
   */
  update(input: InputSnapshot, grid: TileGrid, _levelWidth: number): void {
    this.frameCounter++;

    // ── Death animation ────────────────────────────────────────────────
    if (this.dead) {
      this._updateDead();
      return;
    }

    // ── Invincibility timers ───────────────────────────────────────────
    this._updateInvincibility();

    // ── Grow animation (block input briefly) ──────────────────────────
    if (this.growTimer > 0) {
      this.growTimer--;
      this.vy += GRAVITY;
      if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
      // Still apply tile collision during grow
      const wasGrounded = this.grounded;
      this.grounded = false;
      this._resolveTiles(grid);
      if (!wasGrounded && this.grounded) this.isJumping = false;
      return;
    }

    // ── Step 1: Coyote timer ──────────────────────────────────────────
    if (this.grounded) {
      this.coyoteTimer = COYOTE_FRAMES;
    } else {
      if (this.coyoteTimer > 0) this.coyoteTimer--;
    }

    // ── Step 2: Crouch ────────────────────────────────────────────────
    const canCrouch = this.isSuper && this.grounded;
    if (canCrouch && input.down) {
      if (!this.crouching) {
        this.crouching = true;
        this._updateDimensions();
      }
    } else if (this.crouching) {
      if (this._hasHeadroomToStand(grid)) {
        this.crouching = false;
        this._updateDimensions();
      }
    }

    // ── Step 3: Horizontal movement ────────────────────────────────────
    if (!this.crouching) {
      this._updateHorizontal(input);
    } else {
      // Slide deceleration while crouching
      this._applyFriction(this.grounded ? GROUND_FRICTION : AIR_RESISTANCE);
    }

    // ── Step 4: Jump buffer ────────────────────────────────────────────
    if (input.jump) {
      this.jumpBufferTimer = JUMP_BUFFER_FRAMES;
    } else if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer--;
    }

    // ── Step 4b: Jump execution ────────────────────────────────────────
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0 && !this.crouching) {
      this.vy             = JUMP_VELOCITY;
      this.isJumping      = true;
      this.grounded       = false;
      this.coyoteTimer    = 0;
      this.jumpBufferTimer = 0;
    }

    // ── Step 5: Variable jump gravity ─────────────────────────────────
    if (this.isJumping && this.vy < 0 && input.jumpHeld) {
      this.vy += JUMP_HOLD_GRAVITY;
    } else {
      this.vy += JUMP_RELEASE_GRAVITY;
      if (!input.jumpHeld) this.isJumping = false;
    }

    // ── Step 6: Cap fall speed ─────────────────────────────────────────
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

    // ── Step 7: Tile collision ─────────────────────────────────────────
    const wasGrounded = this.grounded;
    this.grounded = false;
    this._resolveTiles(grid);

    // Detect landing
    if (!wasGrounded && this.grounded) {
      this.isJumping = false;
    }

    // ── Step 8: Pit check (handled by WorldScene reading mario.y) ─────
    // WorldScene checks: mario.y > LEVEL_HEIGHT_PX + 32 → triggerDeath

    // ── Step 9: Fireballs ──────────────────────────────────────────────
    if (this.form === MarioForm.FIRE && input.fire) {
      this._tryFireball();
    }

    // Update active fireballs; decrement counter when one transitions to dead
    for (const fb of this.fireballs) {
      if (fb.alive) {
        fb.update(grid);
        if (!fb.alive) {
          // Fireball just died this frame
          this._activeFireballs--;
          if (this._activeFireballs < 0) this._activeFireballs = 0;
        }
      }
    }

    // ── Step 10: Animation state ───────────────────────────────────────
    this._updateAnimState(input);

    // Reset stomp combo when grounded
    // (WorldScene calls stateMachine.onLand() when grounded detected)
  }
}
