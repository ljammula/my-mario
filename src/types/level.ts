/**
 * types/level.ts
 * LevelData, TileGrid, EnemyDef, BlockDef, TriggerDef interfaces.
 */

import { EnemyType, ItemType } from './entities';

// ─── Tile Grid ────────────────────────────────────────────────────────────────

/** 2D array of tile IDs: grid[row][col] = tile string ID */
export type TileGrid = string[][];

// ─── Level Structure ──────────────────────────────────────────────────────────

export interface EnemyDef {
  type:   EnemyType;
  col:    number;    // tile column spawn position
  row:    number;    // tile row spawn position
}

export interface BlockDef {
  col:     number;
  row:     number;
  content: ItemType | 'coin' | null;  // what spawns when hit
  count:   number;                     // how many times it can be hit (Q blocks = 1)
}

export interface TriggerDef {
  col:     number;
  row:     number;
  type:    'flagpole' | 'warp_pipe' | 'axe';
  targetWorld?: number;
  targetLevel?: number;
}

export interface LevelData {
  world:      number;
  level:      number;
  grid:       TileGrid;
  widthPx:    number;       // total level width in logical pixels
  heightPx:   number;       // total level height in logical pixels
  cols:       number;
  rows:       number;
  enemies:    EnemyDef[];
  blocks:     BlockDef[];   // tracks Q blocks and their contents
  triggers:   TriggerDef[];
  marioStartX: number;      // logical px
  marioStartY: number;      // logical px
  bgColor:    string;       // hex sky color
}
