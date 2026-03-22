/**
 * collision.js
 * AABB (Axis-Aligned Bounding Box) collision detection and resolution.
 *
 * Handles:
 *   - player ↔ tiles
 *   - player ↔ enemies
 *   - player ↔ items / power-ups
 *   - enemies ↔ tiles
 *   - fireballs ↔ tiles
 *   - fireballs ↔ enemies
 *
 * All coordinates and sizes are in logical pixels (not canvas pixels).
 *
 * Entity structure expected:
 *   { x, y, w, h, vx, vy }
 *   x, y = top-left corner in world space
 */

import { TILE_SIZE, SOLID_TILES, TILE, LEVEL_COLS, LEVEL_ROWS } from './constants.js';

// ─── AABB Helpers ─────────────────────────────────────────────────────────────

/**
 * Return true if two axis-aligned rectangles overlap.
 * @param {number} ax  @param {number} ay  @param {number} aw  @param {number} ah
 * @param {number} bx  @param {number} by  @param {number} bw  @param {number} bh
 */
export function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw &&
         ax + aw > bx &&
         ay < by + bh &&
         ay + ah > by;
}

/**
 * Compute the overlap rectangle of two rects, or null if they don't overlap.
 * Returns { x, y, w, h } of the intersection.
 */
export function rectIntersection(ax, ay, aw, ah, bx, by, bw, bh) {
  const ix = Math.max(ax, bx);
  const iy = Math.max(ay, by);
  const ix2 = Math.min(ax + aw, bx + bw);
  const iy2 = Math.min(ay + ah, by + bh);
  if (ix2 <= ix || iy2 <= iy) return null;
  return { x: ix, y: iy, w: ix2 - ix, h: iy2 - iy };
}

// ─── Tile Grid Utilities ──────────────────────────────────────────────────────

/**
 * Get the tile ID at grid position (col, row).
 * Returns TILE.EMPTY if out of bounds.
 * @param {string[][]} grid
 */
function getTile(grid, col, row) {
  if (col < 0 || col >= LEVEL_COLS || row < 0 || row >= LEVEL_ROWS) return TILE.EMPTY;
  return grid[row]?.[col] ?? TILE.EMPTY;
}

/**
 * Return true if the tile at (col, row) is solid.
 */
function isSolid(grid, col, row) {
  return SOLID_TILES.has(getTile(grid, col, row));
}

// ─── Tile Collision Resolution ────────────────────────────────────────────────

/**
 * Resolve entity collision against the tile grid.
 * Moves the entity's x,y to resolve penetration and zeroes velocity on contact.
 *
 * Strategy: separate horizontal and vertical passes.
 * Returns a collision result object describing which sides touched.
 *
 * @param {Object} entity  — { x, y, w, h, vx, vy }  (mutated in place)
 * @param {string[][]} grid
 * @param {Function} [onHitTile]  — optional callback(col, row, side) called when a solid tile is hit
 * @returns {{ left: boolean, right: boolean, top: boolean, bottom: boolean }}
 */
export function resolveTileCollision(entity, grid, onHitTile) {
  const result = { left: false, right: false, top: false, bottom: false };

  // ── Horizontal pass ──────────────────────────────────────────────────────
  {
    const x = entity.x + entity.vx;
    const y = entity.y;

    const left   = Math.floor(x / TILE_SIZE);
    const right  = Math.floor((x + entity.w - 1) / TILE_SIZE);
    const top    = Math.floor(y / TILE_SIZE);
    const bottom = Math.floor((y + entity.h - 1) / TILE_SIZE);

    if (entity.vx > 0) {
      // Moving right — check right column
      for (let row = top; row <= bottom; row++) {
        if (isSolid(grid, right, row)) {
          // Push back so right edge aligns with left of tile
          entity.x = right * TILE_SIZE - entity.w;
          entity.vx = 0;
          result.right = true;
          if (onHitTile) onHitTile(right, row, 'right');
          break;
        }
      }
    } else if (entity.vx < 0) {
      // Moving left — check left column
      for (let row = top; row <= bottom; row++) {
        if (isSolid(grid, left, row)) {
          // Push right so left edge aligns with right of tile
          entity.x = (left + 1) * TILE_SIZE;
          entity.vx = 0;
          result.left = true;
          if (onHitTile) onHitTile(left, row, 'left');
          break;
        }
      }
    }
  }

  // ── Vertical pass ────────────────────────────────────────────────────────
  {
    const x = entity.x;
    const y = entity.y + entity.vy;

    const left   = Math.floor((x + 1) / TILE_SIZE);          // +1 slight inset to avoid corner ghosts
    const right  = Math.floor((x + entity.w - 2) / TILE_SIZE);// -1 inset
    const top    = Math.floor(y / TILE_SIZE);
    const bottom = Math.floor((y + entity.h - 1) / TILE_SIZE);

    if (entity.vy > 0) {
      // Moving down — check bottom row
      for (let col = left; col <= right; col++) {
        if (isSolid(grid, col, bottom)) {
          // Land on top of tile
          entity.y = bottom * TILE_SIZE - entity.h;
          entity.vy = 0;
          result.bottom = true;
          if (onHitTile) onHitTile(col, bottom, 'bottom');
          break;
        }
      }
    } else if (entity.vy < 0) {
      // Moving up — check top row
      for (let col = left; col <= right; col++) {
        if (isSolid(grid, col, top)) {
          // Hit ceiling — push down
          entity.y = (top + 1) * TILE_SIZE;
          entity.vy = 0;
          result.top = true;
          if (onHitTile) onHitTile(col, top, 'top');
          break;
        }
      }
    }
  }

  // Apply movement after resolution
  entity.x += entity.vx;
  entity.y += entity.vy;

  return result;
}

/**
 * Specialized tile collision for the player.
 * Same as resolveTileCollision but:
 * - Calls onHitTileFromBelow(col, row) when moving up and hitting a solid tile.
 * - Returns the result including `tileCols` touched on the bottom for grounded detection.
 *
 * @param {Object} entity
 * @param {string[][]} grid
 * @param {Object} callbacks
 *   callbacks.onBottomHit(col, row)  — called for each tile hit on bottom
 *   callbacks.onTopHit(col, row)     — called for tiles hit on top (head bonk)
 *   callbacks.onLeftHit(col, row)    — wall on left
 *   callbacks.onRightHit(col, row)   — wall on right
 */
export function resolvePlayerTileCollision(entity, grid, callbacks = {}) {
  const result = { left: false, right: false, top: false, bottom: false };

  // ── Horizontal pass ──────────────────────────────────────────────────────
  {
    const testX = entity.x + entity.vx;
    const y     = entity.y;

    const colL  = Math.floor(testX / TILE_SIZE);
    const colR  = Math.floor((testX + entity.w - 1) / TILE_SIZE);
    const rowT  = Math.floor(y / TILE_SIZE);
    const rowB  = Math.floor((y + entity.h - 1) / TILE_SIZE);

    if (entity.vx > 0) {
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

  // After horizontal correction, apply horizontal movement
  entity.x += entity.vx;

  // ── Vertical pass ────────────────────────────────────────────────────────
  {
    const x     = entity.x;
    const testY = entity.y + entity.vy;

    // Slight horizontal inset to prevent catching on corners of adjacent tiles
    const colL  = Math.floor((x + 2) / TILE_SIZE);
    const colR  = Math.floor((x + entity.w - 3) / TILE_SIZE);
    const rowT  = Math.floor(testY / TILE_SIZE);
    const rowB  = Math.floor((testY + entity.h - 1) / TILE_SIZE);

    if (entity.vy > 0) {
      // Falling — check tiles below
      for (let col = colL; col <= colR; col++) {
        if (isSolid(grid, col, rowB)) {
          entity.y  = rowB * TILE_SIZE - entity.h;
          entity.vy = 0;
          result.bottom = true;
          if (callbacks.onBottomHit) callbacks.onBottomHit(col, rowB);
        }
      }
    } else if (entity.vy < 0) {
      // Rising — check tiles above
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

  // Apply vertical movement after resolution
  entity.y += entity.vy;

  return result;
}

// ─── Entity-Entity Collision ──────────────────────────────────────────────────

/**
 * Test if two entities' AABBs overlap.
 * @param {Object} a  { x, y, w, h }
 * @param {Object} b  { x, y, w, h }
 * @returns {boolean}
 */
export function entitiesOverlap(a, b) {
  return rectsOverlap(a.x, a.y, a.w, a.h, b.x, b.y, b.w, b.h);
}

/**
 * Stomp detection: determine if entity `a` (Mario) is stomping entity `b` (enemy).
 *
 * Stomp condition per spec:
 *   - a.vy > 0 (Mario moving downward)
 *   - a.bottom > b.top  (overlap in Y)
 *   - a.bottom < b.center (Mario's feet are in the top half of the enemy)
 *   - Horizontal overlap exists
 *
 * @param {Object} a  Mario: { x, y, w, h, vy }
 * @param {Object} b  Enemy: { x, y, w, h }
 * @returns {boolean}
 */
export function isStomping(a, b) {
  if (a.vy <= 0) return false;

  const aBottom  = a.y + a.h;
  const bTop     = b.y;
  const bCenter  = b.y + b.h / 2;

  // Mario's bottom is inside the top half of the enemy
  if (aBottom <= bTop)    return false;
  if (aBottom >= bCenter) return false;

  // Horizontal overlap (with 1px tolerance)
  const aLeft  = a.x;
  const aRight = a.x + a.w;
  const bLeft  = b.x;
  const bRight = b.x + b.w;
  return aRight > bLeft + 1 && aLeft < bRight - 1;
}

/**
 * Side-hit detection: Mario's side (not stomp) hits an enemy.
 * Returns true when entities overlap but it's NOT a stomp.
 *
 * @param {Object} mario
 * @param {Object} enemy
 * @returns {boolean}
 */
export function isSideHit(mario, enemy) {
  if (!entitiesOverlap(mario, enemy)) return false;
  if (isStomping(mario, enemy)) return false;
  return true;
}

// ─── Fireball Tile Collision ──────────────────────────────────────────────────

/**
 * Resolve a fireball's collision against the tile grid.
 * Fireballs bounce vertically off the ground, die on ceilings and walls.
 *
 * @param {Object} fb   Fireball: { x, y, w, h, vx, vy, bounces, alive }
 * @param {string[][]} grid
 * @param {number} maxBounces
 */
export function resolveFireballTileCollision(fb, grid, maxBounces) {
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
      fb.vy = -Math.abs(fb.vy) * 0.75;  // reduce velocity on bounce
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

/** Helper: any solid tile in a column from rowTop to rowBottom? */
function checkColumnSolid(grid, col, rowTop, rowBottom) {
  for (let r = rowTop; r <= rowBottom; r++) {
    if (isSolid(grid, col, r)) return true;
  }
  return false;
}

/** Helper: any solid tile in a row from colLeft to colRight? */
function checkRowSolid(grid, row, colLeft, colRight) {
  for (let c = colLeft; c <= colRight; c++) {
    if (isSolid(grid, c, row)) return true;
  }
  return false;
}

// ─── Enemy Tile Collision (simplified, walking enemies) ───────────────────────

/**
 * Resolve a walking enemy's collision against the tile grid.
 * Enemies:
 *   - Collide on bottom (gravity), left, right
 *   - Reverse direction on wall hit
 *   - Walk off ledges (no ledge detection unless flagged)
 *
 * @param {Object} enemy   { x, y, w, h, vx, vy, reverseOnWall }
 * @param {string[][]} grid
 * @returns {{ bottom: boolean, left: boolean, right: boolean, top: boolean }}
 */
export function resolveEnemyTileCollision(enemy, grid) {
  const result = { left: false, right: false, top: false, bottom: false };

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

/**
 * Check whether an entity is grounded (standing on a solid tile directly below).
 * This is a pure query — it does not modify the entity.
 *
 * @param {Object} entity  { x, y, w, h }
 * @param {string[][]} grid
 * @returns {boolean}
 */
export function isGrounded(entity, grid) {
  const colL = Math.floor((entity.x + 2) / TILE_SIZE);
  const colR = Math.floor((entity.x + entity.w - 3) / TILE_SIZE);
  const row  = Math.floor((entity.y + entity.h) / TILE_SIZE);  // row just below feet

  for (let col = colL; col <= colR; col++) {
    if (isSolid(grid, col, row)) return true;
  }
  return false;
}

/**
 * Check whether there is a ledge ahead of the entity in its movement direction.
 * Used by enemies that should not walk off ledges.
 *
 * @param {Object} entity  { x, y, w, h, vx }
 * @param {string[][]} grid
 * @returns {boolean}  true if ledge detected (no ground tile ahead)
 */
export function isLedgeAhead(entity, grid) {
  // Look one tile ahead in movement direction
  const checkX = entity.vx >= 0
    ? entity.x + entity.w + 1   // right edge + 1
    : entity.x - 1;              // left edge - 1
  const col = Math.floor(checkX / TILE_SIZE);
  const row = Math.floor((entity.y + entity.h) / TILE_SIZE); // row below feet
  return !isSolid(grid, col, row);
}

// ─── Broad-Phase Sweep ────────────────────────────────────────────────────────

/**
 * Broad-phase filter: return only entities from a list that could possibly
 * overlap with the given AABB. Useful for skipping obviously distant entities.
 *
 * @param {Object} bounds  { x, y, w, h }
 * @param {Object[]} entities  array of { x, y, w, h }
 * @param {number} margin  extra margin in logical pixels
 * @returns {Object[]}
 */
export function broadPhaseFilter(bounds, entities, margin = 0) {
  const bx1 = bounds.x - margin;
  const by1 = bounds.y - margin;
  const bx2 = bounds.x + bounds.w + margin;
  const by2 = bounds.y + bounds.h + margin;

  return entities.filter(e =>
    e.x < bx2 && e.x + e.w > bx1 &&
    e.y < by2 && e.y + e.h > by1
  );
}
