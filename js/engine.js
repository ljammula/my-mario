/**
 * engine.js
 * Main game loop, state machine, and orchestrator for Super Mario Bros.
 *
 * State machine screens:
 *   TITLE     — title screen, press Enter to start
 *   INTRO     — "WORLD X-X" card shown before each life
 *   PLAYING   — active gameplay
 *   PAUSED    — gameplay frozen, overlay shown
 *   DEATH     — death animation playing
 *   WIN       — flagpole / level complete animation
 *   GAMEOVER  — game over screen
 *   COMING_SOON — stub for next level
 *
 * Engineer 2 will provide: js/level.js, js/renderer.js, js/audio.js
 * Until they exist, stubs are used so the engine runs standalone.
 */

import {
  CANVAS_WIDTH, CANVAS_HEIGHT, LOGICAL_WIDTH, LOGICAL_HEIGHT, SCALE,
  TILE_SIZE, LEVEL_COLS, LEVEL_ROWS, LEVEL_WIDTH_PX,
  SCREEN, MARIO_STATE, ANIM_STATE,
  SCORE, STOMP_COMBO_POINTS,
  COYOTE_FRAMES,
  DEATH_ANIM_FRAMES,
  INVINCIBLE_DURATION, HURT_INVINCIBLE_FRAMES,
  FIREBALL_MAX_ACTIVE,
  CAMERA_LEAD_X,
  TIME_LIMIT, HURRY_TIME, TIME_BONUS_PER_SEC,
  COLOR, HUD,
  TILE, SOLID_TILES,
  WALK_MAX_SPEED, RUN_MAX_SPEED,
  GRAVITY, MAX_FALL_SPEED,
} from './constants.js';

import {
  initInput, pollInput, inputState,
  consumeJump, consumeFire, consumeStart,
} from './input.js';

import { Mario, drawPlayer } from './player.js';

import {
  entitiesOverlap, isStomping, isSideHit,
  resolveEnemyTileCollision, resolveFireballTileCollision,
  isGrounded, isLedgeAhead,
} from './collision.js';

// ─── Dynamic-import stubs for engineer-2 modules ─────────────────────────────
// These are loaded at runtime; if the files don't exist yet, fallback stubs run.

let level    = null;  // level module
let renderer = null;  // renderer module
let audio    = null;  // audio module

async function loadModules() {
  try {
    level    = await import('./level.js');
  } catch (_) {
    console.warn('[engine] level.js not found — using stub level');
    level = _makeStubLevel();
  }
  try {
    renderer = await import('./renderer.js');
  } catch (_) {
    console.warn('[engine] renderer.js not found — using stub renderer');
    renderer = _makeStubRenderer();
  }
  try {
    audio    = await import('./audio.js');
  } catch (_) {
    console.warn('[engine] audio.js not found — using stub audio');
    audio = _makeStubAudio();
  }
}

// ─── Game State Object ────────────────────────────────────────────────────────

/**
 * Central game state — readable by all modules.
 * @type {Object}
 */
export const gameState = {
  screen:    SCREEN.TITLE,
  score:     0,
  coins:     0,
  lives:     3,
  world:     1,
  levelNum:  1,
  time:      TIME_LIMIT,   // seconds remaining
  frameCount: 0,           // total frames elapsed
  paused:    false,

  // Sub-timers
  introTimer:     0,   // frames remaining on intro card
  gameoverTimer:  0,   // frames remaining on game over screen
  winTimer:       0,   // frames into win sequence
  titleBlink:     0,   // for "Press Enter" blinking

  // Hurry mode
  hurry:          false,
};

// ─── World Objects ────────────────────────────────────────────────────────────

/** @type {Mario} */
let mario = null;

/** @type {string[][]} */
let grid = null;

/** @type {Object[]} enemies */
let enemies = [];

/** @type {Object[]} power-ups / items */
let items = [];

/** @type {Object[]} score popups */
let popups = [];

/** @type {Object[]} particles */
let particles = [];

/** Camera position in logical pixels */
const camera = { x: 0, y: 0 };

// ─── Canvas Setup ─────────────────────────────────────────────────────────────

/** @type {HTMLCanvasElement} */
let canvas;
/** @type {CanvasRenderingContext2D} */
let ctx;

// ─── Time tracking (fixed-step loop) ─────────────────────────────────────────

const FRAME_TIME_MS = 1000 / 60;   // ~16.67ms per frame
let lastTimestamp   = 0;
let accumulator     = 0;
let timeCounter     = 0;           // frame counter for time countdown (60 frames → 1 second)

// ─── Entry Point ──────────────────────────────────────────────────────────────

/**
 * Bootstrap: attach canvas, event listeners, load modules, start loop.
 */
export async function init() {
  canvas = document.getElementById('gameCanvas');
  if (!canvas) throw new Error('[engine] #gameCanvas not found in DOM');
  ctx = canvas.getContext('2d');

  // Disable image smoothing for crisp pixel art
  ctx.imageSmoothingEnabled = false;

  initInput();

  await loadModules();

  // Initialize level
  grid    = level.createGrid();
  enemies = level.createEnemies();
  items   = level.createItems();

  // Spawn Mario
  const spawn = level.getSpawnPoint();
  mario = new Mario(spawn.x, spawn.y);

  // Start audio context on first user gesture
  window.addEventListener('keydown', _initAudioOnce, { once: true });

  // Start the game loop
  requestAnimationFrame(_loop);
}

function _initAudioOnce() {
  if (audio && audio.initAudio) {
    audio.initAudio();
  }
}

// ─── Main Loop ────────────────────────────────────────────────────────────────

function _loop(timestamp) {
  requestAnimationFrame(_loop);

  // Cap delta to prevent spiral-of-death
  const rawDelta = timestamp - lastTimestamp;
  lastTimestamp  = timestamp;
  const delta    = Math.min(rawDelta, 50);  // ms
  accumulator   += delta;

  // Fixed timestep: run update steps for each elapsed 16.67ms
  while (accumulator >= FRAME_TIME_MS) {
    accumulator -= FRAME_TIME_MS;
    pollInput();
    _update();
    // Consume edge-triggered inputs after the update step
    consumeJump();
    consumeFire();
    consumeStart();
  }

  // Render once per animation frame (interpolation omitted for clarity)
  _render();
}

// ─── Update ──────────────────────────────────────────────────────────────────

function _update() {
  gameState.frameCount++;

  // Title blink
  gameState.titleBlink = Math.floor(gameState.frameCount / 30) % 2;

  switch (gameState.screen) {
    case SCREEN.TITLE:      _updateTitle();    break;
    case SCREEN.INTRO:      _updateIntro();    break;
    case SCREEN.PLAYING:    _updatePlaying();  break;
    case SCREEN.PAUSED:     _updatePaused();   break;
    case SCREEN.DEATH:      _updateDeath();    break;
    case SCREEN.WIN:        _updateWin();      break;
    case SCREEN.GAMEOVER:   _updateGameOver(); break;
    case SCREEN.COMING_SOON:_updateComingSoon();break;
  }
}

// ─── State: TITLE ────────────────────────────────────────────────────────────

function _updateTitle() {
  if (inputState.start) {
    _startGame();
  }
}

function _startGame() {
  // Reset game state
  gameState.score   = 0;
  gameState.coins   = 0;
  gameState.lives   = 3;
  gameState.world   = 1;
  gameState.levelNum= 1;
  gameState.hurry   = false;

  _startLevel();
}

function _startLevel() {
  gameState.time    = TIME_LIMIT;
  timeCounter       = 0;

  grid    = level.createGrid();
  enemies = level.createEnemies();
  items   = level.createItems();
  popups  = [];
  particles = [];

  const spawn = level.getSpawnPoint();
  mario = new Mario(spawn.x, spawn.y);

  _updateCamera();

  // Show intro card first
  gameState.screen     = SCREEN.INTRO;
  gameState.introTimer = 180; // 3 seconds

  if (audio) audio.stopMusic();
}

// ─── State: INTRO ────────────────────────────────────────────────────────────

function _updateIntro() {
  gameState.introTimer--;
  if (gameState.introTimer <= 0) {
    gameState.screen = SCREEN.PLAYING;
    if (audio) audio.startMusic(gameState.hurry);
  }
}

// ─── State: PLAYING ──────────────────────────────────────────────────────────

function _updatePlaying() {
  // Toggle pause
  if (inputState.start) {
    gameState.screen = SCREEN.PAUSED;
    if (audio) audio.pauseMusic();
    return;
  }

  // ── Timer countdown ─────────────────────────────────────────────────
  timeCounter++;
  if (timeCounter >= 60) {
    timeCounter = 0;
    gameState.time--;
    if (gameState.time <= 0) {
      gameState.time = 0;
      _triggerDeath();
      return;
    }
    // Hurry mode
    if (gameState.time <= HURRY_TIME && !gameState.hurry) {
      gameState.hurry = true;
      if (audio) audio.setHurryMode(true);
    }
  }

  // ── Update Mario ────────────────────────────────────────────────────
  mario.update(inputState, grid);

  // ── Pit death ───────────────────────────────────────────────────────
  if (mario.y > LEVEL_ROWS * TILE_SIZE + TILE_SIZE) {
    _triggerDeath();
    return;
  }

  // ── Block interactions (head bonk) ─────────────────────────────────
  if (mario._headBonkCol >= 0) {
    _handleBlockBonk(mario._headBonkCol, mario._headBonkRow);
  }

  // ── Update enemies ──────────────────────────────────────────────────
  _updateEnemies();

  // ── Update items ────────────────────────────────────────────────────
  _updateItems();

  // ── Player ↔ enemy collisions ───────────────────────────────────────
  _checkPlayerEnemyCollisions();

  // ── Player ↔ item collisions ────────────────────────────────────────
  _checkPlayerItemCollisions();

  // ── Fireball ↔ enemy collisions ─────────────────────────────────────
  _checkFireballEnemyCollisions();

  // ── Flagpole check ──────────────────────────────────────────────────
  _checkFlagpole();

  // ── Update camera ───────────────────────────────────────────────────
  _updateCamera();

  // ── Update score popups ─────────────────────────────────────────────
  _updatePopups();

  // ── Update particles ────────────────────────────────────────────────
  _updateParticles();

  // ── Audio scheduler tick ────────────────────────────────────────────
  if (audio && audio.tick) audio.tick();
}

// ─── State: PAUSED ───────────────────────────────────────────────────────────

function _updatePaused() {
  if (inputState.start) {
    gameState.screen = SCREEN.PLAYING;
    if (audio) audio.resumeMusic();
  }
}

// ─── State: DEATH ────────────────────────────────────────────────────────────

function _updateDeath() {
  // Mario animates upward then falls off-screen
  mario._updateDead();

  gameState.introTimer--;
  if (gameState.introTimer <= 0) {
    // Death sequence complete
    gameState.lives--;
    if (gameState.lives <= 0) {
      gameState.screen     = SCREEN.GAMEOVER;
      gameState.gameoverTimer = 300; // 5 seconds
      if (audio) audio.stopMusic();
    } else {
      _startLevel(); // re-enter intro card, respawn
    }
  }
}

function _triggerDeath() {
  if (mario.dead) return;
  mario._startDeath();
  gameState.screen     = SCREEN.DEATH;
  gameState.introTimer = DEATH_ANIM_FRAMES + 60; // animation + short pause

  if (audio) {
    audio.stopMusic();
    audio.playDeath();
  }
}

// ─── State: WIN ──────────────────────────────────────────────────────────────

function _updateWin() {
  gameState.winTimer++;

  // Phase 1: flag drops (frames 0-60)
  // Phase 2: Mario slides down pole (frames 61-180)
  // Phase 3: Walk to castle (181-240)
  // Phase 4: Time bonus tally (241+)

  if (gameState.winTimer < 60) {
    // Flag drops — handled by renderer
  } else if (gameState.winTimer < 180) {
    // Mario slides down — move down
    mario.y += 3;  // 3px/frame slide
  } else if (gameState.winTimer < 240) {
    // Walk right to castle
    mario.x  += 1.5;
    mario.vx  = 1.5;
    mario.facing = 1;
  } else if (gameState.winTimer === 240) {
    // Tally time bonus
    const bonus = gameState.time * TIME_BONUS_PER_SEC;
    _addScore(bonus);
    _spawnPopup(mario.x, mario.y, `+${bonus}`);
    if (audio) audio.playLevelComplete();
  } else if (gameState.winTimer > 420) {
    // Transition to next level / coming soon
    gameState.screen = SCREEN.COMING_SOON;
  }
}

function _triggerWin() {
  gameState.screen   = SCREEN.WIN;
  gameState.winTimer = 0;
  if (audio) {
    audio.stopMusic();
    audio.playFlagpole();
  }
  // Award flagpole points based on Mario's Y position
  const poleTopY    = 4 * TILE_SIZE;   // flagpole top row
  const poleBottomY = 13 * TILE_SIZE;
  const poleRange   = poleBottomY - poleTopY;
  const marioRelY   = Math.max(0, mario.y - poleTopY);
  const fraction    = 1 - (marioRelY / poleRange);  // 1 = top, 0 = bottom

  let pts;
  if (fraction >= 1.0)       pts = SCORE.FLAGPOLE_TOP;
  else if (fraction >= 0.8)  pts = SCORE.FLAGPOLE_HIGH2;
  else if (fraction >= 0.6)  pts = SCORE.FLAGPOLE_HIGH1;
  else if (fraction >= 0.4)  pts = SCORE.FLAGPOLE_MID2;
  else if (fraction >= 0.2)  pts = SCORE.FLAGPOLE_MID1;
  else                       pts = SCORE.FLAGPOLE_LOW;

  _addScore(pts);
  _spawnPopup(mario.x, mario.y, pts);
}

// ─── State: GAMEOVER ─────────────────────────────────────────────────────────

function _updateGameOver() {
  gameState.gameoverTimer--;
  if (gameState.gameoverTimer <= 0) {
    gameState.screen = SCREEN.TITLE;
    // Reset score/lives for next play-through
    gameState.score  = 0;
    gameState.lives  = 3;
    gameState.coins  = 0;
    gameState.time   = TIME_LIMIT;
    gameState.hurry  = false;
  }
}

// ─── State: COMING_SOON ──────────────────────────────────────────────────────

function _updateComingSoon() {
  if (inputState.start) {
    gameState.screen = SCREEN.TITLE;
  }
}

// ─── Enemy Updates ────────────────────────────────────────────────────────────

function _updateEnemies() {
  // Only update enemies that are within ~3 screens of Mario (optimization)
  const activeRange = LOGICAL_WIDTH * 3;

  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    // Skip enemies far from Mario
    if (Math.abs(enemy.x - mario.x) > activeRange) continue;

    // Apply gravity to enemies not on ground
    enemy.vy = (enemy.vy || 0) + GRAVITY;
    if (enemy.vy > MAX_FALL_SPEED) enemy.vy = MAX_FALL_SPEED;

    // Enemy-specific update logic
    _updateEnemy(enemy);

    // Tile collision
    const hitResult = resolveEnemyTileCollision(enemy, grid);

    // Pit death
    if (enemy.y > LEVEL_ROWS * TILE_SIZE + TILE_SIZE) {
      enemy.alive = false;
    }

    // Animate
    if (typeof enemy.frameCounter === 'number') {
      enemy.frameCounter++;
      if (enemy.frameCounter % 16 === 0) {
        enemy.walkFrame = ((enemy.walkFrame || 0) + 1) % 2;
      }
    }
  }

  // Remove dead enemies
  enemies = enemies.filter(e => e.alive || e.dying);
}

function _updateEnemy(enemy) {
  switch (enemy.type) {
    case 'goomba':
      _updateGoomba(enemy);
      break;
    case 'koopa':
      _updateKoopa(enemy);
      break;
    case 'shell':
      _updateShell(enemy);
      break;
    case 'piranha':
      _updatePiranha(enemy);
      break;
    case 'flying_koopa':
      _updateFlyingKoopa(enemy);
      break;
  }
}

function _updateGoomba(g) {
  if (g.dying) {
    g.dyingTimer = (g.dyingTimer || 0) + 1;
    if (g.dyingTimer > 30) g.alive = false;
    return;
  }
  // Move horizontally, reverse on wall
  g.reverseOnWall = true;
}

function _updateKoopa(k) {
  if (k.state === 'shell') {
    // Shell sitting still — nothing to do
    return;
  }
  // Walking koopa: reverse on wall, also don't walk off ledges (green: walk off; this is simplified)
  k.reverseOnWall = true;
}

function _updateShell(s) {
  s.reverseOnWall = true;
  // Shell has its own vx — no further AI
}

function _updatePiranha(p) {
  p.timer = (p.timer || 0) + 1;
  // 4-phase cycle: hidden, rising, extended, retracting
  const PHASE = 120; // frames per phase
  const phase = Math.floor(p.timer / PHASE) % 4;

  // Don't emerge if Mario is within 1 tile horizontally
  const marioNear = Math.abs(mario.x - p.pipeX) < TILE_SIZE;

  switch (phase) {
    case 0: // hidden
      p.y = p.pipeBottom;
      break;
    case 1: // rising
      if (marioNear) { p.timer = Math.floor(p.timer / PHASE) * PHASE; break; }
      {
        const t = (p.timer % PHASE) / PHASE;  // 0..1
        p.y = p.pipeBottom - t * p.riseHeight;
      }
      break;
    case 2: // extended
      p.y = p.pipeBottom - p.riseHeight;
      break;
    case 3: // retracting
      {
        const t = (p.timer % PHASE) / PHASE;
        p.y = p.pipeBottom - (1 - t) * p.riseHeight;
      }
      break;
  }
}

function _updateFlyingKoopa(fk) {
  // Sine-wave vertical patrol
  fk.patrolTimer = (fk.patrolTimer || 0) + 1;
  const amplitude = 3 * TILE_SIZE;  // 3 tiles
  fk.y = fk.spawnY + Math.sin(fk.patrolTimer * 0.05) * amplitude;
  fk.reverseOnWall = true;
}

// ─── Item Updates ─────────────────────────────────────────────────────────────

function _updateItems() {
  for (const item of items) {
    if (!item.alive) continue;

    // Gravity
    item.vy = (item.vy || 0) + GRAVITY;
    if (item.vy > MAX_FALL_SPEED) item.vy = MAX_FALL_SPEED;

    _updateItem(item);

    // Tile collision (simple)
    const before = { x: item.x, y: item.y };
    resolveEnemyTileCollision(item, grid);

    // Stars bounce
    if (item.type === 'star' && item.y === before.y && item.vy > 0) {
      item.vy = -item.vy * 0.9;
    }

    // Despawn if falls off
    if (item.y > LEVEL_ROWS * TILE_SIZE + TILE_SIZE) item.alive = false;
  }
  items = items.filter(i => i.alive);
}

function _updateItem(item) {
  switch (item.type) {
    case 'mushroom':
    case '1up':
      // Moves at 1.5px/frame, reverses on wall (handled by resolveEnemyTileCollision)
      item.reverseOnWall = true;
      break;
    case 'flower':
      // Stationary after emergence
      item.vx = 0;
      break;
    case 'star':
      item.reverseOnWall = true;
      // constant horizontal speed
      break;
    case 'coin_popup':
      // Coin from block: rises then falls
      item.timer = (item.timer || 0) + 1;
      if (item.timer > 60) item.alive = false;
      break;
  }
}

// ─── Collision Checks ─────────────────────────────────────────────────────────

function _checkPlayerEnemyCollisions() {
  if (mario.dead) return;

  for (const enemy of enemies) {
    if (!enemy.alive || enemy.dying) continue;

    // Piranha plants can never be stomped
    if (enemy.type === 'piranha') {
      if (entitiesOverlap(mario, enemy) && !mario.isInvincible) {
        const result = mario.onEnemyContact();
        if (result.damaged && mario.dead) {
          _triggerDeath();
          return;
        }
      }
      continue;
    }

    // Star or hurt invincibility: kill enemy on contact
    if (mario.starInvincible && entitiesOverlap(mario, enemy)) {
      _killEnemy(enemy, 'star');
      const pts = STOMP_COMBO_POINTS[Math.min(mario.stompCombo, STOMP_COMBO_POINTS.length - 1)];
      mario.stompCombo++;
      _addScore(pts);
      _spawnPopup(enemy.x, enemy.y, pts);
      continue;
    }

    if (isStomping(mario, enemy)) {
      // Stomp!
      if (enemy.type === 'koopa' && enemy.state === 'walking') {
        // Koopa becomes shell
        enemy.state = 'shell';
        enemy.vx    = 0;
        _addScore(100);
        _spawnPopup(enemy.x, enemy.y, 100);
      } else if (enemy.type === 'koopa' && enemy.state === 'shell') {
        // Kick the shell
        const dir = mario.x < enemy.x ? 1 : -1;
        _startSlidingShell(enemy, dir);
      } else {
        // Goomba / flying koopa: squish
        _killEnemy(enemy, 'stomp');
        const pts = mario.onStomp();
        _addScore(pts);
        _spawnPopup(enemy.x, enemy.y, pts);
        if (audio) audio.playStomp();
      }
    } else if (isSideHit(mario, enemy)) {
      // Side/bottom contact — damage Mario (unless invincible)
      if (!mario.isInvincible) {
        // Shell that is sliding also damages
        const result = mario.onEnemyContact();
        if (result.damaged) {
          if (mario.dead) {
            _triggerDeath();
            return;
          }
          if (audio) audio.playPowerDown();
        }
      }
    }
  }
}

function _checkPlayerItemCollisions() {
  if (mario.dead) return;

  for (const item of items) {
    if (!item.alive) continue;
    if (!entitiesOverlap(mario, item)) continue;

    // Collect item
    item.alive = false;
    const pts  = mario.onPowerUp(item.type);
    _addScore(pts);
    _spawnPopup(item.x, item.y, pts);

    if (item.type === 'coin' || item.type === 'coin_popup') {
      gameState.coins++;
      if (gameState.coins >= 100) {
        gameState.coins = 0;
        gameState.lives++;
        _spawnPopup(item.x, item.y - TILE_SIZE, '1UP');
        if (audio) audio.play1UP();
      }
      if (audio) audio.playCoin();
    } else if (item.type === '1up') {
      gameState.lives++;
      _spawnPopup(item.x, item.y, '1UP');
      if (audio) audio.play1UP();
    } else {
      if (audio) audio.playPowerUp();
    }
  }
}

function _checkFireballEnemyCollisions() {
  for (const fb of mario.fireballs) {
    if (!fb.alive) continue;
    for (const enemy of enemies) {
      if (!enemy.alive || enemy.dying) continue;
      if (enemy.type === 'piranha') continue; // piranha is killable by fireball
      if (entitiesOverlap(fb, enemy)) {
        fb.alive = false;
        _killEnemy(enemy, 'fireball');
        _addScore(SCORE.FIREBALL_KILL);
        _spawnPopup(enemy.x, enemy.y, SCORE.FIREBALL_KILL);
        if (audio) audio.playStomp();
        break;
      }
    }
  }
}

function _killEnemy(enemy, cause) {
  enemy.dying     = true;
  enemy.dyingTimer= 0;
  enemy.alive     = false; // for broad-phase skip

  if (cause === 'stomp') {
    enemy.squished = true;
  } else if (cause === 'fireball' || cause === 'star' || cause === 'shell') {
    // Flip and fly off
    enemy.vy = -4;
    enemy.vx = enemy.vx || 1;
    enemy.flipped = true;
  }
}

function _startSlidingShell(enemy, dir) {
  enemy.type    = 'shell';
  enemy.state   = 'sliding';
  enemy.vx      = dir * 8;
  enemy.alive   = true;
}

// ─── Block Bonk ───────────────────────────────────────────────────────────────

function _handleBlockBonk(col, row) {
  const tileId = grid[row]?.[col];
  if (!tileId) return;

  switch (tileId) {
    case TILE.BRICK:
      if (mario.isSuper) {
        // Break brick
        grid[row][col] = TILE.EMPTY;
        _spawnBrickParticles(col, row);
        _addScore(SCORE.BRICK_BREAK);
        if (audio) audio.playBreakBlock();
      } else {
        // Shake (visual effect via renderer)
        _shakeTile(col, row);
        // Bounce enemies on top
        _bounceEnemiesOnTile(col, row);
      }
      break;

    case TILE.QUESTION:
      // Reveal contents
      {
        const content = level.getBlockContent(col, row);
        grid[row][col] = TILE.USED; // depleted
        _spawnItemFromBlock(col, row, content);
        if (audio) audio.playPowerUpAppear();
      }
      break;

    case TILE.INVISIBLE:
      {
        const content = level.getBlockContent(col, row);
        grid[row][col] = TILE.USED;
        _spawnItemFromBlock(col, row, content);
        if (audio) audio.playPowerUpAppear();
      }
      break;

    default:
      // Hard, ground, etc. — no effect (or bounce for any solid)
      _bounceEnemiesOnTile(col, row);
      break;
  }
}

function _spawnItemFromBlock(col, row, content) {
  // Item appears above the block
  const x = col * TILE_SIZE;
  const y = (row - 1) * TILE_SIZE;

  if (content === 'coin') {
    // Coin popup animation
    items.push({
      type: 'coin_popup', alive: true,
      x, y, w: TILE_SIZE, h: TILE_SIZE,
      vx: 0, vy: -2, timer: 0,
    });
    gameState.coins++;
    _addScore(SCORE.COIN);
    if (audio) audio.playCoin();
    return;
  }

  let itemType = content;
  // If small and flower: give mushroom instead
  if (content === 'flower' && mario.state === MARIO_STATE.SMALL) {
    itemType = 'mushroom';
  }

  const item = {
    alive: true, type: itemType,
    x, y, w: TILE_SIZE, h: TILE_SIZE,
    vx: itemType === 'flower' ? 0 : 1.5,
    vy: 0,
    reverseOnWall: true,
  };

  if (itemType === 'star') {
    item.vx = 2;
    item.vy = -3;
  }

  items.push(item);
}

function _shakeTile(col, row) {
  // Signal renderer to play a shake animation on this tile
  // Renderer checks shaken tiles each frame
  if (!_shakenTiles) _shakenTiles = [];
  _shakenTiles.push({ col, row, timer: 8 });
}

let _shakenTiles = [];

function _bounceEnemiesOnTile(col, row) {
  // Kill/bounce enemies standing on top of this tile
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const enemyBottomRow = Math.floor((enemy.y + enemy.h) / TILE_SIZE);
    const enemyColL      = Math.floor(enemy.x / TILE_SIZE);
    const enemyColR      = Math.floor((enemy.x + enemy.w - 1) / TILE_SIZE);
    if (enemyBottomRow === row && enemyColL <= col && enemyColR >= col) {
      _killEnemy(enemy, 'shell'); // treat as projectile kill
      _addScore(SCORE.GOOMBA_STOMP);
      _spawnPopup(enemy.x, enemy.y, SCORE.GOOMBA_STOMP);
    }
  }
}

// ─── Flagpole Check ───────────────────────────────────────────────────────────

function _checkFlagpole() {
  if (gameState.screen !== SCREEN.PLAYING) return;

  // Flagpole at column 210, rows 4-13
  const poleCol   = 210;
  const marioCol  = Math.floor(mario.centerX / TILE_SIZE);
  const marioRow  = Math.floor(mario.y / TILE_SIZE);

  if (marioCol >= poleCol && marioRow >= 4 && marioRow <= 13) {
    _triggerWin();
  }
}

// ─── Camera ───────────────────────────────────────────────────────────────────

function _updateCamera() {
  // Camera X follows Mario, never scrolls left
  const targetX = mario.x - CAMERA_LEAD_X;
  if (targetX > camera.x) {
    camera.x = targetX;
  }
  // Clamp to level bounds
  const maxCamX = LEVEL_WIDTH_PX - LOGICAL_WIDTH;
  if (camera.x < 0)        camera.x = 0;
  if (camera.x > maxCamX)  camera.x = maxCamX;
}

// ─── Score / Popups ───────────────────────────────────────────────────────────

function _addScore(pts) {
  gameState.score = Math.min(999999, gameState.score + pts);
}

/**
 * Spawn a floating score text popup at logical world coords.
 * @param {number} x
 * @param {number} y
 * @param {string|number} value
 */
function _spawnPopup(x, y, value) {
  popups.push({ x, y, value: String(value), timer: 0, maxTimer: 60, vy: -0.5 });
}

function _updatePopups() {
  for (const p of popups) {
    p.timer++;
    p.y += p.vy;
  }
  popups = popups.filter(p => p.timer < p.maxTimer);
}

// ─── Particles ────────────────────────────────────────────────────────────────

function _spawnBrickParticles(col, row) {
  const cx = col * TILE_SIZE + TILE_SIZE / 2;
  const cy = row * TILE_SIZE + TILE_SIZE / 2;
  const angles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
  for (const angle of angles) {
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * 3,
      vy: Math.sin(angle) * 3 - 2,
      color: COLOR.BRICK,
      w: 4, h: 4,
      timer: 0, maxTimer: 40,
    });
  }
}

function _updateParticles() {
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += GRAVITY * 0.5;
    p.timer++;
  }
  particles = particles.filter(p => p.timer < p.maxTimer);
}

// ─── Render ───────────────────────────────────────────────────────────────────

function _render() {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  switch (gameState.screen) {
    case SCREEN.TITLE:
      _renderTitle();
      break;

    case SCREEN.INTRO:
      _renderIntro();
      break;

    case SCREEN.PLAYING:
    case SCREEN.PAUSED:
    case SCREEN.WIN:
    case SCREEN.DEATH:
      _renderGame();
      if (gameState.screen === SCREEN.PAUSED) _renderPauseOverlay();
      if (gameState.screen === SCREEN.WIN)    _renderWinOverlay();
      break;

    case SCREEN.GAMEOVER:
      _renderGameOver();
      break;

    case SCREEN.COMING_SOON:
      _renderComingSoon();
      break;
  }
}

// ─── Render: game world ───────────────────────────────────────────────────────

function _renderGame() {
  // Background sky
  ctx.fillStyle = COLOR.SKY;
  ctx.fillRect(0, HUD.HEIGHT_C, CANVAS_WIDTH, CANVAS_HEIGHT - HUD.HEIGHT_C);

  if (renderer && renderer.drawTiles) {
    renderer.drawTiles(ctx, grid, camera, SCALE, _shakenTiles);
  } else {
    _stubDrawTiles();
  }

  // Tick down shaken tiles
  _shakenTiles = _shakenTiles.filter(t => {
    t.timer--;
    return t.timer > 0;
  });

  // Draw items
  if (renderer && renderer.drawItems) {
    renderer.drawItems(ctx, items, camera, SCALE);
  } else {
    _stubDrawItems();
  }

  // Draw enemies
  if (renderer && renderer.drawEnemies) {
    renderer.drawEnemies(ctx, enemies, camera, SCALE);
  } else {
    _stubDrawEnemies();
  }

  // Draw player
  drawPlayer(ctx, mario, SCALE, camera.x);

  // Draw particles
  _renderParticles();

  // Draw popups
  _renderPopups();

  // Draw HUD
  _renderHUD();
}

function _renderParticles() {
  for (const p of particles) {
    const alpha = 1 - p.timer / p.maxTimer;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(
      (p.x - camera.x) * SCALE,
      p.y * SCALE,
      p.w * SCALE, p.h * SCALE
    );
  }
  ctx.globalAlpha = 1;
}

function _renderPopups() {
  ctx.textAlign    = 'center';
  ctx.font         = `bold ${HUD.FONT_SIZE_C}px monospace`;
  for (const p of popups) {
    const alpha = 1 - p.timer / p.maxTimer;
    const cx    = (p.x - camera.x) * SCALE;
    const cy    = p.y * SCALE;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#000';
    ctx.fillText(p.value, cx + 1, cy + 1);
    ctx.fillStyle = '#FFF';
    ctx.fillText(p.value, cx, cy);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign   = 'left';
}

// ─── Render: HUD ─────────────────────────────────────────────────────────────

function _renderHUD() {
  // HUD background bar
  ctx.fillStyle = COLOR.HUD_BG;
  ctx.fillRect(0, 0, CANVAS_WIDTH, HUD.HEIGHT_C);

  ctx.font      = `${HUD.FONT_SIZE_C}px monospace`;
  ctx.fillStyle = COLOR.HUD_TEXT;

  const score6 = String(gameState.score).padStart(6, '0');
  const coins2 = String(gameState.coins).padStart(2, '0');
  const timeStr= String(Math.max(0, Math.floor(gameState.time))).padStart(3, '0');
  const world  = `${gameState.world}-${gameState.levelNum}`;

  // Shadow then text helper
  const htext = (txt, x, y) => {
    ctx.fillStyle = '#000';
    ctx.fillText(txt, x + 1, y + 1);
    ctx.fillStyle = '#FFF';
    ctx.fillText(txt, x, y);
  };

  htext('MARIO',     HUD.MARIO_X_C,    HUD.LABEL_Y_C);
  htext(score6,      HUD.SCORE_X_C,    HUD.VALUE_Y_C);
  htext('\u00D7' + coins2, HUD.COINX_X_C, HUD.LABEL_Y_C);  // × sign
  htext('WORLD',     HUD.WORLD_X_C,    HUD.LABEL_Y_C);
  htext(world,       HUD.WORLD_VAL_X_C,HUD.VALUE_Y_C);
  htext('TIME',      HUD.TIME_X_C,     HUD.LABEL_Y_C);
  htext(timeStr,     HUD.TIME_VAL_X_C, HUD.VALUE_Y_C);

  // Coin icon (small yellow circle)
  ctx.fillStyle = '#FFFF00';
  ctx.beginPath();
  ctx.arc(HUD.COIN_ICON_X_C, HUD.LABEL_Y_C - 2, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#CC8800';
  ctx.lineWidth   = 1;
  ctx.stroke();
}

// ─── Render: TITLE ───────────────────────────────────────────────────────────

function _renderTitle() {
  ctx.fillStyle = COLOR.BLACK;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.textAlign  = 'center';

  // Title
  ctx.font       = `bold 36px monospace`;
  ctx.fillStyle  = '#000';
  ctx.fillText('SUPER MARIO BROS', CANVAS_WIDTH / 2 + 2, 130 + 2);
  ctx.fillStyle  = '#FFFFFF';
  ctx.fillText('SUPER MARIO BROS', CANVAS_WIDTH / 2, 130);

  // Sub title
  ctx.font       = `18px monospace`;
  ctx.fillStyle  = '#FFFF00';
  ctx.fillText('Web Edition', CANVAS_WIDTH / 2, 160);

  // Decorative Mario silhouette
  _drawTitleMario(CANVAS_WIDTH / 2 - 12, 200);

  // Blinking "Press Enter"
  if (gameState.titleBlink === 0) {
    ctx.font      = `bold 18px monospace`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('PRESS  ENTER  TO  START', CANVAS_WIDTH / 2, 320);
  }

  // Copyright note
  ctx.font      = `12px monospace`;
  ctx.fillStyle = '#888';
  ctx.fillText('Fan project — not affiliated with Nintendo', CANVAS_WIDTH / 2, 460);

  ctx.textAlign = 'left';
}

function _drawTitleMario(x, y) {
  // Simple Mario icon for title screen
  ctx.save();
  ctx.translate(x, y);
  const S = SCALE;
  ctx.fillStyle = COLOR.MARIO_HAT;
  ctx.fillRect(2*S, 0,    8*S, 4*S);
  ctx.fillRect(0*S, 3*S, 10*S, 2*S);
  ctx.fillStyle = COLOR.MARIO_SKIN;
  ctx.fillRect(2*S, 4*S,  8*S, 5*S);
  ctx.fillStyle = COLOR.MARIO_SHIRT;
  ctx.fillRect(0*S, 9*S, 12*S, 4*S);
  ctx.fillStyle = COLOR.MARIO_OVERALLS;
  ctx.fillRect(0*S, 13*S,12*S, 3*S);
  ctx.restore();
}

// ─── Render: INTRO card ──────────────────────────────────────────────────────

function _renderIntro() {
  ctx.fillStyle = COLOR.BLACK;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.textAlign  = 'center';
  ctx.font       = `bold 24px monospace`;
  ctx.fillStyle  = '#FFFFFF';
  ctx.fillText(`WORLD  ${gameState.world}-${gameState.levelNum}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);

  ctx.font       = `18px monospace`;
  ctx.fillText(`MARIO  \u00D7  ${gameState.lives}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);

  // Small Mario icon
  _drawTitleMario(CANVAS_WIDTH / 2 - 48, CANVAS_HEIGHT / 2 + 40);

  ctx.textAlign  = 'left';
}

// ─── Render: PAUSE overlay ───────────────────────────────────────────────────

function _renderPauseOverlay() {
  ctx.fillStyle = COLOR.OVERLAY_BG;
  ctx.fillRect(0, HUD.HEIGHT_C, CANVAS_WIDTH, CANVAS_HEIGHT - HUD.HEIGHT_C);

  ctx.textAlign  = 'center';
  ctx.font       = `bold 32px monospace`;
  ctx.fillStyle  = '#000';
  ctx.fillText('PAUSED', CANVAS_WIDTH / 2 + 2, CANVAS_HEIGHT / 2 + 2);
  ctx.fillStyle  = '#FFFFFF';
  ctx.fillText('PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  ctx.textAlign  = 'left';
}

// ─── Render: WIN overlay ─────────────────────────────────────────────────────

function _renderWinOverlay() {
  if (gameState.winTimer > 240) {
    // Time tally
    ctx.textAlign  = 'center';
    ctx.font       = `bold 20px monospace`;
    ctx.fillStyle  = '#FFFFFF';
    ctx.fillText('COURSE CLEAR!', CANVAS_WIDTH / 2, 100);
    ctx.fillText(`TIME BONUS: ${gameState.time * TIME_BONUS_PER_SEC}`, CANVAS_WIDTH / 2, 140);
    ctx.textAlign  = 'left';
  }
}

// ─── Render: GAMEOVER ────────────────────────────────────────────────────────

function _renderGameOver() {
  ctx.fillStyle = COLOR.BLACK;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.textAlign  = 'center';
  ctx.font       = `bold 36px monospace`;
  ctx.fillStyle  = '#000';
  ctx.fillText('GAME  OVER', CANVAS_WIDTH / 2 + 2, CANVAS_HEIGHT / 2 + 2);
  ctx.fillStyle  = '#FFFFFF';
  ctx.fillText('GAME  OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

  ctx.font       = `16px monospace`;
  ctx.fillStyle  = '#AAAAAA';
  ctx.fillText(`Score: ${String(gameState.score).padStart(6,'0')}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);

  ctx.textAlign  = 'left';
}

// ─── Render: COMING SOON ─────────────────────────────────────────────────────

function _renderComingSoon() {
  ctx.fillStyle = COLOR.BLACK;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.textAlign  = 'center';
  ctx.font       = `bold 28px monospace`;
  ctx.fillStyle  = '#FFFFFF';
  ctx.fillText('WORLD 1-2', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
  ctx.font       = `20px monospace`;
  ctx.fillStyle  = '#FFFF00';
  ctx.fillText('Coming Soon!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);

  ctx.font       = `14px monospace`;
  ctx.fillStyle  = '#AAAAAA';
  ctx.fillText('Press Enter to return to title', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
  ctx.textAlign  = 'left';
}

// ─── Stub renderers (used when renderer.js is missing) ───────────────────────

function _stubDrawTiles() {
  // Minimal tile rendering so the game is playable without renderer.js
  const startCol = Math.floor(camera.x / TILE_SIZE);
  const endCol   = Math.min(LEVEL_COLS - 1, startCol + Math.ceil(LOGICAL_WIDTH / TILE_SIZE) + 1);

  for (let row = 0; row < LEVEL_ROWS; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const tile = grid[row]?.[col];
      if (!tile || tile === TILE.EMPTY) continue;

      const cx = (col * TILE_SIZE - camera.x) * SCALE;
      const cy = row * TILE_SIZE * SCALE;
      const cs = TILE_SIZE * SCALE;

      switch (tile) {
        case TILE.GROUND:
          ctx.fillStyle = row === 9 ? '#E0A000' : '#C07000';
          break;
        case TILE.BRICK:
          ctx.fillStyle = '#C84C0C';
          break;
        case TILE.QUESTION:
          ctx.fillStyle = Math.floor(Date.now() / 250) % 2 === 0 ? '#FAC000' : '#E07820';
          break;
        case TILE.USED:
          ctx.fillStyle = '#706050';
          break;
        case TILE.HARD:
        case TILE.INVISIBLE:
          ctx.fillStyle = tile === TILE.INVISIBLE ? 'transparent' : '#8888AA';
          break;
        case TILE.PIPE_TL:
        case TILE.PIPE_TR:
        case TILE.PIPE_BL:
        case TILE.PIPE_BR:
          ctx.fillStyle = '#00AA00';
          break;
        case TILE.FLAGPOLE:
          ctx.fillStyle = '#AAAAAA';
          ctx.fillRect(cx + cs/2 - 2, cy, 4, cs);
          continue;
        case TILE.FLAG:
          ctx.fillStyle = '#00AA00';
          ctx.fillRect(cx + cs/2, cy, cs/2, cs/2);
          continue;
        case TILE.CASTLE_WALL:
          ctx.fillStyle = '#888888';
          break;
        case TILE.CASTLE_DOOR:
          ctx.fillStyle = '#222222';
          break;
        default:
          ctx.fillStyle = '#888';
      }
      ctx.fillRect(cx, cy, cs, cs);
      // Grid line for clarity
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth   = 0.5;
      ctx.strokeRect(cx, cy, cs, cs);
    }
  }
}

function _stubDrawEnemies() {
  for (const enemy of enemies) {
    if (!enemy.alive && !enemy.dying) continue;
    const cx = (enemy.x - camera.x) * SCALE;
    const cy = enemy.y * SCALE;
    const cw = enemy.w * SCALE;
    const ch = enemy.h * SCALE;

    let color = '#AA5500';
    if (enemy.type === 'koopa' || enemy.type === 'shell') color = '#009900';
    if (enemy.type === 'piranha') color = '#CC0000';

    ctx.fillStyle = color;
    ctx.fillRect(cx, cy, cw, ch);

    // Eyes
    ctx.fillStyle = '#FFF';
    ctx.fillRect(cx + cw * 0.2, cy + ch * 0.2, cw * 0.2, ch * 0.2);
    ctx.fillRect(cx + cw * 0.6, cy + ch * 0.2, cw * 0.2, ch * 0.2);
    ctx.fillStyle = '#000';
    ctx.fillRect(cx + cw * 0.25, cy + ch * 0.25, cw * 0.1, ch * 0.1);
    ctx.fillRect(cx + cw * 0.65, cy + ch * 0.25, cw * 0.1, ch * 0.1);
  }
}

function _stubDrawItems() {
  for (const item of items) {
    if (!item.alive) continue;
    const cx = (item.x - camera.x) * SCALE;
    const cy = item.y * SCALE;
    const cs = TILE_SIZE * SCALE;

    switch (item.type) {
      case 'mushroom': ctx.fillStyle = '#CC0000'; break;
      case '1up':      ctx.fillStyle = '#00CC00'; break;
      case 'flower':   ctx.fillStyle = '#FF8800'; break;
      case 'star':     ctx.fillStyle = '#FFFF00'; break;
      case 'coin_popup': ctx.fillStyle = '#FFDD00'; break;
      default:         ctx.fillStyle = '#FFFFFF';
    }
    ctx.beginPath();
    ctx.arc(cx + cs/2, cy + cs/2, cs/2 - 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Stub Module Factories ────────────────────────────────────────────────────

function _makeStubLevel() {
  // Minimal World 1-1 stub: flat ground so the game boots
  return {
    createGrid() {
      const g = Array.from({ length: LEVEL_ROWS }, () =>
        Array(LEVEL_COLS).fill(TILE.EMPTY)
      );
      // Ground rows 9-14, most columns
      const groundCols = [
        [0, 68], [71, 85], [89, 96], [97, 103],
        [108, 197], [198, 223],
      ];
      for (const [s, e] of groundCols) {
        for (let col = s; col <= e; col++) {
          for (let row = 9; row <= 14; row++) {
            g[row][col] = TILE.GROUND;
          }
        }
      }
      // Pipes (simple solid for MVP)
      const pipes = [[28,29,12,13],[38,39,11,13],[46,47,11,13],[57,58,10,13],[97,98,11,13]];
      for (const [c1, c2, rTop, rBot] of pipes) {
        for (let r = rTop; r <= rBot; r++) {
          g[r][c1] = r === rTop ? TILE.PIPE_TL : TILE.PIPE_BL;
          g[r][c2] = r === rTop ? TILE.PIPE_TR : TILE.PIPE_BR;
        }
      }
      // Question blocks
      const qblocks = [
        [16,9],[22,9],[24,9],[77,9],[79,9],[80,9],[109,5],[110,9],[113,5]
      ];
      for (const [col, row] of qblocks) g[row][col] = TILE.QUESTION;

      // Brick rows
      const bricks = [
        [17,9],[18,9],[19,9],[20,9],[23,9],[25,9],[26,9],
        [78,9],[79,9],[80,9],[81,9],[82,9],
        [77,5],[78,5],[79,5],[80,5],
        [108,5],[109,5],[110,5],[111,5],[112,5],
        [130,9],[131,9],[132,9],[133,9],[130,5],
        [148,9],[149,9],[150,9],[151,9],[152,9],[153,9],[154,9],[155,9],
      ];
      for (const [col, row] of bricks) g[row][col] = TILE.BRICK;

      // Hard platform cols 29-33 row 8
      for (let col = 29; col <= 33; col++) g[8][col] = TILE.HARD;

      // Staircase
      const stairs = [
        [198, [13,13]], [199, [12,13]], [200, [11,13]], [201, [10,13]],
        [202, [9,13]], [203, [8,13]], [204, [7,13]], [205, [6,13]],
      ];
      for (const [col, [rTop, rBot]] of stairs) {
        for (let r = rTop; r <= rBot; r++) g[r][col] = TILE.HARD;
      }

      // Flagpole
      g[4][210] = TILE.FLAG;
      for (let r = 5; r <= 13; r++) g[r][210] = TILE.FLAGPOLE;

      // Castle (simple)
      for (let r = 8; r <= 13; r++) {
        for (let col = 212; col <= 223; col++) g[r][col] = TILE.CASTLE_WALL;
      }
      g[12][216] = TILE.CASTLE_DOOR;
      g[12][217] = TILE.CASTLE_DOOR;
      g[13][216] = TILE.CASTLE_DOOR;
      g[13][217] = TILE.CASTLE_DOOR;

      return g;
    },

    createEnemies() {
      const enemySpawns = [
        { type: 'goomba', col: 22, row: 13 },
        { type: 'goomba', col: 23, row: 13 },
        { type: 'goomba', col: 39, row: 13 },
        { type: 'goomba', col: 40, row: 13 },
        { type: 'koopa',  col: 57, row: 12 },
        { type: 'goomba', col: 80, row: 13 },
        { type: 'goomba', col: 81, row: 13 },
        { type: 'goomba', col: 107, row: 13 },
        { type: 'goomba', col: 108, row: 13 },
        { type: 'goomba', col: 110, row: 13 },
        { type: 'goomba', col: 111, row: 13 },
        { type: 'koopa',  col: 128, row: 13 },
        { type: 'goomba', col: 149, row: 13 },
        { type: 'goomba', col: 150, row: 13 },
        { type: 'goomba', col: 153, row: 13 },
        { type: 'goomba', col: 154, row: 13 },
      ];
      return enemySpawns.map(e => ({
        type:  e.type,
        x:     e.col * TILE_SIZE,
        y:     (e.row - 1) * TILE_SIZE,  // spawn one row above ground
        w:     TILE_SIZE,
        h:     TILE_SIZE,
        vx:    -1,   // move left
        vy:    0,
        alive: true,
        dying: false,
        state: 'walking',
        reverseOnWall: true,
        frameCounter: Math.floor(Math.random() * 60),
        walkFrame: 0,
        squished: false,
      }));
    },

    createItems() {
      return []; // items spawn dynamically from block hits
    },

    getSpawnPoint() {
      return { x: 3 * TILE_SIZE, y: 12 * TILE_SIZE };
    },

    getBlockContent(col, row) {
      // ? block contents per spec
      const map = {
        '16,9': 'coin', '22,9': 'coin', '24,9': 'coin',
        '77,9': 'coin', '79,9': 'coin', '80,9': 'coin',
        '109,5': 'coin', '110,9': 'star', '113,5': 'coin',
        '21,5': 'mushroom', '78,5': 'mushroom',
      };
      return map[`${col},${row}`] || 'coin';
    },
  };
}

function _makeStubRenderer() {
  // Stub renderer — the engine's built-in fallback drawing handles it
  return {
    drawTiles:   null,
    drawEnemies: null,
    drawItems:   null,
  };
}

function _makeStubAudio() {
  // No-op audio stub
  return {
    initAudio()    {},
    startMusic()   {},
    stopMusic()    {},
    pauseMusic()   {},
    resumeMusic()  {},
    setHurryMode() {},
    playCoin()     {},
    playJump()     {},
    playStomp()    {},
    playBreakBlock(){},
    playPowerUp()  {},
    playPowerUpAppear(){},
    playPowerDown(){},
    playDeath()    {},
    playLevelComplete(){},
    playFlagpole() {},
    play1UP()      {},
    tick()         {},
  };
}

// ─── Auto-init when DOM is ready ─────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
