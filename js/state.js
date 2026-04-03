// ============================================================
// GAME STATE — global mutable variables + entity factories
// ============================================================

let gameState = STATE.TITLE;
let currentLevel = 1;
let currentArea = 'main'; // 'main' | 'hidden'
let currentQContents = null;
let grid      = null;
let score     = 0;
let coins     = 0;
let lives     = 3;
let gameTimer = 400 * 60; // frames
let cameraX   = 0;
let stateTimer   = 0;
let blinkTimer   = 0;
let musicStarted = false;

let mario          = null;
let enemies        = [];
let items          = [];
let fireballs      = [];
let fireballCooldown = 0;
let pipeTransitionLock = 0;
let piranha        = null;

// --------------- Entity factories ---------------

function createMario() {
  return {
    x: 48, y: 192,
    vx: 0, vy: 0,
    w: 12, h: 16,
    grounded: false,
    facing: 1,           // 1=right, -1=left
    form: 'small',       // 'small' | 'super' | 'fire'
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

function createEnemyGoomba(col, row, opts = {}) {
  const h = 16;
  const speed = opts.speed || 1.0;
  return {
    type: 'goomba',
    x: col * TILE,
    y: row * TILE - h,   // feet touch top of spawn row
    vx: -speed, vy: 0,
    w: 16, h,
    state: 'walk',       // 'walk' | 'squish' | 'dead'
    stateTimer: 0,
    active: false,
    edgeAware: !!opts.edgeAware,
    facing: -1,
  };
}

function createEnemyKoopa(col, row, opts = {}) {
  const h = 24;
  const speed = opts.speed || 1.0;
  return {
    type: 'koopa',
    x: col * TILE,
    y: row * TILE - h,   // feet touch top of spawn row
    vx: -speed, vy: 0,
    w: 14, h,
    state: 'walk',       // 'walk' | 'shell' | 'shell_moving'
    stateTimer: 0,
    active: false,
    edgeAware: !!opts.edgeAware,
    facing: -1,
  };
}

function getLevelAreaData() {
  if (currentLevel === 1) {
    return { grid: buildLevel(), qContents: Q_CONTENTS };
  }
  if (currentLevel === 2) {
    return { grid: buildLevel2(), qContents: Q_CONTENTS_L2 };
  }
  if (currentArea === 'hidden') {
    return { grid: buildLevel3Hidden(), qContents: Q_CONTENTS_L3_HIDDEN };
  }
  return { grid: buildLevel3Main(), qContents: Q_CONTENTS_L3_MAIN };
}

function getMusicTrack() {
  return (currentLevel === 2 || currentArea === 'hidden') ? 'underground' : 'overworld';
}

function spawnEnemies() {
  enemies = [];
  if (currentLevel === 1) {
    const goombas = [
      [22,13],[23,13],[41,13],[43,13],[80,13],[81,13],
      [107,13],[108,13],[110,13],[111,13],[149,13],[150,13],[153,13],[154,13]
    ];
    for (const [c, r] of goombas) enemies.push(createEnemyGoomba(c, r));
    enemies.push(createEnemyKoopa(60, 13));
    enemies.push(createEnemyKoopa(128, 13));
    return;
  }

  if (currentLevel === 2) {
    // World 1-2 enemies
    const goombas = [
      [20,12],[21,12],[15,12],[16,12],
      [26,12],[27,12],[35,12],[36,12],
      [52,12],[53,12],[68,12],[69,12],
      [78,12],[79,12],[90,12],[91,12],
      [110,12],[111,12],[130,12],[131,12],
      [160,12],[161,12],[172,12],[173,12],
    ];
    for (const [c, r] of goombas) enemies.push(createEnemyGoomba(c, r));
    enemies.push(createEnemyKoopa(44, 12));
    enemies.push(createEnemyKoopa(100, 12));
    enemies.push(createEnemyKoopa(145, 12));
    return;
  }

  if (currentArea === 'hidden') {
    enemies.push(createEnemyGoomba(95, 13, { speed: 1.2 }));
    enemies.push(createEnemyKoopa(144, 13, { speed: 1.2 }));
    return;
  }

  // World 1-3 enemy set: higher density with platform patrols.
  const groundGoombas = [
    [18,13],[20,13],[43,13],[45,13],[58,13],[60,13],
    [88,13],[90,13],[134,13],[136,13],[162,13],[164,13],
  ];
  for (const [c, r] of groundGoombas) {
    enemies.push(createEnemyGoomba(c, r, { speed: 1.2 }));
  }

  const platformGoombas = [
    [63,9],[69,9],[102,8],[132,9],[170,10],[181,8],
  ];
  for (const [c, r] of platformGoombas) {
    enemies.push(createEnemyGoomba(c, r, { edgeAware: true, speed: 1.15 }));
  }

  const koopas = [
    [30,10],[66,9],[86,10],[116,10],[143,7],[178,8],[194,9],
  ];
  for (const [c, r] of koopas) {
    enemies.push(createEnemyKoopa(c, r, { edgeAware: true, speed: 1.2 }));
  }
}

function configurePiranha() {
  if (currentLevel === 1) {
    piranha = {
      x: 97 * TILE + 4,
      y: 10 * TILE,
      w: 8, h: 16,
      timer: 0,
      state: 'hidden',
      visible: false,
      baseY:   10 * TILE,
      targetY:  8 * TILE,
      pipeX: 97 * TILE + 8,
    };
    return;
  }

  if (currentLevel === 3 && currentArea === 'main') {
    piranha = {
      x: 75 * TILE + 4,
      y: 10 * TILE,
      w: 8, h: 16,
      timer: 0,
      state: 'hidden',
      visible: false,
      baseY:   10 * TILE,
      targetY:  8 * TILE,
      pipeX: 75 * TILE + 8,
    };
    return;
  }

  piranha = null;
}

function applyCurrentAreaData() {
  const levelData = getLevelAreaData();
  grid = levelData.grid;
  currentQContents = levelData.qContents;
  spawnEnemies();
  configurePiranha();
}

function switchLevel3Area(nextArea, spawnX, spawnY) {
  if (currentLevel !== 3) return;
  currentArea = nextArea;
  applyCurrentAreaData();
  cameraX = Math.max(0, spawnX - LOGICAL_W * 0.4);
  const maxCamera = LEVEL_COLS * TILE - LOGICAL_W;
  if (cameraX > maxCamera) cameraX = maxCamera;

  mario.x = spawnX;
  mario.y = spawnY;
  mario.vx = 0;
  mario.vy = 0;
  mario.grounded = false;
  mario.onFlagpole = false;
  mario.won = false;

  items = [];
  fireballs = [];
  pipeTransitionLock = 45;

  AudioSystem.playMusic(getMusicTrack());
}

function enterLevel3HiddenArea() {
  switchLevel3Area('hidden', 9 * TILE + 2, 10 * TILE);
}

function exitLevel3HiddenArea() {
  switchLevel3Area('main', 124 * TILE, 11 * TILE);
}

function resetLevel() {
  currentArea      = 'main';
  mario            = createMario();
  applyCurrentAreaData();
  cameraX          = 0;
  gameTimer        = 400 * 60;
  fireballCooldown = 0;
  pipeTransitionLock = 0;
  items            = [];
  fireballs        = [];
}
