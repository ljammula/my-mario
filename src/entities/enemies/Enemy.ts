/**
 * Enemy.ts
 * Abstract base class for all enemies.
 *
 * Enemies are pooled: pre-allocated array of 32. When an enemy
 * dies or scrolls off-screen left, it is deactivated (active = false)
 * and can be recycled for a new enemy spawn.
 *
 * Activation rule:
 *   active = false → skip update.
 *   Becomes active = true when first entering viewport + 2-tile margin.
 *   Becomes active = false (and alive = false) when scrolled past on left.
 */

import { Entity } from '../Entity';
import {
  GRAVITY,
  MAX_FALL_SPEED,
} from '../../config/physics';
import { LOGICAL_WIDTH } from '../../config/constants';
import {
  resolveEnemyTileCollision,
  CollisionResult,
} from '../../systems/TileCollision';
import { TileGrid } from '../../types/level';
import { Mario } from '../player/Mario';

export abstract class Enemy extends Entity {
  alive:          boolean = true;
  active:         boolean = false;   // false = offscreen, skip update
  facing:         number  = -1;      // 1 = right, -1 = left (most enemies start going left)
  reverseOnWall:  boolean = true;    // most enemies reverse on wall hit
  animFrame:      number  = 0;
  animTimer:      number  = 0;
  frameTimer:     number  = 0;

  constructor(x: number, y: number, w: number, h: number) {
    super(x, y, w, h);
  }

  // ── Abstract interface ─────────────────────────────────────────────────────

  abstract update(grid: TileGrid, mario: Mario, dt: number): void;
  abstract onStomp(mario: Mario): void;
  abstract onFireball(): void;
  abstract onShell(): void;

  // ── Shared physics ─────────────────────────────────────────────────────────

  protected applyGravity(): void {
    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL_SPEED);
  }

  protected resolveTiles(grid: TileGrid): CollisionResult {
    return resolveEnemyTileCollision(this, grid);
  }

  // ── Viewport check ─────────────────────────────────────────────────────────

  isInViewport(cameraX: number): boolean {
    return this.x + this.w > cameraX - 32 &&
           this.x           < cameraX + LOGICAL_WIDTH + 32;
  }

  /**
   * Called each frame from WorldScene to update active status.
   * Enemies activate when they first enter the viewport (right edge enters).
   * Enemies deactivate + die when scrolled past the left edge.
   *
   * @param cameraX  Current camera left edge in world coordinates
   */
  checkActivation(cameraX: number): void {
    if (!this.alive) return;

    // Activate when entering right side of viewport (with 2-tile = 32px margin)
    if (!this.active && this.x < cameraX + LOGICAL_WIDTH + 32) {
      this.active = true;
    }

    // Deactivate + kill when scrolled past left edge (one tile margin)
    if (this.active && this.x + this.w < cameraX - 16) {
      this.active = false;
      this.alive  = false;
    }
  }

  // ── Sprite key (overridden by subclasses for specific animation) ───────────

  abstract getSpriteKey(): string;
}
