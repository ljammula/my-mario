/**
 * player.js
 * Mario entity: state machine, movement physics, jumping, animation, fireball throwing.
 *
 * Exports:
 *   class Mario
 *   function drawPlayer(ctx, mario, scale)
 *
 * All coordinates in logical pixels. The renderer multiplies by scale (2) for canvas drawing.
 */

import {
  GRAVITY, MAX_FALL_SPEED,
  JUMP_VELOCITY, JUMP_HOLD_GRAVITY, JUMP_RELEASE_GRAVITY,
  COYOTE_FRAMES, JUMP_BUFFER_FRAMES,
  WALK_ACCELERATION, RUN_ACCELERATION,
  WALK_MAX_SPEED, RUN_MAX_SPEED,
  SKID_DECELERATION, GROUND_FRICTION, AIR_RESISTANCE,
  SMALL_MARIO_W, SMALL_MARIO_H,
  SUPER_MARIO_W, SUPER_MARIO_H,
  MARIO_HITBOX_INSET,
  MARIO_STATE, ANIM_STATE,
  WALK_FRAME_DURATION, RUN_FRAME_DURATION,
  DEATH_POP_VELOCITY, DEATH_ANIM_FRAMES,
  INVINCIBLE_DURATION, HURT_INVINCIBLE_FRAMES, FLICKER_RATE,
  FIREBALL_SPEED_X, FIREBALL_SPEED_Y, FIREBALL_GRAVITY,
  FIREBALL_MAX_BOUNCES, FIREBALL_MAX_ACTIVE, FIREBALL_W, FIREBALL_H,
  TILE_SIZE, LEVEL_WIDTH_PX,
  SOLID_TILES,
  SCORE, STOMP_COMBO_POINTS,
  COLOR,
} from './constants.js';

import {
  resolvePlayerTileCollision,
  resolveFireballTileCollision,
  entitiesOverlap, isStomping, isSideHit,
} from './collision.js';

// ─── Fireball ─────────────────────────────────────────────────────────────────

class Fireball {
  constructor(x, y, dirX) {
    this.x       = x;
    this.y       = y;
    this.w       = FIREBALL_W;
    this.h       = FIREBALL_H;
    this.vx      = dirX * FIREBALL_SPEED_X;
    this.vy      = FIREBALL_SPEED_Y;   // launches slightly upward then falls
    this.bounces = 0;
    this.alive   = true;
    this.frame   = 0;   // animation frame counter
  }

  update(grid) {
    if (!this.alive) return;
    this.frame++;
    // Apply gravity
    this.vy += FIREBALL_GRAVITY;
    // Resolve tile collision (handles bounces and death)
    resolveFireballTileCollision(this, grid, FIREBALL_MAX_BOUNCES);
    // Kill if out of horizontal bounds
    if (this.x < -FIREBALL_W || this.x > LEVEL_WIDTH_PX + FIREBALL_W) {
      this.alive = false;
    }
  }
}

// ─── Mario Class ──────────────────────────────────────────────────────────────

export class Mario {
  /**
   * @param {number} startX  logical x (world coords)
   * @param {number} startY  logical y (world coords)
   */
  constructor(startX, startY) {
    // ── Position & velocity ──────────────────────────────────────────────
    this.x  = startX;
    this.y  = startY;
    this.vx = 0;
    this.vy = 0;

    // ── Hitbox dimensions (updated based on state) ───────────────────────
    this.w  = SMALL_MARIO_W;
    this.h  = SMALL_MARIO_H;

    // ── State machines ───────────────────────────────────────────────────
    this.state      = MARIO_STATE.SMALL;    // SMALL | SUPER | FIRE
    this.animState  = ANIM_STATE.IDLE;      // current animation mode
    this.facing     = 1;                    // 1 = right, -1 = left

    // ── Grounded / air tracking ──────────────────────────────────────────
    this.grounded       = false;
    this.coyoteTimer    = 0;   // frames since last grounded
    this.jumpBufferTimer= 0;   // frames since jump was pressed while airborne
    this.isJumping      = false;  // true while jump key held and still rising

    // ── Crouch ───────────────────────────────────────────────────────────
    this.crouching = false;

    // ── Invincibility (star or post-hit) ─────────────────────────────────
    this.starInvincible    = false;
    this.starTimer         = 0;   // frames remaining of star invincibility
    this.hurtInvincible    = false;
    this.hurtTimer         = 0;   // frames remaining of post-hit invincibility

    // ── Death ────────────────────────────────────────────────────────────
    this.dead          = false;
    this.deathTimer    = 0;   // counts up; triggers respawn when past DEATH_ANIM_FRAMES

    // ── Animation ────────────────────────────────────────────────────────
    this.frameCounter  = 0;   // global frame counter for animations
    this.walkFrame     = 0;   // 0 or 1 walk cycle frame
    this.growTimer     = 0;   // grow animation frames remaining
    this.flickerVisible= true; // for invincibility flicker

    // ── Scoring / combo ──────────────────────────────────────────────────
    this.stompCombo    = 0;   // consecutive stomps without touching ground

    // ── Fireballs ────────────────────────────────────────────────────────
    /** @type {Fireball[]} */
    this.fireballs = [];
  }

  // ── Computed helpers ────────────────────────────────────────────────────────

  /** Right edge in world space */
  get right()  { return this.x + this.w; }
  /** Bottom edge in world space */
  get bottom() { return this.y + this.h; }
  /** Center X */
  get centerX() { return this.x + this.w / 2; }
  /** Center Y */
  get centerY() { return this.y + this.h / 2; }

  /** Return true if currently invincible (star or hurt) */
  get isInvincible() {
    return this.starInvincible || this.hurtInvincible;
  }

  /** Is Mario in Super or Fire state (taller) */
  get isSuper() {
    return this.state === MARIO_STATE.SUPER || this.state === MARIO_STATE.FIRE;
  }

  // ── Dimensions ──────────────────────────────────────────────────────────────

  /** Update hitbox dimensions based on state and crouch */
  _updateDimensions() {
    const prevH = this.h;
    if (this.isSuper) {
      this.w = SUPER_MARIO_W;
      this.h = this.crouching ? SMALL_MARIO_H : SUPER_MARIO_H;
    } else {
      this.w = SMALL_MARIO_W;
      this.h = SMALL_MARIO_H;
    }
    // If Mario grew taller, adjust y so bottom stays in same place
    if (this.h > prevH) {
      this.y -= (this.h - prevH);
    }
    // If Mario shrank, shift y down
    if (this.h < prevH) {
      this.y += (prevH - this.h);
    }
  }

  // ── Power-up collection ──────────────────────────────────────────────────────

  /**
   * Called when Mario collects a power-up.
   * @param {'mushroom'|'flower'|'star'|'1up'|'coin'} type
   * @returns {number} points awarded
   */
  onPowerUp(type) {
    switch (type) {
      case 'mushroom':
        if (this.state === MARIO_STATE.SMALL) {
          this.state = MARIO_STATE.SUPER;
          this.growTimer = 30; // brief grow animation
          this._updateDimensions();
        }
        return SCORE.POWERUP;

      case 'flower':
        if (this.state === MARIO_STATE.SMALL) {
          // Fire flower acts as mushroom if small
          this.state = MARIO_STATE.SUPER;
          this.growTimer = 30;
          this._updateDimensions();
        } else {
          this.state = MARIO_STATE.FIRE;
          this.growTimer = 20; // brief flash
          this._updateDimensions();
        }
        return SCORE.POWERUP;

      case 'star':
        this.starInvincible = true;
        this.starTimer      = INVINCIBLE_DURATION;
        return SCORE.POWERUP;

      case '1up':
        return 0; // extra life handled by engine; no points from this call

      case 'coin':
        return SCORE.COIN;

      default:
        return 0;
    }
  }

  // ── Enemy contact ────────────────────────────────────────────────────────────

  /**
   * Called when Mario is hit by an enemy (side or bottom contact).
   * Returns number of points (0 on damage).
   * The caller (engine) handles actual state transitions for score display, lives, etc.
   *
   * @returns {{ damaged: boolean }}
   */
  onEnemyContact() {
    if (this.isInvincible) return { damaged: false };

    switch (this.state) {
      case MARIO_STATE.FIRE:
        // Fire → Super (+ brief invincibility)
        this.state = MARIO_STATE.SUPER;
        this._updateDimensions();
        this._startHurtInvincible();
        return { damaged: true };

      case MARIO_STATE.SUPER:
        // Super → Small (+ brief invincibility)
        this.state = MARIO_STATE.SMALL;
        this._updateDimensions();
        this._startHurtInvincible();
        return { damaged: true };

      case MARIO_STATE.SMALL:
        // Small → Death
        this._startDeath();
        return { damaged: true };

      default:
        return { damaged: false };
    }
  }

  _startHurtInvincible() {
    this.hurtInvincible = true;
    this.hurtTimer = HURT_INVINCIBLE_FRAMES;
  }

  _startDeath() {
    if (this.dead) return;
    this.dead      = true;
    this.deathTimer= 0;
    this.vy        = DEATH_POP_VELOCITY;
    this.vx        = 0;
    this.grounded  = false;
    this.animState = ANIM_STATE.DEATH;
  }

  // ── Stomp callback ───────────────────────────────────────────────────────────

  /**
   * Called when Mario successfully stomps an enemy.
   * Bounces Mario and returns points.
   * @returns {number} points
   */
  onStomp() {
    // Bounce upward after stomp
    this.vy = JUMP_VELOCITY * 0.6;
    this.grounded = false;

    const pts = STOMP_COMBO_POINTS[Math.min(this.stompCombo, STOMP_COMBO_POINTS.length - 1)];
    this.stompCombo++;
    return pts;
  }

  // ── Main update ──────────────────────────────────────────────────────────────

  /**
   * Update Mario for one frame.
   * @param {Object} inputState  from input.js
   * @param {string[][]} grid    tile grid from level.js
   */
  update(inputState, grid) {
    this.frameCounter++;

    // ── Death animation ────────────────────────────────────────────────────
    if (this.dead) {
      this._updateDead();
      return;
    }

    // ── Invincibility timers ───────────────────────────────────────────────
    this._updateInvincibility();

    // ── Grow animation (block input briefly) ──────────────────────────────
    if (this.growTimer > 0) {
      this.growTimer--;
      // Still apply gravity during grow, but don't process input
      this.vy += GRAVITY;
      if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
      this._resolveTiles(grid, inputState);
      return;
    }

    // ── Crouch ────────────────────────────────────────────────────────────
    const canCrouch = this.isSuper && this.grounded;
    if (canCrouch && (inputState.down)) {
      if (!this.crouching) {
        this.crouching = true;
        this._updateDimensions();
      }
    } else if (this.crouching) {
      // Try to stand up — check headroom
      if (this._hasHeadroomToStand(grid)) {
        this.crouching = false;
        this._updateDimensions();
      }
    }

    // ── Horizontal movement ────────────────────────────────────────────────
    if (!this.crouching) {
      this._updateHorizontal(inputState);
    } else {
      // Sliding deceleration while crouching
      this._applyFriction(this.grounded ? GROUND_FRICTION : AIR_RESISTANCE);
    }

    // ── Coyote time ────────────────────────────────────────────────────────
    if (this.grounded) {
      this.coyoteTimer = COYOTE_FRAMES;
      this.stompCombo  = 0;  // reset combo on landing
    } else {
      if (this.coyoteTimer > 0) this.coyoteTimer--;
    }

    // ── Jump buffer ────────────────────────────────────────────────────────
    if (inputState.jump) {
      this.jumpBufferTimer = JUMP_BUFFER_FRAMES;
    } else if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer--;
    }

    // ── Jump execution ────────────────────────────────────────────────────
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0 && !this.crouching) {
      this.vy          = JUMP_VELOCITY;
      this.isJumping   = true;
      this.grounded    = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
    }

    // ── Variable jump gravity ──────────────────────────────────────────────
    if (this.isJumping && this.vy < 0 && inputState.jumpHeld) {
      this.vy += JUMP_HOLD_GRAVITY;
    } else {
      this.vy += JUMP_RELEASE_GRAVITY;
      if (!inputState.jumpHeld) this.isJumping = false;
    }

    // Clamp fall speed
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

    // ── Fire fireball ─────────────────────────────────────────────────────
    if (this.state === MARIO_STATE.FIRE && inputState.fire) {
      this._tryFireball();
    }

    // ── Resolve tile collisions ────────────────────────────────────────────
    const wasGrounded = this.grounded;
    this.grounded = false;
    this._resolveTiles(grid, inputState);

    // Detect landing: was airborne, now grounded
    if (!wasGrounded && this.grounded) {
      this.isJumping  = false;
    }

    // ── Update fireballs ───────────────────────────────────────────────────
    for (const fb of this.fireballs) {
      fb.update(grid);
    }
    // Remove dead fireballs
    this.fireballs = this.fireballs.filter(fb => fb.alive);

    // ── Update animation state ────────────────────────────────────────────
    this._updateAnimState(inputState);
  }

  // ── Horizontal movement helper ───────────────────────────────────────────────

  _updateHorizontal(inputState) {
    const running    = inputState.run;
    const movingLeft = inputState.left;
    const movingRight= inputState.right;

    const maxSpeed   = running ? RUN_MAX_SPEED  : WALK_MAX_SPEED;
    const accel      = running ? RUN_ACCELERATION: WALK_ACCELERATION;

    if (movingRight && !movingLeft) {
      // Moving right
      if (this.vx < 0) {
        // Skidding — was going left
        this.vx += SKID_DECELERATION;
        if (this.vx > 0) this.vx = 0;
      } else {
        this.facing = 1;
        this.vx += accel;
        if (this.vx > maxSpeed) {
          // If over max due to run → walk transition, decelerate gently
          this.vx -= this.grounded ? GROUND_FRICTION : AIR_RESISTANCE;
          if (this.vx < maxSpeed) this.vx = maxSpeed;
        }
      }
    } else if (movingLeft && !movingRight) {
      // Moving left
      if (this.vx > 0) {
        // Skidding
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
      // No direction — apply friction
      this._applyFriction(this.grounded ? GROUND_FRICTION : AIR_RESISTANCE);
    }

    // Hard clamp to run max (in case of wonky transitions)
    if (this.vx > RUN_MAX_SPEED)  this.vx = RUN_MAX_SPEED;
    if (this.vx < -RUN_MAX_SPEED) this.vx = -RUN_MAX_SPEED;
  }

  _applyFriction(amount) {
    if (this.vx > 0) {
      this.vx -= amount;
      if (this.vx < 0) this.vx = 0;
    } else if (this.vx < 0) {
      this.vx += amount;
      if (this.vx > 0) this.vx = 0;
    }
  }

  // ── Tile collision resolution ─────────────────────────────────────────────────

  _resolveTiles(grid, inputState) {
    const self = this;

    const callbacks = {
      onBottomHit(col, row) {
        self.grounded = true;
      },
      onTopHit(col, row) {
        // Head bonk — engine/level handles block interaction
        // Signal to engine via event-like property
        self._headBonkCol = col;
        self._headBonkRow = row;
      },
    };

    // Clear head bonk tracking
    this._headBonkCol = -1;
    this._headBonkRow = -1;

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

  // ── Headroom check for standing up from crouch ─────────────────────────────

  _hasHeadroomToStand(grid) {
    // Check if uncrouching (going from SMALL_H to SUPER_H) would push into ceiling
    const targetH    = SUPER_MARIO_H;
    const targetTopY = this.y + this.h - targetH;  // where top would be
    const colL = Math.floor((this.x + 2) / TILE_SIZE);
    const colR = Math.floor((this.x + this.w - 3) / TILE_SIZE);
    const topRow = Math.floor(targetTopY / TILE_SIZE);
    const curRow = Math.floor(this.y / TILE_SIZE);

    // Check every row between the target top and the current top for solid tiles
    for (let col = colL; col <= colR; col++) {
      for (let row = topRow; row < curRow; row++) {
        const tile = grid[row]?.[col] ?? '.';
        if (SOLID_TILES.has(tile)) return false;
      }
    }
    return true;
  }

  // ── Fireball ────────────────────────────────────────────────────────────────

  _tryFireball() {
    // Filter to only alive fireballs
    this.fireballs = this.fireballs.filter(fb => fb.alive);
    if (this.fireballs.length >= FIREBALL_MAX_ACTIVE) return;

    // Spawn at Mario's front-center
    const fbX = this.facing > 0
      ? this.x + this.w
      : this.x - FIREBALL_W;
    const fbY = this.y + this.h / 2 - FIREBALL_H / 2;
    this.fireballs.push(new Fireball(fbX, fbY, this.facing));
  }

  // ── Death update ─────────────────────────────────────────────────────────────

  _updateDead() {
    // Apply gravity only (no input)
    this.vy += GRAVITY;
    if (this.vy > MAX_FALL_SPEED * 1.5) this.vy = MAX_FALL_SPEED * 1.5; // no terminal while dying
    this.y += this.vy;
    this.deathTimer++;
  }

  // ── Invincibility ────────────────────────────────────────────────────────────

  _updateInvincibility() {
    if (this.starInvincible) {
      this.starTimer--;
      if (this.starTimer <= 0) {
        this.starInvincible = false;
        this.starTimer      = 0;
      }
    }
    if (this.hurtInvincible) {
      this.hurtTimer--;
      if (this.hurtTimer <= 0) {
        this.hurtInvincible = false;
        this.hurtTimer      = 0;
      }
    }
    // Flicker visibility for hurt invincibility
    this.flickerVisible = this.hurtInvincible
      ? (Math.floor(this.frameCounter / FLICKER_RATE) % 2 === 0)
      : true;
  }

  // ── Animation state ────────────────────────────────────────────────────────

  _updateAnimState(inputState) {
    if (this.dead) {
      this.animState = ANIM_STATE.DEATH;
      return;
    }
    if (this.crouching) {
      this.animState = ANIM_STATE.CROUCH;
      return;
    }
    if (!this.grounded) {
      this.animState = ANIM_STATE.JUMP;
      return;
    }

    const moving = inputState.left || inputState.right;
    const skidding = (inputState.right && this.vx < 0) || (inputState.left && this.vx > 0);

    if (skidding && Math.abs(this.vx) > 0.5) {
      this.animState = ANIM_STATE.SKID;
    } else if (moving && Math.abs(this.vx) > 0.05) {
      this.animState = Math.abs(this.vx) >= WALK_MAX_SPEED ? ANIM_STATE.RUN : ANIM_STATE.WALK;
      // Advance walk frame
      const frameDur = Math.abs(this.vx) >= WALK_MAX_SPEED ? RUN_FRAME_DURATION : WALK_FRAME_DURATION;
      if (this.frameCounter % frameDur === 0) {
        this.walkFrame = (this.walkFrame + 1) % 3;
      }
    } else {
      this.animState = ANIM_STATE.IDLE;
    }
  }

  // ── Respawn ────────────────────────────────────────────────────────────────

  /**
   * Reset Mario to spawn position after death.
   * @param {number} spawnX
   * @param {number} spawnY
   */
  respawn(spawnX, spawnY) {
    this.x          = spawnX;
    this.y          = spawnY;
    this.vx         = 0;
    this.vy         = 0;
    this.state      = MARIO_STATE.SMALL;
    this.grounded   = false;
    this.dead       = false;
    this.deathTimer = 0;
    this.crouching  = false;
    this.starInvincible  = false;
    this.hurtInvincible  = false;
    this.starTimer  = 0;
    this.hurtTimer  = 0;
    this.isJumping  = false;
    this.coyoteTimer= 0;
    this.jumpBufferTimer = 0;
    this.stompCombo = 0;
    this.fireballs  = [];
    this.animState  = ANIM_STATE.IDLE;
    this.facing     = 1;
    this.growTimer  = 0;
    this.flickerVisible = true;
    this._updateDimensions();
  }
}

// ─── Draw Player (canvas primitives) ─────────────────────────────────────────

/**
 * Draw Mario using canvas rectangle and arc primitives.
 * No image files — purely procedural.
 *
 * Mario anatomy (logical px, relative to sprite top-left):
 *
 * SMALL (12×16):
 *   Hat:     x+2, y+0,  w=8, h=4   (red)
 *   Face:    x+2, y+4,  w=8, h=5   (skin)
 *   Body:    x+0, y+9,  w=12,h=4   (red shirt)
 *   Overalls:x+0, y+13, w=12,h=3   (blue)
 *   — Walk frame alternates legs (left/right offset)
 *
 * SUPER (12×24):
 *   Hat:      x+2, y+0,   w=8, h=4
 *   Face:     x+2, y+4,   w=8, h=5
 *   Body:     x+0, y+9,   w=12,h=6
 *   Overalls: x+0, y+15,  w=12,h=6
 *   Legs:     x+0, y+21,  w=12,h=3
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Mario} mario
 * @param {number} scale   (2 for 2x canvas)
 * @param {number} camX    camera X offset in logical pixels
 */
export function drawPlayer(ctx, mario, scale, camX = 0) {
  if (!mario.flickerVisible) return;

  // Convert logical world coords to canvas coords
  const cx = (mario.x - camX) * scale;
  const cy = mario.y * scale;
  const sw = mario.w * scale;
  const sh = mario.h * scale;

  ctx.save();

  // ── Flip for facing direction ─────────────────────────────────────────
  if (mario.facing === -1) {
    // Flip around center of sprite
    ctx.translate(cx + sw / 2, cy);
    ctx.scale(-1, 1);
    ctx.translate(-sw / 2, 0);
  } else {
    ctx.translate(cx, cy);
  }

  // ── Color selection ───────────────────────────────────────────────────
  let hatColor      = COLOR.MARIO_HAT;
  let skinColor     = COLOR.MARIO_SKIN;
  let shirtColor    = COLOR.MARIO_SHIRT;
  let overallsColor = COLOR.MARIO_OVERALLS;
  let hairColor     = COLOR.MARIO_HAIR;

  if (mario.state === MARIO_STATE.FIRE) {
    shirtColor    = COLOR.FIRE_SHIRT;
    overallsColor = COLOR.FIRE_OVERALLS;
    hatColor      = COLOR.FIRE_OVERALLS;
  }

  // Star invincibility: rainbow cycle
  if (mario.starInvincible) {
    const rainbowIdx = Math.floor(mario.frameCounter / 4) % COLOR.RAINBOW.length;
    hatColor      = COLOR.RAINBOW[rainbowIdx];
    shirtColor    = COLOR.RAINBOW[(rainbowIdx + 2) % COLOR.RAINBOW.length];
    overallsColor = COLOR.RAINBOW[(rainbowIdx + 4) % COLOR.RAINBOW.length];
  }

  const S = scale;  // shorthand

  if (mario.dead && mario.animState === ANIM_STATE.DEATH) {
    // Death pose — simplified spinning hat and flattened body
    _drawSmallMarioDead(ctx, S, hatColor, skinColor, shirtColor, overallsColor, hairColor);
  } else if (mario.crouching && mario.isSuper) {
    _drawSuperMarioCrouch(ctx, S, hatColor, skinColor, shirtColor, overallsColor, hairColor);
  } else if (mario.isSuper) {
    _drawSuperMario(ctx, mario, S, hatColor, skinColor, shirtColor, overallsColor, hairColor);
  } else {
    _drawSmallMario(ctx, mario, S, hatColor, skinColor, shirtColor, overallsColor, hairColor);
  }

  ctx.restore();

  // ── Draw fireballs ────────────────────────────────────────────────────
  for (const fb of mario.fireballs) {
    if (!fb.alive) continue;
    drawFireball(ctx, fb, scale, camX);
  }
}

// ─── Small Mario ────────────────────────────────────────────────────────────

function _drawSmallMario(ctx, mario, S, hat, skin, shirt, overalls, hair) {
  const wf = mario.walkFrame;  // 0, 1, 2

  // Hat brim line
  ctx.fillStyle = hat;
  ctx.fillRect(2*S, 0,     8*S, 4*S);  // hat top
  ctx.fillRect(0*S, 3*S,  10*S, 2*S);  // hat brim wider

  // Face (skin)
  ctx.fillStyle = skin;
  ctx.fillRect(2*S, 4*S,   8*S, 5*S);

  // Hair / sideburns
  ctx.fillStyle = hair;
  ctx.fillRect(2*S, 4*S,   2*S, 2*S);  // sideburn left
  ctx.fillRect(2*S, 8*S,   2*S, 1*S);  // mustache hint

  // Eyes (dark dot)
  ctx.fillStyle = '#000';
  ctx.fillRect(6*S, 5*S,   2*S, 2*S);

  // Shirt / body
  ctx.fillStyle = shirt;
  ctx.fillRect(0*S, 9*S,  12*S, 4*S);

  // Overalls
  ctx.fillStyle = overalls;
  ctx.fillRect(0*S, 13*S, 12*S, 3*S);

  // Legs — alternate walk frames
  if (mario.animState === ANIM_STATE.IDLE || mario.animState === ANIM_STATE.JUMP) {
    // Both feet together
    ctx.fillStyle = overalls;
    ctx.fillRect(1*S, 13*S,  4*S, 3*S);
    ctx.fillRect(7*S, 13*S,  4*S, 3*S);
  } else {
    // Walk cycle: 3 frames
    const legOffsets = [[0, 2], [1, 1], [2, 0]]; // [leftLeg, rightLeg] offset
    const off = legOffsets[wf % 3];
    ctx.fillStyle = overalls;
    ctx.fillRect((1 + off[0])*S, 13*S, 4*S, 3*S);
    ctx.fillRect((7 - off[1])*S, 13*S, 4*S, 3*S);
  }

  // Shoe tips (dark)
  ctx.fillStyle = '#3B1F00';
  if (mario.animState !== ANIM_STATE.IDLE) {
    ctx.fillRect(0*S, 15*S,  3*S, 1*S);
    ctx.fillRect(9*S, 15*S,  3*S, 1*S);
  } else {
    ctx.fillRect(1*S, 15*S,  10*S, 1*S);
  }
}

// ─── Small Mario Death Pose ──────────────────────────────────────────────────

function _drawSmallMarioDead(ctx, S, hat, skin, shirt, overalls, hair) {
  // Death pose: same body but arms out
  ctx.fillStyle = hat;
  ctx.fillRect(2*S, 0,    8*S, 4*S);
  ctx.fillRect(0*S, 3*S, 10*S, 2*S);

  ctx.fillStyle = skin;
  ctx.fillRect(2*S, 4*S,  8*S, 5*S);

  ctx.fillStyle = '#000';
  ctx.fillRect(6*S, 5*S,  2*S, 2*S);

  ctx.fillStyle = shirt;
  ctx.fillRect(0*S, 9*S, 12*S, 4*S);

  // Arms outstretched
  ctx.fillStyle = skin;
  ctx.fillRect(-2*S, 9*S, 3*S, 2*S);
  ctx.fillRect(11*S, 9*S, 3*S, 2*S);

  ctx.fillStyle = overalls;
  ctx.fillRect(0*S, 13*S, 12*S, 3*S);
}

// ─── Super Mario ─────────────────────────────────────────────────────────────

function _drawSuperMario(ctx, mario, S, hat, skin, shirt, overalls, hair) {
  const wf = mario.walkFrame;

  // Hat
  ctx.fillStyle = hat;
  ctx.fillRect(2*S, 0,     8*S, 4*S);
  ctx.fillRect(0*S, 3*S,  10*S, 2*S);

  // Face
  ctx.fillStyle = skin;
  ctx.fillRect(2*S, 4*S,   8*S, 5*S);

  // Hair
  ctx.fillStyle = hair;
  ctx.fillRect(2*S, 4*S,   2*S, 2*S);

  // Eyes
  ctx.fillStyle = '#000';
  ctx.fillRect(6*S, 5*S,   2*S, 2*S);

  // Shirt / torso (Super is taller — 8px body)
  ctx.fillStyle = shirt;
  ctx.fillRect(0*S, 9*S,  12*S, 8*S);

  // Overalls
  ctx.fillStyle = overalls;
  ctx.fillRect(1*S, 12*S, 10*S, 5*S);  // bib
  ctx.fillRect(0*S, 17*S, 12*S, 4*S);  // lower

  // Legs
  if (mario.animState === ANIM_STATE.IDLE || mario.animState === ANIM_STATE.JUMP) {
    ctx.fillStyle = overalls;
    ctx.fillRect(1*S, 21*S,  4*S, 3*S);
    ctx.fillRect(7*S, 21*S,  4*S, 3*S);
  } else {
    const legOffsets = [[0,2],[1,1],[2,0]];
    const off = legOffsets[wf % 3];
    ctx.fillStyle = overalls;
    ctx.fillRect((1 + off[0])*S, 21*S, 4*S, 3*S);
    ctx.fillRect((7 - off[1])*S, 21*S, 4*S, 3*S);
  }

  // Shoes
  ctx.fillStyle = '#3B1F00';
  ctx.fillRect(1*S, 23*S, 10*S, 1*S);
}

// ─── Super Mario Crouch ──────────────────────────────────────────────────────

function _drawSuperMarioCrouch(ctx, S, hat, skin, shirt, overalls, hair) {
  // Crouched: compressed height
  ctx.fillStyle = hat;
  ctx.fillRect(2*S, 0,    8*S, 4*S);
  ctx.fillRect(0*S, 3*S, 10*S, 2*S);

  ctx.fillStyle = skin;
  ctx.fillRect(2*S, 4*S,  8*S, 4*S);

  ctx.fillStyle = '#000';
  ctx.fillRect(6*S, 5*S,  2*S, 2*S);

  ctx.fillStyle = shirt;
  ctx.fillRect(0*S, 8*S, 12*S, 4*S);

  ctx.fillStyle = overalls;
  ctx.fillRect(0*S, 12*S, 12*S, 4*S);

  ctx.fillStyle = '#3B1F00';
  ctx.fillRect(1*S, 15*S, 10*S, 1*S);
}

// ─── Fireball ────────────────────────────────────────────────────────────────

function drawFireball(ctx, fb, scale, camX) {
  const cx = (fb.x - camX) * scale;
  const cy = fb.y * scale;
  const cr = fb.w * scale / 2;  // radius

  // Glow ring
  ctx.fillStyle = COLOR.FIREBALL_GLOW;
  ctx.beginPath();
  ctx.arc(cx + cr, cy + cr, cr, 0, Math.PI * 2);
  ctx.fill();

  // White core (slightly smaller)
  ctx.fillStyle = COLOR.FIREBALL;
  ctx.beginPath();
  ctx.arc(cx + cr, cy + cr, cr * 0.6, 0, Math.PI * 2);
  ctx.fill();
}
