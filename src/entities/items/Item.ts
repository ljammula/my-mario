/**
 * Item.ts
 * Abstract base class for all collectible items.
 * Applies gravity and tile collision using the enemy tile collision resolver.
 */

import { ItemType } from '../../types/entities';
import { resolveEnemyTileCollision } from '../../systems/TileCollision';
import { TileGrid } from '../../types/level';
import { GRAVITY, MAX_FALL_SPEED } from '../../config/physics';

export abstract class Item {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  alive: boolean = true;
  collected: boolean = false;
  animTimer: number = 0;

  /** Required by resolveEnemyTileCollision — subclasses set this. */
  reverseOnWall: boolean = true;

  constructor(x: number, y: number, w: number, h: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.vx = 0;
    this.vy = 0;
  }

  abstract get type(): ItemType;
  abstract getSpriteKey(): string;

  /** Apply gravity, resolve tile collisions, advance animTimer. */
  update(grid: TileGrid): void {
    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL_SPEED);
    resolveEnemyTileCollision(this, grid);
    this.animTimer++;
  }
}
