/**
 * PiranhaPlant.ts
 * Emerge/pause/retract cycle, 2s each phase.
 * Avoids emerging when Mario is within 1 tile of the pipe opening.
 *
 * States:
 *   waiting_bottom — hidden inside pipe, waiting before rising
 *   rising         — moving upward from pipe over 120 frames (2s)
 *   waiting_top    — fully extended, paused for 120 frames
 *   retracting     — moving back down over 120 frames
 *
 * The Piranha Plant cannot be stomped (no onStomp kill), can be killed
 * by fireball or shell.
 */

import { Enemy } from './Enemy';
import { TILE_SIZE } from '../../config/constants';
import { TileGrid } from '../../types/level';
import { Mario } from '../player/Mario';
import { PiranhaState } from '../../types/entities';

const PHASE_FRAMES       = 120;  // 2 seconds per phase at 60fps
const WAIT_BOTTOM_FRAMES = 60;   // 1 second at bottom before first rise
const ANIM_PERIOD        = 16;   // frames per animation step

export class PiranhaPlant extends Enemy {
  piranhaState:   PiranhaState = PiranhaState.WAITING_BOTTOM;
  stateTimer:     number       = WAIT_BOTTOM_FRAMES;

  private fullyHiddenY:   number;
  private fullyExtendedY: number;
  private pipeX:          number;
  private pipeTopY:       number;

  constructor(pipeCol: number, pipeTopRow: number) {
    // Plant width/height
    super(
      pipeCol * TILE_SIZE + (TILE_SIZE - 7),  // center in 2-tile pipe
      pipeTopRow * TILE_SIZE,                  // start at pipe top (will be adjusted)
      14,
      22
    );

    this.pipeX     = pipeCol * TILE_SIZE;
    this.pipeTopY  = pipeTopRow * TILE_SIZE;

    // Fully hidden: below pipe top, submerged completely
    this.fullyHiddenY   = this.pipeTopY + this.h + 4;
    // Fully extended: above pipe rim
    this.fullyExtendedY = this.pipeTopY - this.h;

    this.y = this.fullyHiddenY;

    // Piranha Plants don't move horizontally and don't reverse on walls
    this.vx            = 0;
    this.reverseOnWall = false;
    this.active        = true;  // always active (pipes are fixed positions)
  }

  /**
   * Returns true if Mario is within 1 tile of the pipe opening horizontally.
   */
  private isMarioNearby(mario: Mario): boolean {
    const pipeCenter  = this.pipeX + TILE_SIZE;
    const marioCenterX = mario.x + mario.w / 2;
    return Math.abs(marioCenterX - pipeCenter) <= TILE_SIZE;
  }

  update(_grid: TileGrid, mario: Mario, _dt: number): void {
    if (!this.alive) return;

    // Animation tick
    this.animTimer++;
    if (this.animTimer >= ANIM_PERIOD) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % 2;
    }

    this.stateTimer--;

    switch (this.piranhaState) {
      case PiranhaState.WAITING_BOTTOM:
        this.y = this.fullyHiddenY;
        if (this.stateTimer <= 0) {
          if (!this.isMarioNearby(mario)) {
            this.piranhaState = PiranhaState.RISING;
            this.stateTimer   = PHASE_FRAMES;
          } else {
            // Mario too close — reset wait timer and try again
            this.stateTimer = WAIT_BOTTOM_FRAMES;
          }
        }
        break;

      case PiranhaState.RISING: {
        const elapsed = PHASE_FRAMES - this.stateTimer;
        const t = elapsed / PHASE_FRAMES;
        this.y = this.fullyHiddenY + (this.fullyExtendedY - this.fullyHiddenY) * t;
        if (this.stateTimer <= 0) {
          this.y            = this.fullyExtendedY;
          this.piranhaState = PiranhaState.WAITING_TOP;
          this.stateTimer   = PHASE_FRAMES;
        }
        break;
      }

      case PiranhaState.WAITING_TOP:
        this.y = this.fullyExtendedY;
        if (this.stateTimer <= 0) {
          this.piranhaState = PiranhaState.RETRACTING;
          this.stateTimer   = PHASE_FRAMES;
        }
        break;

      case PiranhaState.RETRACTING: {
        const elapsed = PHASE_FRAMES - this.stateTimer;
        const t = elapsed / PHASE_FRAMES;
        this.y = this.fullyExtendedY + (this.fullyHiddenY - this.fullyExtendedY) * t;
        if (this.stateTimer <= 0) {
          this.y            = this.fullyHiddenY;
          this.piranhaState = PiranhaState.WAITING_BOTTOM;
          this.stateTimer   = WAIT_BOTTOM_FRAMES;
        }
        break;
      }
    }
  }

  onStomp(_mario: Mario): void {
    // Piranha Plants cannot be stomped — contact damages Mario instead
    // WorldScene should treat Piranha Plant as a side-hit only
  }

  onFireball(): void {
    if (!this.alive) return;
    this.alive  = false;
    this.active = false;
  }

  onShell(): void {
    if (!this.alive) return;
    this.alive  = false;
    this.active = false;
  }

  // Piranha plants override activation — always active when in level
  checkActivation(_cameraX: number): void {
    // Piranha Plants are always active; they stay in their pipe
  }

  getSpriteKey(): string {
    // Alternate between open and closed bite frames
    return this.animFrame === 0 ? 'piranha_open' : 'piranha_closed';
  }
}
