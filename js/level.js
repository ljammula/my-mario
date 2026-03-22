// level.js — World 1-1 tile map, metadata, and tile query API

export const TILE_SIZE = 16; // logical pixels

// Tile IDs
export const TILES = {
  EMPTY: '.',
  GROUND: 'G',
  BRICK: 'B',
  QUESTION: 'Q',
  USED: 'U',
  HARD: 'H',
  INVISIBLE: 'I',
  PIPE_TOP_LEFT: 'PT',
  PIPE_TOP_RIGHT: 'PR',
  PIPE_BODY_LEFT: 'PL',
  PIPE_BODY_RIGHT: 'PB',
  FLAGPOLE: 'FP',
  FLAG: 'FF',
  CASTLE_WALL: 'CA',
  CASTLE_DOOR: 'CD',
};

// Solid tile IDs set
const SOLID_TILES = new Set([
  'G', 'B', 'Q', 'U', 'H',
  'PT', 'PR', 'PL', 'PB',
  'FP', 'FF',
  'CA', 'CD',
]);

// Ground tile IDs
const GROUND_TILES = new Set(['G']);

// Level dimensions
export const LEVEL_COLS = 224;
export const LEVEL_ROWS = 15;

// Level metadata
export const levelMeta = {
  timeLimit: 400,
  music: 'overworld',
  backgroundColor: '#5C94FC',
  world: '1-1',
};

// Question block contents map: "col,row" -> content type
export const questionBlockContents = {};

// Build the 2D tile grid
function buildGrid() {
  // Initialize all cells to EMPTY
  const grid = [];
  for (let row = 0; row < LEVEL_ROWS; row++) {
    grid.push(new Array(LEVEL_COLS).fill('.'));
  }

  // ── Ground (rows 13 and 14) ──────────────────────────────────────────────
  // Row 14 ground segments (from spec):
  //   0–68, 71–85, 89–96, 97–103, 108–197, 210–223
  // Row 13 mirrors row 14

  const groundCols = [
    [0, 68],
    [71, 85],
    [89, 96],
    [97, 103],
    [108, 197],
    [210, 223],
  ];

  // Also fill "underground" from rows 9–14 for ground columns
  // Only rows 13-14 are visible ground top; rows 9-12 are fill
  for (const [start, end] of groundCols) {
    for (let col = start; col <= end; col++) {
      for (let row = 9; row <= 14; row++) {
        grid[row][col] = 'G';
      }
    }
  }

  // ── Pipes ────────────────────────────────────────────────────────────────
  // Each pipe: (leftCol, topRow, bottomRow inclusive)
  // Pipe layout: top row = PT/PR, body rows = PL/PB
  function addPipe(col, topRow) {
    grid[topRow][col] = 'PT';
    grid[topRow][col + 1] = 'PR';
    for (let r = topRow + 1; r <= 13; r++) {
      grid[r][col] = 'PL';
      grid[r][col + 1] = 'PB';
    }
  }

  // Pipes at: (col 28, height 2 from ground → top at row 12)
  // Ground is row 13-14; "height 2 above ground" means topRow = 14-2 = 12
  addPipe(28, 12); // height 2
  addPipe(38, 11); // height 3
  addPipe(46, 11); // height 3
  addPipe(57, 10); // height 4 — wait, spec says rows 10-13 for col 57-58
  addPipe(97, 11); // height 3, has Piranha Plant

  // ── Question Mark Blocks ─────────────────────────────────────────────────
  function addQ(col, row, content) {
    grid[row][col] = 'Q';
    questionBlockContents[`${col},${row}`] = content;
  }

  addQ(16, 9, 'coin');
  addQ(21, 5, 'mushroom');   // hidden mushroom block (spec says treat as I type but Q with content)
  addQ(22, 9, 'coin');
  addQ(24, 9, 'coin');
  addQ(77, 9, 'coin');
  addQ(78, 5, 'mushroom');
  addQ(79, 9, 'coin');
  addQ(80, 9, 'coin');
  addQ(109, 5, 'coin');
  addQ(110, 9, 'star');
  addQ(113, 5, 'coin');

  // ── Brick Blocks ─────────────────────────────────────────────────────────
  function addBricks(colStart, colEnd, row) {
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

  // ── Elevated Platform (cols 29-33, row 8) ────────────────────────────────
  for (let c = 29; c <= 33; c++) {
    grid[8][c] = 'H';
  }

  // ── Staircase (cols 198-209) ─────────────────────────────────────────────
  // Step 1: col 198, row 13
  // Step 2: col 199, rows 12-13
  // Step 3: col 200, rows 11-13
  // Step 4: col 201, rows 10-13
  // Step 5: col 202, rows 9-13
  // Step 6: col 203, rows 8-13
  // Step 7: col 204, rows 7-13
  // Step 8: col 205, rows 6-13
  // cols 206-209: ground only (row 13)
  const staircaseSteps = [
    [198, 13, 13],
    [199, 12, 13],
    [200, 11, 13],
    [201, 10, 13],
    [202, 9, 13],
    [203, 8, 13],
    [204, 7, 13],
    [205, 6, 13],
  ];
  for (const [col, topRow, botRow] of staircaseSteps) {
    for (let r = topRow; r <= botRow; r++) {
      grid[r][col] = 'H';
    }
  }
  // Ground under steps 206-209
  for (let c = 206; c <= 209; c++) {
    grid[13][c] = 'H';
  }

  // ── Flagpole (col 210) ───────────────────────────────────────────────────
  grid[4][210] = 'FF'; // flag at top
  for (let r = 5; r <= 13; r++) {
    grid[r][210] = 'FP';
  }

  // ── Castle (cols 212-223) ────────────────────────────────────────────────
  // Row 8:  cols 214-221 = CA
  for (let c = 214; c <= 221; c++) grid[8][c] = 'CA';
  // Rows 9-11: cols 212-223 = CA
  for (let r = 9; r <= 11; r++) {
    for (let c = 212; c <= 223; c++) grid[r][c] = 'CA';
  }
  // Row 12: cols 212-223 = CA, except 216-217 = CD
  for (let c = 212; c <= 223; c++) grid[12][c] = 'CA';
  grid[12][216] = 'CD';
  grid[12][217] = 'CD';
  // Row 13: cols 212-223 = CA, except 216-217 = CD
  for (let c = 212; c <= 223; c++) grid[13][c] = 'CA';
  grid[13][216] = 'CD';
  grid[13][217] = 'CD';

  return grid;
}

export const tileGrid = buildGrid();

// ── Tile Query API ────────────────────────────────────────────────────────────

export function getTile(col, row) {
  if (row < 0 || row >= LEVEL_ROWS || col < 0 || col >= LEVEL_COLS) {
    return row >= LEVEL_ROWS ? 'G' : '.'; // treat below-level as ground, off sides as empty
  }
  return tileGrid[row][col];
}

export function setTile(col, row, tileId) {
  if (row >= 0 && row < LEVEL_ROWS && col >= 0 && col < LEVEL_COLS) {
    tileGrid[row][col] = tileId;
  }
}

export function isGround(col, row) {
  const t = getTile(col, row);
  return GROUND_TILES.has(t);
}

export function isSolid(col, row) {
  const t = getTile(col, row);
  return SOLID_TILES.has(t);
}

// Convert tile coordinates to world (logical pixel) coordinates (top-left of tile)
export function tileToWorld(col, row) {
  return { x: col * TILE_SIZE, y: row * TILE_SIZE };
}

// Convert world (logical pixel) coordinates to tile coordinates
export function worldToTile(x, y) {
  return {
    col: Math.floor(x / TILE_SIZE),
    row: Math.floor(y / TILE_SIZE),
  };
}

// ── Spawn Points ──────────────────────────────────────────────────────────────

// Mario spawn: col 3, row 13 (standing on ground, so y = row*TILE_SIZE - height)
export const marioSpawn = { col: 3, row: 13 };

// Enemy spawn list
export const enemySpawns = [
  { type: 'Goomba',       col: 22,  row: 13 },
  { type: 'Goomba',       col: 23,  row: 13 },
  { type: 'Goomba',       col: 39,  row: 13 },
  { type: 'Goomba',       col: 40,  row: 13 },
  { type: 'KoopaTroopa',  col: 57,  row: 12 },
  { type: 'Goomba',       col: 80,  row: 13 },
  { type: 'Goomba',       col: 81,  row: 13 },
  { type: 'PiranhaPlant', col: 97,  row: 11, pipeCol: 97 },
  { type: 'Goomba',       col: 107, row: 13 },
  { type: 'Goomba',       col: 108, row: 13 },
  { type: 'Goomba',       col: 110, row: 13 },
  { type: 'Goomba',       col: 111, row: 13 },
  { type: 'KoopaTroopa',  col: 128, row: 13 },
  { type: 'Goomba',       col: 149, row: 13 },
  { type: 'Goomba',       col: 150, row: 13 },
  { type: 'Goomba',       col: 153, row: 13 },
  { type: 'Goomba',       col: 154, row: 13 },
];

// Coin spawn list (floating coins in level)
export const coinSpawns = [
  { col: 12, row: 9 },
  { col: 13, row: 9 },
];

// ── Engine-compatible API ─────────────────────────────────────────────────────
// engine.js calls createGrid(), createEnemies(), createItems(),
// getSpawnPoint(), and getBlockContent() on the imported level module.

export function createGrid() {
  // Return a fresh (mutable) copy of the tile grid so the engine can modify it
  return tileGrid.map(row => row.slice());
}

export function getSpawnPoint() {
  // Mario spawns standing on top of the ground tile at marioSpawn position.
  // y is the top of Mario's feet = row * TILE_SIZE - small mario height (16px).
  return {
    x: marioSpawn.col * TILE_SIZE,
    y: (marioSpawn.row - 1) * TILE_SIZE,
  };
}

export function createEnemies() {
  return enemySpawns.map(e => {
    const type = e.type === 'Goomba' ? 'goomba'
               : e.type === 'KoopaTroopa' ? 'koopa'
               : e.type === 'PiranhaPlant' ? 'piranha'
               : e.type.toLowerCase();

    const base = {
      type,
      x:     e.col * TILE_SIZE,
      y:     (e.row - 1) * TILE_SIZE,
      w:     TILE_SIZE,
      h:     TILE_SIZE,
      vx:    -1,
      vy:    0,
      alive: true,
      dying: false,
      state: 'walking',
      reverseOnWall: true,
      frameCounter: Math.floor(Math.random() * 60),
      walkFrame: 0,
      squished: false,
    };

    if (type === 'piranha') {
      base.vx       = 0;
      base.pipeX    = e.pipeCol * TILE_SIZE;
      base.pipeBottom = e.row * TILE_SIZE;
      base.riseHeight = 2 * TILE_SIZE;
      base.timer    = 0;
      base.reverseOnWall = false;
    }

    return base;
  });
}

export function createItems() {
  // Static coins from coinSpawns (items can also spawn dynamically from blocks)
  return coinSpawns.map(c => ({
    type:  'coin',
    alive: true,
    x:     c.col * TILE_SIZE,
    y:     c.row * TILE_SIZE,
    w:     TILE_SIZE,
    h:     TILE_SIZE,
    vx:    0,
    vy:    0,
  }));
}

export function getBlockContent(col, row) {
  return questionBlockContents[`${col},${row}`] || 'coin';
}
