/**
 * CameraSystem.ts
 * Manages the logical camera position for Super Mario Bros v2.
 *
 * Camera rule: Mario is CAMERA_LEAD_X logical pixels from the left edge.
 * Camera never scrolls left (one-way horizontal scroll, NES authentic).
 * Clamped to level bounds on both sides.
 *
 * Integration with Phaser:
 *   After update(), call scene.cameras.main.setScroll(camera.cameraX * SCALE, 0)
 *   so Phaser renders game objects at the correct world offset.
 *   All GameObjects are placed in logical world coordinates; Phaser handles
 *   the final pixel transform via the scale factor.
 */

import { CAMERA_LEAD_X } from '../config/physics';
import { LOGICAL_WIDTH, SCALE } from '../config/constants';

export class CameraSystem {
  /** Current logical camera X position (left edge of viewport in world space) */
  cameraX: number = 0;

  /**
   * Update camera position to follow Mario.
   * Camera never moves left; target is clamped to [0, levelWidthPx - logicalWidth].
   *
   * @param marioX         Mario's current world X position (logical px)
   * @param levelWidthPx   Total level width in logical pixels
   * @param logicalWidth   Viewport width in logical pixels (default: LOGICAL_WIDTH)
   */
  update(
    marioX: number,
    levelWidthPx: number,
    logicalWidth: number = LOGICAL_WIDTH
  ): void {
    const target = marioX - CAMERA_LEAD_X;
    const maxX   = levelWidthPx - logicalWidth;

    // Camera never scrolls left (Math.max with current cameraX enforces this)
    const newX = Math.max(this.cameraX, Math.min(target, maxX));
    this.cameraX = Math.max(0, newX);
  }

  /**
   * Convert a world X coordinate to a screen (viewport) X coordinate.
   */
  worldToScreen(worldX: number): number {
    return worldX - this.cameraX;
  }

  /**
   * Convert a screen X coordinate to a world X coordinate.
   */
  screenToWorld(screenX: number): number {
    return screenX + this.cameraX;
  }

  /**
   * Left edge of the viewport in world coordinates (with optional margin for culling).
   */
  viewportLeft(margin: number = 32): number {
    return this.cameraX - margin;
  }

  /**
   * Right edge of the viewport in world coordinates (with optional margin for culling).
   */
  viewportRight(margin: number = 32): number {
    return this.cameraX + LOGICAL_WIDTH + margin;
  }

  /**
   * Apply this camera position to a Phaser scene's main camera.
   * Call at the end of each WorldScene.update().
   *
   * @param scene  The Phaser.Scene to scroll
   */
  applyToPhaser(scene: Phaser.Scene): void {
    scene.cameras.main.setScroll(this.cameraX * SCALE, 0);
  }

  /**
   * Check if a world-space rect (x, w) is visible in the current viewport.
   */
  isInViewport(worldX: number, worldW: number, margin: number = 32): boolean {
    return worldX + worldW > this.viewportLeft(margin) &&
           worldX           < this.viewportRight(margin);
  }
}
