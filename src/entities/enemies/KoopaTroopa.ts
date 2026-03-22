/**
 * KoopaTroopa.ts
 * Walking Koopa that turns into a shell when stomped.
 * Shell can be kicked to slide at KOOPA_SHELL_SPEED.
 *
 * States:
 *   walking — walks left, turns at ledges and walls
 *   shell   — stationary; kicked into sliding if stomped again
 *   sliding — shell sliding at 8px/frame; bounces off walls, kills enemies
 *   flipped — killed by fireball, arcs off-screen
 *
 * Shell revival: after 300 frames stationary (5s), wakes back to walking.
 */

import { Enemy } from './Enemy';
import {
  GRAVITY, MAX_FALL_SPEED,
  KOOPA_SPEED, KOOPA_SHELL_SPEED,
} from '../../config/physics';
import { TILE_SIZE } from '../../config/constants';
import { isLedgeAhead } from '../../systems/TileCollision';
import { TileGrid } from '../../types/level';
import { Mario } from '../player/Mario';
import { KoopaState } from '../../types/entities';

const WALK_ANIM_PERIOD   = 16;
const SHELL_WAKE_FRAMES  = 300;  // 5 seconds before waking up

export class KoopaTroopa extends Enemy {
  koopaState:       KoopaState = KoopaState.WALKING;
  shellStillTimer:  number     = 0;
  points:           number     = 100;
  comboPoints:      number     = 200;

  constructor(x: number, y: number) {
    super(x, y, 14, 22);  // taller when walking (1×2 tiles)
    this.vx            = -KOOPA_SPEED;
    this.facing        = -1;
    this.reverseOnWall = false;  // Koopa turns at ledges instead of bouncing off walls
  }

  update(grid: TileGrid, _mario: Mario, _dt: number): void {
    if (!this.alive) return;

    if (this.koopaState === KoopaState.FLIPPED) {
      this.vy = Math.min(this.vy + GRAVITY, MAX_FALL_SPEED);
      this.y += this.vy;
      if (this.y > TILE_SIZE * 20) {
        this.alive  = false;
        this.active = false;
      }
      return;
    }

    this.applyGravity();

    if (this.koopaState === KoopaState.SHELL) {
      this.resolveTiles(grid);

      this.shellStillTimer--;
      if (this.shellStillTimer <= 0) {
        // Wake up — expand back to walking
        this._wakeUp();
      }
      return;
    }

    if (this.koopaState === KoopaState.SLIDING) {
      // Shell slides with reverseOnWall = true (bounces off walls)
      this.reverseOnWall = true;
      const hit = this.resolveTiles(grid);
      if (hit.left || hit.right) {
        // vx was already reversed by resolveEnemyTileCollision since reverseOnWall=true
        this.facing = this.vx > 0 ? 1 : -1;
      }
      if (this.y > TILE_SIZE * 20) {
        this.alive  = false;
        this.active = false;
      }
      return;
    }

    // Walking state
    this.reverseOnWall = false;

    // Turn at ledges
    if (isLedgeAhead(this, grid)) {
      this.vx    = -this.vx;
      this.facing = this.vx > 0 ? 1 : -1;
    }

    const hit = this.resolveTiles(grid);
    if (hit.left || hit.right) {
      this.vx    = -this.vx;
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

  onStomp(mario: Mario): void {
    if (this.koopaState === KoopaState.WALKING) {
      // Stomp → become shell
      this._becomeShell();
      this.points = 100;
    } else if (this.koopaState === KoopaState.SHELL) {
      // Kick the shell
      const dir = mario.x < this.centerX ? 1 : -1;
      this._startSliding(dir * KOOPA_SHELL_SPEED);
    } else if (this.koopaState === KoopaState.SLIDING) {
      // Touching a sliding shell from the side → stop it
      this._becomeShell();
    }
  }

  onFireball(): void {
    if (!this.alive) return;
    this._flip();
    this.points = 200;
  }

  onShell(): void {
    if (!this.alive) return;
    this._flip();
    // Points handled by Shell's chain-kill counter
    this.points = 200;
  }

  /**
   * Returns points for a shell chain-kill (escalating combo).
   */
  shellChainKillPoints(): number {
    const pts = this.comboPoints;
    this.comboPoints = Math.min(this.comboPoints * 2, 8000);
    return pts;
  }

  private _becomeShell(): void {
    this.koopaState      = KoopaState.SHELL;
    this.vx              = 0;
    this.vy              = 0;
    this.h               = 14;          // shell is 1 tile high
    this.y              += 8;           // adjust for shorter hitbox
    this.shellStillTimer = SHELL_WAKE_FRAMES;
    this.reverseOnWall   = false;
  }

  private _startSliding(speed: number): void {
    this.koopaState = KoopaState.SLIDING;
    this.vx         = speed;
    this.facing     = speed > 0 ? 1 : -1;
  }

  private _wakeUp(): void {
    this.koopaState    = KoopaState.WALKING;
    this.h             = 22;
    this.y            -= 8;
    this.vx            = -KOOPA_SPEED;
    this.facing        = -1;
    this.reverseOnWall = false;
  }

  private _flip(): void {
    this.koopaState = KoopaState.FLIPPED;
    this.vx         = 0;
    this.vy         = -4;
  }

  getSpriteKey(): string {
    switch (this.koopaState) {
      case KoopaState.SHELL:
        return 'koopa_shell';
      case KoopaState.SLIDING:
        return `koopa_shell_slide${this.animFrame % 2 + 1}`;
      case KoopaState.FLIPPED:
        return 'koopa_dead';
      default:
        return `koopa_walk${this.animFrame + 1}`;
    }
  }
}
