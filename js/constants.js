// ============================================================
// CONSTANTS & PHYSICS
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
  EMPTY:       '.',
  GROUND:      'G',
  BRICK:       'B',
  QUESTION:    'Q',
  USED:        'U',
  HARD:        'H',
  PIPE_TOP_L:  'PT',
  PIPE_TOP_R:  'PR',
  PIPE_BODY_L: 'PL',
  PIPE_BODY_R: 'PB',
  FLAG_POLE:   'FP',
  FLAG_FLAG:   'FF',
  CASTLE_WALL: 'CA',
  CASTLE_DOOR: 'CD',
};

const SOLID_TILES = new Set(['G','B','Q','U','H','PT','PR','PL','PB','CA','CD']);

// Game states
const STATE = {
  TITLE:    'TITLE',
  INTRO:    'INTRO',
  PLAYING:  'PLAYING',
  PAUSED:   'PAUSED',
  DEATH:    'DEATH',
  WIN:      'WIN',
  GAMEOVER: 'GAMEOVER',
};
