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

// Fade transition state
let fadeAlpha     = 0;     // 0=transparent, 1=black
let fadeDir       = 1;     // 1=fade-out (darken), -1=fade-in (brighten)
let fadeCallback  = null;  // called once fully black (prepares next scene)
let fadeDoneState = null;  // gameState to enter after fade-in completes
let fadeSrcState  = null;  // gameState we were in when fade started
let selectedLevel = 1;

// --------------- Entity factories ---------------

function createMario(powerState = null) {
  const form = powerState?.form || 'small';
  const isTall = form !== 'small';
  const starFrames = Math.max(0, powerState?.starFrames || 0);
  return {
    x: 48, y: isTall ? 184 : 192,
    vx: 0, vy: 0,
    w: 12, h: isTall ? 24 : 16,
    grounded: false,
    facing: 1,           // 1=right, -1=left
    form,                // 'small' | 'super' | 'fire'
    jumpHeld: false,
    coyoteFrames: 0,
    jumpBuffer: 0,
    invincibleFrames: 0,
    starFrames,
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
  if (currentLevel === 4) {
    return { grid: buildLevel4(), qContents: Q_CONTENTS_L4 };
  }
  if (currentLevel === 5) {
    return { grid: buildLevel5(), qContents: Q_CONTENTS_L5 };
  }
  if (currentLevel === 6) {
    return { grid: buildLevel6(), qContents: Q_CONTENTS_L6 };
  }
  if (currentLevel === 7) {
    return { grid: buildLevel7(), qContents: Q_CONTENTS_L7 };
  }
  if (currentLevel === 8) {
    return { grid: buildLevel8(), qContents: Q_CONTENTS_L8 };
  }
  if (currentArea === 'hidden') {
    return { grid: buildLevel3Hidden(), qContents: Q_CONTENTS_L3_HIDDEN };
  }
  return { grid: buildLevel3Main(), qContents: Q_CONTENTS_L3_MAIN };
}

function getMusicTrack() {
  const underground = [2, 5, 7, 10];
  return (underground.includes(currentLevel) || currentArea === 'hidden') ? 'underground' : 'overworld';
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

  if (currentLevel === 8) {
    const goombas = [
      [2,12],[7,12],[22,12],[28,12],[37,10],[46,12],
      [60,9],[67,11],[79,9],[91,10],[112,9],[162,11],
    ];
    for (const [c,r] of goombas) enemies.push(createEnemyGoomba(c,r,{speed:1.3}));
    enemies.push(createEnemyKoopa(11,9, {edgeAware:true,speed:1.3}));
    enemies.push(createEnemyKoopa(45,10,{edgeAware:true,speed:1.3}));
    enemies.push(createEnemyKoopa(57,7, {edgeAware:true,speed:1.3}));
    enemies.push(createEnemyKoopa(89,8, {edgeAware:true,speed:1.3}));
    enemies.push(createEnemyKoopa(100,10,{edgeAware:true,speed:1.3}));
    enemies.push(createEnemyKoopa(124,9,{edgeAware:true,speed:1.3}));
    enemies.push(createEnemyKoopa(147,7,{edgeAware:true,speed:1.3}));
    enemies.push(createEnemyKoopa(171,8,{edgeAware:true,speed:1.3}));
    return;
  }

  if (currentLevel === 7) {
    const goombas = [
      [3,12],[14,12],[16,12],[26,10],[28,10],[40,8],[44,8],
      [55,12],[57,12],[69,10],[84,8],[99,12],[114,10],[129,8],[144,12],[160,10],
    ];
    for (const [c,r] of goombas) enemies.push(createEnemyGoomba(c,r,{speed:1.3}));
    enemies.push(createEnemyKoopa(12,12,{edgeAware:true,speed:1.3}));
    enemies.push(createEnemyKoopa(30,10,{edgeAware:true,speed:1.3}));
    enemies.push(createEnemyKoopa(42,8, {edgeAware:true,speed:1.3}));
    enemies.push(createEnemyKoopa(58,12,{edgeAware:true,speed:1.3}));
    enemies.push(createEnemyKoopa(86,8, {edgeAware:true,speed:1.3}));
    enemies.push(createEnemyKoopa(162,10,{edgeAware:true,speed:1.3}));
    return;
  }

  if (currentLevel === 6) {
    const goombas = [
      [5,12],[8,12],[16,12],[42,9],[52,12],[57,12],
      [82,12],[98,8],[103,8],[107,6],[125,9],[135,9],[160,12],[175,12],
    ];
    for (const [c,r] of goombas) enemies.push(createEnemyGoomba(c,r,{speed:1.3}));
    enemies.push(createEnemyKoopa(44,9,{edgeAware:true,speed:1.3}));
    enemies.push(createEnemyKoopa(45,9,{edgeAware:true,speed:1.3}));
    enemies.push(createEnemyKoopa(132,9,{edgeAware:true,speed:1.3}));
    enemies.push(createEnemyKoopa(136,9,{edgeAware:true,speed:1.3}));
    enemies.push(createEnemyKoopa(190,12,{speed:1.4}));
    enemies.push(createEnemyKoopa(193,12,{speed:1.4}));
    return;
  }

  if (currentLevel === 4) {
    const goombas = [
      [18,13],[20,13],[35,13],[37,13],[68,13],[70,13],
      [96,13],[98,13],[128,13],[130,13],[158,13],[160,13],
      [170,13],[172,13],
    ];
    for (const [c, r] of goombas) enemies.push(createEnemyGoomba(c, r, { speed: 1.2 }));
    enemies.push(createEnemyKoopa(47, 13, { speed: 1.2 }));
    enemies.push(createEnemyKoopa(80, 9, { edgeAware: true, speed: 1.2 }));
    enemies.push(createEnemyKoopa(112, 13, { speed: 1.2 }));
    enemies.push(createEnemyKoopa(145, 13, { speed: 1.2 }));
    enemies.push(createEnemyKoopa(183, 13, { speed: 1.3 }));
    return;
  }

  if (currentLevel === 5) {
    const goombas = [
      [15,12],[17,12],[35,12],[37,12],[58,12],[60,12],
      [72,12],[74,12],[110,12],[112,12],[135,12],[137,12],
      [162,12],[164,12],[178,12],[180,12],
    ];
    for (const [c, r] of goombas) enemies.push(createEnemyGoomba(c, r, { speed: 1.3 }));
    enemies.push(createEnemyKoopa(25, 8, { edgeAware: true, speed: 1.3 }));
    enemies.push(createEnemyKoopa(42, 6, { edgeAware: true, speed: 1.3 }));
    enemies.push(createEnemyKoopa(90, 6, { edgeAware: true, speed: 1.3 }));
    enemies.push(createEnemyKoopa(150, 6, { edgeAware: true, speed: 1.3 }));
    enemies.push(createEnemyKoopa(165, 10, { edgeAware: true, speed: 1.4 }));
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

  if (currentLevel === 8) {
    piranha = {
      x: 50 * TILE + 4,
      y: 10 * TILE,
      w: 8, h: 16,
      timer: 0,
      state: 'hidden',
      visible: false,
      baseY:   10 * TILE,
      targetY:  8 * TILE,
      pipeX: 50 * TILE + 8,
    };
    return;
  }

  if (currentLevel === 6) {
    piranha = {
      x: 48 * TILE + 4,
      y: 10 * TILE,
      w: 8, h: 16,
      timer: 0,
      state: 'hidden',
      visible: false,
      baseY:   10 * TILE,
      targetY:  8 * TILE,
      pipeX: 48 * TILE + 8,
    };
    return;
  }

  if (currentLevel === 4) {
    piranha = {
      x: 55 * TILE + 4,
      y: 10 * TILE,
      w: 8, h: 16,
      timer: 0,
      state: 'hidden',
      visible: false,
      baseY:   10 * TILE,
      targetY:  8 * TILE,
      pipeX: 55 * TILE + 8,
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

  mario.x = spawnX;
  mario.y = spawnY + (16 - mario.h);
  mario.vx = 0;
  mario.vy = 0;
  mario.grounded = false;
  mario.onFlagpole = false;
  mario.won = false;

  items = [];
  fireballs = [];
  pipeTransitionLock = 45;
  if (typeof snapCameraToMario === 'function') snapCameraToMario(false);

  AudioSystem.playMusic(getMusicTrack());
}

function enterLevel3HiddenArea() {
  switchLevel3Area('hidden', 9 * TILE + 2, 10 * TILE);
}

function exitLevel3HiddenArea() {
  // Exit on top of the main-area entry pipe so the player never respawns over the pit.
  switchLevel3Area('main', 121 * TILE + 2, 10 * TILE);
}

function getMarioPowerState() {
  if (!mario) return null;
  return {
    form: mario.form,
    starFrames: mario.starFrames,
  };
}

function resetLevel(preservePower = false) {
  const powerState = preservePower ? getMarioPowerState() : null;
  currentArea      = 'main';
  mario            = createMario(powerState);
  applyCurrentAreaData();
  cameraX          = 0;
  if (typeof snapCameraToMario === 'function') snapCameraToMario(false);
  gameTimer        = 400 * 60;
  fireballCooldown = 0;
  pipeTransitionLock = 0;
  items            = [];
  fireballs        = [];
}
