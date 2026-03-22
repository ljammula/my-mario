/**
 * world1-1.ts
 * SE2 — Full World 1-1 level data.
 *
 * Tile grid: 15 rows × 224 cols (row 0 = sky top, row 14 = ground).
 * Row 15 is the death pit zone (handled by physics, not in grid).
 *
 * Tile IDs (from constants.ts):
 *   '.'  = empty/sky
 *   'G'  = ground (solid, unbreakable)
 *   'B'  = brick block (breakable by Super+)
 *   'Q'  = question block (spawns item)
 *   'U'  = used block (inert, post-Q)
 *   'H'  = hard block (indestructible)
 *   'I'  = invisible item block
 *   'PT' = pipe top-left
 *   'PR' = pipe top-right
 *   'PL' = pipe body-left
 *   'PB' = pipe body-right
 *   'FP' = flagpole segment
 *   'FF' = flag (top of pole)
 *   'CA' = castle wall
 *   'CD' = castle door
 */

import { LevelData, EnemyDef, BlockDef, TriggerDef } from '../../types';
import { EnemyType, ItemType } from '../../types';
import { TILE_SIZE } from '../../config/constants';

const COLS = 224;
const ROWS = 15;

// ── Grid builder ──────────────────────────────────────────────────────────────

function buildGrid(): string[][] {
  // Initialize all to empty sky
  const grid: string[][] = [];
  for (let r = 0; r < ROWS; r++) {
    grid.push(new Array(COLS).fill('.'));
  }

  // ── Ground segments (rows 9–14) ───────────────────────────────────────────
  // Spec ground pattern (row 14 is visible top; fill rows 9-13 with G too)
  // Gaps (pits): cols 69-70, 86-88, 104-107
  const groundSegments: [number, number][] = [
    [0, 68],
    [71, 85],
    [89, 103],
    [108, 197],
    [210, 223],
  ];

  for (const [start, end] of groundSegments) {
    for (let col = start; col <= end; col++) {
      for (let row = 13; row < ROWS; row++) {
        grid[row][col] = 'G';
      }
    }
  }

  // ── Pipes ─────────────────────────────────────────────────────────────────
  // addPipe(leftCol, topRow): top row = 14 - height
  // ground top visible row is 13; "height N tiles above ground" → topRow = 13 - N
  function addPipe(col: number, topRow: number): void {
    grid[topRow][col] = 'PT';
    grid[topRow][col + 1] = 'PR';
    for (let r = topRow + 1; r <= 13; r++) {
      grid[r][col] = 'PL';
      grid[r][col + 1] = 'PB';
    }
  }

  // Pipe 1: col 28-29, height 2 → topRow = 13-2 = 11
  addPipe(28, 11);
  // Pipe 2: col 38-39, height 3 → topRow = 10
  addPipe(38, 10);
  // Pipe 3: col 46-47, height 3 → topRow = 10
  addPipe(46, 10);
  // Pipe 4: col 57-58, height 4 → topRow = 9
  addPipe(57, 9);
  // Pipe 5: col 97-98, height 3 → topRow = 10, has Piranha
  addPipe(97, 10);

  // ── Question blocks ───────────────────────────────────────────────────────
  function addQ(col: number, row: number): void {
    grid[row][col] = 'Q';
  }

  addQ(16, 9);   // coin
  addQ(21, 5);   // hidden mushroom — visible Q in world1-1 original
  addQ(22, 9);   // coin
  addQ(24, 9);   // coin
  addQ(77, 9);   // coin
  addQ(78, 5);   // mushroom
  addQ(79, 9);   // coin
  addQ(80, 9);   // coin
  addQ(109, 5);  // coin
  addQ(110, 9);  // star
  addQ(113, 5);  // coin

  // ── Brick blocks ──────────────────────────────────────────────────────────
  function addBricks(colStart: number, colEnd: number, row: number): void {
    for (let c = colStart; c <= colEnd; c++) {
      grid[row][c] = 'B';
    }
  }

  addBricks(17, 20, 9);
  addBricks(23, 23, 9);
  addBricks(25, 26, 9);
  addBricks(78, 82, 9);
  addBricks(77, 80, 5);
  addBricks(108, 112, 5);
  addBricks(130, 133, 9);
  addBricks(130, 130, 5);
  addBricks(148, 155, 9);

  // ── Elevated hard-block platform (cols 29-33, row 8) ─────────────────────
  for (let c = 29; c <= 33; c++) {
    grid[8][c] = 'H';
  }

  // ── Staircase (cols 198-205) ──────────────────────────────────────────────
  // Step 1: col 198, rows 13
  // Step 2: col 199, rows 12-13
  // Step 3: col 200, rows 11-13
  // Step 4: col 201, rows 10-13
  // Step 5: col 202, rows 9-13
  // Step 6: col 203, rows 8-13
  // Step 7: col 204, rows 7-13
  // Step 8: col 205, rows 6-13
  const staircaseSteps: [number, number, number][] = [
    [198, 13, 13],
    [199, 12, 13],
    [200, 11, 13],
    [201, 10, 13],
    [202,  9, 13],
    [203,  8, 13],
    [204,  7, 13],
    [205,  6, 13],
  ];
  for (const [col, topRow, botRow] of staircaseSteps) {
    for (let r = topRow; r <= botRow; r++) {
      grid[r][col] = 'H';
    }
  }
  // Ground continuation under cols 206-209
  for (let c = 206; c <= 209; c++) {
    for (let r = 13; r < ROWS; r++) {
      grid[r][c] = 'H';
    }
  }

  // ── Flagpole (col 210, rows 4-13) ─────────────────────────────────────────
  grid[4][210] = 'FF'; // flag at top
  for (let r = 5; r <= 13; r++) {
    grid[r][210] = 'FP';
  }

  // ── Castle (cols 212-223) ─────────────────────────────────────────────────
  // Row 8: battlements (cols 214-215, 218-219, 221-221 are merlons)
  for (let c = 212; c <= 223; c++) {
    grid[8][c] = 'CA';
  }
  // Remove sky gaps for merlons (standard castle crenellation)
  // Merlons at even positions within range
  for (const mc of [213, 215, 217, 219, 221]) {
    if (mc <= 223) grid[8][mc] = '.';
  }

  // Rows 9-11: solid castle wall
  for (let r = 9; r <= 11; r++) {
    for (let c = 212; c <= 223; c++) {
      grid[r][c] = 'CA';
    }
  }

  // Row 12-13: castle wall with door arch at cols 216-217
  for (let r = 12; r <= 13; r++) {
    for (let c = 212; c <= 223; c++) {
      grid[r][c] = 'CA';
    }
    grid[r][216] = 'CD';
    grid[r][217] = 'CD';
  }

  return grid;
}

// ── Block defs (Q block contents) ────────────────────────────────────────────

const BLOCKS: BlockDef[] = [
  { col: 16,  row: 9, content: 'coin',              count: 1 },
  { col: 21,  row: 5, content: ItemType.MUSHROOM,   count: 1 },
  { col: 22,  row: 9, content: 'coin',              count: 1 },
  { col: 24,  row: 9, content: 'coin',              count: 1 },
  { col: 77,  row: 9, content: 'coin',              count: 1 },
  { col: 78,  row: 5, content: ItemType.MUSHROOM,   count: 1 },
  { col: 79,  row: 9, content: 'coin',              count: 1 },
  { col: 80,  row: 9, content: 'coin',              count: 1 },
  { col: 109, row: 5, content: 'coin',              count: 1 },
  { col: 110, row: 9, content: ItemType.STAR,       count: 1 },
  { col: 113, row: 5, content: 'coin',              count: 1 },
];

// ── Enemy spawns ──────────────────────────────────────────────────────────────

const ENEMIES: EnemyDef[] = [
  { type: EnemyType.GOOMBA,        col: 22,  row: 13 },
  { type: EnemyType.GOOMBA,        col: 23,  row: 13 },
  { type: EnemyType.GOOMBA,        col: 39,  row: 13 },
  { type: EnemyType.GOOMBA,        col: 40,  row: 13 },
  { type: EnemyType.KOOPA_TROOPA,  col: 57,  row: 12 },
  { type: EnemyType.GOOMBA,        col: 80,  row: 13 },
  { type: EnemyType.GOOMBA,        col: 81,  row: 13 },
  { type: EnemyType.PIRANHA_PLANT, col: 97,  row: 11 },
  { type: EnemyType.GOOMBA,        col: 107, row: 13 },
  { type: EnemyType.GOOMBA,        col: 108, row: 13 },
  { type: EnemyType.GOOMBA,        col: 110, row: 13 },
  { type: EnemyType.GOOMBA,        col: 111, row: 13 },
  { type: EnemyType.KOOPA_TROOPA,  col: 128, row: 13 },
  { type: EnemyType.GOOMBA,        col: 149, row: 13 },
  { type: EnemyType.GOOMBA,        col: 150, row: 13 },
  { type: EnemyType.GOOMBA,        col: 153, row: 13 },
  { type: EnemyType.GOOMBA,        col: 154, row: 13 },
];

// ── Triggers ──────────────────────────────────────────────────────────────────

const TRIGGERS: TriggerDef[] = [
  { col: 210, row: 4, type: 'flagpole' },
];

// ── Exported level data ───────────────────────────────────────────────────────

export const WORLD_1_1: LevelData = {
  world:       1,
  level:       1,
  grid:        buildGrid(),
  widthPx:     COLS * TILE_SIZE,   // 3584 logical px
  heightPx:    ROWS * TILE_SIZE,   // 240 logical px
  cols:        COLS,
  rows:        ROWS,
  enemies:     ENEMIES,
  blocks:      BLOCKS,
  triggers:    TRIGGERS,
  marioStartX: 3 * TILE_SIZE,      // col 3 → 48 logical px
  marioStartY: 13 * TILE_SIZE - 16,  // = 192, feet land on top of row 13
  bgColor:     '#6888FC',          // NES sky blue (palette index 20)
};
