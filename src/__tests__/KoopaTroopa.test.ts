/**
 * KoopaTroopa.test.ts
 * Tests for KoopaTroopa enemy state machine, shell kicking, and revival.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { KoopaTroopa } from '../entities/enemies/KoopaTroopa';
import { KoopaState } from '../types/entities';
import { KOOPA_SPEED, KOOPA_SHELL_SPEED } from '../config/physics';
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

function floorGrid(): TileGrid {
  const grid = emptyGrid();
  for (let c = 0; c < 224; c++) {
    grid[14][c] = 'G';
  }
  return grid;
}

function fakeMario(x = 500): Mario {
  return new Mario(x, 208);
}

function koopa(x = 100): KoopaTroopa {
  const k = new KoopaTroopa(x, 202); // y: 224 - 22 = 202 on floor
  k.active = true;
  return k;
}

// ─── Initial state ────────────────────────────────────────────────────────────

describe('KoopaTroopa — initial state', () => {
  it('starts in WALKING state', () => {
    const k = koopa();
    expect(k.koopaState).toBe(KoopaState.WALKING);
  });

  it('starts moving left at KOOPA_SPEED', () => {
    const k = koopa();
    expect(k.vx).toBe(-KOOPA_SPEED);
  });

  it('starts alive', () => {
    const k = koopa();
    expect(k.alive).toBe(true);
  });

  it('has reverseOnWall = false (turns at ledges, not walls)', () => {
    const k = koopa();
    expect(k.reverseOnWall).toBe(false);
  });

  it('facing starts as -1 (left)', () => {
    const k = koopa();
    expect(k.facing).toBe(-1);
  });
});

// ─── Stomp — walking → shell ──────────────────────────────────────────────────

describe('KoopaTroopa — stomp while WALKING', () => {
  it('stomp while WALKING transitions to SHELL state', () => {
    const k = koopa();
    k.onStomp(fakeMario());
    expect(k.koopaState).toBe(KoopaState.SHELL);
  });

  it('stomp while WALKING sets vx = 0', () => {
    const k = koopa();
    k.onStomp(fakeMario());
    expect(k.vx).toBe(0);
  });

  it('stomp while WALKING reduces height to 14 (shell is 1 tile)', () => {
    const k = koopa();
    k.onStomp(fakeMario());
    expect(k.h).toBe(14);
  });

  it('stomp while WALKING sets shellStillTimer to SHELL_WAKE_FRAMES', () => {
    const k = koopa();
    k.onStomp(fakeMario());
    expect(k.shellStillTimer).toBe(300); // SHELL_WAKE_FRAMES = 300
  });
});

// ─── Stomp — shell still → kick ───────────────────────────────────────────────

describe('KoopaTroopa — stomp while SHELL (kick)', () => {
  it('kick from left (mario on left of shell) → shell moves right', () => {
    const k = koopa(100);
    k.onStomp(fakeMario(500)); // become SHELL
    expect(k.koopaState).toBe(KoopaState.SHELL);
    // Mario is to the LEFT of shell (mario.x=30 < koopa.centerX=100+7=107)
    const marioLeft = new Mario(30, 208);
    k.onStomp(marioLeft);
    expect(k.koopaState).toBe(KoopaState.SLIDING);
    expect(k.vx).toBeGreaterThan(0); // moves right
  });

  it('kick from right (mario on right of shell) → shell moves left', () => {
    const k = koopa(100);
    k.onStomp(fakeMario(30)); // become SHELL
    // Mario is to the RIGHT of shell
    const marioRight = new Mario(200, 208);
    k.onStomp(marioRight);
    expect(k.koopaState).toBe(KoopaState.SLIDING);
    expect(k.vx).toBeLessThan(0); // moves left
  });

  it('kick gives shell KOOPA_SHELL_SPEED', () => {
    const k = koopa(100);
    k.onStomp(fakeMario(500));
    const marioLeft = new Mario(30, 208);
    k.onStomp(marioLeft);
    expect(Math.abs(k.vx)).toBe(KOOPA_SHELL_SPEED);
  });
});

// ─── Shell revival ────────────────────────────────────────────────────────────

describe('KoopaTroopa — shell revival after 300 frames', () => {
  it('SHELL_STILL after 300 frames transitions back to WALKING', () => {
    const k = koopa(100);
    k.onStomp(fakeMario());
    expect(k.koopaState).toBe(KoopaState.SHELL);
    const mario = fakeMario();
    // Each update decrements shellStillTimer; at <= 0 it wakes up
    for (let i = 0; i < 300; i++) {
      k.update(floorGrid(), mario, 0);
    }
    expect(k.koopaState).toBe(KoopaState.WALKING);
  });

  it('SHELL does NOT wake up at 299 frames', () => {
    const k = koopa(100);
    k.onStomp(fakeMario());
    const mario = fakeMario();
    for (let i = 0; i < 299; i++) {
      k.update(floorGrid(), mario, 0);
    }
    expect(k.koopaState).toBe(KoopaState.SHELL);
  });

  it('woken koopa returns to walking speed at KOOPA_SPEED', () => {
    const k = koopa(100);
    k.onStomp(fakeMario());
    const mario = fakeMario();
    for (let i = 0; i < 300; i++) {
      k.update(floorGrid(), mario, 0);
    }
    expect(Math.abs(k.vx)).toBe(KOOPA_SPEED);
  });

  it('SHELL_STILL + stomp (before 300 frames) → kicks the shell, does not wake', () => {
    const k = koopa(100);
    k.onStomp(fakeMario(500)); // become SHELL
    // Stomp again quickly (not after 300 frames)
    const marioLeft = new Mario(30, 208);
    k.onStomp(marioLeft); // should kick, not wake
    expect(k.koopaState).toBe(KoopaState.SLIDING);
  });
});

// ─── Fireball kill ────────────────────────────────────────────────────────────

describe('KoopaTroopa — onFireball', () => {
  it('WALKING + onFireball → FLIPPED state', () => {
    const k = koopa();
    k.onFireball();
    expect(k.koopaState).toBe(KoopaState.FLIPPED);
  });

  it('FLIPPED koopa has negative vy (pops upward)', () => {
    const k = koopa();
    k.onFireball();
    expect(k.vy).toBeLessThan(0);
  });

  it('FLIPPED koopa becomes inactive after falling off screen', () => {
    const k = koopa();
    k.onFireball();
    // vy starts at -4 (pops upward). Set it positive so koopa falls down.
    k.vy = 5;
    k.y = TILE_SIZE * 20; // exactly at threshold; next update pushes past it
    k.update(emptyGrid(), fakeMario(), 0);
    // After update: vy += GRAVITY, y += vy → y > TILE_SIZE*20 → killed
    expect(k.alive).toBe(false);
    expect(k.active).toBe(false);
  });
});

// ─── Shell hit ────────────────────────────────────────────────────────────────

describe('KoopaTroopa — onShell', () => {
  it('onShell → FLIPPED state', () => {
    const k = koopa();
    k.onShell();
    expect(k.koopaState).toBe(KoopaState.FLIPPED);
  });
});

// ─── damagesMario ────────────────────────────────────────────────────────────

describe('KoopaTroopa — damage states', () => {
  it('WALKING koopa is alive and dangerous', () => {
    const k = koopa();
    expect(k.koopaState).toBe(KoopaState.WALKING);
    expect(k.alive).toBe(true);
  });

  it('SHELL koopa has vx=0 and is not actively harmful to walk', () => {
    const k = koopa();
    k.onStomp(fakeMario());
    expect(k.koopaState).toBe(KoopaState.SHELL);
    expect(k.vx).toBe(0);
  });

  it('FLIPPED koopa is not alive once it falls off screen', () => {
    const k = koopa();
    k.onFireball();
    k.vy = 5; // ensure positive vy so it falls past threshold
    k.y = TILE_SIZE * 20;
    k.update(emptyGrid(), fakeMario(), 0);
    expect(k.alive).toBe(false);
  });
});

// ─── Shell chain kill points ──────────────────────────────────────────────────

describe('KoopaTroopa — shellChainKillPoints', () => {
  it('starts at 200 for first chain kill', () => {
    const k = koopa();
    expect(k.shellChainKillPoints()).toBe(200);
  });

  it('doubles on second kill (200 → 400)', () => {
    const k = koopa();
    k.shellChainKillPoints(); // 200
    expect(k.shellChainKillPoints()).toBe(400);
  });

  it('caps at 8000 for very long chains', () => {
    const k = koopa();
    for (let i = 0; i < 10; i++) k.shellChainKillPoints();
    expect(k.shellChainKillPoints()).toBe(8000);
  });
});

// ─── getSpriteKey ─────────────────────────────────────────────────────────────

describe('KoopaTroopa — getSpriteKey', () => {
  it('returns shell sprite key when SHELL', () => {
    const k = koopa();
    k.onStomp(fakeMario());
    expect(k.getSpriteKey()).toBe('koopa_shell');
  });

  it('returns dead sprite key when FLIPPED', () => {
    const k = koopa();
    k.onFireball();
    expect(k.getSpriteKey()).toBe('koopa_dead');
  });

  it('returns walk sprite key when WALKING', () => {
    const k = koopa();
    expect(k.getSpriteKey()).toMatch(/^koopa_walk/);
  });

  it('returns slide sprite key when SLIDING', () => {
    const k = koopa(100);
    k.onStomp(fakeMario(500));
    const marioLeft = new Mario(30, 208);
    k.onStomp(marioLeft);
    expect(k.getSpriteKey()).toMatch(/^koopa_shell_slide/);
  });
});
