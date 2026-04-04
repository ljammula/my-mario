// ============================================================
// LEVEL DATA
// ============================================================

function buildLevel() {
  const grid = [];
  for (let r = 0; r < LEVEL_ROWS; r++) {
    grid.push(new Array(LEVEL_COLS).fill('.'));
  }

  function setTile(col, row, id) {
    if (col >= 0 && col < LEVEL_COLS && row >= 0 && row < LEVEL_ROWS) {
      grid[row][col] = id;
    }
  }

  // Ground segments (rows 13-14)
  const groundSegs = [
    [0, 68], [71, 85], [89, 103], [108, 197], [210, 223]
  ];
  for (const [start, end] of groundSegs) {
    for (let c = start; c <= end; c++) {
      setTile(c, 13, 'G');
      setTile(c, 14, 'G');
    }
  }

  // Pipes: [colL, topRow, height, hasPiranha]
  const pipes = [
    [28, 11, 2, false],
    [38, 10, 3, false],
    [46, 10, 3, false],
    [57,  9, 4, false],
    [97, 10, 3, true],   // has Piranha Plant
  ];
  for (const [c, topRow, h] of pipes) {
    setTile(c,   topRow, 'PT');
    setTile(c+1, topRow, 'PR');
    for (let r = topRow + 1; r <= 13; r++) {
      setTile(c,   r, 'PL');
      setTile(c+1, r, 'PB');
    }
  }

  // Question blocks
  const qBlocks = [
    [16,9],[21,5],[22,9],[24,9],
    [77,9],[78,5],[79,9],[80,9],
    [109,5],[110,9],[113,5]
  ];
  for (const [c, r] of qBlocks) setTile(c, r, 'Q');

  // Brick blocks
  for (let c = 17; c <= 20; c++) setTile(c, 9, 'B');
  setTile(23, 9, 'B');
  for (let c = 25; c <= 26; c++) setTile(c, 9, 'B');
  for (let c = 78; c <= 82; c++) {
    if (grid[9][c] !== 'Q') setTile(c, 9, 'B');
  }
  setTile(78, 9, 'B');
  setTile(81, 9, 'B');
  setTile(82, 9, 'B');
  for (let c = 77; c <= 80; c++) {
    if (grid[5][c] !== 'Q') setTile(c, 5, 'B');
  }
  for (let c = 108; c <= 112; c++) {
    if (grid[5][c] !== 'Q') setTile(c, 5, 'B');
  }
  for (let c = 130; c <= 133; c++) setTile(c, 9, 'B');
  setTile(130, 5, 'B');
  for (let c = 148; c <= 155; c++) setTile(c, 9, 'B');

  // Hard block platform: cols 29-33, row 8
  for (let c = 29; c <= 33; c++) setTile(c, 8, 'H');

  // Staircase — fill row 14 too so base is solid
  setTile(198, 13, 'H'); setTile(198, 14, 'H');
  for (let r = 12; r <= 14; r++) setTile(199, r, 'H');
  for (let r = 11; r <= 14; r++) setTile(200, r, 'H');
  for (let r = 10; r <= 14; r++) setTile(201, r, 'H');
  for (let r =  9; r <= 14; r++) setTile(202, r, 'H');
  for (let r =  8; r <= 14; r++) setTile(203, r, 'H');
  for (let r =  7; r <= 14; r++) setTile(204, r, 'H');
  for (let r =  6; r <= 14; r++) setTile(205, r, 'H');
  for (let c = 206; c <= 209; c++) {
    setTile(c, 13, 'H');
    setTile(c, 14, 'H');
  }

  // Flagpole
  setTile(210, 4, 'FF');
  for (let r = 5; r <= 13; r++) setTile(210, r, 'FP');

  // Castle (cols 212-223)
  for (let c = 212; c <= 223; c += 2) setTile(c, 8, 'CA');
  for (let r = 9; r <= 11; r++) {
    for (let c = 212; c <= 223; c++) setTile(c, r, 'CA');
  }
  for (let r = 12; r <= 13; r++) {
    for (let c = 212; c <= 223; c++) {
      if (c === 216 || c === 217) setTile(c, r, 'CD');
      else setTile(c, r, 'CA');
    }
  }

  return grid;
}

// Q-block contents map: "col,row" -> 'coin'|'mushroom'|'star'
const Q_CONTENTS = {
  '16,9':  'coin',
  '21,5':  'mushroom',
  '22,9':  'coin',
  '24,9':  'coin',
  '77,9':  'coin',
  '78,5':  'mushroom',
  '79,9':  'coin',
  '80,9':  'coin',
  '109,5': 'coin',
  '110,9': 'star',
  '113,5': 'coin',
};

// Q-block contents for World 1-2
const Q_CONTENTS_L2 = {
  '17,5':  'mushroom',
  '20,5':  'coin',
  '21,5':  'coin',
  '31,5':  'coin',
  '47,7':  'coin',
  '49,7':  'coin',
  '57,5':  'star',
  '72,9':  'coin',
  '74,9':  'coin',
  '82,5':  'mushroom',
  '114,7': 'coin',
  '116,7': 'coin',
  '127,5': 'coin',
  '129,5': 'star',
  '176,5': 'coin',
  '178,5': 'coin',
};

function buildLevel2() {
  const grid = [];
  for (let r = 0; r < LEVEL_ROWS; r++) {
    grid.push(new Array(LEVEL_COLS).fill('.'));
  }

  function setTile(col, row, id) {
    if (col >= 0 && col < LEVEL_COLS && row >= 0 && row < LEVEL_ROWS) {
      grid[row][col] = id;
    }
  }

  // Ceiling (rows 0-1)
  for (let c = 0; c < LEVEL_COLS; c++) {
    setTile(c, 0, 'H');
    setTile(c, 1, 'H');
  }

  // Ground (rows 13-14, full width)
  for (let c = 0; c < LEVEL_COLS; c++) {
    setTile(c, 13, 'G');
    setTile(c, 14, 'G');
  }

  // Brick platforms — area 1
  for (let c = 9; c <= 13; c++) setTile(c, 9, 'B');
  for (let c = 16; c <= 22; c++) setTile(c, 5, 'B');
  for (let c = 19; c <= 22; c++) setTile(c, 7, 'B');
  setTile(17, 5, 'Q');
  setTile(20, 5, 'Q');
  setTile(21, 5, 'Q');

  // Short pipe at col 11 (rows 12-13)
  setTile(11, 12, 'PT'); setTile(12, 12, 'PR');
  setTile(11, 13, 'PL'); setTile(12, 13, 'PB');

  // Brick platforms — area 2
  for (let c = 29; c <= 34; c++) setTile(c, 9, 'B');
  for (let c = 30; c <= 33; c++) setTile(c, 5, 'B');
  setTile(31, 5, 'Q');

  // Pipe at col 40 (rows 11-13)
  setTile(40, 11, 'PT'); setTile(41, 11, 'PR');
  for (let r = 12; r <= 13; r++) { setTile(40, r, 'PL'); setTile(41, r, 'PB'); }

  // Brick platforms — area 3
  for (let c = 45; c <= 50; c++) setTile(c, 7, 'B');
  setTile(47, 7, 'Q');
  setTile(49, 7, 'Q');

  // Brick platforms — area 4
  for (let c = 55; c <= 60; c++) setTile(c, 5, 'B');
  setTile(57, 5, 'Q');

  // Pipe at col 65 (rows 10-13)
  setTile(65, 10, 'PT'); setTile(66, 10, 'PR');
  for (let r = 11; r <= 13; r++) { setTile(65, r, 'PL'); setTile(66, r, 'PB'); }

  // Brick platforms — area 5
  for (let c = 70; c <= 76; c++) setTile(c, 9, 'B');
  setTile(72, 9, 'Q');
  setTile(74, 9, 'Q');

  // Brick platforms — area 6
  for (let c = 80; c <= 86; c++) setTile(c, 5, 'B');
  setTile(82, 5, 'Q');
  for (let c = 84; c <= 87; c++) setTile(c, 7, 'B');

  // Brick platforms — area 7
  for (let c = 95; c <= 101; c++) setTile(c, 9, 'B');

  // Pipe at col 105 (rows 11-13)
  setTile(105, 11, 'PT'); setTile(106, 11, 'PR');
  for (let r = 12; r <= 13; r++) { setTile(105, r, 'PL'); setTile(106, r, 'PB'); }

  // Brick platforms — area 8
  for (let c = 112; c <= 118; c++) setTile(c, 7, 'B');
  setTile(114, 7, 'Q');
  setTile(116, 7, 'Q');

  // Brick platforms — area 9
  for (let c = 125; c <= 131; c++) setTile(c, 5, 'B');
  setTile(127, 5, 'Q');
  setTile(129, 5, 'Q');

  // Hard platforms — area 10
  for (let c = 140; c <= 145; c++) setTile(c, 9, 'H');
  for (let c = 150; c <= 155; c++) setTile(c, 7, 'H');
  for (let c = 160; c <= 165; c++) setTile(c, 5, 'H');

  // Brick platforms — area 11
  for (let c = 170; c <= 180; c++) setTile(c, 9, 'B');
  for (let c = 175; c <= 180; c++) setTile(c, 5, 'B');
  setTile(176, 5, 'Q');
  setTile(178, 5, 'Q');

  // Pipe at col 185 (rows 10-13)
  setTile(185, 10, 'PT'); setTile(186, 10, 'PR');
  for (let r = 11; r <= 13; r++) { setTile(185, r, 'PL'); setTile(186, r, 'PB'); }

  // Staircase (same layout as 1-1)
  setTile(198, 13, 'H'); setTile(198, 14, 'H');
  for (let r = 12; r <= 14; r++) setTile(199, r, 'H');
  for (let r = 11; r <= 14; r++) setTile(200, r, 'H');
  for (let r = 10; r <= 14; r++) setTile(201, r, 'H');
  for (let r =  9; r <= 14; r++) setTile(202, r, 'H');
  for (let r =  8; r <= 14; r++) setTile(203, r, 'H');
  for (let r =  7; r <= 14; r++) setTile(204, r, 'H');
  for (let r =  6; r <= 14; r++) setTile(205, r, 'H');
  for (let c = 206; c <= 209; c++) {
    setTile(c, 13, 'H');
    setTile(c, 14, 'H');
  }

  // Flagpole
  setTile(210, 4, 'FF');
  for (let r = 5; r <= 13; r++) setTile(210, r, 'FP');

  // Castle (cols 212-223)
  for (let c = 212; c <= 223; c += 2) setTile(c, 8, 'CA');
  for (let r = 9; r <= 11; r++) {
    for (let c = 212; c <= 223; c++) setTile(c, r, 'CA');
  }
  for (let r = 12; r <= 13; r++) {
    for (let c = 212; c <= 223; c++) {
      if (c === 216 || c === 217) setTile(c, r, 'CD');
      else setTile(c, r, 'CA');
    }
  }

  return grid;
}

// Q-block contents for World 1-3 main area
const Q_CONTENTS_L3_MAIN = {
  '26,10': 'coin',
  '42,8':  'coin',
  '54,11': 'mushroom',
  '65,9':  'coin',
  '87,10': 'coin',
  '102,8': 'star',
  '116,10':'coin',
  '134,9': 'coin',
  '143,7': 'mushroom',
  '170,10':'coin',
  '181,8': 'coin',
};

// Q-block contents for World 1-3 hidden area
const Q_CONTENTS_L3_HIDDEN = {
  '30,8':  'coin',
  '32,8':  'coin',
  '34,8':  'coin',
  '58,6':  'coin',
  '60,6':  'coin',
  '62,6':  'coin',
  '100,7': 'coin',
  '102,7': 'coin',
  '132,6': 'coin',
  '134,6': 'star',
  '166,8': 'coin',
  '168,8': 'coin',
};

function buildLevel3Main() {
  const grid = [];
  for (let r = 0; r < LEVEL_ROWS; r++) {
    grid.push(new Array(LEVEL_COLS).fill('.'));
  }

  function setTile(col, row, id) {
    if (col >= 0 && col < LEVEL_COLS && row >= 0 && row < LEVEL_ROWS) {
      grid[row][col] = id;
    }
  }

  // Ground segments with frequent gaps to emphasize platforming.
  const groundSegs = [
    [0, 24], [29, 45], [50, 67], [74, 93],
    [98, 117], [126, 152], [160, 183], [190, 197], [210, 223],
  ];
  for (const [start, end] of groundSegs) {
    for (let c = start; c <= end; c++) {
      setTile(c, 13, 'G');
      setTile(c, 14, 'G');
    }
  }

  // Athletic mushroom-like platforms.
  const mushroomPlatforms = [
    [26, 33, 10],
    [38, 46, 8],
    [53, 58, 11],
    [62, 71, 9],
    [84, 90, 10],
    [100, 108, 8],
    [113, 119, 10],
    [128, 138, 9],
    [142, 148, 7],
    [166, 174, 10],
    [178, 186, 8],
    [194, 200, 9],
  ];
  for (const [start, end, row] of mushroomPlatforms) {
    for (let c = start; c <= end; c++) setTile(c, row, 'M');
  }

  // Pipes: [colL, topRow, hasPiranha]
  const pipes = [
    [35, 11, false],
    [75, 10, true],
    [120, 11, false], // hidden-area entry
    [154, 10, false],
  ];
  for (const [c, topRow] of pipes) {
    setTile(c,   topRow, 'PT');
    setTile(c+1, topRow, 'PR');
    for (let r = topRow + 1; r <= 13; r++) {
      setTile(c,   r, 'PL');
      setTile(c+1, r, 'PB');
    }
  }

  // Question blocks.
  const qBlocks = [
    [26,10],[42,8],[54,11],[65,9],[87,10],[102,8],
    [116,10],[134,9],[143,7],[170,10],[181,8],
  ];
  for (const [c, r] of qBlocks) setTile(c, r, 'Q');

  // Supporting bricks around reward blocks.
  const brickRanges = [
    [24, 28, 10],
    [40, 44, 8],
    [63, 67, 9],
    [100, 104, 8],
    [132, 136, 9],
    [141, 145, 7],
    [168, 172, 10],
    [179, 183, 8],
  ];
  for (const [start, end, row] of brickRanges) {
    for (let c = start; c <= end; c++) {
      if (grid[row][c] !== 'Q') setTile(c, row, 'B');
    }
  }

  // End staircase + flat run-up.
  setTile(198, 13, 'H'); setTile(198, 14, 'H');
  for (let r = 12; r <= 14; r++) setTile(199, r, 'H');
  for (let r = 11; r <= 14; r++) setTile(200, r, 'H');
  for (let r = 10; r <= 14; r++) setTile(201, r, 'H');
  for (let r =  9; r <= 14; r++) setTile(202, r, 'H');
  for (let r =  8; r <= 14; r++) setTile(203, r, 'H');
  for (let r =  7; r <= 14; r++) setTile(204, r, 'H');
  for (let r =  6; r <= 14; r++) setTile(205, r, 'H');
  for (let c = 206; c <= 209; c++) {
    setTile(c, 13, 'H');
    setTile(c, 14, 'H');
  }

  // Flagpole.
  setTile(210, 4, 'FF');
  for (let r = 5; r <= 13; r++) setTile(210, r, 'FP');

  // Castle.
  for (let c = 212; c <= 223; c += 2) setTile(c, 8, 'CA');
  for (let r = 9; r <= 11; r++) {
    for (let c = 212; c <= 223; c++) setTile(c, r, 'CA');
  }
  for (let r = 12; r <= 13; r++) {
    for (let c = 212; c <= 223; c++) {
      if (c === 216 || c === 217) setTile(c, r, 'CD');
      else setTile(c, r, 'CA');
    }
  }

  return grid;
}

function buildLevel3Hidden() {
  const grid = [];
  for (let r = 0; r < LEVEL_ROWS; r++) {
    grid.push(new Array(LEVEL_COLS).fill('.'));
  }

  function setTile(col, row, id) {
    if (col >= 0 && col < LEVEL_COLS && row >= 0 && row < LEVEL_ROWS) {
      grid[row][col] = id;
    }
  }

  // Underground shell.
  for (let c = 0; c < LEVEL_COLS; c++) {
    setTile(c, 0, 'H');
    setTile(c, 1, 'H');
    setTile(c, 13, 'G');
    setTile(c, 14, 'G');
  }

  // Entry pipe near start.
  setTile(8, 11, 'PT'); setTile(9, 11, 'PR');
  setTile(8, 12, 'PL'); setTile(9, 12, 'PB');
  setTile(8, 13, 'PL'); setTile(9, 13, 'PB');

  // Return pipe near end.
  setTile(196, 11, 'PT'); setTile(197, 11, 'PR');
  setTile(196, 12, 'PL'); setTile(197, 12, 'PB');
  setTile(196, 13, 'PL'); setTile(197, 13, 'PB');

  // Coin room platforms.
  const hardPlatforms = [
    [22, 40, 10],
    [50, 70, 8],
    [90, 112, 9],
    [126, 140, 8],
    [156, 172, 10],
  ];
  for (const [start, end, row] of hardPlatforms) {
    for (let c = start; c <= end; c++) setTile(c, row, 'H');
  }

  const qBlocks = [
    [30,8],[32,8],[34,8],
    [58,6],[60,6],[62,6],
    [100,7],[102,7],
    [132,6],[134,6],
    [166,8],[168,8],
  ];
  for (const [c, r] of qBlocks) setTile(c, r, 'Q');

  return grid;
}

// ============================================================
// WORLD 4 — Overworld / Forest (harder than World 1)
// ============================================================

// Q-block contents for World 1-4
const Q_CONTENTS_L4 = {
  '20,9':  'coin',
  '23,5':  'mushroom',
  '25,9':  'coin',
  '48,5':  'coin',
  '50,5':  'coin',
  '52,9':  'star',
  '80,9':  'coin',
  '83,5':  'mushroom',
  '110,9': 'coin',
  '135,5': 'coin',
  '160,9': 'coin',
  '162,5': 'star',
};

function buildLevel4() {
  const grid = [];
  for (let r = 0; r < LEVEL_ROWS; r++) {
    grid.push(new Array(LEVEL_COLS).fill('.'));
  }

  function setTile(col, row, id) {
    if (col >= 0 && col < LEVEL_COLS && row >= 0 && row < LEVEL_ROWS) {
      grid[row][col] = id;
    }
  }

  // Ground segments — more/longer gaps than level 1 for harder feel
  const groundSegs = [
    [0, 60],    // long starting stretch
    [66, 88],   // gap at 61-65
    [95, 118],  // gap at 89-94
    [126, 148], // gap at 119-125
    [156, 175], // gap at 149-155
    [183, 197], // gap at 176-182
    [210, 223], // castle base (no gap before staircase block)
  ];
  for (const [start, end] of groundSegs) {
    for (let c = start; c <= end; c++) {
      setTile(c, 13, 'G');
      setTile(c, 14, 'G');
    }
  }

  // Pipes: [colL, topRow, height, hasPiranha]
  const pipes = [
    [30, 11, 2, false],
    [42, 10, 3, false],
    [55, 10, 3, true],   // piranha plant
    [100,  9, 4, false],
    [140, 10, 3, false],
  ];
  for (const [c, topRow, , ] of pipes) {
    setTile(c,   topRow, 'PT');
    setTile(c+1, topRow, 'PR');
    for (let r = topRow + 1; r <= 13; r++) {
      setTile(c,   r, 'PL');
      setTile(c+1, r, 'PB');
    }
  }

  // Q-blocks (positions must match Q_CONTENTS_L4 keys)
  const qBlocks = [
    [20, 9], [23, 5], [25, 9],
    [48, 5], [50, 5], [52, 9],
    [80, 9], [83, 5],
    [110, 9],
    [135, 5],
    [160, 9], [162, 5],
  ];
  for (const [c, r] of qBlocks) setTile(c, r, 'Q');

  // Brick rows — height 9 (low) and height 5 (high)
  // Area 1
  for (let c = 18; c <= 27; c++) {
    if (grid[9][c] !== 'Q') setTile(c, 9, 'B');
  }
  for (let c = 21; c <= 27; c++) {
    if (grid[5][c] !== 'Q') setTile(c, 5, 'B');
  }
  // Mid-level brick row at height 7
  for (let c = 68; c <= 74; c++) setTile(c, 7, 'B');
  // Area 2
  for (let c = 46; c <= 54; c++) {
    if (grid[5][c] !== 'Q') setTile(c, 5, 'B');
  }
  for (let c = 50; c <= 54; c++) {
    if (grid[9][c] !== 'Q') setTile(c, 9, 'B');
  }
  // Area 3
  for (let c = 78; c <= 85; c++) {
    if (grid[9][c] !== 'Q') setTile(c, 9, 'B');
    if (grid[5][c] !== 'Q') setTile(c, 5, 'B');
  }
  // Area 4 — mid-level bricks
  for (let c = 108; c <= 115; c++) {
    if (grid[9][c] !== 'Q') setTile(c, 9, 'B');
  }
  // Area 5
  for (let c = 133; c <= 138; c++) {
    if (grid[5][c] !== 'Q') setTile(c, 5, 'B');
  }
  // Area 6
  for (let c = 158; c <= 165; c++) {
    if (grid[9][c] !== 'Q') setTile(c, 9, 'B');
    if (grid[5][c] !== 'Q') setTile(c, 5, 'B');
  }

  // Hard-block platform mid-level for variety
  for (let c = 96; c <= 99; c++) setTile(c, 8, 'H');
  for (let c = 168; c <= 172; c++) setTile(c, 8, 'H');

  // Staircase (cols 198-209)
  setTile(198, 13, 'H'); setTile(198, 14, 'H');
  for (let r = 12; r <= 14; r++) setTile(199, r, 'H');
  for (let r = 11; r <= 14; r++) setTile(200, r, 'H');
  for (let r = 10; r <= 14; r++) setTile(201, r, 'H');
  for (let r =  9; r <= 14; r++) setTile(202, r, 'H');
  for (let r =  8; r <= 14; r++) setTile(203, r, 'H');
  for (let r =  7; r <= 14; r++) setTile(204, r, 'H');
  for (let r =  6; r <= 14; r++) setTile(205, r, 'H');
  for (let c = 206; c <= 209; c++) {
    setTile(c, 13, 'H');
    setTile(c, 14, 'H');
  }

  // Flagpole
  setTile(210, 4, 'FF');
  for (let r = 5; r <= 13; r++) setTile(210, r, 'FP');

  // Castle (cols 212-223)
  for (let c = 212; c <= 223; c += 2) setTile(c, 8, 'CA');
  for (let r = 9; r <= 11; r++) {
    for (let c = 212; c <= 223; c++) setTile(c, r, 'CA');
  }
  for (let r = 12; r <= 13; r++) {
    for (let c = 212; c <= 223; c++) {
      if (c === 216 || c === 217) setTile(c, r, 'CD');
      else setTile(c, r, 'CA');
    }
  }

  return grid;
}

// ============================================================
// WORLD 5 — Underground / Castle (hardest)
// ============================================================

// Q-block contents for World 1-5
const Q_CONTENTS_L5 = {
  '22,9':  'coin',
  '25,9':  'coin',
  '40,7':  'mushroom',
  '60,9':  'coin',
  '75,5':  'coin',
  '90,7':  'coin',
  '92,7':  'star',
  '115,9': 'coin',
  '130,5': 'mushroom',
  '150,7': 'coin',
  '170,9': 'coin',
  '185,5': 'coin',
};

function buildLevel5() {
  const grid = [];
  for (let r = 0; r < LEVEL_ROWS; r++) {
    grid.push(new Array(LEVEL_COLS).fill('.'));
  }

  function setTile(col, row, id) {
    if (col >= 0 && col < LEVEL_COLS && row >= 0 && row < LEVEL_ROWS) {
      grid[row][col] = id;
    }
  }

  // Full ceiling (rows 0-1) — underground/castle theme
  for (let c = 0; c < LEVEL_COLS; c++) {
    setTile(c, 0, 'H');
    setTile(c, 1, 'H');
  }

  // Full ground (rows 13-14)
  for (let c = 0; c < LEVEL_COLS; c++) {
    setTile(c, 13, 'G');
    setTile(c, 14, 'G');
  }

  // Multi-layer hard-block platforms — rows 5, 7, 9, 11
  // Layer at row 11 (near ground)
  for (let c = 10; c <= 18; c++) setTile(c, 11, 'H');
  for (let c = 32; c <= 40; c++) setTile(c, 11, 'H');
  for (let c = 105; c <= 115; c++) setTile(c, 11, 'H');
  for (let c = 160; c <= 170; c++) setTile(c, 11, 'H');

  // Layer at row 9
  for (let c = 20; c <= 28; c++) setTile(c, 9, 'H');
  for (let c = 55; c <= 65; c++) setTile(c, 9, 'H');
  for (let c = 120; c <= 130; c++) setTile(c, 9, 'H');
  for (let c = 175; c <= 185; c++) setTile(c, 9, 'H');

  // Layer at row 7
  for (let c = 38; c <= 43; c++) setTile(c, 7, 'H');
  for (let c = 82; c <= 95; c++) setTile(c, 7, 'H');
  for (let c = 145; c <= 155; c++) setTile(c, 7, 'H');

  // Layer at row 5 (near ceiling)
  for (let c = 70; c <= 78; c++) setTile(c, 5, 'H');
  for (let c = 125; c <= 133; c++) setTile(c, 5, 'H');
  for (let c = 180; c <= 188; c++) setTile(c, 5, 'H');

  // Q-blocks (positions must match Q_CONTENTS_L5 keys)
  const qBlocks = [
    [22, 9], [25, 9],
    [40, 7],
    [60, 9],
    [75, 5],
    [90, 7], [92, 7],
    [115, 9],
    [130, 5],
    [150, 7],
    [170, 9],
    [185, 5],
  ];
  for (const [c, r] of qBlocks) setTile(c, r, 'Q');

  // Brick decorations around Q-blocks for harder density
  for (let c = 20; c <= 27; c++) {
    if (grid[9][c] !== 'Q' && grid[9][c] !== 'H') setTile(c, 9, 'B');
  }
  for (let c = 88; c <= 94; c++) {
    if (grid[7][c] !== 'Q' && grid[7][c] !== 'H') setTile(c, 7, 'B');
  }
  for (let c = 113; c <= 118; c++) {
    if (grid[9][c] !== 'Q' && grid[9][c] !== 'H') setTile(c, 9, 'B');
  }
  for (let c = 128; c <= 135; c++) {
    if (grid[5][c] !== 'Q' && grid[5][c] !== 'H') setTile(c, 5, 'B');
  }
  for (let c = 168; c <= 173; c++) {
    if (grid[9][c] !== 'Q' && grid[9][c] !== 'H') setTile(c, 9, 'B');
  }

  // Obstacle pipes (no piranhas — underground cramped feel)
  // Pipe 1: col 48, rows 11-13 (2-tile tall)
  setTile(48, 11, 'PT'); setTile(49, 11, 'PR');
  setTile(48, 12, 'PL'); setTile(49, 12, 'PB');
  setTile(48, 13, 'PL'); setTile(49, 13, 'PB');

  // Pipe 2: col 100, rows 10-13 (3-tile tall)
  setTile(100, 10, 'PT'); setTile(101, 10, 'PR');
  for (let r = 11; r <= 13; r++) {
    setTile(100, r, 'PL');
    setTile(101, r, 'PB');
  }

  // Pipe 3: col 155, rows 11-13 (2-tile tall)
  setTile(155, 11, 'PT'); setTile(156, 11, 'PR');
  setTile(155, 12, 'PL'); setTile(156, 12, 'PB');
  setTile(155, 13, 'PL'); setTile(156, 13, 'PB');

  // Staircase (cols 198-209)
  setTile(198, 13, 'H'); setTile(198, 14, 'H');
  for (let r = 12; r <= 14; r++) setTile(199, r, 'H');
  for (let r = 11; r <= 14; r++) setTile(200, r, 'H');
  for (let r = 10; r <= 14; r++) setTile(201, r, 'H');
  for (let r =  9; r <= 14; r++) setTile(202, r, 'H');
  for (let r =  8; r <= 14; r++) setTile(203, r, 'H');
  for (let r =  7; r <= 14; r++) setTile(204, r, 'H');
  for (let r =  6; r <= 14; r++) setTile(205, r, 'H');
  for (let c = 206; c <= 209; c++) {
    setTile(c, 13, 'H');
    setTile(c, 14, 'H');
  }

  // Flagpole
  setTile(210, 4, 'FF');
  for (let r = 5; r <= 13; r++) setTile(210, r, 'FP');

  // Castle (cols 212-223)
  for (let c = 212; c <= 223; c += 2) setTile(c, 8, 'CA');
  for (let r = 9; r <= 11; r++) {
    for (let c = 212; c <= 223; c++) setTile(c, r, 'CA');
  }
  for (let r = 12; r <= 13; r++) {
    for (let c = 212; c <= 223; c++) {
      if (c === 216 || c === 217) setTile(c, r, 'CD');
      else setTile(c, r, 'CA');
    }
  }

  return grid;
}

// ============================================================
// WORLD 6 — "Storm Coast" — Overworld (harder than World 4)
// ============================================================

const Q_CONTENTS_L6 = {
  '22,9':  'coin',
  '25,9':  'mushroom',
  '28,9':  'coin',
  '55,5':  'star',
  '58,5':  'coin',
  '61,5':  'coin',
  '90,9':  'mushroom',
  '93,9':  'coin',
  '96,9':  'coin',
  '120,5': 'star',
  '123,5': 'mushroom',
  '155,9': 'coin',
  '158,9': 'coin',
};

function buildLevel6() {
  const grid = [];
  for (let r = 0; r < LEVEL_ROWS; r++) grid.push(new Array(LEVEL_COLS).fill('.'));
  function setTile(col, row, id) {
    if (col >= 0 && col < LEVEL_COLS && row >= 0 && row < LEVEL_ROWS) grid[row][col] = id;
  }

  // Ground segments — big gaps (6-8 tiles) for storm-coast feel
  const groundSegs = [
    [0,30],[38,70],[79,110],[118,148],[156,180],[187,197],[210,223]
  ];
  for (const [s,e] of groundSegs)
    for (let c = s; c <= e; c++) { setTile(c,13,'G'); setTile(c,14,'G'); }

  // Pipes: [colL, topRow]
  setTile(12,11,'PT'); setTile(13,11,'PR');
  for (let r=12;r<=13;r++) { setTile(12,r,'PL'); setTile(13,r,'PB'); }

  setTile(48,10,'PT'); setTile(49,10,'PR');           // piranha
  for (let r=11;r<=13;r++) { setTile(48,r,'PL'); setTile(49,r,'PB'); }

  setTile(64,9,'PT'); setTile(65,9,'PR');
  for (let r=10;r<=13;r++) { setTile(64,r,'PL'); setTile(65,r,'PB'); }

  setTile(88,8,'PT'); setTile(89,8,'PR');
  for (let r=9;r<=13;r++) { setTile(88,r,'PL'); setTile(89,r,'PB'); }

  setTile(168,11,'PT'); setTile(169,11,'PR');
  for (let r=12;r<=13;r++) { setTile(168,r,'PL'); setTile(169,r,'PB'); }

  // Q-blocks row 9 cluster (seg 1)
  setTile(22,9,'Q'); setTile(25,9,'Q'); setTile(28,9,'Q');
  for (let c=20;c<=30;c++) if (grid[9][c]!=='Q') setTile(c,9,'B');

  // Q-blocks row 5 cluster (seg 2)
  setTile(55,5,'Q'); setTile(58,5,'Q'); setTile(61,5,'Q');
  for (let c=53;c<=63;c++) if (grid[5][c]!=='Q') setTile(c,5,'B');

  // Q-blocks row 9 cluster (seg 3)
  setTile(90,9,'Q'); setTile(93,9,'Q'); setTile(96,9,'Q');
  for (let c=91;c<=95;c++) if (grid[9][c]!=='Q') setTile(c,9,'B');

  // Q-blocks row 5 cluster (seg 4)
  setTile(120,5,'Q'); setTile(123,5,'Q');
  for (let c=118;c<=125;c++) if (grid[5][c]!=='Q') setTile(c,5,'B');

  // Q-blocks row 9 (seg 5)
  setTile(155,9,'Q'); setTile(158,9,'Q');
  for (let c=153;c<=160;c++) if (grid[9][c]!=='Q') setTile(c,9,'B');

  // Standalone brick row mid-level
  for (let c=100;c<=108;c++) setTile(c,7,'B');

  // Elevated hard-block platforms row 8
  for (let c=40;c<=46;c++) setTile(c,8,'H');
  for (let c=130;c<=137;c++) setTile(c,8,'H');

  // Staircase + flagpole + castle
  setTile(198,13,'H'); setTile(198,14,'H');
  for (let r=12;r<=14;r++) setTile(199,r,'H');
  for (let r=11;r<=14;r++) setTile(200,r,'H');
  for (let r=10;r<=14;r++) setTile(201,r,'H');
  for (let r= 9;r<=14;r++) setTile(202,r,'H');
  for (let r= 8;r<=14;r++) setTile(203,r,'H');
  for (let r= 7;r<=14;r++) setTile(204,r,'H');
  for (let r= 6;r<=14;r++) setTile(205,r,'H');
  for (let c=206;c<=209;c++) { setTile(c,13,'H'); setTile(c,14,'H'); }
  setTile(210,4,'FF');
  for (let r=5;r<=13;r++) setTile(210,r,'FP');
  for (let c=212;c<=223;c+=2) setTile(c,8,'CA');
  for (let r=9;r<=11;r++) for (let c=212;c<=223;c++) setTile(c,r,'CA');
  for (let r=12;r<=13;r++) for (let c=212;c<=223;c++) {
    if (c===216||c===217) setTile(c,r,'CD'); else setTile(c,r,'CA');
  }
  return grid;
}

// ============================================================
// WORLD 7 — "Shadow Dungeon" — Underground (zigzag platforms)
// ============================================================

const Q_CONTENTS_L7 = {
  '18,11': 'coin',
  '32,9':  'mushroom',
  '48,7':  'coin',
  '62,11': 'coin',
  '76,9':  'star',
  '92,7':  'coin',
  '106,11':'mushroom',
  '120,9': 'coin',
  '136,7': 'coin',
  '150,11':'star',
  '165,9': 'mushroom',
};

function buildLevel7() {
  const grid = [];
  for (let r = 0; r < LEVEL_ROWS; r++) grid.push(new Array(LEVEL_COLS).fill('.'));
  function setTile(col, row, id) {
    if (col >= 0 && col < LEVEL_COLS && row >= 0 && row < LEVEL_ROWS) grid[row][col] = id;
  }

  // Full H ceiling (rows 0-1)
  for (let c = 0; c < LEVEL_COLS; c++) { setTile(c,0,'H'); setTile(c,1,'H'); }

  // Full G floor (rows 13-14)
  for (let c = 0; c < LEVEL_COLS; c++) { setTile(c,13,'G'); setTile(c,14,'G'); }

  // Zigzag platforms row 11→9→7→11→... with embedded Q-blocks
  // Platform 1: row 11, cols 10-17, Q at col 18
  for (let c=10;c<=17;c++) setTile(c,11,'H');
  setTile(18,11,'Q');

  // Platform 2: row 9, cols 24-31, Q at col 32
  for (let c=24;c<=31;c++) setTile(c,9,'H');
  setTile(32,9,'Q');

  // Platform 3: row 7, cols 38-46, Q at col 48
  for (let c=38;c<=46;c++) setTile(c,7,'H');
  setTile(48,7,'Q');

  // Platform 4: row 11, cols 53-60, Q at col 62
  for (let c=53;c<=60;c++) setTile(c,11,'H');
  setTile(62,11,'Q');

  // Platform 5: row 9, cols 67-75, Q at col 76
  for (let c=67;c<=75;c++) setTile(c,9,'H');
  setTile(76,9,'Q');

  // Platform 6: row 7, cols 82-90, Q at col 92
  for (let c=82;c<=90;c++) setTile(c,7,'H');
  setTile(92,7,'Q');

  // Platform 7: row 11, cols 97-105, Q at col 106
  for (let c=97;c<=105;c++) setTile(c,11,'H');
  setTile(106,11,'Q');

  // Platform 8: row 9, cols 112-119, Q at col 120
  for (let c=112;c<=119;c++) setTile(c,9,'H');
  setTile(120,9,'Q');

  // Platform 9: row 7, cols 127-135, Q at col 136
  for (let c=127;c<=135;c++) setTile(c,7,'H');
  setTile(136,7,'Q');

  // Platform 10: row 11, cols 142-150, Q at col 150
  for (let c=142;c<=150;c++) setTile(c,11,'H');
  setTile(150,11,'Q');

  // Platform 11: row 9, cols 157-165, Q at col 165
  for (let c=157;c<=165;c++) setTile(c,9,'H');
  setTile(165,9,'Q');

  // Short obstacle pipes (rows 12-13)
  setTile(6,12,'PT');  setTile(7,12,'PR');
  setTile(6,13,'PL');  setTile(7,13,'PB');

  setTile(72,12,'PT'); setTile(73,12,'PR');
  setTile(72,13,'PL'); setTile(73,13,'PB');

  setTile(145,12,'PT'); setTile(146,12,'PR');
  setTile(145,13,'PL'); setTile(146,13,'PB');

  // Staircase + flagpole + castle
  setTile(198,13,'H'); setTile(198,14,'H');
  for (let r=12;r<=14;r++) setTile(199,r,'H');
  for (let r=11;r<=14;r++) setTile(200,r,'H');
  for (let r=10;r<=14;r++) setTile(201,r,'H');
  for (let r= 9;r<=14;r++) setTile(202,r,'H');
  for (let r= 8;r<=14;r++) setTile(203,r,'H');
  for (let r= 7;r<=14;r++) setTile(204,r,'H');
  for (let r= 6;r<=14;r++) setTile(205,r,'H');
  for (let c=206;c<=209;c++) { setTile(c,13,'H'); setTile(c,14,'H'); }
  setTile(210,4,'FF');
  for (let r=5;r<=13;r++) setTile(210,r,'FP');
  for (let c=212;c<=223;c+=2) setTile(c,8,'CA');
  for (let r=9;r<=11;r++) for (let c=212;c<=223;c++) setTile(c,r,'CA');
  for (let r=12;r<=13;r++) for (let c=212;c<=223;c++) {
    if (c===216||c===217) setTile(c,r,'CD'); else setTile(c,r,'CA');
  }
  return grid;
}

// ============================================================
// WORLD 8 — "Volcanic Wastes" — Athletic (very hard, mostly platforms)
// ============================================================

const Q_CONTENTS_L8 = {
  '30,9':  'coin',
  '33,9':  'coin',
  '36,9':  'coin',
  '55,8':  'mushroom',
  '70,7':  'coin',
  '85,8':  'star',
  '100,9': 'coin',
  '115,8': 'mushroom',
  '130,7': 'coin',
  '148,8': 'star',
  '165,9': 'mushroom',
};

function buildLevel8() {
  const grid = [];
  for (let r = 0; r < LEVEL_ROWS; r++) grid.push(new Array(LEVEL_COLS).fill('.'));
  function setTile(col, row, id) {
    if (col >= 0 && col < LEVEL_COLS && row >= 0 && row < LEVEL_ROWS) grid[row][col] = id;
  }

  // Small ground segments — mostly platforms over pits
  const groundSegs = [[0,8],[20,30],[48,54],[185,197],[210,223]];
  for (const [s,e] of groundSegs)
    for (let c=s;c<=e;c++) { setTile(c,13,'G'); setTile(c,14,'G'); }

  // Pipe 1: col 5, topRow=10 (on seg 1)
  setTile(5,10,'PT'); setTile(6,10,'PR');
  for (let r=11;r<=13;r++) { setTile(5,r,'PL'); setTile(6,r,'PB'); }

  // Pipe 2: col 24, topRow=9 (on seg 2)
  setTile(24,9,'PT'); setTile(25,9,'PR');
  for (let r=10;r<=13;r++) { setTile(24,r,'PL'); setTile(25,r,'PB'); }

  // Pipe 3 (piranha): col 50, topRow=10 (on ground stub seg 48-54)
  setTile(50,10,'PT'); setTile(51,10,'PR');
  for (let r=11;r<=13;r++) { setTile(50,r,'PL'); setTile(51,r,'PB'); }

  // Mushroom platforms across the level
  const mPlats = [
    [9,15,10],[17,20,9],[33,39,9],[43,48,11],[55,61,8],
    [65,70,10],[76,82,8],[88,93,9],[98,104,11],[110,116,8],
    [122,127,10],[133,139,9],[145,151,8],[157,163,10],[169,175,9],[179,184,11],
  ];
  for (const [s,e,r] of mPlats)
    for (let c=s;c<=e;c++) setTile(c,r,'M');

  // Q-blocks
  setTile(30,9,'Q'); setTile(33,9,'Q'); setTile(36,9,'Q');
  setTile(55,8,'Q'); setTile(70,7,'Q'); setTile(85,8,'Q');
  setTile(100,9,'Q'); setTile(115,8,'Q'); setTile(130,7,'Q');
  setTile(148,8,'Q'); setTile(165,9,'Q');

  // Brick/H accents
  for (let c=35;c<=38;c++) setTile(c,6,'B');
  for (let c=78;c<=80;c++) setTile(c,5,'H');
  for (let c=134;c<=137;c++) setTile(c,6,'B');
  setTile(160,7,'H'); setTile(161,7,'H');

  // Staircase + flagpole + castle
  setTile(198,13,'H'); setTile(198,14,'H');
  for (let r=12;r<=14;r++) setTile(199,r,'H');
  for (let r=11;r<=14;r++) setTile(200,r,'H');
  for (let r=10;r<=14;r++) setTile(201,r,'H');
  for (let r= 9;r<=14;r++) setTile(202,r,'H');
  for (let r= 8;r<=14;r++) setTile(203,r,'H');
  for (let r= 7;r<=14;r++) setTile(204,r,'H');
  for (let r= 6;r<=14;r++) setTile(205,r,'H');
  for (let c=206;c<=209;c++) { setTile(c,13,'H'); setTile(c,14,'H'); }
  setTile(210,4,'FF');
  for (let r=5;r<=13;r++) setTile(210,r,'FP');
  for (let c=212;c<=223;c+=2) setTile(c,8,'CA');
  for (let r=9;r<=11;r++) for (let c=212;c<=223;c++) setTile(c,r,'CA');
  for (let r=12;r<=13;r++) for (let c=212;c<=223;c++) {
    if (c===216||c===217) setTile(c,r,'CD'); else setTile(c,r,'CA');
  }
  return grid;
}

// ============================================================
// WORLD 9 — "Sky Citadel" — Hard Overworld (very high enemy density)
// ============================================================

const Q_CONTENTS_L9 = {
  '18,9':  'coin',
  '22,9':  'coin',
  '26,9':  'coin',
  '42,7':  'mushroom',
  '60,5':  'coin',
  '64,5':  'coin',
  '80,7':  'coin',
  '95,9':  'star',
  '110,7': 'mushroom',
  '130,5': 'coin',
  '134,5': 'coin',
  '150,7': 'star',
  '170,9': 'mushroom',
};

function buildLevel9() {
  const grid = [];
  for (let r = 0; r < LEVEL_ROWS; r++) grid.push(new Array(LEVEL_COLS).fill('.'));
  function setTile(col, row, id) {
    if (col >= 0 && col < LEVEL_COLS && row >= 0 && row < LEVEL_ROWS) grid[row][col] = id;
  }

  // Ground segments
  const groundSegs = [
    [0,24],[30,35],[41,65],[71,76],[82,110],[116,120],[126,197],[210,223]
  ];
  for (const [s,e] of groundSegs)
    for (let c=s;c<=e;c++) { setTile(c,13,'G'); setTile(c,14,'G'); }

  // Pipes: [colL, topRow]
  setTile(8,9,'PT'); setTile(9,9,'PR');
  for (let r=10;r<=13;r++) { setTile(8,r,'PL'); setTile(9,r,'PB'); }

  // Pipe 2 moved to col 42 (within seg 3 starting at col 41, no half-floating)
  setTile(42,10,'PT'); setTile(43,10,'PR');
  for (let r=11;r<=13;r++) { setTile(42,r,'PL'); setTile(43,r,'PB'); }

  setTile(55,8,'PT'); setTile(56,8,'PR');
  for (let r=9;r<=13;r++) { setTile(55,r,'PL'); setTile(56,r,'PB'); }

  setTile(90,11,'PT'); setTile(91,11,'PR');
  for (let r=12;r<=13;r++) { setTile(90,r,'PL'); setTile(91,r,'PB'); }

  // Pipe 5 (piranha): col 130, topRow=10
  setTile(130,10,'PT'); setTile(131,10,'PR');
  for (let r=11;r<=13;r++) { setTile(130,r,'PL'); setTile(131,r,'PB'); }

  // Brick tower walls (row 5)
  for (let c=16;c<=26;c++) setTile(c,5,'B');
  for (let c=58;c<=69;c++) setTile(c,5,'B');
  for (let c=128;c<=139;c++) setTile(c,5,'B');

  // Floating brick platforms row 7
  for (let c=12;c<=20;c++) setTile(c,7,'B');
  for (let c=44;c<=52;c++) setTile(c,7,'B');
  for (let c=84;c<=92;c++) setTile(c,7,'B');
  for (let c=140;c<=148;c++) setTile(c,7,'B');
  for (let c=170;c<=178;c++) setTile(c,7,'B');

  // Floating brick platforms row 9
  for (let c=18;c<=28;c++) setTile(c,9,'B');
  for (let c=62;c<=70;c++) setTile(c,9,'B');
  for (let c=104;c<=112;c++) setTile(c,9,'B');
  for (let c=150;c<=158;c++) setTile(c,9,'B');

  // Hard-block rest platforms row 8
  for (let c=34;c<=39;c++) setTile(c,8,'H');
  for (let c=74;c<=80;c++) setTile(c,8,'H');
  for (let c=118;c<=124;c++) setTile(c,8,'H');
  for (let c=162;c<=167;c++) setTile(c,8,'H');

  // Mini H-staircases (challenge structures mid-level)
  // Structure 1: cols 95-102
  setTile(95,12,'H');
  setTile(96,11,'H'); setTile(96,12,'H');
  setTile(97,10,'H'); setTile(97,11,'H'); setTile(97,12,'H');
  setTile(98,9,'H');  setTile(98,10,'H'); setTile(98,11,'H'); setTile(98,12,'H');
  setTile(99,9,'H');  setTile(99,10,'H'); setTile(99,11,'H'); setTile(99,12,'H');
  setTile(100,10,'H');setTile(100,11,'H');setTile(100,12,'H');
  setTile(101,11,'H');setTile(101,12,'H');
  setTile(102,12,'H');

  // Structure 2: cols 155-162
  setTile(155,12,'H');
  setTile(156,11,'H'); setTile(156,12,'H');
  setTile(157,10,'H'); setTile(157,11,'H'); setTile(157,12,'H');
  setTile(158,9,'H');  setTile(158,10,'H');setTile(158,11,'H');setTile(158,12,'H');
  setTile(159,9,'H');  setTile(159,10,'H');setTile(159,11,'H');setTile(159,12,'H');
  setTile(160,10,'H'); setTile(160,11,'H');setTile(160,12,'H');
  setTile(161,11,'H'); setTile(161,12,'H');
  setTile(162,12,'H');

  // Q-blocks (placed after B platforms so Q overwrites B where overlapping)
  setTile(18,9,'Q'); setTile(22,9,'Q'); setTile(26,9,'Q');
  setTile(42,7,'Q'); setTile(60,5,'Q'); setTile(64,5,'Q');
  setTile(80,7,'Q'); setTile(95,9,'Q'); setTile(110,7,'Q');
  setTile(130,5,'Q'); setTile(134,5,'Q'); setTile(150,7,'Q');
  setTile(170,9,'Q');

  // Staircase + flagpole + castle
  setTile(198,13,'H'); setTile(198,14,'H');
  for (let r=12;r<=14;r++) setTile(199,r,'H');
  for (let r=11;r<=14;r++) setTile(200,r,'H');
  for (let r=10;r<=14;r++) setTile(201,r,'H');
  for (let r= 9;r<=14;r++) setTile(202,r,'H');
  for (let r= 8;r<=14;r++) setTile(203,r,'H');
  for (let r= 7;r<=14;r++) setTile(204,r,'H');
  for (let r= 6;r<=14;r++) setTile(205,r,'H');
  for (let c=206;c<=209;c++) { setTile(c,13,'H'); setTile(c,14,'H'); }
  setTile(210,4,'FF');
  for (let r=5;r<=13;r++) setTile(210,r,'FP');
  for (let c=212;c<=223;c+=2) setTile(c,8,'CA');
  for (let r=9;r<=11;r++) for (let c=212;c<=223;c++) setTile(c,r,'CA');
  for (let r=12;r<=13;r++) for (let c=212;c<=223;c++) {
    if (c===216||c===217) setTile(c,r,'CD'); else setTile(c,r,'CA');
  }
  return grid;
}
