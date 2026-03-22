// ============================================================
// MY MARIO — World 1-1 Clone
// Vanilla JS + HTML5 Canvas, no frameworks, no build step
// ============================================================

// ============================================================
// SECTION 1: CONSTANTS & PHYSICS
// ============================================================

const CANVAS_W = 512;
const CANVAS_H = 480;
const LOGICAL_W = 256;
const LOGICAL_H = 240;
const SCALE = 2;

const TILE = 16;
const LEVEL_COLS = 224;
const LEVEL_ROWS = 15;

// Physics
const GRAVITY           = 0.5;
const MAX_FALL_SPEED    = 8.0;
const JUMP_VELOCITY     = -8.5;
const JUMP_HOLD_GRAVITY = 0.25;
const WALK_ACCELERATION = 0.15;
const RUN_ACCELERATION  = 0.25;
const WALK_MAX_SPEED    = 2.5;
const RUN_MAX_SPEED     = 5.0;
const SKID_DECELERATION = 0.35;
const GROUND_FRICTION   = 0.12;
const AIR_RESISTANCE    = 0.04;
const COYOTE_FRAMES     = 4;
const JUMP_BUFFER       = 6;
const DEATH_POP_VY      = -8.0;

// Tile IDs
const T = {
  EMPTY: '.',
  GROUND: 'G',
  BRICK: 'B',
  QUESTION: 'Q',
  USED: 'U',
  HARD: 'H',
  PIPE_TOP_L: 'PT',
  PIPE_TOP_R: 'PR',
  PIPE_BODY_L: 'PL',
  PIPE_BODY_R: 'PB',
  FLAG_POLE: 'FP',
  FLAG_FLAG: 'FF',
  CASTLE_WALL: 'CA',
  CASTLE_DOOR: 'CD',
};

const SOLID_TILES = new Set(['G','B','Q','U','H','PT','PR','PL','PB','CA','CD']);

// Game states
const STATE = {
  TITLE: 'TITLE',
  INTRO: 'INTRO',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  DEATH: 'DEATH',
  WIN: 'WIN',
  GAMEOVER: 'GAMEOVER',
};

// ============================================================
// SECTION 2: AUDIO SYSTEM
// ============================================================

const AudioSystem = (() => {
  let ctx = null;
  let musicNode = null;
  let musicGain = null;
  let musicPlaying = false;
  let audioReady = false;

  function init() {
    if (audioReady) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioReady = true;
    } catch(e) {
      console.warn('Web Audio not available');
    }
  }

  function playSFX(name) {
    if (!audioReady || !ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    switch(name) {
      case 'jump_small': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(600, now + 0.1);
        g.gain.setValueAtTime(0.15, now);
        g.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.1);
        break;
      }
      case 'jump_super': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(500, now + 0.15);
        g.gain.setValueAtTime(0.15, now);
        g.gain.linearRampToValueAtTime(0, now + 0.15);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.15);
        break;
      }
      case 'coin': {
        [988, 1319].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const t = now + i * 0.08;
          g.gain.setValueAtTime(0.2, t);
          g.gain.linearRampToValueAtTime(0, t + 0.08);
          osc.connect(g); g.connect(ctx.destination);
          osc.start(t); osc.stop(t + 0.1);
        });
        break;
      }
      case 'stomp': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.1);
        g.gain.setValueAtTime(0.2, now);
        g.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.1);
        break;
      }
      case 'break_block': {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 2000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.3, now);
        g.gain.linearRampToValueAtTime(0, now + 0.08);
        src.connect(filter); filter.connect(g); g.connect(ctx.destination);
        src.start(now);
        break;
      }
      case 'powerup_collect': {
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'square';
          osc.frequency.value = freq;
          const t = now + i * 0.06;
          g.gain.setValueAtTime(0.15, t);
          g.gain.linearRampToValueAtTime(0, t + 0.06);
          osc.connect(g); g.connect(ctx.destination);
          osc.start(t); osc.stop(t + 0.08);
        });
        break;
      }
      case 'death': {
        const notes = [440, 349, 294, 220, 175];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'square';
          osc.frequency.value = freq;
          const t = now + i * 0.12;
          g.gain.setValueAtTime(0.15, t);
          g.gain.linearRampToValueAtTime(0, t + 0.1);
          osc.connect(g); g.connect(ctx.destination);
          osc.start(t); osc.stop(t + 0.12);
        });
        break;
      }
      case 'flagpole': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.linearRampToValueAtTime(220, now + 0.8);
        g.gain.setValueAtTime(0.2, now);
        g.gain.linearRampToValueAtTime(0, now + 0.8);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.9);
        break;
      }
      case 'bump': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(80, now + 0.1);
        g.gain.setValueAtTime(0.15, now);
        g.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.12);
        break;
      }
    }
  }

  // Simple overworld melody using oscillator
  function playMusic(name) {
    if (!audioReady || !ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    stopMusic();
    musicPlaying = true;

    // Overworld theme approximation (freely composed, similar feel)
    const melody = [
      // bar 1
      [659,0.15],[659,0.15],[0,0.15],[659,0.15],[0,0.15],[523,0.15],[659,0.15],
      [784,0.30],[0,0.30],[392,0.30],
      // bar 2
      [523,0.30],[0,0.15],[392,0.30],[0,0.15],[330,0.30],
      [0,0.15],[440,0.15],[494,0.15],[466,0.15],[440,0.15],
      [392,0.20],[659,0.20],[784,0.20],[880,0.15],
      [698,0.15],[784,0.15],[0,0.08],[659,0.15],
      [523,0.15],[587,0.15],[494,0.15],[0,0.30],
      // bar 3
      [523,0.30],[0,0.15],[392,0.30],[0,0.15],[330,0.30],
      [0,0.45],[196,0.15],[196,0.15],[196,0.15],
      [196,0.15],[0,0.15],[196,0.15],[0,0.15],[247,0.15],
      [0,0.30],[262,0.15],[0,0.30],[247,0.15],
      [0,0.15],[233,0.15],[0,0.30],[220,0.15],
      [196,0.20],[262,0.20],[330,0.20],[392,0.15],
      [330,0.15],[262,0.15],[0,0.30],
    ];

    if (name !== 'overworld') return;

    let currentTime = ctx.currentTime;
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.08;
    musicGain.connect(ctx.destination);

    function scheduleMelody(startTime) {
      let t = startTime;
      melody.forEach(([freq, dur]) => {
        if (freq > 0) {
          const osc = ctx.createOscillator();
          osc.type = 'square';
          osc.frequency.value = freq;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.8, t);
          g.gain.linearRampToValueAtTime(0, t + dur * 0.9);
          osc.connect(g);
          g.connect(musicGain);
          osc.start(t);
          osc.stop(t + dur);
        }
        t += dur;
      });
      return t;
    }

    // Schedule initial play + loop
    let totalDur = melody.reduce((s, [, d]) => s + d, 0);
    let endTime = scheduleMelody(currentTime);

    // Use a timer-based loop approach
    function scheduleLoop() {
      if (!musicPlaying) return;
      const now2 = ctx.currentTime;
      endTime = scheduleMelody(endTime);
      setTimeout(scheduleLoop, totalDur * 1000 * 0.9);
    }
    setTimeout(scheduleLoop, totalDur * 1000 * 0.9);
  }

  function stopMusic() {
    musicPlaying = false;
    if (musicGain) {
      try { musicGain.disconnect(); } catch(e) {}
      musicGain = null;
    }
  }

  function pauseMusic() {
    if (ctx && ctx.state === 'running') ctx.suspend();
  }

  function resumeMusic() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  return { init, playSFX, playMusic, stopMusic, pauseMusic, resumeMusic };
})();

// ============================================================
// SECTION 3: LEVEL DATA
// ============================================================

function buildLevel() {
  // Create grid: LEVEL_ROWS rows × LEVEL_COLS cols, all empty
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

  // Pipes: [colL, topRow, height]
  const pipes = [
    [28, 11, 2, false],
    [38, 10, 3, false],
    [46, 10, 3, false],
    [57,  9, 4, false],
    [97, 10, 3, true],   // has Piranha Plant
  ];
  for (const [c, topRow, h] of pipes) {
    // Top row: PT (left), PR (right)
    setTile(c,   topRow, 'PT');
    setTile(c+1, topRow, 'PR');
    // Body rows
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
  // cols 17-20 row 9
  for (let c = 17; c <= 20; c++) setTile(c, 9, 'B');
  // col 23 row 9
  setTile(23, 9, 'B');
  // cols 25-26 row 9
  for (let c = 25; c <= 26; c++) setTile(c, 9, 'B');
  // cols 78-82 row 9 (but 78/79/80 may be Q — Q takes priority, set bricks elsewhere)
  // cols 78-82 row 9 bricks
  for (let c = 78; c <= 82; c++) {
    // only set if not already Q
    if (grid[9][c] !== 'Q') setTile(c, 9, 'B');
  }
  // Actually the spec says "cols 78-82 row 9" as bricks alongside the Q blocks
  // Let's re-read: Q blocks at (77,9),(78,5),(79,9),(80,9) — row 5 is different row
  // Bricks cols 78-82 row 9 — but 79,80 are Q at row 9. So:
  setTile(78, 9, 'B'); // not Q (Q at row 5)
  setTile(81, 9, 'B');
  setTile(82, 9, 'B');
  // Q is at 79,9 and 80,9 — already set above

  // cols 77-80 row 5 bricks (78 is Q at row 5, so skip that)
  for (let c = 77; c <= 80; c++) {
    if (grid[5][c] !== 'Q') setTile(c, 5, 'B');
  }
  // cols 108-112 row 5 (109,113 are Q)
  for (let c = 108; c <= 112; c++) {
    if (grid[5][c] !== 'Q') setTile(c, 5, 'B');
  }
  // cols 130-133 row 9
  for (let c = 130; c <= 133; c++) setTile(c, 9, 'B');
  // col 130 row 5
  setTile(130, 5, 'B');
  // cols 148-155 row 9
  for (let c = 148; c <= 155; c++) setTile(c, 9, 'B');

  // Hard block platform: cols 29-33, row 8
  for (let c = 29; c <= 33; c++) setTile(c, 8, 'H');

  // Staircase (H tiles) — fill row 14 too so base is solid
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
  // Row 8: CA at even cols
  for (let c = 212; c <= 223; c += 2) setTile(c, 8, 'CA');
  // Rows 9-11: CA full width
  for (let r = 9; r <= 11; r++) {
    for (let c = 212; c <= 223; c++) setTile(c, r, 'CA');
  }
  // Rows 12-13: CA full but CD at 216-217
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
  '16,9': 'coin',
  '21,5': 'mushroom',
  '22,9': 'coin',
  '24,9': 'coin',
  '77,9': 'coin',
  '78,5': 'mushroom',
  '79,9': 'coin',
  '80,9': 'coin',
  '109,5': 'coin',
  '110,9': 'star',
  '113,5': 'coin',
};

// ============================================================
// SECTION 4: GAME STATE
// ============================================================

let gameState = STATE.TITLE;
let grid = buildLevel();
let score = 0;
let coins = 0;
let lives = 3;
let gameTimer = 400 * 60; // frames
let cameraX = 0;
let stateTimer = 0;
let blinkTimer = 0;
let musicStarted = false;

// Mario object
let mario = createMario();

function createMario() {
  return {
    x: 48,
    y: 192,
    vx: 0,
    vy: 0,
    w: 12,
    h: 16,
    grounded: false,
    facing: 1, // 1=right, -1=left
    form: 'small', // 'small','super','fire'
    jumpHeld: false,
    coyoteFrames: 0,
    jumpBuffer: 0,
    invincibleFrames: 0,
    starFrames: 0,
    flickerVisible: true,
    animFrame: 0,
    animTimer: 0,
    dead: false,
    won: false,
    onFlagpole: false,
    flagpoleY: 0,
    jumpedThisPress: false,
  };
}

// Enemies array
let enemies = [];
// Items array (mushrooms, flowers, stars, coin popups)
let items = [];
// Fireballs
let fireballs = [];
// Active fireball count
let fireballCooldown = 0;

// Piranha plant state
let piranha = {
  x: 97 * TILE + 4,
  y: 10 * TILE,
  w: 8,
  h: 16,
  timer: 0,
  state: 'hidden', // 'hidden','rising','up','lowering'
  visible: false,
  baseY: 10 * TILE, // top of pipe rim
  targetY: 8 * TILE, // 2 tiles above pipe
};

function createEnemyGoomba(col, row) {
  const h = 16;
  return {
    type: 'goomba',
    x: col * TILE,
    y: row * TILE - h,  // feet touch top of spawn row
    vx: -1.0,
    vy: 0,
    w: 16,
    h: h,
    state: 'walk', // 'walk','squish','dead'
    stateTimer: 0,
    active: false,
    facing: -1,
  };
}

function createEnemyKoopa(col, row) {
  const h = 24;
  return {
    type: 'koopa',
    x: col * TILE,
    y: row * TILE - h,  // feet touch top of spawn row
    vx: -1.0,
    vy: 0,
    w: 14,
    h: h,
    state: 'walk', // 'walk','shell','shell_moving'
    stateTimer: 0,
    active: false,
    facing: -1,
  };
}

function spawnEnemies() {
  enemies = [];
  // Goombas  (row 13 = ground; spawn y = 13*16-16 = 192)
  // Note: pipe 2 at cols 38-39, pipe 3 at cols 46-47, pipe 4 at cols 57-58
  const goombas = [
    [22,13],[23,13],[41,13],[43,13],[80,13],[81,13],
    [107,13],[108,13],[110,13],[111,13],[149,13],[150,13],[153,13],[154,13]
  ];
  for (const [c,r] of goombas) enemies.push(createEnemyGoomba(c, r));

  // Koopa Troopas — col 60 is clear of pipe 4 (cols 57-58)
  enemies.push(createEnemyKoopa(60, 13));
  enemies.push(createEnemyKoopa(128, 13));
}

function resetLevel() {
  grid = buildLevel();
  mario = createMario();
  cameraX = 0;
  gameTimer = 400 * 60;
  spawnEnemies();
  items = [];
  fireballs = [];
  fireballCooldown = 0;
  piranha = {
    x: 97 * TILE + 4,
    y: 10 * TILE,
    w: 8,
    h: 16,
    timer: 0,
    state: 'hidden',
    visible: false,
    baseY: 10 * TILE,
    targetY: 8 * TILE,
  };
}

// ============================================================
// SECTION 5: INPUT
// ============================================================

const keys = {};
const keysDown = {};
const keysUp = {};

window.addEventListener('keydown', e => {
  if (!keys[e.code]) {
    keysDown[e.code] = true;
    // Init audio on first keypress
    AudioSystem.init();
    if (!musicStarted && (gameState === STATE.TITLE || gameState === STATE.INTRO || gameState === STATE.PLAYING)) {
      // Will start music when transitioning to PLAYING
    }
  }
  keys[e.code] = true;
  // Prevent scrolling
  if (['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)) {
    e.preventDefault();
  }
});

window.addEventListener('keyup', e => {
  keys[e.code] = false;
  keysUp[e.code] = true;
});

function isDown(codes) {
  return codes.some(c => keys[c]);
}
function isPressed(codes) {
  return codes.some(c => keysDown[c]);
}

function clearInputEdges() {
  for (const k in keysDown) delete keysDown[k];
  for (const k in keysUp) delete keysUp[k];
}

// ============================================================
// SECTION 6: TILE HELPERS
// ============================================================

function getTile(col, row) {
  if (col < 0 || col >= LEVEL_COLS || row < 0 || row >= LEVEL_ROWS) return '.';
  return grid[row][col];
}

function isSolid(col, row) {
  return SOLID_TILES.has(getTile(col, row));
}

function tileAt(worldX, worldY) {
  return { col: Math.floor(worldX / TILE), row: Math.floor(worldY / TILE) };
}

// ============================================================
// SECTION 7: COLLISION DETECTION
// ============================================================

function resolvePlayerTileCollision(entity, onHeadBonk) {
  // Horizontal pass
  entity.x += entity.vx;
  const hw = entity.w;
  const hh = entity.h;

  // Check horizontal - left
  if (entity.vx < 0) {
    const leftX = entity.x;
    const col = Math.floor(leftX / TILE);
    const rowTop = Math.floor(entity.y / TILE);
    const rowBot = Math.floor((entity.y + hh - 1) / TILE);
    for (let r = rowTop; r <= rowBot; r++) {
      if (isSolid(col, r)) {
        entity.x = (col + 1) * TILE;
        entity.vx = 0;
        break;
      }
    }
  } else if (entity.vx > 0) {
    const rightX = entity.x + hw - 1;
    const col = Math.floor(rightX / TILE);
    const rowTop = Math.floor(entity.y / TILE);
    const rowBot = Math.floor((entity.y + hh - 1) / TILE);
    for (let r = rowTop; r <= rowBot; r++) {
      if (isSolid(col, r)) {
        entity.x = col * TILE - hw;
        entity.vx = 0;
        break;
      }
    }
  }

  // Vertical pass (2px horizontal inset)
  entity.y += entity.vy;
  let grounded = false;
  const inset = 2;

  if (entity.vy < 0) {
    // Moving up - check head
    const topY = entity.y;
    const row = Math.floor(topY / TILE);
    const colL = Math.floor((entity.x + inset) / TILE);
    const colR = Math.floor((entity.x + hw - 1 - inset) / TILE);
    let bonked = false;
    for (let c = colL; c <= colR; c++) {
      if (isSolid(c, row)) {
        entity.y = (row + 1) * TILE;
        entity.vy = 0;
        if (!bonked && onHeadBonk) {
          onHeadBonk(c, row);
          bonked = true;
        }
        break;
      }
    }
  } else if (entity.vy >= 0) {
    // Moving down - check feet
    const botY = entity.y + hh;
    const row = Math.floor(botY / TILE);
    const colL = Math.floor((entity.x + inset) / TILE);
    const colR = Math.floor((entity.x + hw - 1 - inset) / TILE);
    for (let c = colL; c <= colR; c++) {
      if (isSolid(c, row)) {
        entity.y = row * TILE - hh;
        entity.vy = 0;
        grounded = true;
        break;
      }
    }
    // Also check if standing exactly on a tile (vy==0)
    if (!grounded && entity.vy === 0) {
      const standRow = Math.floor((entity.y + hh) / TILE);
      for (let c = colL; c <= colR; c++) {
        if (isSolid(c, standRow)) {
          grounded = true;
          break;
        }
      }
    }
  }

  return grounded;
}

function resolveEnemyTileCollision(entity) {
  const hw = entity.w;
  const hh = entity.h;

  // Horizontal
  entity.x += entity.vx;
  if (entity.vx < 0) {
    const col = Math.floor(entity.x / TILE);
    const rowTop = Math.floor(entity.y / TILE);
    const rowBot = Math.floor((entity.y + hh - 1) / TILE);
    for (let r = rowTop; r <= rowBot; r++) {
      if (isSolid(col, r)) {
        entity.x = (col + 1) * TILE;
        entity.vx = -entity.vx;
        break;
      }
    }
  } else if (entity.vx > 0) {
    const col = Math.floor((entity.x + hw - 1) / TILE);
    const rowTop = Math.floor(entity.y / TILE);
    const rowBot = Math.floor((entity.y + hh - 1) / TILE);
    for (let r = rowTop; r <= rowBot; r++) {
      if (isSolid(col, r)) {
        entity.x = col * TILE - hw;
        entity.vx = -entity.vx;
        break;
      }
    }
  }

  // Vertical
  entity.y += entity.vy;
  let grounded = false;
  const inset = 1;

  if (entity.vy < 0) {
    const row = Math.floor(entity.y / TILE);
    const colL = Math.floor((entity.x + inset) / TILE);
    const colR = Math.floor((entity.x + hw - 1 - inset) / TILE);
    for (let c = colL; c <= colR; c++) {
      if (isSolid(c, row)) {
        entity.y = (row + 1) * TILE;
        entity.vy = 0;
        break;
      }
    }
  } else {
    const botY = entity.y + hh;
    const row = Math.floor(botY / TILE);
    const colL = Math.floor((entity.x + inset) / TILE);
    const colR = Math.floor((entity.x + hw - 1 - inset) / TILE);
    for (let c = colL; c <= colR; c++) {
      if (isSolid(c, row)) {
        entity.y = row * TILE - hh;
        entity.vy = 0;
        grounded = true;
        break;
      }
    }
    if (!grounded && entity.vy === 0) {
      const standRow = Math.floor((entity.y + hh) / TILE);
      for (let c = colL; c <= colR; c++) {
        if (isSolid(c, standRow)) {
          grounded = true;
          break;
        }
      }
    }
  }

  return grounded;
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ============================================================
// SECTION 8: MARIO HEAD-BONK CALLBACK
// ============================================================

function handleHeadBonk(col, row) {
  const tile = getTile(col, row);
  if (tile === 'Q') {
    AudioSystem.playSFX('bump');
    // Trigger Q-block animation (handled visually by bump timer)
    const key = `${col},${row}`;
    const content = Q_CONTENTS[key];
    grid[row][col] = 'U'; // Mark as used
    if (content === 'coin') {
      score += 200;
      coins++;
      if (coins >= 100) { coins -= 100; lives++; }
      AudioSystem.playSFX('coin');
      // Spawn coin popup
      items.push({
        type: 'coinpopup',
        x: col * TILE + 2,
        y: (row - 1) * TILE,
        vy: -2,
        timer: 30,
      });
    } else if (content === 'mushroom' || content === 'flower') {
      score += 1000;
      if (mario.form === 'small') {
        // Spawn mushroom
        items.push({
          type: 'mushroom',
          x: col * TILE,
          y: (row - 1) * TILE,
          vx: 1.5,
          vy: 0,
          w: 14,
          h: 14,
          grounded: false,
        });
      } else {
        // Spawn fire flower
        items.push({
          type: 'fireflower',
          x: col * TILE + 1,
          y: (row - 1) * TILE,
          vx: 0,
          vy: 0,
          w: 14,
          h: 14,
          grounded: false,
        });
      }
      AudioSystem.playSFX('bump');
    } else if (content === 'star') {
      items.push({
        type: 'star',
        x: col * TILE,
        y: (row - 1) * TILE,
        vx: 2,
        vy: -4,
        w: 12,
        h: 12,
        grounded: false,
      });
      AudioSystem.playSFX('bump');
    }
  } else if (tile === 'B') {
    if (mario.form !== 'small') {
      // Break brick
      AudioSystem.playSFX('break_block');
      score += 50;
      grid[row][col] = '.';
    } else {
      // Bump, don't break
      AudioSystem.playSFX('bump');
    }
  } else if (tile === 'U' || tile === 'H') {
    AudioSystem.playSFX('bump');
  }
}

// ============================================================
// SECTION 9: MARIO PHYSICS UPDATE
// ============================================================

function updateMario() {
  if (mario.dead) {
    // Death animation
    mario.vy += GRAVITY;
    if (mario.vy > MAX_FALL_SPEED) mario.vy = MAX_FALL_SPEED;
    mario.y += mario.vy;
    return;
  }

  if (mario.onFlagpole) {
    // Slide down flagpole
    mario.y += 1.5;
    if (mario.y >= 13 * TILE - mario.h) {
      mario.onFlagpole = false;
      // Trigger win
      gameState = STATE.WIN;
      stateTimer = 4 * 60;
      AudioSystem.playSFX('flagpole');
      // Award time bonus
      const timeBonus = Math.floor((gameTimer / 60)) * 50;
      score += timeBonus;
      AudioSystem.stopMusic();
    }
    return;
  }

  const left  = isDown(['ArrowLeft', 'KeyA']);
  const right = isDown(['ArrowRight', 'KeyD']);
  const run   = isDown(['KeyX', 'ShiftLeft', 'ShiftRight']);
  const jumpPressed = isPressed(['Space', 'KeyZ']);
  const jumpHeld    = isDown(['Space', 'KeyZ']);

  // Jump buffer
  if (jumpPressed) mario.jumpBuffer = JUMP_BUFFER;
  else if (mario.jumpBuffer > 0) mario.jumpBuffer--;

  // Coyote time
  if (mario.grounded) mario.coyoteFrames = COYOTE_FRAMES;
  else if (mario.coyoteFrames > 0) mario.coyoteFrames--;

  // Horizontal movement
  const accel = run ? RUN_ACCELERATION : WALK_ACCELERATION;
  const maxSpd = run ? RUN_MAX_SPEED : WALK_MAX_SPEED;

  if (left && !right) {
    mario.facing = -1;
    // Check for skid
    if (mario.vx > 0.5 && mario.grounded) {
      mario.vx -= SKID_DECELERATION;
    } else {
      mario.vx -= accel;
    }
    if (mario.vx < -maxSpd) mario.vx = -maxSpd;
  } else if (right && !left) {
    mario.facing = 1;
    if (mario.vx < -0.5 && mario.grounded) {
      mario.vx += SKID_DECELERATION;
    } else {
      mario.vx += accel;
    }
    if (mario.vx > maxSpd) mario.vx = maxSpd;
  } else {
    // Friction / deceleration
    if (mario.grounded) {
      if (Math.abs(mario.vx) < GROUND_FRICTION) {
        mario.vx = 0;
      } else {
        mario.vx -= Math.sign(mario.vx) * GROUND_FRICTION;
      }
    } else {
      if (Math.abs(mario.vx) < AIR_RESISTANCE) {
        mario.vx = 0;
      } else {
        mario.vx -= Math.sign(mario.vx) * AIR_RESISTANCE;
      }
    }
  }

  // Jump
  if (mario.jumpBuffer > 0 && mario.coyoteFrames > 0 && !mario.jumpedThisPress) {
    mario.vy = JUMP_VELOCITY;
    mario.coyoteFrames = 0;
    mario.jumpBuffer = 0;
    mario.jumpedThisPress = true;
    mario.grounded = false;
    const sfx = mario.form === 'small' ? 'jump_small' : 'jump_super';
    AudioSystem.playSFX(sfx);
  }

  // Allow jump again after releasing
  if (!isDown(['Space', 'KeyZ'])) {
    mario.jumpedThisPress = false;
  }

  // Variable height jump
  if (jumpHeld && mario.vy < 0) {
    mario.vy += JUMP_HOLD_GRAVITY;
  } else {
    mario.vy += GRAVITY;
  }
  if (mario.vy > MAX_FALL_SPEED) mario.vy = MAX_FALL_SPEED;

  // Tile collision
  mario.grounded = resolvePlayerTileCollision(mario, handleHeadBonk);

  // World bounds (left edge)
  if (mario.x < 0) { mario.x = 0; mario.vx = 0; }

  // Fall into pit
  if (mario.y > LOGICAL_H + 32) {
    triggerMarioDeath();
    return;
  }

  // Flagpole check
  const marioColCenter = Math.floor((mario.x + mario.w / 2) / TILE);
  if (marioColCenter === 210 && !mario.won) {
    mario.won = true;
    mario.onFlagpole = true;
    mario.vx = 0;
    mario.vy = 0;
    mario.x = 210 * TILE - mario.w / 2;
    // Height bonus
    const marioRow = Math.floor(mario.y / TILE);
    let bonus = 100;
    if (marioRow <= 5) bonus = 5000;
    else if (marioRow <= 7) bonus = 2000;
    else if (marioRow <= 9) bonus = 1000;
    else if (marioRow <= 11) bonus = 500;
    score += bonus;
    AudioSystem.playSFX('flagpole');
    AudioSystem.stopMusic();
  }

  // Invincibility flicker
  if (mario.invincibleFrames > 0) {
    mario.invincibleFrames--;
    mario.flickerVisible = (Math.floor(mario.invincibleFrames / 3) % 2 === 0);
  } else {
    mario.flickerVisible = true;
  }

  if (mario.starFrames > 0) {
    mario.starFrames--;
    mario.flickerVisible = (Math.floor(mario.starFrames / 3) % 2 === 0);
  }

  // Animation
  mario.animTimer++;
  if (mario.grounded && (left || right)) {
    if (mario.animTimer % 6 === 0) mario.animFrame = (mario.animFrame + 1) % 4;
  } else if (!mario.grounded) {
    mario.animFrame = 2; // jump frame
  } else {
    mario.animFrame = 0; // stand frame
  }

  // Fireball
  if (mario.form === 'fire' && isPressed(['KeyX'])) {
    if (fireballCooldown <= 0 && fireballs.filter(f => f.active).length < 2) {
      fireballs.push({
        x: mario.x + (mario.facing === 1 ? mario.w : 0),
        y: mario.y + mario.h / 2 - 4,
        vx: 6 * mario.facing,
        vy: 3,
        w: 8,
        h: 8,
        active: true,
        bounces: 0,
      });
      fireballCooldown = 10;
    }
  }
  if (fireballCooldown > 0) fireballCooldown--;
}

function triggerMarioDeath() {
  if (mario.invincibleFrames > 0 || mario.dead) return;
  mario.dead = true;
  mario.vy = DEATH_POP_VY;
  mario.vx = 0;
  AudioSystem.playSFX('death');
  AudioSystem.stopMusic();
  gameState = STATE.DEATH;
  stateTimer = 2 * 60;
}

function damageMario() {
  if (mario.invincibleFrames > 0 || mario.starFrames > 0) return;
  if (mario.form === 'fire') {
    mario.form = 'super';
    mario.invincibleFrames = 2 * 60;
  } else if (mario.form === 'super') {
    mario.form = 'small';
    mario.h = 16;
    mario.invincibleFrames = 2 * 60;
  } else {
    triggerMarioDeath();
  }
}

// ============================================================
// SECTION 10: ENEMY UPDATES
// ============================================================

function updateEnemies() {
  const viewRight = cameraX + LOGICAL_W + 300;

  for (const enemy of enemies) {
    if (enemy.state === 'dead') continue;

    // Activate when in range
    if (!enemy.active && enemy.x < viewRight) {
      enemy.active = true;
    }
    if (!enemy.active) continue;

    // Deactivate if far behind camera
    if (enemy.x + enemy.w < cameraX - 32) {
      enemy.state = 'dead';
      continue;
    }

    if (enemy.type === 'goomba') {
      updateGoomba(enemy);
    } else if (enemy.type === 'koopa') {
      updateKoopa(enemy);
    }

    // Check Mario collision
    if (enemy.state === 'walk' || enemy.state === 'shell_moving' || enemy.state === 'shell') {
      checkEnemyMarioCollision(enemy);
    }
  }

  // Piranha plant
  updatePiranha();
}

function updateGoomba(g) {
  if (g.state === 'squish') {
    g.stateTimer++;
    if (g.stateTimer >= 30) g.state = 'dead';
    return;
  }

  // Gravity
  g.vy += GRAVITY;
  if (g.vy > MAX_FALL_SPEED) g.vy = MAX_FALL_SPEED;

  const grounded = resolveEnemyTileCollision(g);
  if (!grounded && g.vy > 0 && g.y > LOGICAL_H + 32) {
    g.state = 'dead';
  }
}

function updateKoopa(k) {
  if (k.state === 'shell') {
    k.stateTimer++;
    return;
  }

  // Gravity
  k.vy += GRAVITY;
  if (k.vy > MAX_FALL_SPEED) k.vy = MAX_FALL_SPEED;

  if (k.state === 'walk') {
    // Check tile below before walking off ledge
    const checkCol = k.vx < 0
      ? Math.floor((k.x - 1) / TILE)
      : Math.floor((k.x + k.w) / TILE);
    const groundRow = Math.floor((k.y + k.h + 1) / TILE);
    if (!isSolid(checkCol, groundRow) && k.vy >= 0) {
      k.vx = -k.vx;
    }
  }

  const grounded = resolveEnemyTileCollision(k);
  if (!grounded && k.y > LOGICAL_H + 32) k.state = 'dead';

  if (k.state === 'shell_moving') {
    // Shell kills other enemies
    for (const other of enemies) {
      if (other === k || other.state === 'dead') continue;
      if (rectsOverlap(k.x, k.y, k.w, k.h, other.x, other.y, other.w, other.h)) {
        other.state = 'dead';
        score += 200;
      }
    }
  }
}

function updatePiranha() {
  const pipeX = 97 * TILE;
  const marioNear = Math.abs(mario.x - pipeX) < TILE;

  piranha.timer++;
  const cycle = 120; // 2s at 60fps

  if (piranha.state === 'hidden') {
    if (!marioNear && piranha.timer >= cycle) {
      piranha.state = 'rising';
      piranha.timer = 0;
    }
    piranha.visible = false;
    piranha.y = piranha.baseY;
  } else if (piranha.state === 'rising') {
    piranha.y -= 0.5;
    piranha.visible = true;
    if (piranha.y <= piranha.targetY) {
      piranha.y = piranha.targetY;
      piranha.state = 'up';
      piranha.timer = 0;
    }
  } else if (piranha.state === 'up') {
    piranha.visible = true;
    if (piranha.timer >= cycle) {
      piranha.state = 'lowering';
      piranha.timer = 0;
    }
    // Damage Mario
    if (rectsOverlap(piranha.x, piranha.y, piranha.w, piranha.h,
                     mario.x, mario.y, mario.w, mario.h)) {
      damageMario();
    }
  } else if (piranha.state === 'lowering') {
    piranha.y += 0.5;
    piranha.visible = true;
    if (piranha.y >= piranha.baseY) {
      piranha.y = piranha.baseY;
      piranha.state = 'hidden';
      piranha.timer = 0;
    }
  }
}

function checkEnemyMarioCollision(enemy) {
  if (!rectsOverlap(mario.x, mario.y, mario.w, mario.h,
                    enemy.x, enemy.y, enemy.w, enemy.h)) return;

  // Star invincibility
  if (mario.starFrames > 0) {
    if (enemy.type === 'goomba') enemy.state = 'dead';
    else if (enemy.type === 'koopa') enemy.state = 'dead';
    score += 200;
    return;
  }

  // Stomp check: mario falling, feet in top half of enemy
  const marioFeet = mario.y + mario.h;
  const enemyMid = enemy.y + enemy.h / 2;
  const hOverlap = Math.min(mario.x + mario.w, enemy.x + enemy.w) - Math.max(mario.x, enemy.x);

  if (mario.vy > 0 && marioFeet > enemy.y + 1 && marioFeet < enemy.y + enemy.h * 0.6 && hOverlap > 1) {
    // Stomp!
    mario.vy = -5;
    mario.grounded = false;
    if (enemy.type === 'goomba') {
      if (enemy.state === 'walk') {
        enemy.state = 'squish';
        enemy.stateTimer = 0;
        score += 100;
        AudioSystem.playSFX('stomp');
      }
    } else if (enemy.type === 'koopa') {
      if (enemy.state === 'walk') {
        enemy.state = 'shell';
        enemy.stateTimer = 0;
        enemy.vx = 0;
        score += 100;
        AudioSystem.playSFX('stomp');
      } else if (enemy.state === 'shell') {
        // Kick the shell
        const kickDir = mario.x < enemy.x ? 1 : -1;
        enemy.vx = 8 * kickDir;
        enemy.state = 'shell_moving';
        AudioSystem.playSFX('stomp');
      } else if (enemy.state === 'shell_moving') {
        // Stop the shell
        enemy.vx = 0;
        enemy.state = 'shell';
        enemy.stateTimer = 0;
        AudioSystem.playSFX('stomp');
      }
    }
  } else {
    // Mario takes damage
    damageMario();
  }
}

// ============================================================
// SECTION 11: ITEM UPDATES
// ============================================================

function updateItems() {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];

    if (item.type === 'coinpopup') {
      item.y += item.vy;
      item.timer--;
      if (item.timer <= 0) items.splice(i, 1);
      continue;
    }

    // Gravity for mushroom/star
    if (item.type === 'mushroom' || item.type === 'star') {
      item.vy += GRAVITY;
      if (item.vy > MAX_FALL_SPEED) item.vy = MAX_FALL_SPEED;
    }

    // Star bounces
    if (item.type === 'star') {
      // Horizontal movement
      item.x += item.vx;
      // Check horizontal collision
      if (item.vx < 0) {
        const col = Math.floor(item.x / TILE);
        const rowT = Math.floor(item.y / TILE);
        const rowB = Math.floor((item.y + item.h - 1) / TILE);
        for (let r = rowT; r <= rowB; r++) {
          if (isSolid(col, r)) { item.x = (col+1)*TILE; item.vx = -item.vx; break; }
        }
      } else {
        const col = Math.floor((item.x + item.w - 1) / TILE);
        const rowT = Math.floor(item.y / TILE);
        const rowB = Math.floor((item.y + item.h - 1) / TILE);
        for (let r = rowT; r <= rowB; r++) {
          if (isSolid(col, r)) { item.x = col*TILE - item.w; item.vx = -item.vx; break; }
        }
      }
      item.y += item.vy;
      const botY = item.y + item.h;
      const row = Math.floor(botY / TILE);
      const colL = Math.floor(item.x / TILE);
      const colR = Math.floor((item.x + item.w - 1) / TILE);
      for (let c = colL; c <= colR; c++) {
        if (isSolid(c, row)) {
          item.y = row * TILE - item.h;
          item.vy = item.vy * -0.9; // bounce
          if (Math.abs(item.vy) < 0.5) item.vy = -4; // min bounce
          break;
        }
      }
    } else if (item.type === 'mushroom') {
      // Mushroom: horizontal movement, gravity
      item.x += item.vx;
      if (item.vx < 0) {
        const col = Math.floor(item.x / TILE);
        const rowT = Math.floor(item.y / TILE);
        const rowB = Math.floor((item.y + item.h - 1) / TILE);
        for (let r = rowT; r <= rowB; r++) {
          if (isSolid(col, r)) { item.x = (col+1)*TILE; item.vx = -item.vx; break; }
        }
      } else {
        const col = Math.floor((item.x + item.w - 1) / TILE);
        const rowT = Math.floor(item.y / TILE);
        const rowB = Math.floor((item.y + item.h - 1) / TILE);
        for (let r = rowT; r <= rowB; r++) {
          if (isSolid(col, r)) { item.x = col*TILE - item.w; item.vx = -item.vx; break; }
        }
      }
      item.y += item.vy;
      const botY = item.y + item.h;
      const row = Math.floor(botY / TILE);
      const colL = Math.floor(item.x / TILE);
      const colR = Math.floor((item.x + item.w - 1) / TILE);
      for (let c = colL; c <= colR; c++) {
        if (isSolid(c, row)) {
          item.y = row * TILE - item.h;
          item.vy = 0;
          item.grounded = true;
          break;
        }
      }
      if (item.y > LOGICAL_H + 32) { items.splice(i, 1); continue; }
    }

    // Check Mario collision
    if (item.type !== 'coinpopup' &&
        rectsOverlap(mario.x, mario.y, mario.w, mario.h,
                     item.x, item.y, item.w, item.h)) {
      collectItem(item);
      items.splice(i, 1);
      continue;
    }

    // Remove if off screen bottom
    if (item.y > LOGICAL_H + 64) { items.splice(i, 1); }
  }
}

function collectItem(item) {
  AudioSystem.playSFX('powerup_collect');
  if (item.type === 'mushroom') {
    score += 1000;
    if (mario.form === 'small') {
      mario.form = 'super';
      mario.h = 24;
      mario.y -= 8; // grow upward
    }
  } else if (item.type === 'fireflower') {
    score += 1000;
    if (mario.form !== 'fire') {
      mario.form = 'fire';
      mario.h = 24;
      if (mario.form === 'small') mario.y -= 8;
    }
  } else if (item.type === 'star') {
    score += 1000;
    mario.starFrames = 10 * 60;
  }
}

// ============================================================
// SECTION 12: FIREBALL UPDATES
// ============================================================

function updateFireballs() {
  for (let i = fireballs.length - 1; i >= 0; i--) {
    const fb = fireballs[i];
    if (!fb.active) { fireballs.splice(i, 1); continue; }

    fb.vy += GRAVITY;
    fb.x += fb.vx;

    // Horizontal wall collision
    const col = fb.vx > 0 ? Math.floor((fb.x + fb.w) / TILE) : Math.floor(fb.x / TILE);
    const rowT = Math.floor(fb.y / TILE);
    const rowB = Math.floor((fb.y + fb.h - 1) / TILE);
    for (let r = rowT; r <= rowB; r++) {
      if (isSolid(col, r)) { fb.active = false; break; }
    }
    if (!fb.active) { fireballs.splice(i, 1); continue; }

    fb.y += fb.vy;
    // Vertical collision
    const botRow = Math.floor((fb.y + fb.h) / TILE);
    const colL = Math.floor(fb.x / TILE);
    const colR = Math.floor((fb.x + fb.w - 1) / TILE);
    for (let c = colL; c <= colR; c++) {
      if (isSolid(c, botRow)) {
        fb.y = botRow * TILE - fb.h;
        fb.vy *= -0.75;
        fb.bounces++;
        if (fb.bounces >= 5) { fb.active = false; }
        break;
      }
    }
    if (!fb.active) { fireballs.splice(i, 1); continue; }

    // Off screen
    if (fb.y > LOGICAL_H + 32 || fb.x < cameraX - 32 || fb.x > cameraX + LOGICAL_W + 32) {
      fb.active = false;
      fireballs.splice(i, 1);
      continue;
    }

    // Hit enemies
    for (const enemy of enemies) {
      if (enemy.state === 'dead' || enemy.state === 'squish') continue;
      if (rectsOverlap(fb.x, fb.y, fb.w, fb.h, enemy.x, enemy.y, enemy.w, enemy.h)) {
        if (enemy.type === 'goomba') enemy.state = 'dead';
        else if (enemy.type === 'koopa') enemy.state = 'dead';
        score += 200;
        fb.active = false;
        fireballs.splice(i, 1);
        AudioSystem.playSFX('stomp');
        break;
      }
    }
  }
}

// ============================================================
// SECTION 13: CAMERA UPDATE
// ============================================================

function updateCamera() {
  const levelWidth = LEVEL_COLS * TILE; // 224*16 = 3584
  const target = mario.x - 128;
  if (target > cameraX) cameraX = target;
  if (cameraX < 0) cameraX = 0;
  const maxCamera = levelWidth - LOGICAL_W;
  if (cameraX > maxCamera) cameraX = maxCamera;
}

// ============================================================
// SECTION 14: DRAWING HELPERS
// ============================================================

// World to screen conversion
function wx(worldX) { return (worldX - cameraX) * SCALE; }
function wy(worldY) { return worldY * SCALE; }

function drawTile(ctx, id, col, row) {
  const sx = (col * TILE - cameraX) * SCALE;
  const sy = row * TILE * SCALE;
  const sz = TILE * SCALE; // 32px

  // Cull off-screen tiles
  if (sx + sz < 0 || sx > CANVAS_W) return;

  switch(id) {
    case 'G': {
      // Check if top of ground (row above is not ground)
      const above = getTile(col, row - 1);
      if (above === '.' || above === 'B' || above === 'Q' || above === 'U' || above === 'H') {
        // Top ground tile: green strip on top + brown fill
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(sx, sy, sz, sz);
        ctx.fillStyle = '#228B22';
        ctx.fillRect(sx, sy, sz, 4);
        // Dark green line
        ctx.fillStyle = '#145214';
        ctx.fillRect(sx, sy + 4, sz, 2);
      } else {
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(sx, sy, sz, sz);
      }
      break;
    }
    case 'B': {
      ctx.fillStyle = '#CD853F';
      ctx.fillRect(sx, sy, sz, sz);
      // Mortar lines
      ctx.fillStyle = '#8B6347';
      ctx.fillRect(sx, sy, sz, 2);
      ctx.fillRect(sx, sy + sz/2, sz, 2);
      ctx.fillRect(sx, sy, 2, sz);
      ctx.fillRect(sx + sz/2, sy + 2, 2, sz/2 - 2);
      ctx.fillRect(sx + sz/4, sy + sz/2 + 2, 2, sz/2 - 2);
      ctx.fillRect(sx + 3*sz/4, sy + sz/2 + 2, 2, sz/2 - 2);
      break;
    }
    case 'Q': {
      ctx.fillStyle = '#FF8C00';
      ctx.fillRect(sx, sy, sz, sz);
      // Border
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(sx, sy, sz, 2);
      ctx.fillRect(sx, sy+sz-2, sz, 2);
      ctx.fillRect(sx, sy, 2, sz);
      ctx.fillRect(sx+sz-2, sy, 2, sz);
      // ? mark
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${sz*0.6}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', sx + sz/2, sy + sz/2 + 1);
      break;
    }
    case 'U': {
      ctx.fillStyle = '#888888';
      ctx.fillRect(sx, sy, sz, sz);
      ctx.fillStyle = '#666666';
      ctx.fillRect(sx, sy, sz, 2);
      ctx.fillRect(sx, sy+sz-2, sz, 2);
      ctx.fillRect(sx, sy, 2, sz);
      ctx.fillRect(sx+sz-2, sy, 2, sz);
      break;
    }
    case 'H': {
      // Hard/immovable block — same look as bricks but slightly darker
      ctx.fillStyle = '#B87333';
      ctx.fillRect(sx, sy, sz, sz);
      ctx.fillStyle = '#8B5E3C';
      ctx.fillRect(sx, sy, sz, 2);
      ctx.fillRect(sx, sy + sz/2, sz, 2);
      ctx.fillRect(sx, sy, 2, sz);
      ctx.fillRect(sx + sz/2, sy + 2, 2, sz/2 - 2);
      ctx.fillRect(sx + sz/4, sy + sz/2 + 2, 2, sz/2 - 2);
      ctx.fillRect(sx + 3*sz/4, sy + sz/2 + 2, 2, sz/2 - 2);
      break;
    }
    case 'PT': {
      // Pipe top-left
      ctx.fillStyle = '#006400';
      ctx.fillRect(sx, sy, sz, sz);
      ctx.fillStyle = '#008000';
      ctx.fillRect(sx + 4, sy + 4, sz - 8, sz - 4);
      ctx.fillStyle = '#00A000';
      ctx.fillRect(sx + 4, sy + 4, 4, sz - 4);
      break;
    }
    case 'PR': {
      // Pipe top-right
      ctx.fillStyle = '#006400';
      ctx.fillRect(sx, sy, sz, sz);
      ctx.fillStyle = '#008000';
      ctx.fillRect(sx, sy + 4, sz - 4, sz - 4);
      ctx.fillStyle = '#00A000';
      ctx.fillRect(sx, sy + 4, 4, sz - 4);
      break;
    }
    case 'PL': {
      // Pipe body-left
      ctx.fillStyle = '#006400';
      ctx.fillRect(sx, sy, sz, sz);
      ctx.fillStyle = '#007000';
      ctx.fillRect(sx + 4, sy, sz - 8, sz);
      ctx.fillStyle = '#009000';
      ctx.fillRect(sx + 4, sy, 4, sz);
      break;
    }
    case 'PB': {
      // Pipe body-right
      ctx.fillStyle = '#006400';
      ctx.fillRect(sx, sy, sz, sz);
      ctx.fillStyle = '#007000';
      ctx.fillRect(sx, sy, sz - 4, sz);
      ctx.fillStyle = '#009000';
      ctx.fillRect(sx, sy, 4, sz);
      break;
    }
    case 'FP': {
      // Flagpole - gray vertical
      ctx.fillStyle = '#AAAAAA';
      ctx.fillRect(sx + sz/2 - 2, sy, 4, sz);
      break;
    }
    case 'FF': {
      // Flag
      ctx.fillStyle = '#AAAAAA';
      ctx.fillRect(sx + sz/2 - 2, sy, 4, sz);
      ctx.fillStyle = '#CC0000';
      ctx.beginPath();
      ctx.moveTo(sx + sz/2 + 2, sy + 2);
      ctx.lineTo(sx + sz/2 + 2 + 16, sy + 8);
      ctx.lineTo(sx + sz/2 + 2, sy + 14);
      ctx.fill();
      break;
    }
    case 'CA': {
      ctx.fillStyle = '#888888';
      ctx.fillRect(sx, sy, sz, sz);
      ctx.fillStyle = '#666666';
      ctx.fillRect(sx, sy, sz, 2);
      ctx.fillRect(sx, sy, 2, sz);
      ctx.fillRect(sx + sz/2, sy, 2, sz);
      ctx.fillRect(sx, sy + sz/2, sz, 2);
      break;
    }
    case 'CD': {
      ctx.fillStyle = '#222222';
      ctx.fillRect(sx, sy, sz, sz);
      break;
    }
  }
}

function drawMario(ctx) {
  if (!mario.flickerVisible) return;

  const x = wx(mario.x);
  const y = wy(mario.y);
  const w = mario.w * SCALE;
  const h = mario.h * SCALE;
  const f = mario.facing;

  // Colors
  const hatShirt = '#CC0000';
  const skin = '#FC9838';
  const overalls = '#0000CC';
  const shoes = '#5C3317';
  const hair = '#5C3317';

  if (mario.starFrames > 0) {
    // Rainbow flicker for star
    const colors = ['#FF0000','#FF8800','#FFFF00','#00FF00','#0000FF','#FF00FF'];
    ctx.fillStyle = colors[Math.floor(Date.now()/80) % colors.length];
    ctx.fillRect(x, y, w, h);
    return;
  }

  ctx.save();
  if (f === -1) {
    // Flip horizontally
    ctx.translate(x + w, 0);
    ctx.scale(-1, 1);
    drawMarioShape(ctx, 0, y, w, h, mario.form, mario.animFrame);
  } else {
    drawMarioShape(ctx, x, y, w, h, mario.form, mario.animFrame);
  }
  ctx.restore();
}

function drawMarioShape(ctx, x, y, w, h, form, frame) {
  const s = SCALE;
  // Hat
  ctx.fillStyle = '#CC0000';
  ctx.fillRect(x + 2*s, y, 8*s, 3*s);
  ctx.fillRect(x, y + 3*s, 10*s, 2*s);
  // Face
  ctx.fillStyle = '#FC9838';
  ctx.fillRect(x + 1*s, y + 4*s, 9*s, 5*s);
  // Eye
  ctx.fillStyle = '#000000';
  ctx.fillRect(x + 6*s, y + 5*s, 2*s, 2*s);
  // Mustache
  ctx.fillStyle = '#5C3317';
  ctx.fillRect(x + 3*s, y + 7*s, 7*s, 2*s);
  // Overalls
  ctx.fillStyle = '#0000CC';
  if (form === 'small') {
    ctx.fillRect(x + 1*s, y + 9*s, 9*s, 4*s);
    ctx.fillRect(x + 3*s, y + 9*s, 5*s, 2*s); // bib
  } else {
    ctx.fillRect(x + 1*s, y + 9*s, 9*s, 9*s);
    ctx.fillRect(x + 3*s, y + 9*s, 5*s, 3*s);
  }
  // Shirt
  ctx.fillStyle = '#CC0000';
  if (form === 'small') {
    ctx.fillRect(x, y + 9*s, 3*s, 4*s);
    ctx.fillRect(x + 9*s, y + 9*s, 2*s, 4*s);
  } else {
    ctx.fillRect(x, y + 9*s, 3*s, 7*s);
    ctx.fillRect(x + 9*s, y + 9*s, 2*s, 7*s);
  }
  // Shoes
  ctx.fillStyle = '#5C3317';
  if (form === 'small') {
    if (frame === 1 || frame === 3) {
      ctx.fillRect(x, y + 13*s, 5*s, 3*s);
      ctx.fillRect(x + 6*s, y + 12*s, 5*s, 4*s);
    } else {
      ctx.fillRect(x, y + 13*s, 4*s, 3*s);
      ctx.fillRect(x + 7*s, y + 13*s, 4*s, 3*s);
    }
  } else {
    if (frame === 1 || frame === 3) {
      ctx.fillRect(x, y + 18*s, 5*s, 6*s);
      ctx.fillRect(x + 6*s, y + 17*s, 5*s, 7*s);
    } else {
      ctx.fillRect(x, y + 18*s, 4*s, 6*s);
      ctx.fillRect(x + 7*s, y + 18*s, 4*s, 6*s);
    }
  }
}

function drawGoomba(ctx, enemy) {
  if (enemy.state === 'dead') return;
  const x = wx(enemy.x);
  const y = wy(enemy.y);
  const s = SCALE;

  if (enemy.state === 'squish') {
    // Flattened
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x, y + enemy.h*s - 6*s, enemy.w*s, 6*s);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x + 2*s, y + enemy.h*s - 5*s, 3*s, 3*s);
    ctx.fillRect(x + 10*s, y + enemy.h*s - 5*s, 3*s, 3*s);
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 3*s, y + enemy.h*s - 4*s, 2*s, 2*s);
    ctx.fillRect(x + 11*s, y + enemy.h*s - 4*s, 2*s, 2*s);
    return;
  }

  const w = enemy.w * s;
  const h = enemy.h * s;

  // Body (rounded-ish rectangle)
  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y + 4*s, w, h - 4*s, 4) : ctx.rect(x, y + 4*s, w, h - 4*s);
  ctx.fill();
  // Head bump
  ctx.beginPath();
  ctx.arc(x + w/2, y + 5*s, 7*s, Math.PI, 0);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + 2*s, y + 3*s, 4*s, 4*s);
  ctx.fillRect(x + 9*s, y + 3*s, 4*s, 4*s);
  ctx.fillStyle = '#000000';
  ctx.fillRect(x + 3*s, y + 4*s, 2*s, 2*s);
  ctx.fillRect(x + 10*s, y + 4*s, 2*s, 2*s);
  // Angry eyebrows
  ctx.fillRect(x + 2*s, y + 2*s, 5*s, 2*s);
  ctx.fillRect(x + 8*s, y + 2*s, 5*s, 2*s);

  // Feet
  ctx.fillStyle = '#5C2E00';
  const anim = Math.floor(Date.now() / 150) % 2;
  if (anim === 0) {
    ctx.fillRect(x, y + h - 4*s, 5*s, 4*s);
    ctx.fillRect(x + 10*s, y + h - 2*s, 6*s, 2*s);
  } else {
    ctx.fillRect(x, y + h - 2*s, 6*s, 2*s);
    ctx.fillRect(x + 11*s, y + h - 4*s, 5*s, 4*s);
  }
}

function drawKoopa(ctx, enemy) {
  if (enemy.state === 'dead') return;
  const x = wx(enemy.x);
  const y = wy(enemy.y);
  const s = SCALE;
  const w = enemy.w * s;
  const h = enemy.h * s;

  if (enemy.state === 'shell' || enemy.state === 'shell_moving') {
    // Shell only
    ctx.fillStyle = '#228B22';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x + 2*s, y + h/2, w - 4*s, h/2, 4) : ctx.rect(x + 2*s, y + h/2, w - 4*s, h/2);
    ctx.fill();
    ctx.fillStyle = '#90EE90';
    ctx.fillRect(x + 4*s, y + h/2 + 2*s, w - 8*s, 4*s);
    ctx.fillStyle = '#006400';
    ctx.fillRect(x + w/2 - s, y + h/2, 2*s, h/2);
    ctx.fillRect(x + 2*s, y + h*0.75, w - 4*s, 2*s);
    return;
  }

  // Shell body
  ctx.fillStyle = '#228B22';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x + 1*s, y + 8*s, w - 2*s, h - 12*s, 3) : ctx.rect(x + 1*s, y + 8*s, w - 2*s, h - 12*s);
  ctx.fill();
  // Shell pattern
  ctx.fillStyle = '#006400';
  ctx.fillRect(x + w/2 - s, y + 8*s, 2*s, h - 12*s);
  ctx.fillRect(x + 1*s, y + (h-12*s)/2 + 8*s, w - 2*s, 2*s);

  // Head
  ctx.fillStyle = '#90EE90';
  ctx.fillRect(x + 3*s, y + 2*s, w - 6*s, 8*s);
  // Eyes
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + 4*s, y + 3*s, 3*s, 3*s);
  ctx.fillStyle = '#000000';
  ctx.fillRect(x + 5*s, y + 4*s, 2*s, 2*s);
  // Feet
  ctx.fillStyle = '#5C3317';
  const facing = enemy.facing < 0 ? 1 : -1;
  ctx.fillRect(x, y + h - 6*s, 5*s, 6*s);
  ctx.fillRect(x + w - 5*s, y + h - 4*s, 5*s, 4*s);
}

function drawMushroom(ctx, item) {
  const x = wx(item.x);
  const y = wy(item.y);
  const s = SCALE;
  // Cap
  ctx.fillStyle = '#CC0000';
  ctx.beginPath();
  ctx.arc(x + 7*s, y + 5*s, 7*s, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + 2*s, y + 2*s, 3*s, 3*s);
  ctx.fillRect(x + 9*s, y + 2*s, 3*s, 3*s);
  // Stem
  ctx.fillStyle = '#FC9838';
  ctx.fillRect(x + 3*s, y + 5*s, 8*s, 7*s);
  ctx.fillStyle = '#E08828';
  ctx.fillRect(x + 3*s, y + 5*s, 2*s, 7*s);
}

function drawFireFlower(ctx, item) {
  const x = wx(item.x);
  const y = wy(item.y);
  const s = SCALE;
  // Stem
  ctx.fillStyle = '#228B22';
  ctx.fillRect(x + 6*s, y + 6*s, 2*s, 8*s);
  // Petals
  const t = Math.floor(Date.now() / 200) % 2;
  ctx.fillStyle = t === 0 ? '#FF4400' : '#FF8800';
  ctx.beginPath();
  ctx.arc(x + 7*s, y + 4*s, 5*s, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#FFFF00';
  ctx.beginPath();
  ctx.arc(x + 7*s, y + 4*s, 3*s, 0, Math.PI*2);
  ctx.fill();
}

function drawStar(ctx, item) {
  const x = wx(item.x);
  const y = wy(item.y);
  const s = SCALE;
  const colors = ['#FFD700','#FFFF00','#FFA500'];
  ctx.fillStyle = colors[Math.floor(Date.now()/100) % colors.length];
  // Simple star shape
  const cx = x + 6*s, cy = y + 6*s, r = 6*s;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI / 5) - Math.PI/2;
    const rad = i % 2 === 0 ? r : r * 0.4;
    const px = cx + Math.cos(angle) * rad;
    const py = cy + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawFireball(ctx, fb) {
  const x = wx(fb.x);
  const y = wy(fb.y);
  const s = SCALE;
  const t = Math.floor(Date.now()/60) % 2;
  ctx.fillStyle = t === 0 ? '#FF6600' : '#FFFF00';
  ctx.beginPath();
  ctx.arc(x + fb.w*s/2, y + fb.h*s/2, fb.w*s/2, 0, Math.PI*2);
  ctx.fill();
}

function drawCoinPopup(ctx, item) {
  const x = wx(item.x);
  const y = wy(item.y);
  const s = SCALE;
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(x + 4*s, y + 4*s, 4*s, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#FFA500';
  ctx.beginPath();
  ctx.arc(x + 4*s, y + 4*s, 2*s, 0, Math.PI*2);
  ctx.fill();
}

function drawPiranha(ctx) {
  if (!piranha.visible) return;
  const x = wx(piranha.x);
  const y = wy(piranha.y);
  const s = SCALE;
  const w = piranha.w * s;
  const h = piranha.h * s;
  // Head
  ctx.fillStyle = '#CC0000';
  ctx.fillRect(x, y, w, h * 0.6);
  // Mouth/teeth
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + 2*s, y + h*0.4, w - 4*s, h*0.15);
  // Stem
  ctx.fillStyle = '#228B22';
  ctx.fillRect(x + w*0.3, y + h*0.6, w*0.4, h*0.4);
  // Eye
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + w - 5*s, y + 2*s, 3*s, 3*s);
  ctx.fillStyle = '#000000';
  ctx.fillRect(x + w - 4*s, y + 3*s, 2*s, 2*s);
}

// ============================================================
// SECTION 15: HUD
// ============================================================

function drawHUD(ctx) {
  // Black bar
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, CANVAS_W, 48);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // MARIO label
  ctx.fillText('MARIO', 24, 10);
  // Score
  const scoreStr = String(score).padStart(6, '0');
  ctx.fillText(scoreStr, 24, 28);

  // Coin display
  ctx.fillText('\u00D7' + String(coins).padStart(2,'0'), 200, 28);
  // Coin icon (small yellow circle)
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(196, 35, 5, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';

  // WORLD
  ctx.fillText('WORLD', 296, 10);
  ctx.fillText('1-1', 316, 28);

  // TIME
  ctx.fillText('TIME', 400, 10);
  const timeLeft = Math.max(0, Math.ceil(gameTimer / 60));
  ctx.fillText(String(timeLeft).padStart(3,'0'), 420, 28);

  // Lives
  ctx.fillText('\u2665\u00D7' + lives, 100, 10);
}

// ============================================================
// SECTION 16: SCREEN DRAWS
// ============================================================

function drawSky(ctx) {
  ctx.fillStyle = '#5C94FC'; // classic blue sky
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function drawTitleScreen(ctx) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 32px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MY MARIO', CANVAS_W/2, CANVAS_H/2 - 60);

  // Blink "press enter"
  if (Math.floor(blinkTimer / 30) % 2 === 0) {
    ctx.font = '16px monospace';
    ctx.fillText('PRESS ENTER TO START', CANVAS_W/2, CANVAS_H/2 + 20);
  }

  // Credits
  ctx.font = '10px monospace';
  ctx.fillStyle = '#888888';
  ctx.fillText('WORLD 1-1', CANVAS_W/2, CANVAS_H/2 + 80);
}

function drawIntroScreen(ctx) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '24px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('WORLD 1-1', CANVAS_W/2, CANVAS_H/2 - 30);
  ctx.font = '16px monospace';
  // Life hearts
  ctx.fillText('\u2665 \u00D7 ' + lives, CANVAS_W/2, CANVAS_H/2 + 20);
}

function drawPausedOverlay(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PAUSED', CANVAS_W/2, CANVAS_H/2);
}

function drawGameOver(ctx) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GAME OVER', CANVAS_W/2, CANVAS_H/2);
}

function drawWinScreen(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LEVEL CLEAR!', CANVAS_W/2, CANVAS_H/2 - 30);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '16px monospace';
  ctx.fillText('Score: ' + score, CANVAS_W/2, CANVAS_H/2 + 20);
}

// ============================================================
// SECTION 17: MAIN RENDER
// ============================================================

function render(ctx) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  if (gameState === STATE.TITLE) {
    drawTitleScreen(ctx);
    return;
  }

  if (gameState === STATE.INTRO) {
    drawIntroScreen(ctx);
    return;
  }

  if (gameState === STATE.GAMEOVER) {
    drawGameOver(ctx);
    return;
  }

  // Draw world
  drawSky(ctx);

  // Draw tiles (only visible columns)
  const startCol = Math.max(0, Math.floor(cameraX / TILE) - 1);
  const endCol = Math.min(LEVEL_COLS - 1, Math.floor((cameraX + LOGICAL_W) / TILE) + 2);

  for (let r = 0; r < LEVEL_ROWS; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const tile = grid[r][c];
      if (tile !== '.') {
        drawTile(ctx, tile, c, r);
      }
    }
  }

  // Draw items
  for (const item of items) {
    if (item.x + 16 < cameraX || item.x > cameraX + LOGICAL_W) continue;
    if (item.type === 'mushroom') drawMushroom(ctx, item);
    else if (item.type === 'fireflower') drawFireFlower(ctx, item);
    else if (item.type === 'star') drawStar(ctx, item);
    else if (item.type === 'coinpopup') drawCoinPopup(ctx, item);
  }

  // Draw fireballs
  for (const fb of fireballs) {
    if (fb.active) drawFireball(ctx, fb);
  }

  // Draw enemies
  for (const enemy of enemies) {
    if (!enemy.active || enemy.state === 'dead') continue;
    if (enemy.x + enemy.w < cameraX || enemy.x > cameraX + LOGICAL_W) continue;
    if (enemy.type === 'goomba') drawGoomba(ctx, enemy);
    else if (enemy.type === 'koopa') drawKoopa(ctx, enemy);
  }

  // Draw piranha
  drawPiranha(ctx);

  // Draw Mario
  drawMario(ctx);

  // HUD
  drawHUD(ctx);

  if (gameState === STATE.PAUSED) {
    drawPausedOverlay(ctx);
  }

  if (gameState === STATE.WIN) {
    drawWinScreen(ctx);
  }
}

// ============================================================
// SECTION 18: STATE MACHINE / UPDATE
// ============================================================

function update() {
  blinkTimer++;

  switch(gameState) {
    case STATE.TITLE:
      if (isPressed(['Enter'])) {
        gameState = STATE.INTRO;
        stateTimer = 3 * 60;
        resetLevel();
      }
      break;

    case STATE.INTRO:
      stateTimer--;
      if (stateTimer <= 0) {
        gameState = STATE.PLAYING;
        AudioSystem.init();
        if (!musicStarted) {
          AudioSystem.playMusic('overworld');
          musicStarted = true;
        } else {
          AudioSystem.playMusic('overworld');
        }
      }
      if (isPressed(['Enter'])) {
        gameState = STATE.PLAYING;
        AudioSystem.playMusic('overworld');
      }
      break;

    case STATE.PLAYING: {
      // Pause
      if (isPressed(['Enter'])) {
        gameState = STATE.PAUSED;
        AudioSystem.pauseMusic();
        break;
      }

      // Timer countdown
      gameTimer--;
      if (gameTimer <= 0) {
        triggerMarioDeath();
        break;
      }

      updateCamera();
      updateMario();
      updateEnemies();
      updateItems();
      updateFireballs();
      break;
    }

    case STATE.PAUSED:
      if (isPressed(['Enter'])) {
        gameState = STATE.PLAYING;
        AudioSystem.resumeMusic();
      }
      break;

    case STATE.DEATH:
      // Mario death animation continues
      mario.vy += GRAVITY;
      mario.y += mario.vy;
      stateTimer--;
      if (stateTimer <= 0) {
        lives--;
        if (lives <= 0) {
          gameState = STATE.GAMEOVER;
          stateTimer = 5 * 60;
          musicStarted = false;
        } else {
          gameState = STATE.INTRO;
          stateTimer = 3 * 60;
          resetLevel();
          musicStarted = false;
        }
      }
      break;

    case STATE.WIN:
      stateTimer--;
      if (stateTimer <= 0) {
        gameState = STATE.INTRO;
        stateTimer = 3 * 60;
        resetLevel();
        musicStarted = false;
      }
      break;

    case STATE.GAMEOVER:
      stateTimer--;
      if (stateTimer <= 0) {
        gameState = STATE.TITLE;
        score = 0;
        coins = 0;
        lives = 3;
        musicStarted = false;
      }
      break;
  }

  clearInputEdges();
}

// ============================================================
// SECTION 19: MAIN LOOP
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const STEP_MS = 1000 / 60;
let accumulator = 0;
let lastTime = 0;

function loop(timestamp) {
  const delta = Math.min(timestamp - lastTime, 50);
  lastTime = timestamp;
  accumulator += delta;
  while (accumulator >= STEP_MS) {
    update();
    accumulator -= STEP_MS;
  }
  render(ctx);
  requestAnimationFrame(loop);
}

// Initialize
resetLevel();

requestAnimationFrame(loop);
