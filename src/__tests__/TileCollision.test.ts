/**
 * TileCollision.test.ts
 * Comprehensive tests for AABB tile collision detection and resolution.
 */

import { describe, it, expect } from 'vitest';
import {
  rectsOverlap,
  entitiesOverlap,
  resolvePlayerTileCollision,
  resolveEnemyTileCollision,
  resolveFireballTileCollision,
  isStomping,
  isSideHit,
  isGrounded,
  PhysicsEntity,
  FireballEntity,
  CollisionCallbacks,
} from '../systems/TileCollision';
import { TILE_SIZE, LEVEL_COLS, LEVEL_ROWS } from '../config/constants';
import { TileGrid } from '../types/level';

// ─── Grid Helpers ─────────────────────────────────────────────────────────────

/**
 * Build a TileGrid filled with air, then place solid tiles where specified.
 * Solid tiles are placed as 'G' (ground).
 */
function makeGrid(solidCells: Array<[row: number, col: number]> = []): TileGrid {
  const grid: TileGrid = [];
  for (let r = 0; r < LEVEL_ROWS; r++) {
    grid.push(new Array(LEVEL_COLS).fill('.'));
  }
  for (const [row, col] of solidCells) {
    if (row >= 0 && row < LEVEL_ROWS && col >= 0 && col < LEVEL_COLS) {
      grid[row][col] = 'G';
    }
  }
  return grid;
}

/** Create a minimal PhysicsEntity at given world-space position. */
function makeEntity(x: number, y: number, w = 12, h = 16, vx = 0, vy = 0): PhysicsEntity {
  return { x, y, w, h, vx, vy };
}

// ─── rectsOverlap ─────────────────────────────────────────────────────────────

describe('rectsOverlap', () => {
  it('returns true when rectangles overlap horizontally and vertically', () => {
    expect(rectsOverlap(0, 0, 10, 10, 5, 5, 10, 10)).toBe(true);
  });

  it('returns false when rectangles are separated horizontally', () => {
    expect(rectsOverlap(0, 0, 10, 10, 11, 0, 10, 10)).toBe(false);
  });

  it('returns false when rectangles are separated vertically', () => {
    expect(rectsOverlap(0, 0, 10, 10, 0, 11, 10, 10)).toBe(false);
  });

  it('returns false when rectangles only share an edge (touching but not overlapping)', () => {
    // ax < bx + bw requires ax=0 < 10+10=20 — that is TRUE; but ax+aw > bx requires 0+10 > 10 — FALSE
    expect(rectsOverlap(0, 0, 10, 10, 10, 0, 10, 10)).toBe(false);
  });

  it('returns true when one rect is fully inside the other', () => {
    expect(rectsOverlap(0, 0, 100, 100, 10, 10, 5, 5)).toBe(true);
  });

  it('returns true when rects overlap by 1px horizontally', () => {
    expect(rectsOverlap(0, 0, 10, 10, 9, 0, 10, 10)).toBe(true);
  });
});

// ─── entitiesOverlap ─────────────────────────────────────────────────────────

describe('entitiesOverlap', () => {
  it('returns true when two entities overlap', () => {
    const a = makeEntity(0, 0, 12, 16);
    const b = makeEntity(8, 8, 12, 16);
    expect(entitiesOverlap(a, b)).toBe(true);
  });

  it('returns false when two entities are separated', () => {
    const a = makeEntity(0, 0, 12, 16);
    const b = makeEntity(50, 0, 12, 16);
    expect(entitiesOverlap(a, b)).toBe(false);
  });
});

// ─── resolvePlayerTileCollision ───────────────────────────────────────────────

describe('resolvePlayerTileCollision', () => {
  describe('horizontal resolution', () => {
    it('pushes entity left and zeros vx when moving right into a solid wall', () => {
      // Entity at x=20 moving right with vx=4, solid tile at col=2 (x=32..48)
      const entity = makeEntity(20, 48, 12, 16, 4, 0);
      // Solid tile at col=2, row=3 — entity will move from x=20 to x=24
      const grid = makeGrid([[3, 2]]);
      resolvePlayerTileCollision(entity, grid);
      // After horizontal pass: entity.x should be snapped left of tile at col=2
      expect(entity.vx).toBe(0);
      expect(entity.x).toBe(2 * TILE_SIZE - 12); // colR * TILE_SIZE - w
    });

    it('pushes entity right and zeros vx when moving left into a solid wall', () => {
      // Entity at x=36 moving left vx=-4, solid tile at col=2 (x=32..48)
      // testX = 36 + (-4) = 32, colL = floor(32/16) = 2
      const entity = makeEntity(36, 48, 12, 16, -4, 0);
      const grid = makeGrid([[3, 2]]);
      resolvePlayerTileCollision(entity, grid);
      expect(entity.vx).toBe(0);
      expect(entity.x).toBe((2 + 1) * TILE_SIZE); // (colL+1)*TILE_SIZE
    });

    it('sets result.right true on right-wall hit', () => {
      const entity = makeEntity(20, 48, 12, 16, 4, 0);
      const grid = makeGrid([[3, 2]]);
      const result = resolvePlayerTileCollision(entity, grid);
      expect(result.right).toBe(true);
      expect(result.left).toBe(false);
    });

    it('sets result.left true on left-wall hit', () => {
      const entity = makeEntity(36, 48, 12, 16, -4, 0);
      const grid = makeGrid([[3, 2]]);
      const result = resolvePlayerTileCollision(entity, grid);
      expect(result.left).toBe(true);
      expect(result.right).toBe(false);
    });
  });

  describe('vertical resolution — landing', () => {
    it('snaps entity to tile top and zeros vy when falling onto a tile', () => {
      // Entity at y=40 moving down vy=4 → testY=44, entity bottom = 44+16=60
      // rowB = floor(59/16) = 3, tile at row=3, col=1
      // After horiz pass (vx=0, no horiz collision), x stays, then apply vx (x+=0)
      // Vertical pass with inset: colL=floor((16+2)/16)=1, colR=floor((16+12-3)/16)=1
      const entity = makeEntity(16, 40, 12, 16, 0, 4);
      const grid = makeGrid([[3, 1]]);
      resolvePlayerTileCollision(entity, grid);
      expect(entity.vy).toBe(0);
      expect(entity.y).toBe(3 * TILE_SIZE - 16); // rowB * TILE_SIZE - h
    });

    it('sets result.bottom true when landing', () => {
      const entity = makeEntity(16, 40, 12, 16, 0, 4);
      const grid = makeGrid([[3, 1]]);
      const result = resolvePlayerTileCollision(entity, grid);
      expect(result.bottom).toBe(true);
    });
  });

  describe('vertical resolution — head bump', () => {
    it('snaps entity down and zeros vy when rising into a ceiling tile', () => {
      // Entity at y=20 moving up vy=-4 → testY=16, rowT=floor(16/16)=1
      // Solid tile at row=1, col=1
      const entity = makeEntity(16, 20, 12, 16, 0, -4);
      const grid = makeGrid([[1, 1]]);
      resolvePlayerTileCollision(entity, grid);
      expect(entity.vy).toBe(0);
      expect(entity.y).toBe((1 + 1) * TILE_SIZE); // (rowT+1)*TILE_SIZE
    });

    it('sets result.top true on head bump', () => {
      const entity = makeEntity(16, 20, 12, 16, 0, -4);
      const grid = makeGrid([[1, 1]]);
      const result = resolvePlayerTileCollision(entity, grid);
      expect(result.top).toBe(true);
    });
  });

  describe('air tile — no resolution', () => {
    it('does not modify entity when grid has no solid tiles', () => {
      const entity = makeEntity(16, 40, 12, 16, 3, 4);
      const grid = makeGrid();
      resolvePlayerTileCollision(entity, grid);
      expect(entity.vx).toBe(3); // vx unchanged
      expect(entity.vy).toBe(4); // vy unchanged
    });
  });

  describe('callbacks', () => {
    it('calls onBottomHit when landing on a tile', () => {
      const entity = makeEntity(16, 40, 12, 16, 0, 4);
      const grid = makeGrid([[3, 1]]);
      let called = false;
      const callbacks: CollisionCallbacks = {
        onBottomHit: (_col, _row) => { called = true; },
      };
      resolvePlayerTileCollision(entity, grid, callbacks);
      expect(called).toBe(true);
    });

    it('calls onTopHit when bumping head on a ceiling', () => {
      const entity = makeEntity(16, 20, 12, 16, 0, -4);
      const grid = makeGrid([[1, 1]]);
      let called = false;
      const callbacks: CollisionCallbacks = {
        onTopHit: (_col, _row) => { called = true; },
      };
      resolvePlayerTileCollision(entity, grid, callbacks);
      expect(called).toBe(true);
    });

    it('calls onRightHit when hitting a right wall', () => {
      const entity = makeEntity(20, 48, 12, 16, 4, 0);
      const grid = makeGrid([[3, 2]]);
      let called = false;
      const callbacks: CollisionCallbacks = {
        onRightHit: (_col, _row) => { called = true; },
      };
      resolvePlayerTileCollision(entity, grid, callbacks);
      expect(called).toBe(true);
    });

    it('calls onLeftHit when hitting a left wall', () => {
      const entity = makeEntity(36, 48, 12, 16, -4, 0);
      const grid = makeGrid([[3, 2]]);
      let called = false;
      const callbacks: CollisionCallbacks = {
        onLeftHit: (_col, _row) => { called = true; },
      };
      resolvePlayerTileCollision(entity, grid, callbacks);
      expect(called).toBe(true);
    });
  });

  describe('horizontal resolved before vertical', () => {
    it('horizontal vx is zeroed before vertical pass runs when hitting both a wall and floor', () => {
      // Entity moving right AND down, solid tile at both right column and below
      const entity = makeEntity(20, 40, 12, 16, 4, 4);
      // col=2 (right wall) AND row=3 col=1 (floor)
      const grid = makeGrid([[3, 2], [3, 1]]);
      const result = resolvePlayerTileCollision(entity, grid);
      // Both should be resolved
      expect(entity.vx).toBe(0);
      expect(entity.vy).toBe(0);
      expect(result.right).toBe(true);
      expect(result.bottom).toBe(true);
    });
  });

  describe('no collision when no movement', () => {
    it('returns all false when entity is stationary and not overlapping tiles', () => {
      const entity = makeEntity(16, 40, 12, 16, 0, 0);
      const grid = makeGrid();
      const result = resolvePlayerTileCollision(entity, grid);
      expect(result.left).toBe(false);
      expect(result.right).toBe(false);
      expect(result.top).toBe(false);
      expect(result.bottom).toBe(false);
    });
  });
});

// ─── resolveEnemyTileCollision ────────────────────────────────────────────────

describe('resolveEnemyTileCollision', () => {
  function makeEnemy(x: number, y: number, vx: number, vy: number, reverseOnWall: boolean) {
    return { x, y, w: 14, h: 14, vx, vy, reverseOnWall };
  }

  it('reverses enemy vx (negates) when it hits a right wall and reverseOnWall=true', () => {
    // Enemy at x=18 vx=1, solid tile at col=2 (x=32)
    // testX=19, colR=floor((19+14-1)/16)=floor(32/16)=2
    const enemy = makeEnemy(18, 48, 1, 0, true);
    const grid = makeGrid([[3, 2]]);
    resolveEnemyTileCollision(enemy, grid);
    expect(enemy.vx).toBe(-1);
  });

  it('reverses enemy vx when it hits a left wall and reverseOnWall=true', () => {
    // Enemy at x=34 vx=-1, testX=33, colL=floor(33/16)=2, solid at col=2
    const enemy = makeEnemy(34, 48, -1, 0, true);
    const grid = makeGrid([[3, 2]]);
    resolveEnemyTileCollision(enemy, grid);
    expect(enemy.vx).toBe(1);
  });

  it('zeros vx on wall hit when reverseOnWall=false', () => {
    const enemy = makeEnemy(18, 48, 1, 0, false);
    const grid = makeGrid([[3, 2]]);
    resolveEnemyTileCollision(enemy, grid);
    expect(enemy.vx).toBe(0);
  });

  it('snaps enemy down and zeros vy when falling onto a solid tile', () => {
    // Enemy at y=40 vy=4, testY=44, rowB=floor((44+14-1)/16)=3, solid at row=3 col=1
    const enemy = makeEnemy(16, 40, 0, 4, true);
    const grid = makeGrid([[3, 1]]);
    resolveEnemyTileCollision(enemy, grid);
    expect(enemy.vy).toBe(0);
    expect(enemy.y).toBe(3 * TILE_SIZE - 14);
  });

  it('sets result.right true when enemy hits right wall', () => {
    const enemy = makeEnemy(18, 48, 1, 0, true);
    const grid = makeGrid([[3, 2]]);
    const result = resolveEnemyTileCollision(enemy, grid);
    expect(result.right).toBe(true);
    expect(result.left).toBe(false);
  });

  it('sets result.left true when enemy hits left wall', () => {
    const enemy = makeEnemy(34, 48, -1, 0, true);
    const grid = makeGrid([[3, 2]]);
    const result = resolveEnemyTileCollision(enemy, grid);
    expect(result.left).toBe(true);
    expect(result.right).toBe(false);
  });

  it('sets result.bottom true when enemy lands', () => {
    const enemy = makeEnemy(16, 40, 0, 4, true);
    const grid = makeGrid([[3, 1]]);
    const result = resolveEnemyTileCollision(enemy, grid);
    expect(result.bottom).toBe(true);
  });
});

// ─── resolveFireballTileCollision ─────────────────────────────────────────────

describe('resolveFireballTileCollision', () => {
  function makeFireball(x: number, y: number, vx: number, vy: number): FireballEntity {
    return { x, y, w: 8, h: 8, vx, vy, bounces: 0, alive: true };
  }

  it('bounces off the floor (negates vy, increments bounces), entity remains alive', () => {
    // Fireball at y=40 vy=4, floor tile at row=3 col=1
    const fb = makeFireball(16, 40, 4, 4);
    const grid = makeGrid([[3, 1]]);
    resolveFireballTileCollision(fb, grid, 5);
    expect(fb.bounces).toBe(1);
    expect(fb.vy).toBeLessThan(0); // vy was negated (bounce)
    expect(fb.alive).toBe(true);
  });

  it('kills fireball when it hits a wall (alive = false)', () => {
    // Fireball at x=30 vx=6 w=8: testX=36, colR=floor((36+8-1)/16)=floor(43/16)=2
    // Solid at col=2, row=3. Fireball at y=48 → rowT=3, rowB=3
    const fb = makeFireball(30, 48, 6, 0);
    const grid = makeGrid([[3, 2]]);
    resolveFireballTileCollision(fb, grid, 5);
    expect(fb.alive).toBe(false);
  });

  it('kills fireball when it hits a ceiling (alive = false)', () => {
    // Fireball at y=20 vy=-4, ceiling tile at row=1 col=1
    const fb = makeFireball(16, 20, 0, -4);
    const grid = makeGrid([[1, 1]]);
    resolveFireballTileCollision(fb, grid, 5);
    expect(fb.alive).toBe(false);
  });

  it('kills fireball when maxBounces is reached', () => {
    // Already at max-1 bounces, hits floor → reaches max → alive=false
    const fb = makeFireball(16, 40, 4, 4);
    fb.bounces = 4;
    const grid = makeGrid([[3, 1]]);
    resolveFireballTileCollision(fb, grid, 5);
    expect(fb.alive).toBe(false);
    expect(fb.bounces).toBe(5);
  });

  it('does not bounce when grid is empty', () => {
    const fb = makeFireball(16, 40, 4, 4);
    const grid = makeGrid();
    resolveFireballTileCollision(fb, grid, 5);
    expect(fb.bounces).toBe(0);
    expect(fb.alive).toBe(true);
  });

  it('vy after bounce is reduced (0.75 factor applied)', () => {
    const fb = makeFireball(16, 40, 4, 4);
    const grid = makeGrid([[3, 1]]);
    resolveFireballTileCollision(fb, grid, 5);
    expect(Math.abs(fb.vy)).toBeCloseTo(4 * 0.75, 5);
  });
});

// ─── isStomping ───────────────────────────────────────────────────────────────

describe('isStomping', () => {
  /**
   * Mario entity wrapper — vy is on the entity itself.
   * mario.y + mario.h = marioBottom.
   * enemy: y=100, h=20 → enemyTop=100, enemyCenterY=110.
   */
  function makeMario(x: number, y: number, vy: number): PhysicsEntity & { vy: number } {
    return { x, y, w: 12, h: 16, vx: 0, vy };
  }

  function makeEnemy(x: number, y: number): PhysicsEntity {
    return { x, y, w: 14, h: 20, vx: 0, vy: 0 };
  }

  // Enemy at x=50 y=100 h=20: top=100, centerY=110
  // Mario at x=52 w=12 → right=64. enemy x=50 right=64.
  // Horizontal overlap: marioRight(64) > enemyX+1(51) AND marioX(52) < enemyRight-1(63) → TRUE

  it('returns true when mario is falling, bottom is between enemy top and center', () => {
    // mario.y=86, h=16 → bottom=102; vy=3
    // enemyTop=100, enemyCenterY=110
    // 102 > 100 AND 102 < 110 → stomp
    const mario = makeMario(52, 86, 3);
    const enemy = makeEnemy(50, 100);
    expect(isStomping(mario, enemy)).toBe(true);
  });

  it('returns false when mario.vy <= 0 (not falling)', () => {
    const mario = makeMario(52, 86, 0);
    const enemy = makeEnemy(50, 100);
    expect(isStomping(mario, enemy)).toBe(false);
  });

  it('returns false when mario is above enemy (bottom <= enemy top)', () => {
    // mario bottom = 100 exactly (at boundary)
    const mario = makeMario(52, 84, 3); // y=84, h=16 → bottom=100
    const enemy = makeEnemy(50, 100);   // enemyTop=100
    // marioBottom(100) <= enemyTop(100) → false
    expect(isStomping(mario, enemy)).toBe(false);
  });

  it('returns false when mario bottom is at enemy center (boundary)', () => {
    // mario bottom = 110 exactly (at enemyCenterY)
    const mario = makeMario(52, 94, 3); // y=94, h=16 → bottom=110
    const enemy = makeEnemy(50, 100);   // enemyCenterY=110
    // marioBottom(110) >= enemyCenterY(110) → false
    expect(isStomping(mario, enemy)).toBe(false);
  });

  it('returns false when mario bottom is below enemy center (side hit)', () => {
    // mario bottom = 115 (past center)
    const mario = makeMario(52, 99, 3);
    const enemy = makeEnemy(50, 100);
    expect(isStomping(mario, enemy)).toBe(false);
  });

  it('returns true at exact boundary: mario bottom just 1px below enemy top', () => {
    // marioBottom = 101 (just past enemyTop=100), vy > 0
    const mario = makeMario(52, 85, 3); // y=85, h=16 → bottom=101
    const enemy = makeEnemy(50, 100);
    expect(isStomping(mario, enemy)).toBe(true);
  });

  it('returns true at boundary: mario bottom just 1px above enemy center', () => {
    // enemyCenterY=110, marioBottom=109
    const mario = makeMario(52, 93, 3); // y=93, h=16 → bottom=109
    const enemy = makeEnemy(50, 100);
    expect(isStomping(mario, enemy)).toBe(true);
  });

  it('returns false when there is no horizontal overlap', () => {
    // Mario far to the right
    const mario = makeMario(200, 86, 3);
    const enemy = makeEnemy(50, 100);
    expect(isStomping(mario, enemy)).toBe(false);
  });

  it('returns false when mario.vy is exactly 0 (boundary)', () => {
    const mario = makeMario(52, 86, 0);
    const enemy = makeEnemy(50, 100);
    expect(isStomping(mario, enemy)).toBe(false);
  });

  it('returns true when mario.vy is 0.001 (just above zero boundary)', () => {
    const mario = makeMario(52, 86, 0.001);
    const enemy = makeEnemy(50, 100);
    expect(isStomping(mario, enemy)).toBe(true);
  });
});

// ─── isSideHit ────────────────────────────────────────────────────────────────

describe('isSideHit', () => {
  it('returns true when entities overlap and it is not a stomp', () => {
    // Mario falling from above with negative vy OR overlapping from the side
    const mario: PhysicsEntity = { x: 50, y: 100, w: 12, h: 16, vx: 2, vy: -1 };
    const enemy: PhysicsEntity = { x: 55, y: 100, w: 14, h: 20, vx: 0, vy: 0 };
    // They overlap and mario.vy <= 0, so isStomping=false
    expect(isSideHit(mario, enemy)).toBe(true);
  });

  it('returns false when entities do not overlap', () => {
    const mario: PhysicsEntity = { x: 0, y: 0, w: 12, h: 16, vx: 0, vy: 3 };
    const enemy: PhysicsEntity = { x: 100, y: 0, w: 14, h: 20, vx: 0, vy: 0 };
    expect(isSideHit(mario, enemy)).toBe(false);
  });

  it('returns false when mario is stomping (overlap exists but is stomp)', () => {
    // mario bottom = 102, vy=3, enemy top=100, center=110
    const mario: PhysicsEntity = { x: 52, y: 86, w: 12, h: 16, vx: 0, vy: 3 };
    const enemy: PhysicsEntity = { x: 50, y: 100, w: 14, h: 20, vx: 0, vy: 0 };
    expect(isSideHit(mario, enemy)).toBe(false);
  });
});

// ─── isGrounded ───────────────────────────────────────────────────────────────

describe('isGrounded', () => {
  it('returns true when a solid tile is directly below entity feet', () => {
    // Entity at y=32 h=16, feet at y=48 → row=floor(48/16)=3, solid at row=3 col=1
    const entity = makeEntity(16, 32, 12, 16);
    const grid = makeGrid([[3, 1]]);
    expect(isGrounded(entity, grid)).toBe(true);
  });

  it('returns false when no solid tile is below entity', () => {
    const entity = makeEntity(16, 32, 12, 16);
    const grid = makeGrid();
    expect(isGrounded(entity, grid)).toBe(false);
  });

  it('returns false when solid tile is two rows below (not adjacent)', () => {
    const entity = makeEntity(16, 32, 12, 16); // feet at row=3
    const grid = makeGrid([[5, 1]]);            // solid two rows below
    expect(isGrounded(entity, grid)).toBe(false);
  });
});
