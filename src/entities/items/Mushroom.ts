/**
 * Mushroom.ts
 * Red mushroom item — slides right on spawn, bounces off walls, affected by gravity.
 */

import { Item } from './Item';
import { ItemType } from '../../types/entities';

export class Mushroom extends Item {
  reverseOnWall: boolean = true;

  constructor(x: number, y: number) {
    super(x, y, 16, 16);
    this.vx = 1;
    this.vy = 0;
  }

  get type(): ItemType {
    return ItemType.MUSHROOM;
  }

  getSpriteKey(): string {
    return 'mushroom_red';
  }
}
