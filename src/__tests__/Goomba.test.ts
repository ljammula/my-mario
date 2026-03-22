/**
 * Goomba.test.ts
 * Tests for Goomba enemy state machine and behaviors.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Goomba } from '../entities/enemies/Goomba';
import { GoombaState } from '../types/entities';
import { GOOMBA_SPEED } from '../config/physics';
import { TILE_SIZE, LEVEL_WIDTH_PX } from '../config/constants';
import { TileGrid } from '../types/level';
import { Mario } from '../entities/player/Mario';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyGrid(): TileGrid {
  const grid: TileGrid = [];
  for (let r = 0; r < 16; r++) {
    grid.push(new Array(224).fill('.'));
  }
  return grid;
}

/** Floor grid: solid on row 14 across all columns. */
function floorGrid(): TileGrid {
  const grid = emptyGrid();
  for (let c = 0; c < 224; c++) {
    grid[14][c] = 'G';
  }
  return grid;
}

/** Create a fake Mario for use in enemy method signatures. */
function fakeMario(): Mario {
  return new Mario(500, 208); // far away from default goomba position
}

/** Create a Goomba at a position on the floor (y = 224 - 14 = 210). */
function goomba(x = 100): Goomba {
  const g = new Goomba(x, 210);
  g.active = true;
  return g;
}

// ─── Initial state ────────────────────────────────────────────────────────────

describe('Goomba — initial state', () => {
  it('starts in WALKING state', () => {
    const g = goomba();
    expect(g.goombaState).toBe(GoombaState.WALKING);
  });

  it('starts moving left at GOOMBA_SPEED', () => {
    const g = goomba();
    expect(g.vx).toBe(-GOOMBA_SPEED);
  });

  it('starts alive', () => {
    const g = goomba();
    expect(g.alive).toBe(true);
  });

  it('has reverseOnWall = true', () => {
    const g = goomba();
    expect(g.reverseOnWall).toBe(true);
  });
});

// ─── Walking behavior ─────────────────────────────────────────────────────────

describe('Goomba — walking', () => {
  it('moves along x axis each update', () => {
    const g = goomba();
    const xBefore = g.x;
    g.update(floorGrid(), fakeMario(), 0);
    // vx = -GOOMBA_SPEED, so x should decrease
    expect(g.x).toBeLessThan(xBefore);
  });

  it('hits wall: vx reverses direction (single negation, no double-flip)', () => {
    // Goomba at x=110, moving right vx=+1. Wall at col=7 (x=112).
    // resolveEnemyTileCollision (reverseOnWall=true) sets vx = -abs(vx) = -1.
    // Goomba.update must NOT negate again — vx should remain -1 after wall hit.
    const g = new Goomba(110, 210);
    g.active = true;
    g.vx = 1;
    const wallGrid = emptyGrid();
    for (let c = 0; c < 224; c++) wallGrid[14][c] = 'G';
    wallGrid[13][7] = 'G';
    wallGrid[12][7] = 'G';
    const mario = fakeMario();
    g.update(wallGrid, mario, 0);
    // Goomba should remain alive after wall contact
    expect(g.alive).toBe(true);
    // After wall hit, vx must be negative (reversed from initial +1)
    expect(g.vx).toBeLessThan(0);
    // Facing must match the new direction
    expect(g.facing).toBe(-1);
    expect(g.goombaState).toBe(GoombaState.WALKING);
  });
});

// ─── Stomp ────────────────────────────────────────────────────────────────────

describe('Goomba — stomp', () => {
  it('stomp() transitions state to STOMPED', () => {
    const g = goomba();
    g.onStomp(fakeMario());
    expect(g.goombaState).toBe(GoombaState.STOMPED);
  });

  it('stomp() sets vx = 0', () => {
    const g = goomba();
    g.onStomp(fakeMario());
    expect(g.vx).toBe(0);
  });

  it('stomp() sets vy = 0', () => {
    const g = goomba();
    g.onStomp(fakeMario());
    expect(g.vy).toBe(0);
  });

  it('stomped goomba remains alive immediately after stomp', () => {
    const g = goomba();
    g.onStomp(fakeMario());
    expect(g.alive).toBe(true);
  });

  it('STOMPED goomba becomes inactive after 30 frames', () => {
    const g = goomba();
    g.onStomp(fakeMario());
    const mario = fakeMario();
    for (let i = 0; i < 30; i++) {
      g.update(floorGrid(), mario, 0);
    }
    expect(g.alive).toBe(false);
    expect(g.active).toBe(false);
  });

  it('STOMPED goomba is still alive at frame 29 (not yet removed)', () => {
    const g = goomba();
    g.onStomp(fakeMario());
    const mario = fakeMario();
    for (let i = 0; i < 29; i++) {
      g.update(floorGrid(), mario, 0);
    }
    expect(g.alive).toBe(true);
  });

  it('onStomp is idempotent when already STOMPED', () => {
    const g = goomba();
    g.onStomp(fakeMario());
    g.goombaState = GoombaState.STOMPED; // already stomped
    g.onStomp(fakeMario()); // should be a no-op
    expect(g.goombaState).toBe(GoombaState.STOMPED);
  });
});

// ─── Fireball kill ────────────────────────────────────────────────────────────

describe('Goomba — onFireball', () => {
  it('onFireball() transitions state to FLIPPED', () => {
    const g = goomba();
    g.onFireball();
    expect(g.goombaState).toBe(GoombaState.FLIPPED);
  });

  it('FLIPPED goomba starts with negative vy (pops upward)', () => {
    const g = goomba();
    g.onFireball();
    expect(g.vy).toBeLessThan(0);
  });

  it('onFireball when already STOMPED: does nothing (early return)', () => {
    const g = goomba();
    g.onStomp(fakeMario());
    expect(g.goombaState).toBe(GoombaState.STOMPED);
    g.onFireball(); // should be no-op because state is STOMPED
    expect(g.goombaState).toBe(GoombaState.STOMPED);
  });

  it('FLIPPED goomba becomes inactive after falling off screen', () => {
    const g = goomba(100);
    g.onFireball();
    // vy starts at -3 (pops upward). Set it positive so goomba falls down.
    g.vy = 5;
    g.y = TILE_SIZE * 20; // exactly at threshold; next update will push past it
    const mario = fakeMario();
    g.update(emptyGrid(), mario, 0);
    // After update: vy += GRAVITY = 5.5, y += 5.5 → y > TILE_SIZE*20 → killed
    expect(g.alive).toBe(false);
    expect(g.active).toBe(false);
  });
});

// ─── Shell hit ────────────────────────────────────────────────────────────────

describe('Goomba — onShell', () => {
  it('onShell() transitions state to FLIPPED', () => {
    const g = goomba();
    g.onShell();
    expect(g.goombaState).toBe(GoombaState.FLIPPED);
  });
});

// ─── damagesMario determination ───────────────────────────────────────────────

describe('Goomba — damagesMario', () => {
  it('WALKING goomba can damage mario (should be treated as dangerous)', () => {
    const g = goomba();
    // Goomba in WALKING state is dangerous
    expect(g.goombaState).toBe(GoombaState.WALKING);
    expect(g.alive).toBe(true);
  });

  it('STOMPED goomba has vx=0 and is harmless (damageable=false)', () => {
    const g = goomba();
    g.onStomp(fakeMario());
    expect(g.goombaState).toBe(GoombaState.STOMPED);
    expect(g.vx).toBe(0); // stopped
  });

  it('FLIPPED goomba is no longer alive after falling off screen', () => {
    const g = goomba();
    g.onFireball();
    // Set vy positive so gravity accumulates and pushes goomba past the kill threshold
    g.vy = 5;
    g.y = TILE_SIZE * 20;
    g.update(emptyGrid(), fakeMario(), 0);
    expect(g.alive).toBe(false); // flipped/dead → not dangerous
  });
});

// ─── getSpriteKey ─────────────────────────────────────────────────────────────

describe('Goomba — getSpriteKey', () => {
  it('returns stomped sprite key when STOMPED', () => {
    const g = goomba();
    g.onStomp(fakeMario());
    expect(g.getSpriteKey()).toBe('goomba_stomped');
  });

  it('returns dead sprite key when FLIPPED', () => {
    const g = goomba();
    g.onFireball();
    expect(g.getSpriteKey()).toBe('goomba_dead');
  });

  it('returns walk sprite key when WALKING', () => {
    const g = goomba();
    expect(g.getSpriteKey()).toMatch(/^goomba_walk/);
  });
});
