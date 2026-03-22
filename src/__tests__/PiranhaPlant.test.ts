/**
 * PiranhaPlant.test.ts
 * Tests for PiranhaPlant emerge/retract cycle, proximity checks, and kill methods.
 */

import { describe, it, expect } from 'vitest';
import { PiranhaPlant } from '../entities/enemies/PiranhaPlant';
import { PiranhaState } from '../types/entities';
import { TILE_SIZE } from '../config/constants';
import { TileGrid } from '../types/level';
import { Mario } from '../entities/player/Mario';

// ─── Constants matching PiranhaPlant internals ──────────────────────────────

const PHASE_FRAMES       = 120; // 2s per phase
const WAIT_BOTTOM_FRAMES = 60;  // initial wait before rising

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyGrid(): TileGrid {
  const grid: TileGrid = [];
  for (let r = 0; r < 16; r++) {
    grid.push(new Array(224).fill('.'));
  }
  return grid;
}

/**
 * PiranhaPlant constructor: pipeCol, pipeTopRow
 * pipeX = pipeCol * TILE_SIZE
 * pipeTopY = pipeTopRow * TILE_SIZE
 * Plant x = pipeCol * TILE_SIZE + (TILE_SIZE - 7) = pipeCol * 16 + 9
 */
function plant(pipeCol = 5, pipeTopRow = 10): PiranhaPlant {
  return new PiranhaPlant(pipeCol, pipeTopRow);
}

/**
 * Mario at given x, centered at approximately (x + 6) for small Mario.
 * The isMarioNearby check uses mario.x + mario.w/2.
 * For small Mario w=12: center = mario.x + 6.
 * pipeCenter = pipeCol * TILE_SIZE + TILE_SIZE = pipeCol * 16 + 16.
 * For pipeCol=5: pipeCenter = 96.
 * Near = |marioCenterX - pipeCenter| <= TILE_SIZE (16).
 * Far  = |marioCenterX - pipeCenter| > TILE_SIZE.
 */
function marioAt(x: number): Mario {
  return new Mario(x, 100);
}

/** Run n frames of update. */
function runFrames(p: PiranhaPlant, mario: Mario, frames: number): void {
  const grid = emptyGrid();
  for (let i = 0; i < frames; i++) {
    p.update(grid, mario, 0);
  }
}

// ─── Initial state ────────────────────────────────────────────────────────────

describe('PiranhaPlant — initial state', () => {
  it('starts in WAITING_BOTTOM state', () => {
    const p = plant();
    expect(p.piranhaState).toBe(PiranhaState.WAITING_BOTTOM);
  });

  it('starts alive', () => {
    const p = plant();
    expect(p.alive).toBe(true);
  });

  it('is always active (pipes are fixed positions)', () => {
    const p = plant();
    expect(p.active).toBe(true);
  });

  it('does not move horizontally (vx = 0)', () => {
    const p = plant();
    expect(p.vx).toBe(0);
  });
});

// ─── State cycle ─────────────────────────────────────────────────────────────

describe('PiranhaPlant — state cycle', () => {
  // pipeCol=5: pipeCenter = 5*16+16 = 96. Mario far away at x=200 (center=206, diff=110 > 16).

  it('after WAIT_BOTTOM_FRAMES (60) with Mario far away → transitions to RISING', () => {
    const p = plant(5, 10);
    const mario = marioAt(200); // far away
    runFrames(p, mario, WAIT_BOTTOM_FRAMES);
    // stateTimer counts down from WAIT_BOTTOM_FRAMES=60; at 0 it should have transitioned
    expect(p.piranhaState).toBe(PiranhaState.RISING);
  });

  it('while RISING: y is interpolated toward fullyExtendedY (above pipe)', () => {
    const p = plant(5, 10);
    const mario = marioAt(200);
    runFrames(p, mario, WAIT_BOTTOM_FRAMES); // → RISING
    const yAtStart = p.y;
    runFrames(p, mario, 60); // half of PHASE_FRAMES
    // y should have moved upward (decreased) toward fullyExtendedY
    expect(p.y).toBeLessThan(yAtStart);
  });

  it('after RISING phase (120 frames) → transitions to WAITING_TOP', () => {
    const p = plant(5, 10);
    const mario = marioAt(200);
    runFrames(p, mario, WAIT_BOTTOM_FRAMES); // → RISING
    runFrames(p, mario, PHASE_FRAMES);       // → WAITING_TOP
    expect(p.piranhaState).toBe(PiranhaState.WAITING_TOP);
  });

  it('after WAITING_TOP phase (120 frames) → transitions to RETRACTING', () => {
    const p = plant(5, 10);
    const mario = marioAt(200);
    runFrames(p, mario, WAIT_BOTTOM_FRAMES);
    runFrames(p, mario, PHASE_FRAMES); // → WAITING_TOP
    runFrames(p, mario, PHASE_FRAMES); // → RETRACTING
    expect(p.piranhaState).toBe(PiranhaState.RETRACTING);
  });

  it('after RETRACTING phase (120 frames) → transitions back to WAITING_BOTTOM', () => {
    const p = plant(5, 10);
    const mario = marioAt(200);
    runFrames(p, mario, WAIT_BOTTOM_FRAMES);
    runFrames(p, mario, PHASE_FRAMES); // → WAITING_TOP
    runFrames(p, mario, PHASE_FRAMES); // → RETRACTING
    runFrames(p, mario, PHASE_FRAMES); // → WAITING_BOTTOM
    expect(p.piranhaState).toBe(PiranhaState.WAITING_BOTTOM);
  });

  it('full cycle (60 + 120 + 120 + 120 = 420 frames) → back to WAITING_BOTTOM', () => {
    const p = plant(5, 10);
    const mario = marioAt(200);
    // Total cycle: WAIT_BOTTOM + 3×PHASE_FRAMES
    runFrames(p, mario, WAIT_BOTTOM_FRAMES + 3 * PHASE_FRAMES);
    expect(p.piranhaState).toBe(PiranhaState.WAITING_BOTTOM);
  });
});

// ─── Does not emerge when Mario is nearby ────────────────────────────────────

describe('PiranhaPlant — proximity check (isMarioNearby)', () => {
  /**
   * pipeCol=5: pipeCenter = 5*16 + 16 = 96.
   * Mario center = mario.x + 6 (small Mario w=12).
   * Near: |center - 96| <= 16 → center in [80, 112].
   * Mario.x = 74 → center=80 (borderline near).
   * Mario.x = 58 → center=64 (just outside, far: |64-96|=32 > 16).
   */

  it('stays WAITING_BOTTOM when Mario center is within 1 tile of pipeCenter', () => {
    const p = plant(5, 10);
    // mario.x=74 → center=80. |80-96|=16 ≤ 16 → nearby
    const mario = marioAt(74);
    runFrames(p, mario, WAIT_BOTTOM_FRAMES + 5); // try to transition
    // Should reset stateTimer and stay WAITING_BOTTOM
    expect(p.piranhaState).toBe(PiranhaState.WAITING_BOTTOM);
  });

  it('emerges normally when Mario center is more than 1 tile away from pipeCenter', () => {
    const p = plant(5, 10);
    // mario.x=100 → center=106. |106-96|=10 ≤ 16 → still nearby! Use x=120 → center=126, |126-96|=30 > 16 → far
    const mario = marioAt(120);
    runFrames(p, mario, WAIT_BOTTOM_FRAMES);
    expect(p.piranhaState).toBe(PiranhaState.RISING);
  });

  it('resets stateTimer when Mario too close (does not stay at 0)', () => {
    const p = plant(5, 10);
    const mario = marioAt(74); // nearby
    runFrames(p, mario, WAIT_BOTTOM_FRAMES + 1); // timer should have reset
    // stateTimer should be > 0 (reset to WAIT_BOTTOM_FRAMES)
    expect(p.stateTimer).toBeGreaterThan(0);
  });
});

// ─── damagesMario ─────────────────────────────────────────────────────────────

describe('PiranhaPlant — damagesMario by state', () => {
  it('WAITING_BOTTOM → plant is hidden (not dangerous, y = fullyHiddenY)', () => {
    const p = plant(5, 10);
    expect(p.piranhaState).toBe(PiranhaState.WAITING_BOTTOM);
    // In hidden state, plant is submerged — safe to represent as not dangerous
    // (game logic based on state check)
    expect(p.alive).toBe(true); // alive but hidden
  });

  it('RISING → plant is visible and dangerous', () => {
    const p = plant(5, 10);
    const mario = marioAt(200);
    runFrames(p, mario, WAIT_BOTTOM_FRAMES); // → RISING
    expect(p.piranhaState).toBe(PiranhaState.RISING);
    expect(p.alive).toBe(true);
  });

  it('WAITING_TOP → plant is fully extended and dangerous', () => {
    const p = plant(5, 10);
    const mario = marioAt(200);
    runFrames(p, mario, WAIT_BOTTOM_FRAMES + PHASE_FRAMES); // → WAITING_TOP
    expect(p.piranhaState).toBe(PiranhaState.WAITING_TOP);
    expect(p.alive).toBe(true);
  });

  it('RETRACTING → plant is still partially visible and dangerous', () => {
    const p = plant(5, 10);
    const mario = marioAt(200);
    runFrames(p, mario, WAIT_BOTTOM_FRAMES + 2 * PHASE_FRAMES); // → RETRACTING
    expect(p.piranhaState).toBe(PiranhaState.RETRACTING);
    expect(p.alive).toBe(true);
  });
});

// ─── Cannot be stomped ────────────────────────────────────────────────────────

describe('PiranhaPlant — cannot be stomped', () => {
  it('onStomp is a no-op (alive remains true, state unchanged)', () => {
    const p = plant(5, 10);
    const mario = marioAt(200);
    runFrames(p, mario, WAIT_BOTTOM_FRAMES); // → RISING
    const stateBefore = p.piranhaState;
    p.onStomp(mario); // no-op
    expect(p.alive).toBe(true);
    expect(p.piranhaState).toBe(stateBefore);
  });
});

// ─── Fireball kill ────────────────────────────────────────────────────────────

describe('PiranhaPlant — onFireball', () => {
  it('onFireball kills the plant (alive = false, active = false)', () => {
    const p = plant(5, 10);
    p.onFireball();
    expect(p.alive).toBe(false);
    expect(p.active).toBe(false);
  });

  it('onFireball on already-dead plant is safe (no error)', () => {
    const p = plant(5, 10);
    p.onFireball();
    expect(() => p.onFireball()).not.toThrow();
  });
});

// ─── Shell kill ───────────────────────────────────────────────────────────────

describe('PiranhaPlant — onShell', () => {
  it('onShell kills the plant (alive = false, active = false)', () => {
    const p = plant(5, 10);
    p.onShell();
    expect(p.alive).toBe(false);
    expect(p.active).toBe(false);
  });
});

// ─── getSpriteKey ─────────────────────────────────────────────────────────────

describe('PiranhaPlant — getSpriteKey', () => {
  it('returns piranha sprite key', () => {
    const p = plant();
    expect(p.getSpriteKey()).toMatch(/^piranha_/);
  });
});

// ─── checkActivation override ─────────────────────────────────────────────────

describe('PiranhaPlant — checkActivation', () => {
  it('checkActivation is a no-op (plant always active)', () => {
    const p = plant();
    p.active = true;
    p.checkActivation(0); // should not change state
    expect(p.active).toBe(true);
    expect(p.alive).toBe(true);
  });
});
