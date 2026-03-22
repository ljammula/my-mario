// enemies.js — Enemy entities and AI for Super Mario Bros

import { TILE_SIZE, getTile, isSolid, worldToTile, TILES } from './level.js';

const GRAVITY = 0.5;
const MAX_FALL_SPEED = 8.0;

// ── Utility ────────────────────────────────────────────────────────────────────

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// Resolve tile collision for an entity with x, y, width, height, vx, vy
// Modifies entity in-place; returns { left, right, top, bottom } collision flags
function resolveTileCollision(entity) {
  const hit = { left: false, right: false, top: false, bottom: false };

  // Horizontal
  entity.x += entity.vx;
  const cols = cornerCols(entity);
  const rows = cornerRows(entity);

  if (entity.vx > 0) {
    const rightCol = Math.floor((entity.x + entity.width - 1) / TILE_SIZE);
    const topRow = Math.floor(entity.y / TILE_SIZE);
    const botRow = Math.floor((entity.y + entity.height - 1) / TILE_SIZE);
    if (solidAt(rightCol, topRow) || solidAt(rightCol, botRow)) {
      entity.x = rightCol * TILE_SIZE - entity.width;
      entity.vx = 0;
      hit.right = true;
    }
  } else if (entity.vx < 0) {
    const leftCol = Math.floor(entity.x / TILE_SIZE);
    const topRow = Math.floor(entity.y / TILE_SIZE);
    const botRow = Math.floor((entity.y + entity.height - 1) / TILE_SIZE);
    if (solidAt(leftCol, topRow) || solidAt(leftCol, botRow)) {
      entity.x = (leftCol + 1) * TILE_SIZE;
      entity.vx = 0;
      hit.left = true;
    }
  }

  // Vertical
  entity.y += entity.vy;

  if (entity.vy > 0) {
    const botRow = Math.floor((entity.y + entity.height - 1) / TILE_SIZE);
    const leftCol = Math.floor((entity.x + 1) / TILE_SIZE);
    const rightCol = Math.floor((entity.x + entity.width - 2) / TILE_SIZE);
    if (solidAt(leftCol, botRow) || solidAt(rightCol, botRow)) {
      entity.y = botRow * TILE_SIZE - entity.height;
      entity.vy = 0;
      hit.bottom = true;
    }
  } else if (entity.vy < 0) {
    const topRow = Math.floor(entity.y / TILE_SIZE);
    const leftCol = Math.floor((entity.x + 1) / TILE_SIZE);
    const rightCol = Math.floor((entity.x + entity.width - 2) / TILE_SIZE);
    if (solidAt(leftCol, topRow) || solidAt(rightCol, topRow)) {
      entity.y = (topRow + 1) * TILE_SIZE;
      entity.vy = 0;
      hit.top = true;
    }
  }

  return hit;
}

function solidAt(col, row) {
  return isSolid(col, row);
}

function cornerCols(e) {
  return [Math.floor(e.x / TILE_SIZE), Math.floor((e.x + e.width - 1) / TILE_SIZE)];
}

function cornerRows(e) {
  return [Math.floor(e.y / TILE_SIZE), Math.floor((e.y + e.height - 1) / TILE_SIZE)];
}

// Check if entity is about to walk off a ledge (for Koopa turn-around)
function isEdgeAhead(entity, direction) {
  const checkX = direction > 0
    ? entity.x + entity.width + 1
    : entity.x - 1;
  const checkCol = Math.floor(checkX / TILE_SIZE);
  const belowRow = Math.floor((entity.y + entity.height + 1) / TILE_SIZE);
  return !solidAt(checkCol, belowRow);
}

// ── Goomba ────────────────────────────────────────────────────────────────────

export class Goomba {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 14;
    this.height = 14;
    this.vx = -0.75;      // walks left
    this.vy = 0;
    this.alive = true;
    this.dead = false;     // completely removed
    this.state = 'walking'; // 'walking' | 'stomped' | 'flipped'
    this.animFrame = 0;
    this.animTimer = 0;
    this.stompTimer = 0;   // frames to show flat sprite before removing
    this.flipVy = 0;       // for flipped death
    this.points = 100;
  }

  get left()   { return this.x; }
  get right()  { return this.x + this.width; }
  get top()    { return this.y; }
  get bottom() { return this.y + this.height; }
  get centerX(){ return this.x + this.width / 2; }
  get centerY(){ return this.y + this.height / 2; }

  stomp() {
    if (this.state !== 'walking') return;
    this.state = 'stomped';
    this.vx = 0;
    this.vy = 0;
    this.stompTimer = 30; // 0.5s at 60fps
  }

  kill(type) {
    // type: 'fireball' | 'shell' | 'star'
    if (this.state === 'stomped' || this.dead) return;
    this.state = 'flipped';
    this.vx = 0;
    this.vy = -3;
    this.points = 200;
  }

  update() {
    if (this.dead) return;

    if (this.state === 'stomped') {
      this.stompTimer--;
      if (this.stompTimer <= 0) this.dead = true;
      return;
    }

    if (this.state === 'flipped') {
      this.vy += GRAVITY;
      this.y += this.vy;
      if (this.y > 300) this.dead = true; // off-screen
      return;
    }

    // Walking AI
    this.vy += GRAVITY;
    this.vy = clamp(this.vy, -MAX_FALL_SPEED, MAX_FALL_SPEED);

    const hit = resolveTileCollision(this);

    // Reverse direction on wall hit
    if (hit.left || hit.right) {
      this.vx = -this.vx;
    }

    // Walk animation
    this.animTimer++;
    if (this.animTimer >= 16) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % 2;
    }

    // Despawn if fallen far below level
    if (this.y > TILE_SIZE * 20) this.dead = true;
  }
}

// ── KoopaTroopa ────────────────────────────────────────────────────────────────

export class KoopaTroopa {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 14;
    this.height = 22;   // taller when walking (1x2 tiles)
    this.vx = -0.75;
    this.vy = 0;
    this.alive = true;
    this.dead = false;
    this.state = 'walking'; // 'walking' | 'shell' | 'sliding'
    this.animFrame = 0;
    this.animTimer = 0;
    this.shellStillTimer = 0; // shell becomes still → restart after 5s (300 frames)
    this.shellSlidingTimer = 0;
    this.points = 100;
    this.comboPoints = 200; // escalating for shell kills
    this.flipped = false;
    this.flipVy = 0;
  }

  get left()   { return this.x; }
  get right()  { return this.x + this.width; }
  get top()    { return this.y; }
  get bottom() { return this.y + this.height; }
  get centerX(){ return this.x + this.width / 2; }
  get centerY(){ return this.y + this.height / 2; }

  stomp(marioX) {
    if (this.state === 'walking') {
      // First stomp: become shell
      this.state = 'shell';
      this.vx = 0;
      this.vy = 0;
      this.height = 14; // shell is 1 tile
      this.y += 8; // adjust for shorter height
      this.shellStillTimer = 300; // 5 seconds before waking
      this.points = 100;
      return 100;
    } else if (this.state === 'shell') {
      // Kick the shell
      this.state = 'sliding';
      const dir = marioX < this.centerX ? 1 : -1;
      this.vx = dir * 4;
      this.shellSlidingTimer = 0;
      return 0;
    } else if (this.state === 'sliding') {
      // Stop the shell
      this.state = 'shell';
      this.vx = 0;
      this.shellStillTimer = 300;
      return 0;
    }
    return 0;
  }

  killByFireball() {
    if (this.dead) return;
    this.flipped = true;
    this.vx = 0;
    this.vy = -4;
    this.points = 200;
  }

  shellKillEnemy() {
    // Returns points for shell kill (combo escalates)
    const pts = this.comboPoints;
    this.comboPoints = Math.min(this.comboPoints * 2, 8000);
    return pts;
  }

  update() {
    if (this.dead) return;

    if (this.flipped) {
      this.vy += GRAVITY;
      this.y += this.vy;
      if (this.y > TILE_SIZE * 20) this.dead = true;
      return;
    }

    this.vy += GRAVITY;
    this.vy = clamp(this.vy, -MAX_FALL_SPEED, MAX_FALL_SPEED);

    if (this.state === 'shell') {
      const hit = resolveTileCollision(this);
      // Count down still timer → wake up
      if (this.shellStillTimer > 0) {
        this.shellStillTimer--;
        if (this.shellStillTimer <= 0) {
          // Wake up — start walking again
          this.state = 'walking';
          this.height = 22;
          this.y -= 8;
          this.vx = -0.75;
        }
      }
      return;
    }

    if (this.state === 'sliding') {
      const hit = resolveTileCollision(this);
      // Bounce off walls
      if (hit.left || hit.right) {
        this.vx = -this.vx;
      }
      // Slide off ledges (don't turn)
      if (this.y > TILE_SIZE * 20) this.dead = true;
      return;
    }

    if (this.state === 'walking') {
      // Turn around at edges (Koopa turns, doesn't walk off)
      if (isEdgeAhead(this, this.vx > 0 ? 1 : -1)) {
        this.vx = -this.vx;
      }

      const hit = resolveTileCollision(this);
      if (hit.left || hit.right) {
        this.vx = -this.vx;
      }

      this.animTimer++;
      if (this.animTimer >= 16) {
        this.animTimer = 0;
        this.animFrame = (this.animFrame + 1) % 2;
      }

      if (this.y > TILE_SIZE * 20) this.dead = true;
    }
  }
}

// ── PiranhaPlant ───────────────────────────────────────────────────────────────

export class PiranhaPlant {
  // pipeTopY: world-y of the pipe rim top
  // pipeX: world-x left edge of pipe (2 tiles wide, so plant centers at pipeX+8)
  constructor(pipeCol, pipeTopRow) {
    this.pipeCol = pipeCol;
    this.pipeTopRow = pipeTopRow;
    this.width = 14;
    this.height = 22;
    this.pipeX = pipeCol * TILE_SIZE;
    this.pipeTopY = pipeTopRow * TILE_SIZE;

    // Center in pipe horizontally
    this.x = this.pipeX + (TILE_SIZE - this.width / 2); // slight offset in 2-tile pipe

    // The plant starts hidden at pipe bottom
    this.fullyHiddenY = this.pipeTopY + this.height + 4; // below pipe top
    this.fullyExtendedY = this.pipeTopY - this.height;   // above pipe rim

    this.y = this.fullyHiddenY;

    this.state = 'waiting_bottom'; // 'waiting_bottom' | 'rising' | 'waiting_top' | 'retracting'
    this.stateTimer = 60;  // 1s at 60fps before first rise
    this.animFrame = 0;
    this.animTimer = 0;
    this.alive = true;
    this.dead = false;
    this.points = 200;

    this.RISE_SPEED = (this.height * 2) / 120; // traverse in ~2s
  }

  get left()   { return this.x; }
  get right()  { return this.x + this.width; }
  get top()    { return this.y; }
  get bottom() { return this.y + this.height; }
  get centerX(){ return this.x + this.width / 2; }
  get centerY(){ return this.y + this.height / 2; }

  // Returns true if Mario is close to the pipe opening (within 1 tile horizontally)
  isMarioNearby(marioX, marioWidth) {
    const pipeCenter = this.pipeX + TILE_SIZE;
    const marioCenterX = marioX + marioWidth / 2;
    return Math.abs(marioCenterX - pipeCenter) <= TILE_SIZE;
  }

  killByProjectile() {
    if (this.dead) return;
    this.dead = true;
    this.alive = false;
  }

  update(marioX, marioWidth) {
    if (this.dead) return;

    this.animTimer++;
    if (this.animTimer >= 16) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % 2;
    }

    this.stateTimer--;

    if (this.state === 'waiting_bottom') {
      this.y = this.fullyHiddenY;
      if (this.stateTimer <= 0 && !this.isMarioNearby(marioX, marioWidth)) {
        this.state = 'rising';
        this.stateTimer = 120; // 2s to rise
      } else if (this.stateTimer <= 0 && this.isMarioNearby(marioX, marioWidth)) {
        // Reset wait
        this.stateTimer = 60;
      }
    } else if (this.state === 'rising') {
      // Move upward over stateTimer frames
      const totalFrames = 120;
      const elapsed = totalFrames - this.stateTimer;
      const t = elapsed / totalFrames;
      this.y = this.fullyHiddenY + (this.fullyExtendedY - this.fullyHiddenY) * t;
      if (this.stateTimer <= 0) {
        this.y = this.fullyExtendedY;
        this.state = 'waiting_top';
        this.stateTimer = 120; // 2s at top
      }
    } else if (this.state === 'waiting_top') {
      this.y = this.fullyExtendedY;
      if (this.stateTimer <= 0) {
        this.state = 'retracting';
        this.stateTimer = 120; // 2s to retract
      }
    } else if (this.state === 'retracting') {
      const totalFrames = 120;
      const elapsed = totalFrames - this.stateTimer;
      const t = elapsed / totalFrames;
      this.y = this.fullyExtendedY + (this.fullyHiddenY - this.fullyExtendedY) * t;
      if (this.stateTimer <= 0) {
        this.y = this.fullyHiddenY;
        this.state = 'waiting_bottom';
        this.stateTimer = 60; // 1s at bottom
      }
    }
  }
}

// ── Shell (standalone sliding shell entity) ────────────────────────────────────

export class Shell {
  constructor(x, y, vx) {
    this.x = x;
    this.y = y;
    this.width = 14;
    this.height = 14;
    this.vx = vx;
    this.vy = 0;
    this.alive = true;
    this.dead = false;
    this.animFrame = 0;
    this.animTimer = 0;
    this.comboKills = 0;
    this.points = 200;
  }

  get left()   { return this.x; }
  get right()  { return this.x + this.width; }
  get top()    { return this.y; }
  get bottom() { return this.y + this.height; }
  get centerX(){ return this.x + this.width / 2; }

  stop() {
    this.vx = 0;
    this.dead = true; // convert back to Koopa's shell state
  }

  getComboPoints() {
    this.comboKills++;
    const vals = [200, 400, 800, 1600, 3200, 5000, 8000];
    return vals[Math.min(this.comboKills - 1, vals.length - 1)];
  }

  update() {
    if (this.dead) return;

    this.vy += GRAVITY;
    this.vy = clamp(this.vy, -MAX_FALL_SPEED, MAX_FALL_SPEED);

    const hit = resolveTileCollision(this);

    if (hit.left || hit.right) {
      this.vx = -this.vx;
    }

    this.animTimer++;
    if (this.animTimer >= 4) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % 4;
    }

    if (this.y > TILE_SIZE * 20) this.dead = true;
  }
}
