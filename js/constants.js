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
const WALK_ACCELERATION = 0.22;
const RUN_ACCELERATION  = 0.34;
const WALK_MAX_SPEED    = 2.9;
const RUN_MAX_SPEED     = 5.4;
const SKID_DECELERATION = 0.50;
const GROUND_FRICTION   = 0.18;
const AIR_RESISTANCE    = 0.05;
const COYOTE_FRAMES     = 4;
const JUMP_BUFFER       = 6;
const DEATH_POP_VY      = -8.0;

// Input repeat tuning (frames @ 60 fps)
const INPUT_REPEAT_DELAY    = 8;
const INPUT_REPEAT_INTERVAL = 2;

// Camera tuning
const CAMERA_LOOKAHEAD    = 28;
const CAMERA_SMOOTHING    = 0.22;
const CAMERA_MAX_STEP     = 10;
const CAMERA_VX_GAIN      = 1.2;
const CAMERA_SNAP_EPSILON = 0.1;

// Tile IDs
const T = {
  EMPTY:       '.',
  GROUND:      'G',
  BRICK:       'B',
  PLATFORM:    'M',
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

const SOLID_TILES = new Set(['G','B','M','Q','U','H','PT','PR','PL','PB','CA','CD']);

const MAX_LEVEL = 10; // all 10 levels implemented

// Game states
const STATE = {
  TITLE:        'TITLE',
  LEVEL_SELECT: 'LEVEL_SELECT',
  INTRO:        'INTRO',
  PLAYING:      'PLAYING',
  PAUSED:       'PAUSED',
  DEATH:        'DEATH',
  WIN:          'WIN',
  GAMEOVER:     'GAMEOVER',
  FADE:         'FADE',
};
