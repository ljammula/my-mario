/**
 * FireFlower.ts
 * Fire flower item — stationary, animates between two frames every 20 ticks.
 */

import { Item } from './Item';
import { ItemType } from '../../types/entities';
import { TileGrid } from '../../types/level';

export class FireFlower extends Item {
  reverseOnWall: boolean = false;

  constructor(x: number, y: number) {
    super(x, y, 16, 16);
    this.vx = 0;
    this.vy = 0;
  }

  get type(): ItemType {
    return ItemType.FIRE_FLOWER;
  }

  getSpriteKey(): string {
    return (Math.floor(this.animTimer / 20) % 2 === 0)
      ? 'fire_flower_1'
      : 'fire_flower_2';
  }

  /** Override: fire flower does not move, so skip gravity + tile collision. */
  update(_grid: TileGrid): void {
    this.animTimer++;
  }
}
