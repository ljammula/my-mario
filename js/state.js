// ============================================================
// GAME STATE — global mutable variables + entity factories
// ============================================================

let gameState = STATE.TITLE;
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

function createEnemyGoomba(col, row) {
  const h = 16;
  return {
    type: 'goomba',
    x: col * TILE,
    y: row * TILE - h,   // feet touch top of spawn row
    vx: -1.0, vy: 0,
    w: 16, h,
    state: 'walk',       // 'walk' | 'squish' | 'dead'
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
    y: row * TILE - h,   // feet touch top of spawn row
    vx: -1.0, vy: 0,
    w: 14, h,
    state: 'walk',       // 'walk' | 'shell' | 'shell_moving'
    stateTimer: 0,
    active: false,
    facing: -1,
  };
}

function spawnEnemies() {
  enemies = [];
  // Goombas — clear of all pipes
  const goombas = [
    [22,13],[23,13],[41,13],[43,13],[80,13],[81,13],
    [107,13],[108,13],[110,13],[111,13],[149,13],[150,13],[153,13],[154,13]
  ];
  for (const [c, r] of goombas) enemies.push(createEnemyGoomba(c, r));

  // Koopa Troopas — col 60 is clear of pipe 4 (cols 57-58)
  enemies.push(createEnemyKoopa(60, 13));
  enemies.push(createEnemyKoopa(128, 13));
}

function resetLevel() {
  grid             = buildLevel();
  mario            = createMario();
  cameraX          = 0;
  gameTimer        = 400 * 60;
  fireballCooldown = 0;
  items            = [];
  fireballs        = [];
  spawnEnemies();
  piranha = {
    x: 97 * TILE + 4,
    y: 10 * TILE,
    w: 8, h: 16,
    timer: 0,
    state: 'hidden',
    visible: false,
    baseY:   10 * TILE,
    targetY:  8 * TILE,
  };
}
