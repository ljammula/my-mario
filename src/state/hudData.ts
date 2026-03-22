/**
 * hudData.ts
 * Single source of truth for HUD state shared between WorldScene and UIScene.
 * WorldScene writes to this object each frame; UIScene reads it.
 */

import { Screen } from '../types/entities';

export interface HudData {
  score:  number;   // 0–999999
  coins:  number;   // 0–99
  world:  string;   // "1-1"
  time:   number;   // 0–400
  lives:  number;
  hurry:  boolean;
  screen: Screen;
}

export const hudData: HudData = {
  score:  0,
  coins:  0,
  world:  '1-1',
  time:   400,
  lives:  3,
  hurry:  false,
  screen: Screen.TITLE,
};
