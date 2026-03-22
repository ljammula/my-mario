/**
 * hudData.ts
 * Single source of truth for HUD state shared between WorldScene and HUDScene.
 * WorldScene writes to this object each frame; HUDScene reads it.
 */

export interface HudData {
  score:  number;   // 0–999999
  coins:  number;   // 0–99
  world:  string;   // "1-1"
  time:   number;   // 0–400
  lives:  number;
  hurry:  boolean;
}

export const hudData: HudData = {
  score: 0,
  coins: 0,
  world: '1-1',
  time:  400,
  lives: 3,
  hurry: false,
};
