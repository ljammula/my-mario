/**
 * Entity.ts
 * Base entity class with position, velocity, and hitbox.
 * All game objects (Mario, enemies, items) extend this.
 */

import { PhysicsEntity } from '../systems/TileCollision';

export abstract class Entity implements PhysicsEntity {
  x:  number;
  y:  number;
  w:  number;
  h:  number;
  vx: number;
  vy: number;

  constructor(x: number, y: number, w: number, h: number) {
    this.x  = x;
    this.y  = y;
    this.w  = w;
    this.h  = h;
    this.vx = 0;
    this.vy = 0;
  }

  /** Right edge in world space */
  get right():   number { return this.x + this.w; }
  /** Bottom edge in world space */
  get bottom():  number { return this.y + this.h; }
  /** Horizontal center */
  get centerX(): number { return this.x + this.w / 2; }
  /** Vertical center */
  get centerY(): number { return this.y + this.h / 2; }
}
