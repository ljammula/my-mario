/**
 * TileCollision.ts
 * AABB tile collision detection and resolution for Super Mario Bros v2.
 * Ported directly from js/collision.js with full TypeScript types.
 *
 * Strategy: separate horizontal-then-vertical passes.
 * The 2px horizontal inset on the vertical pass prevents corner-catching.
 */

import { TILE_SIZE, SOLID_TILES, TILE, LEVEL_COLS, LEVEL_ROWS } from '../config/constants';
import { TileGrid } from '../types/level';

// ─── Public Interfaces ────────────────────────────────────────────────────────

export interface CollisionResult {
  left:   boolean;
  right:  boolean;
  top:    boolean;
  bottom: boolean;
}

export interface CollisionCallbacks {
  onBottomHit?: (col: number, row: number) => void;
  onTopHit?:    (col: number, row: number) => void;
  onLeftHit?:   (col: number, row: number) => void;
  onRightHit?:  (col: number, row: number) => void;
}

export interface PhysicsEntity {
  x:  number;
  y:  number;
  w:  number;
  h:  number;
  vx: number;
  vy: number;
}

export interface FireballEntity extends PhysicsEntity {
  bounces: number;
  alive:   boolean;
}

// ─── Tile Grid Utilities ──────────────────────────────────────────────────────

/**
 * Get the tile ID at grid position (col, row).
 * Returns TILE.EMPTY if out of bounds.
 */
function getTile(grid: TileGrid, col: number, row: number): string {
  if (col < 0 || col >= LEVEL_COLS || row < 0 || row >= LEVEL_ROWS) return TILE.EMPTY;
  return grid[row]?.[col] ?? TILE.EMPTY;
}

/** Return true if the tile at (col, row) is solid. */
function isSolid(grid: TileGrid, col: number, row: number): boolean {
  return SOLID_TILES.has(getTile(grid, col, row));
}

/** Return true if any solid tile exists in column `col` between rows [rowTop, rowBottom]. */
function checkColumnSolid(grid: TileGrid, col: number, rowTop: number, rowBottom: number): boolean {
  for (let r = rowTop; r <= rowBottom; r++) {
    if (isSolid(grid, col, r)) return true;
  }
  return false;
}

/** Return true if any solid tile exists in row `row` between cols [colLeft, colRight]. */
function checkRowSolid(grid: TileGrid, row: number, colLeft: number, colRight: number): boolean {
  for (let c = colLeft; c <= colRight; c++) {
    if (isSolid(grid, c, row)) return true;
  }
  return false;
}

// ─── AABB Helpers ─────────────────────────────────────────────────────────────

/** Return true if two axis-aligned rectangles overlap. */
export function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
): boolean {
  return ax < bx + bw &&
         ax + aw > bx &&
         ay < by + bh &&
         ay + ah > by;
}

/** Test if two entities' AABBs overlap. */
export function entitiesOverlap(a: PhysicsEntity, b: PhysicsEntity): boolean {
  return rectsOverlap(a.x, a.y, a.w, a.h, b.x, b.y, b.w, b.h);
}

// ─── Player Tile Collision ────────────────────────────────────────────────────

/**
 * Resolve the player's collision against the tile grid.
 * Horizontal pass first, then vertical pass.
 * The 2px horizontal inset on the vertical pass prevents corner-catching.
 *
 * @param entity  Mario's physics entity — mutated in place
 * @param grid    Tile grid
 * @param callbacks  Optional callbacks for tile interaction events
 * @returns  CollisionResult describing which sides were touched
 */
export function resolvePlayerTileCollision(
  entity: PhysicsEntity,
  grid: TileGrid,
  callbacks: CollisionCallbacks = {}
): CollisionResult {
  const result: CollisionResult = { left: false, right: false, top: false, bottom: false };

  // ── Horizontal pass ────────────────────────────────────────────────────────
  {
    const testX = entity.x + entity.vx;
    const y     = entity.y;

    const colL  = Math.floor(testX / TILE_SIZE);
    const colR  = Math.floor((testX + entity.w - 1) / TILE_SIZE);
    const rowT  = Math.floor(y / TILE_SIZE);
    const rowB  = Math.floor((y + entity.h - 1) / TILE_SIZE);

    if (entity.vx > 0) {
      // Moving right — check right column
      for (let row = rowT; row <= rowB; row++) {
        if (isSolid(grid, colR, row)) {
          entity.x  = colR * TILE_SIZE - entity.w;
          entity.vx = 0;
          result.right = true;
          if (callbacks.onRightHit) callbacks.onRightHit(colR, row);
          break;
        }
      }
    } else if (entity.vx < 0) {
      // Moving left — check left column
      for (let row = rowT; row <= rowB; row++) {
        if (isSolid(grid, colL, row)) {
          entity.x  = (colL + 1) * TILE_SIZE;
          entity.vx = 0;
          result.left = true;
          if (callbacks.onLeftHit) callbacks.onLeftHit(colL, row);
          break;
        }
      }
    }
  }

  // Apply horizontal movement after horizontal resolution
  entity.x += entity.vx;

  // ── Vertical pass ──────────────────────────────────────────────────────────
  {
    const x     = entity.x;
    const testY = entity.y + entity.vy;

    // Slight horizontal inset (2px) to prevent catching on corners of adjacent tiles
    const colL  = Math.floor((x + 2) / TILE_SIZE);
    const colR  = Math.floor((x + entity.w - 3) / TILE_SIZE);
    const rowT  = Math.floor(testY / TILE_SIZE);
    const rowB  = Math.floor((testY + entity.h - 1) / TILE_SIZE);

    if (entity.vy > 0) {
      // Falling — check tiles below feet
      for (let col = colL; col <= colR; col++) {
        if (isSolid(grid, col, rowB)) {
          entity.y  = rowB * TILE_SIZE - entity.h;
          entity.vy = 0;
          result.bottom = true;
          if (callbacks.onBottomHit) callbacks.onBottomHit(col, rowB);
          // Note: continue checking remaining cols so all grounded callbacks fire
        }
      }
    } else if (entity.vy < 0) {
      // Rising — check tiles above head
      for (let col = colL; col <= colR; col++) {
        if (isSolid(grid, col, rowT)) {
          entity.y  = (rowT + 1) * TILE_SIZE;
          entity.vy = 0;
          result.top = true;
          if (callbacks.onTopHit) callbacks.onTopHit(col, rowT);
        }
      }
    }
  }

  // Apply vertical movement after vertical resolution
  entity.y += entity.vy;

  return result;
}

// ─── Enemy Tile Collision ─────────────────────────────────────────────────────

/**
 * Resolve a walking enemy's collision against the tile grid.
 * Enemies: collide on bottom (gravity), left, right.
 * Reverses direction on wall hit if reverseOnWall is true.
 */
export function resolveEnemyTileCollision(
  enemy: PhysicsEntity & { reverseOnWall: boolean },
  grid: TileGrid
): CollisionResult {
  const result: CollisionResult = { left: false, right: false, top: false, bottom: false };

  // Horizontal pass
  {
    const testX = enemy.x + enemy.vx;
    const colL  = Math.floor(testX / TILE_SIZE);
    const colR  = Math.floor((testX + enemy.w - 1) / TILE_SIZE);
    const rowT  = Math.floor(enemy.y / TILE_SIZE);
    const rowB  = Math.floor((enemy.y + enemy.h - 1) / TILE_SIZE);

    if (enemy.vx > 0 && checkColumnSolid(grid, colR, rowT, rowB)) {
      enemy.x  = colR * TILE_SIZE - enemy.w;
      enemy.vx = enemy.reverseOnWall ? -Math.abs(enemy.vx) : 0;
      result.right = true;
    } else if (enemy.vx < 0 && checkColumnSolid(grid, colL, rowT, rowB)) {
      enemy.x  = (colL + 1) * TILE_SIZE;
      enemy.vx = enemy.reverseOnWall ? Math.abs(enemy.vx) : 0;
      result.left = true;
    }
  }

  enemy.x += enemy.vx;

  // Vertical pass
  {
    const testY = enemy.y + enemy.vy;
    const colL  = Math.floor(enemy.x / TILE_SIZE);
    const colR  = Math.floor((enemy.x + enemy.w - 1) / TILE_SIZE);
    const rowB  = Math.floor((testY + enemy.h - 1) / TILE_SIZE);
    const rowT  = Math.floor(testY / TILE_SIZE);

    if (enemy.vy > 0 && checkRowSolid(grid, rowB, colL, colR)) {
      enemy.y  = rowB * TILE_SIZE - enemy.h;
      enemy.vy = 0;
      result.bottom = true;
    } else if (enemy.vy < 0 && checkRowSolid(grid, rowT, colL, colR)) {
      enemy.y  = (rowT + 1) * TILE_SIZE;
      enemy.vy = 0;
      result.top = true;
    }
  }

  enemy.y += enemy.vy;

  return result;
}

// ─── Fireball Tile Collision ──────────────────────────────────────────────────

/**
 * Resolve a fireball's collision against the tile grid.
 * Fireballs bounce vertically off ground, die on ceilings and walls.
 * Mutates fb in place.
 */
export function resolveFireballTileCollision(
  fb: FireballEntity,
  grid: TileGrid,
  maxBounces: number
): void {
  // Horizontal pass
  {
    const testX = fb.x + fb.vx;
    const colL  = Math.floor(testX / TILE_SIZE);
    const colR  = Math.floor((testX + fb.w - 1) / TILE_SIZE);
    const rowT  = Math.floor(fb.y / TILE_SIZE);
    const rowB  = Math.floor((fb.y + fb.h - 1) / TILE_SIZE);

    const hitH = (fb.vx > 0 && checkColumnSolid(grid, colR, rowT, rowB)) ||
                 (fb.vx < 0 && checkColumnSolid(grid, colL, rowT, rowB));
    if (hitH) {
      fb.alive = false; // fireballs die on wall hit
      return;
    }
  }

  fb.x += fb.vx;

  // Vertical pass
  {
    const testY = fb.y + fb.vy;
    const colL  = Math.floor(fb.x / TILE_SIZE);
    const colR  = Math.floor((fb.x + fb.w - 1) / TILE_SIZE);
    const rowB  = Math.floor((testY + fb.h - 1) / TILE_SIZE);
    const rowT  = Math.floor(testY / TILE_SIZE);

    if (fb.vy > 0 && checkRowSolid(grid, rowB, colL, colR)) {
      // Bounce off ground
      fb.y  = rowB * TILE_SIZE - fb.h;
      fb.vy = -Math.abs(fb.vy) * 0.75;
      fb.bounces++;
      if (fb.bounces >= maxBounces) {
        fb.alive = false;
      }
      return;
    } else if (fb.vy < 0 && checkRowSolid(grid, rowT, colL, colR)) {
      fb.alive = false; // die on ceiling
      return;
    }
  }

  fb.y += fb.vy;
}

// ─── Query Utilities ──────────────────────────────────────────────────────────

/**
 * Check whether an entity is grounded (standing on a solid tile directly below).
 * Pure query — does not modify the entity.
 */
export function isGrounded(entity: PhysicsEntity, grid: TileGrid): boolean {
  const colL = Math.floor((entity.x + 2) / TILE_SIZE);
  const colR = Math.floor((entity.x + entity.w - 3) / TILE_SIZE);
  const row  = Math.floor((entity.y + entity.h) / TILE_SIZE); // row just below feet

  for (let col = colL; col <= colR; col++) {
    if (isSolid(grid, col, row)) return true;
  }
  return false;
}

/**
 * Check whether there is a ledge ahead of the entity in its movement direction.
 * Returns true if no ground tile is in front of the entity (ledge detected).
 * Used by enemies that should not walk off ledges (Koopa Troopa).
 */
export function isLedgeAhead(entity: PhysicsEntity, grid: TileGrid): boolean {
  const checkX = entity.vx >= 0
    ? entity.x + entity.w + 1   // right edge + 1
    : entity.x - 1;             // left edge - 1
  const col = Math.floor(checkX / TILE_SIZE);
  const row = Math.floor((entity.y + entity.h) / TILE_SIZE); // row below feet
  return !isSolid(grid, col, row);
}

/**
 * Stomp detection: determine if Mario is stomping an enemy.
 * Stomp condition:
 *   - mario.vy > 0 (Mario moving downward)
 *   - mario.bottom > enemy.top (overlap in Y)
 *   - mario.bottom < enemy.centerY (Mario's feet are in the top half of enemy)
 *   - Horizontal overlap exists (with 1px tolerance)
 */
export function isStomping(
  mario: PhysicsEntity & { vy: number },
  enemy: PhysicsEntity
): boolean {
  if (mario.vy <= 0) return false;

  const marioBottom = mario.y + mario.h;
  const enemyTop    = enemy.y;
  const enemyCenterY= enemy.y + enemy.h / 2;

  if (marioBottom <= enemyTop)     return false;
  if (marioBottom >= enemyCenterY) return false;

  // Horizontal overlap (with 1px tolerance)
  const marioRight = mario.x + mario.w;
  const enemyRight = enemy.x + enemy.w;
  return marioRight > enemy.x + 1 && mario.x < enemyRight - 1;
}

/**
 * Side-hit detection: Mario's side (not stomp) hits an enemy.
 * Returns true when entities overlap but it is NOT a stomp.
 */
export function isSideHit(mario: PhysicsEntity, enemy: PhysicsEntity): boolean {
  if (!entitiesOverlap(mario, enemy)) return false;
  if (isStomping(mario as PhysicsEntity & { vy: number }, enemy)) return false;
  return true;
}

/**
 * Broad-phase filter: return only entities that could possibly overlap with bounds.
 * Used to skip obviously distant entities before precise checks.
 */
export function broadPhaseFilter<T extends PhysicsEntity>(
  bounds: PhysicsEntity,
  entities: T[],
  margin: number = 0
): T[] {
  const bx1 = bounds.x - margin;
  const by1 = bounds.y - margin;
  const bx2 = bounds.x + bounds.w + margin;
  const by2 = bounds.y + bounds.h + margin;

  return entities.filter(e =>
    e.x < bx2 && e.x + e.w > bx1 &&
    e.y < by2 && e.y + e.h > by1
  );
}
