/**
 * Goomba.ts
 * Walks left, reverses on walls, stomped flat or flipped by fireball/shell.
 *
 * States:
 *   walking — normal walk AI
 *   stomped — flat sprite shown for 30 frames, then removed
 *   flipped — killed by fireball/shell, arcs upward off-screen
 */

import { Enemy } from './Enemy';
import { GRAVITY, MAX_FALL_SPEED, GOOMBA_SPEED } from '../../config/physics';
import { TILE_SIZE } from '../../config/constants';
import { TileGrid } from '../../types/level';
import { Mario } from '../player/Mario';
import { GoombaState } from '../../types/entities';

const STOMP_DISPLAY_FRAMES = 30;  // frames to show flat sprite
const WALK_ANIM_PERIOD     = 16;  // frames per animation step

export class Goomba extends Enemy {
  goombaState: GoombaState = GoombaState.WALKING;
  stompTimer:  number      = 0;
  points:      number      = 100;

  constructor(x: number, y: number) {
    super(x, y, 14, 14);
    this.vx            = -GOOMBA_SPEED;
    this.reverseOnWall = true;
  }

  update(grid: TileGrid, _mario: Mario, _dt: number): void {
    if (!this.alive) return;

    if (this.goombaState === GoombaState.STOMPED) {
      this.stompTimer--;
      if (this.stompTimer <= 0) {
        this.alive  = false;
        this.active = false;
      }
      return;
    }

    if (this.goombaState === GoombaState.FLIPPED) {
      this.vy = Math.min(this.vy + GRAVITY, MAX_FALL_SPEED);
      this.y += this.vy;
      if (this.y > TILE_SIZE * 20) {
        this.alive  = false;
        this.active = false;
      }
      return;
    }

    // Walking AI
    this.applyGravity();
    const hit = this.resolveTiles(grid);

    if (hit.left || hit.right) {
      this.vx = -this.vx;
      this.facing = this.vx > 0 ? 1 : -1;
    }

    // Walk animation
    this.animTimer++;
    if (this.animTimer >= WALK_ANIM_PERIOD) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % 2;
    }

    if (this.y > TILE_SIZE * 20) {
      this.alive  = false;
      this.active = false;
    }
  }

  onStomp(_mario: Mario): void {
    if (this.goombaState !== GoombaState.WALKING) return;
    this.goombaState = GoombaState.STOMPED;
    this.vx          = 0;
    this.vy          = 0;
    this.stompTimer  = STOMP_DISPLAY_FRAMES;
    this.points      = 100;
  }

  onFireball(): void {
    if (this.goombaState === GoombaState.STOMPED || !this.alive) return;
    this._flip();
    this.points = 200;
  }

  onShell(): void {
    if (!this.alive) return;
    this._flip();
    this.points = 200;
  }

  private _flip(): void {
    this.goombaState = GoombaState.FLIPPED;
    this.vx          = 0;
    this.vy          = -3;
  }

  getSpriteKey(): string {
    switch (this.goombaState) {
      case GoombaState.STOMPED:
        return 'goomba_stomped';
      case GoombaState.FLIPPED:
        return 'goomba_dead';
      default:
        return `goomba_walk${this.animFrame + 1}`;
    }
  }
}
