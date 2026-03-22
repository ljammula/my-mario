/**
 * Star.ts
 * Star item — bounces around, reverses on walls, bounces on floor.
 * Animates between star_1 and star_2 every 15 frames.
 */

import { Item } from './Item';
import { ItemType } from '../../types/entities';
import { TileGrid } from '../../types/level';
import { GRAVITY, MAX_FALL_SPEED } from '../../config/physics';
import { resolveEnemyTileCollision } from '../../systems/TileCollision';
import { LEVEL_HEIGHT_PX } from '../../config/constants';

export class Star extends Item {
  reverseOnWall: boolean = true;

  constructor(x: number, y: number) {
    super(x, y, 16, 16);
    this.vx = 2;
    this.vy = -4;
  }

  get type(): ItemType {
    return ItemType.STAR;
  }

  getSpriteKey(): string {
    return (Math.floor(this.animTimer / 15) % 2 === 0)
      ? 'star_1'
      : 'star_2';
  }

  /** Override: star bounces off the floor with ~90% restitution instead of stopping. */
  update(grid: TileGrid): void {
    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL_SPEED);

    const prevVy = this.vy;
    const result = resolveEnemyTileCollision(this, grid);

    // On floor hit the resolver sets vy = 0; override with bounce (90% restitution)
    if (result.bottom) {
      this.vy = -Math.abs(prevVy) * 0.9;
    }

    // Despawn if fallen off-screen
    if (this.y > LEVEL_HEIGHT_PX + 32) {
      this.alive = false;
    }

    this.animTimer++;
  }
}
