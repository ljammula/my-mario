/**
 * constants.ts
 * Canvas dimensions, tile sizes, tile IDs, game constants, scoring, HUD layout.
 * All logic coordinates are in logical pixels (NES 256×240); canvas is 512×480 (2× scale).
 */

// ─── Canvas / Rendering ───────────────────────────────────────────────────────
export const CANVAS_WIDTH        = 512;    // canvas element pixel width
export const CANVAS_HEIGHT       = 480;    // canvas element pixel height
export const LOGICAL_WIDTH       = 256;    // logical game width (NES resolution)
export const LOGICAL_HEIGHT      = 240;    // logical game height
export const SCALE               = 2;      // canvas pixels per logical pixel
export const TARGET_FPS          = 60;

// ─── Tile ─────────────────────────────────────────────────────────────────────
export const TILE_SIZE           = 16;     // logical pixels per tile
export const TILE_SIZE_C         = 32;     // canvas pixels per tile (TILE_SIZE * SCALE)

// ─── Level Dimensions ─────────────────────────────────────────────────────────
export const LEVEL_COLS          = 224;    // total tile columns
export const LEVEL_ROWS          = 15;     // rows 0-14; row 14 = ground; death pit is virtual (no grid row)
export const LEVEL_WIDTH_PX      = LEVEL_COLS * TILE_SIZE;   // 3584 logical px
export const LEVEL_HEIGHT_PX     = LEVEL_ROWS * TILE_SIZE;   // 240 logical px

// ─── Tile IDs ─────────────────────────────────────────────────────────────────
export const TILE = Object.freeze({
  EMPTY:        '.',   // air
  GROUND:       'G',   // solid ground (unbreakable)
  BRICK:        'B',   // brick block (breakable by Super+)
  QUESTION:     'Q',   // question mark block
  USED:         'U',   // depleted question block
  HARD:         'H',   // indestructible hard block
  INVISIBLE:    'I',   // invisible item block (same collision as H)
  PIPE_TL:      'PT',  // pipe top-left
  PIPE_TR:      'PR',  // pipe top-right
  PIPE_BL:      'PL',  // pipe body-left
  PIPE_BR:      'PB',  // pipe body-right
  FLAGPOLE:     'FP',  // flagpole segment
  FLAG:         'FF',  // flag at top of pole
  CASTLE_WALL:  'CA',  // castle wall tile
  CASTLE_DOOR:  'CD',  // castle door tile
});

// Set of tile IDs that are solid for collision
export const SOLID_TILES: Set<string> = new Set([
  TILE.GROUND, TILE.BRICK, TILE.QUESTION, TILE.USED, TILE.HARD, TILE.INVISIBLE,
  TILE.PIPE_TL, TILE.PIPE_TR, TILE.PIPE_BL, TILE.PIPE_BR,
  TILE.CASTLE_WALL, TILE.CASTLE_DOOR,
]);

// ─── Player Hitboxes (logical pixels) ─────────────────────────────────────────
export const SMALL_MARIO_W       = 12;
export const SMALL_MARIO_H       = 16;
export const SUPER_MARIO_W       = 12;
export const SUPER_MARIO_H       = 24;
export const MARIO_HITBOX_INSET  = 2;      // px inset each side for fairness

// ─── Fireball Dimensions ──────────────────────────────────────────────────────
export const FIREBALL_W          = 8;
export const FIREBALL_H          = 8;

// ─── Player Animation Frame Timings ──────────────────────────────────────────
export const WALK_FRAME_DURATION = 6;      // frames per walk step
export const RUN_FRAME_DURATION  = 4;      // frames per run step

// ─── Death Animation ──────────────────────────────────────────────────────────
export const DEATH_ANIM_FRAMES   = 120;    // ~2 seconds before respawn check

// ─── Scoring ──────────────────────────────────────────────────────────────────
export const SCORE = Object.freeze({
  GOOMBA_STOMP:    100,
  KOOPA_STOMP:     100,
  BRICK_BREAK:      50,
  COIN:            200,
  POWERUP:        1000,
  FIREBALL_KILL:   200,
  FLAGPOLE_LOW:    100,
  FLAGPOLE_MID1:   500,
  FLAGPOLE_MID2:  1000,
  FLAGPOLE_HIGH1: 2000,
  FLAGPOLE_HIGH2: 4000,
  FLAGPOLE_TOP:   5000,
});

// Multi-stomp combo points table (index = stomp number - 1)
export const STOMP_COMBO_POINTS = [100, 200, 400, 800, 1000, 2000, 4000, 8000] as const;

// ─── Time Limit ───────────────────────────────────────────────────────────────
export const TIME_LIMIT          = 400;    // seconds
export const HURRY_TIME          = 100;    // seconds remaining when hurry mode starts
export const TIME_BONUS_PER_SEC  = 50;     // points per remaining second at flagpole

// ─── Game Screen States ───────────────────────────────────────────────────────
export const SCREEN = Object.freeze({
  TITLE:        'title',
  INTRO:        'intro',
  PLAYING:      'playing',
  PAUSED:       'paused',
  DEATH:        'death',
  WIN:          'win',
  GAMEOVER:     'gameover',
  COMING_SOON:  'coming_soon',
});

// ─── HUD Layout (canvas coordinates) ─────────────────────────────────────────
export const HUD = Object.freeze({
  HEIGHT_C:      48,    // canvas px height of HUD bar
  LABEL_Y_C:     16,
  VALUE_Y_C:     32,
  MARIO_X_C:     24,
  SCORE_X_C:     24,
  COIN_ICON_X_C: 200,
  COINX_X_C:     214,
  COIN_CNT_X_C:  228,
  WORLD_X_C:     312,
  WORLD_VAL_X_C: 318,
  TIME_X_C:      424,
  TIME_VAL_X_C:  430,
  FONT_SIZE_C:   16,    // canvas px (8 logical * 2)
});

// ─── Object Pool Sizes ────────────────────────────────────────────────────────
export const POOL_FIREBALLS      = 2;
export const POOL_PARTICLES      = 64;
export const POOL_SCORE_POPUPS   = 16;
export const POOL_ENEMIES        = 32;
