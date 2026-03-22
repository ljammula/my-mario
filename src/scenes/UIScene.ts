/**
 * UIScene.ts
 * Parallel HUD scene — runs alongside WorldScene, renders score/coins/world/timer.
 *
 * SE1 owns: the data feed interface and update loop scaffold.
 * SE2 owns: all rendering (text drawing, coin icon sprite, HUD bar background).
 *
 * The UIScene reads from a shared HUDData object that WorldScene writes to each frame.
 * SE2's rendering code subscribes to this data and re-draws the HUD accordingly.
 */

import { HUD, CANVAS_WIDTH } from '../config/constants';

/** HUD data written by WorldScene each frame, read by UIScene */
export interface HUDData {
  score:    number;
  coins:    number;
  world:    string;    // e.g. "1-1"
  time:     number;    // seconds remaining (integer)
  lives:    number;
  hurry:    boolean;
}

/** Singleton HUD data shared between WorldScene and UIScene */
export const hudData: HUDData = {
  score:  0,
  coins:  0,
  world:  '1-1',
  time:   400,
  lives:  3,
  hurry:  false,
};

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // SE2: Initialize HUD rendering here.
    // Create Phaser text objects, coin icon image, HUD background bar, etc.
    // All positioned in canvas/screen coordinates (not world coordinates).
    // UIScene camera does NOT scroll — it is fixed to the viewport.
    this.cameras.main.setScroll(0, 0);
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
  }

  update(_time: number, _delta: number): void {
    // SE2: Redraw HUD elements using current values from hudData.
    // Example:
    //   this.scoreText.setText(String(hudData.score).padStart(6, '0'));
    //   this.coinText.setText(`×${String(hudData.coins).padStart(2, '0')}`);
    //   this.worldText.setText(hudData.world);
    //   this.timeText.setText(String(Math.floor(hudData.time)));
  }
}
