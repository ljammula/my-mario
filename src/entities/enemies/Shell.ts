/**
 * Shell.ts
 * Standalone sliding shell entity (detached from KoopaTroopa).
 *
 * Used when a shell is kicked and needs to be an independent entity
 * that can chain-kill multiple enemies. The Shell slides at KOOPA_SHELL_SPEED,
 * bounces off walls, and is removed when it falls into a pit or is stopped.
 *
 * Chain kill counter: each enemy killed increments comboKills.
 * Points escalate with each kill: 200, 400, 800, 1600, 3200, 5000, 8000.
 */

import { Enemy } from './Enemy';
import { GRAVITY, MAX_FALL_SPEED, KOOPA_SHELL_SPEED } from '../../config/physics';
import { TILE_SIZE } from '../../config/constants';
import { TileGrid } from '../../types/level';
import { Mario } from '../player/Mario';

const CHAIN_KILL_POINTS = [200, 400, 800, 1600, 3200, 5000, 8000] as const;

export class Shell extends Enemy {
  comboKills: number = 0;

  constructor(x: number, y: number, vx: number) {
    super(x, y, 14, 14);
    this.vx            = vx;
    this.facing        = vx > 0 ? 1 : -1;
    this.reverseOnWall = true;   // bounces off walls
    this.alive         = true;
    this.active        = true;
  }

  update(grid: TileGrid, _mario: Mario, _dt: number): void {
    if (!this.alive) return;

    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL_SPEED);

    const hit = this.resolveTiles(grid);

    if (hit.left || hit.right) {
      // reverseOnWall = true handles the vx flip in resolveEnemyTileCollision
      this.facing = this.vx > 0 ? 1 : -1;
    }

    // Shell spin animation
    this.animTimer++;
    if (this.animTimer >= 4) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % 4;
    }

    if (this.y > TILE_SIZE * 20) {
      this.alive  = false;
      this.active = false;
    }
  }

  onStomp(_mario: Mario): void {
    // Stomping a sliding shell stops it (handled by WorldScene → KoopaTroopa.onStomp)
    this.alive  = false;
    this.active = false;
  }

  onFireball(): void {
    this.alive  = false;
    this.active = false;
  }

  onShell(): void {
    // Two shells collide — both die
    this.alive  = false;
    this.active = false;
  }

  /**
   * Get chain-kill points for the next enemy killed by this shell.
   * Increments the combo counter.
   */
  getChainKillPoints(): number {
    const idx = Math.min(this.comboKills, CHAIN_KILL_POINTS.length - 1);
    this.comboKills++;
    return CHAIN_KILL_POINTS[idx];
  }

  getSpriteKey(): string {
    return `koopa_shell_spin${(this.animFrame % 2) + 1}`;
  }
}
