/**
 * Fireball.ts
 * Fireball projectile fired by Fire Mario.
 *
 * Behavior:
 * - Travels horizontally at FIREBALL_SPEED_X in Mario's facing direction.
 * - Bounces off the ground (up to FIREBALL_MAX_BOUNCES times).
 * - Dies on wall or ceiling hit.
 * - Dies when off-screen horizontally.
 * - Object-pooled: reset() reinitializes without allocating.
 */

import { Entity } from '../Entity';
import {
  FIREBALL_SPEED_X,
  FIREBALL_SPEED_Y,
  FIREBALL_GRAVITY,
  FIREBALL_MAX_BOUNCES,
} from '../../config/physics';
import { FIREBALL_W, FIREBALL_H, LEVEL_WIDTH_PX } from '../../config/constants';
import { resolveFireballTileCollision } from '../../systems/TileCollision';
import { TileGrid } from '../../types/level';

export class Fireball extends Entity {
  alive:   boolean = false;
  bounces: number  = 0;
  frame:   number  = 0;   // animation frame counter (for spin)

  constructor() {
    super(0, 0, FIREBALL_W, FIREBALL_H);
  }

  /**
   * Initialize or reset the fireball for a new launch.
   * Called from the object pool — no `new` allocation during PLAYING.
   *
   * @param x     Launch X position (world)
   * @param y     Launch Y position (world)
   * @param dirX  Direction: 1 = right, -1 = left
   */
  reset(x: number, y: number, dirX: number): void {
    this.x       = x;
    this.y       = y;
    this.vx      = dirX * FIREBALL_SPEED_X;
    this.vy      = FIREBALL_SPEED_Y;
    this.bounces = 0;
    this.alive   = true;
    this.frame   = 0;
  }

  /**
   * Update fireball for one frame.
   *
   * @param grid  Tile grid for collision
   */
  update(grid: TileGrid): void {
    if (!this.alive) return;

    this.frame++;

    // Apply gravity
    this.vy += FIREBALL_GRAVITY;

    // Resolve tile collision (handles bounces and wall death)
    resolveFireballTileCollision(this, grid, FIREBALL_MAX_BOUNCES);

    // Kill if out of horizontal level bounds
    if (this.x < -FIREBALL_W || this.x > LEVEL_WIDTH_PX + FIREBALL_W) {
      this.alive = false;
    }
  }

  /** Current animation frame index (0–3 spin cycle) */
  get animFrame(): number {
    return Math.floor(this.frame / 4) % 4;
  }

  /** Alternating sprite key for fireball animation. */
  getSpriteKey(): string {
    return (Math.floor(this.frame / 4) % 2 === 0)
      ? 'fireball_1'
      : 'fireball_2';
  }
}
