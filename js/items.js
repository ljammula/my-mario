// items.js — Item entities for Super Mario Bros

import { TILE_SIZE, isSolid, worldToTile } from './level.js';

const GRAVITY = 0.5;
const MAX_FALL_SPEED = 8.0;

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// Basic tile collision resolver (returns hit flags)
function resolveTileCollision(entity) {
  const hit = { left: false, right: false, top: false, bottom: false };

  // Horizontal
  entity.x += entity.vx;
  if (entity.vx > 0) {
    const rightCol = Math.floor((entity.x + entity.width - 1) / TILE_SIZE);
    const topRow = Math.floor(entity.y / TILE_SIZE);
    const botRow = Math.floor((entity.y + entity.height - 1) / TILE_SIZE);
    if (isSolid(rightCol, topRow) || isSolid(rightCol, botRow)) {
      entity.x = rightCol * TILE_SIZE - entity.width;
      entity.vx = 0;
      hit.right = true;
    }
  } else if (entity.vx < 0) {
    const leftCol = Math.floor(entity.x / TILE_SIZE);
    const topRow = Math.floor(entity.y / TILE_SIZE);
    const botRow = Math.floor((entity.y + entity.height - 1) / TILE_SIZE);
    if (isSolid(leftCol, topRow) || isSolid(leftCol, botRow)) {
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
    if (isSolid(leftCol, botRow) || isSolid(rightCol, botRow)) {
      entity.y = botRow * TILE_SIZE - entity.height;
      entity.vy = 0;
      hit.bottom = true;
    }
  } else if (entity.vy < 0) {
    const topRow = Math.floor(entity.y / TILE_SIZE);
    const leftCol = Math.floor((entity.x + 1) / TILE_SIZE);
    const rightCol = Math.floor((entity.x + entity.width - 2) / TILE_SIZE);
    if (isSolid(leftCol, topRow) || isSolid(rightCol, topRow)) {
      entity.y = (topRow + 1) * TILE_SIZE;
      entity.vy = 0;
      hit.top = true;
    }
  }

  return hit;
}

// ── Coin (floating / collectible) ─────────────────────────────────────────────

export class Coin {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 8;
    this.height = 12;
    this.collected = false;
    this.dead = false;
    this.animFrame = 0;
    this.animTimer = 0;
    this.points = 200;
    this.type = 'coin';
  }

  get left()   { return this.x; }
  get right()  { return this.x + this.width; }
  get top()    { return this.y; }
  get bottom() { return this.y + this.height; }
  get centerX(){ return this.x + this.width / 2; }

  collect() {
    if (this.collected) return;
    this.collected = true;
    this.dead = true;
  }

  update() {
    if (this.dead) return;
    this.animTimer++;
    if (this.animTimer >= 8) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % 4;
    }
  }
}

// ── SuperMushroom ──────────────────────────────────────────────────────────────

export class SuperMushroom {
  // Spawns from a Q block, slides out upward then moves right
  constructor(blockX, blockY) {
    this.x = blockX;
    this.y = blockY;
    this.width = 14;
    this.height = 14;
    this.vx = 0;
    this.vy = 0;
    this.emerging = true;
    this.emergeY = blockY - TILE_SIZE; // target Y after emerging
    this.emergeSpeed = 0.5;
    this.collected = false;
    this.dead = false;
    this.animFrame = 0;
    this.animTimer = 0;
    this.points = 1000;
    this.type = 'mushroom';
  }

  get left()   { return this.x; }
  get right()  { return this.x + this.width; }
  get top()    { return this.y; }
  get bottom() { return this.y + this.height; }

  collect() {
    if (this.collected) return;
    this.collected = true;
    this.dead = true;
  }

  update() {
    if (this.dead) return;

    if (this.emerging) {
      this.y -= this.emergeSpeed;
      if (this.y <= this.emergeY) {
        this.y = this.emergeY;
        this.emerging = false;
        this.vx = 1.5; // move right after emerging
      }
      return;
    }

    // Gravity and movement
    this.vy += GRAVITY;
    this.vy = clamp(this.vy, -MAX_FALL_SPEED, MAX_FALL_SPEED);

    const hit = resolveTileCollision(this);

    // Reverse direction on wall hit
    if (hit.left || hit.right) {
      this.vx = -this.vx;
    }

    // Animate
    this.animTimer++;
    if (this.animTimer >= 16) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % 2;
    }

    if (this.y > TILE_SIZE * 20) this.dead = true;
  }
}

// ── FireFlower ─────────────────────────────────────────────────────────────────

export class FireFlower {
  constructor(blockX, blockY) {
    this.x = blockX;
    this.y = blockY;
    this.width = 12;
    this.height = 14;
    this.emerging = true;
    this.emergeY = blockY - TILE_SIZE;
    this.emergeSpeed = 0.5;
    this.collected = false;
    this.dead = false;
    this.animFrame = 0;
    this.animTimer = 0;
    this.points = 1000;
    this.type = 'flower';
  }

  get left()   { return this.x; }
  get right()  { return this.x + this.width; }
  get top()    { return this.y; }
  get bottom() { return this.y + this.height; }

  collect() {
    if (this.collected) return;
    this.collected = true;
    this.dead = true;
  }

  update() {
    if (this.dead) return;

    if (this.emerging) {
      this.y -= this.emergeSpeed;
      if (this.y <= this.emergeY) {
        this.y = this.emergeY;
        this.emerging = false;
      }
      return;
    }

    // Fire flower stays in place — just animate
    this.animTimer++;
    if (this.animTimer >= 10) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % 4;
    }
  }
}

// ── SuperStar ──────────────────────────────────────────────────────────────────

export class SuperStar {
  constructor(blockX, blockY) {
    this.x = blockX;
    this.y = blockY;
    this.width = 14;
    this.height = 14;
    this.vx = 2.0;
    this.vy = -4;           // initial upward velocity
    this.emerging = true;
    this.emergeY = blockY - TILE_SIZE;
    this.emergeSpeed = 0.5;
    this.collected = false;
    this.dead = false;
    this.animFrame = 0;
    this.animTimer = 0;
    this.points = 1000;
    this.type = 'star';
    this.BOUNCE_RESTITUTION = 0.9;
  }

  get left()   { return this.x; }
  get right()  { return this.x + this.width; }
  get top()    { return this.y; }
  get bottom() { return this.y + this.height; }

  collect() {
    if (this.collected) return;
    this.collected = true;
    this.dead = true;
  }

  update() {
    if (this.dead) return;

    if (this.emerging) {
      this.y -= this.emergeSpeed;
      if (this.y <= this.emergeY) {
        this.y = this.emergeY;
        this.emerging = false;
      }
      return;
    }

    this.vy += GRAVITY;
    this.vy = clamp(this.vy, -MAX_FALL_SPEED, MAX_FALL_SPEED);

    // Horizontal - bounce off walls
    this.x += this.vx;
    const rightCol = Math.floor((this.x + this.width - 1) / TILE_SIZE);
    const leftCol  = Math.floor(this.x / TILE_SIZE);
    const topRow   = Math.floor(this.y / TILE_SIZE);
    const botRow   = Math.floor((this.y + this.height - 1) / TILE_SIZE);

    if (this.vx > 0 && (isSolid(rightCol, topRow) || isSolid(rightCol, botRow))) {
      this.x = rightCol * TILE_SIZE - this.width;
      this.vx = -this.vx;
    } else if (this.vx < 0 && (isSolid(leftCol, topRow) || isSolid(leftCol, botRow))) {
      this.x = (leftCol + 1) * TILE_SIZE;
      this.vx = -this.vx;
    }

    // Vertical - bounce with restitution
    this.y += this.vy;
    const newBotRow = Math.floor((this.y + this.height - 1) / TILE_SIZE);
    const newTopRow = Math.floor(this.y / TILE_SIZE);
    const lCol = Math.floor((this.x + 1) / TILE_SIZE);
    const rCol = Math.floor((this.x + this.width - 2) / TILE_SIZE);

    if (this.vy > 0 && (isSolid(lCol, newBotRow) || isSolid(rCol, newBotRow))) {
      this.y = newBotRow * TILE_SIZE - this.height;
      this.vy = -Math.abs(this.vy) * this.BOUNCE_RESTITUTION;
    } else if (this.vy < 0 && (isSolid(lCol, newTopRow) || isSolid(rCol, newTopRow))) {
      this.y = (newTopRow + 1) * TILE_SIZE;
      this.vy = Math.abs(this.vy) * this.BOUNCE_RESTITUTION;
    }

    this.animTimer++;
    if (this.animTimer >= 8) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % 4;
    }

    if (this.y > TILE_SIZE * 20) this.dead = true;
  }
}

// ── OneUpMushroom ─────────────────────────────────────────────────────────────

export class OneUpMushroom extends SuperMushroom {
  constructor(blockX, blockY) {
    super(blockX, blockY);
    this.points = 0; // no pts — gives 1UP instead
    this.type = 'oneup';
    this.isOneUp = true;
  }
}

// ── Fireball ──────────────────────────────────────────────────────────────────

const FIREBALL_SPEED_X = 3;
const FIREBALL_BOUNCE_VY = -4;
const FIREBALL_MAX_BOUNCES = 5;

export class Fireball {
  constructor(x, y, dirX) {
    this.x = x;
    this.y = y;
    this.width = 6;
    this.height = 6;
    this.vx = dirX * FIREBALL_SPEED_X;
    this.vy = 2;  // slight downward arc to start
    this.bounces = 0;
    this.dead = false;
    this.exploding = false;
    this.explodeTimer = 0;
    this.animFrame = 0;
    this.animTimer = 0;
    this.type = 'fireball';
  }

  get left()   { return this.x; }
  get right()  { return this.x + this.width; }
  get top()    { return this.y; }
  get bottom() { return this.y + this.height; }

  explode() {
    if (this.exploding || this.dead) return;
    this.exploding = true;
    this.vx = 0;
    this.vy = 0;
    this.explodeTimer = 15; // show explosion briefly
  }

  update() {
    if (this.dead) return;

    if (this.exploding) {
      this.explodeTimer--;
      if (this.explodeTimer <= 0) this.dead = true;
      this.animTimer++;
      if (this.animTimer >= 4) {
        this.animTimer = 0;
        this.animFrame = (this.animFrame + 1) % 3;
      }
      return;
    }

    this.vy += GRAVITY;
    this.vy = clamp(this.vy, -MAX_FALL_SPEED, MAX_FALL_SPEED);

    // Horizontal
    this.x += this.vx;
    if (this.vx > 0) {
      const col = Math.floor((this.x + this.width - 1) / TILE_SIZE);
      const tRow = Math.floor(this.y / TILE_SIZE);
      const bRow = Math.floor((this.y + this.height - 1) / TILE_SIZE);
      if (isSolid(col, tRow) || isSolid(col, bRow)) {
        this.explode();
        return;
      }
    } else if (this.vx < 0) {
      const col = Math.floor(this.x / TILE_SIZE);
      const tRow = Math.floor(this.y / TILE_SIZE);
      const bRow = Math.floor((this.y + this.height - 1) / TILE_SIZE);
      if (isSolid(col, tRow) || isSolid(col, bRow)) {
        this.explode();
        return;
      }
    }

    // Vertical
    this.y += this.vy;
    if (this.vy > 0) {
      const row = Math.floor((this.y + this.height - 1) / TILE_SIZE);
      const lCol = Math.floor((this.x + 1) / TILE_SIZE);
      const rCol = Math.floor((this.x + this.width - 2) / TILE_SIZE);
      if (isSolid(lCol, row) || isSolid(rCol, row)) {
        this.y = row * TILE_SIZE - this.height;
        this.vy = FIREBALL_BOUNCE_VY;
        this.bounces++;
        if (this.bounces >= FIREBALL_MAX_BOUNCES) {
          this.explode();
          return;
        }
      }
    } else if (this.vy < 0) {
      const row = Math.floor(this.y / TILE_SIZE);
      const lCol = Math.floor((this.x + 1) / TILE_SIZE);
      const rCol = Math.floor((this.x + this.width - 2) / TILE_SIZE);
      if (isSolid(lCol, row) || isSolid(rCol, row)) {
        this.y = (row + 1) * TILE_SIZE;
        this.vy = Math.abs(this.vy);
      }
    }

    this.animTimer++;
    if (this.animTimer >= 4) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % 4;
    }

    // Despawn if off-screen or fallen below level
    if (this.y > TILE_SIZE * 20) this.dead = true;
  }
}
