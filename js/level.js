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
