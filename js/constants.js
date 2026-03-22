/**
 * constants.js
 * All physics constants, tile IDs, colors, and game settings for Super Mario Bros.
 * All physics values are in logical pixels/frames at 60fps.
 * The canvas is 512x480 (2x scale); all game logic uses logical coords (256x240).
 */

// ─── Canvas / Rendering ─────────────────────────────────────────────────────
export const CANVAS_WIDTH        = 512;     // canvas element pixel width
export const CANVAS_HEIGHT       = 480;     // canvas element pixel height
export const LOGICAL_WIDTH       = 256;     // logical game width (NES resolution)
export const LOGICAL_HEIGHT      = 240;     // logical game height
export const SCALE               = 2;       // canvas pixels per logical pixel
export const TARGET_FPS          = 60;

// ─── Tile ────────────────────────────────────────────────────────────────────
export const TILE_SIZE           = 16;      // logical pixels per tile
export const TILE_SIZE_C         = 32;      // canvas pixels per tile (TILE_SIZE * SCALE)

// Level dimensions
export const LEVEL_COLS          = 224;     // total tile columns
export const LEVEL_ROWS          = 16;      // total tile rows (row 15 = death pit)
export const LEVEL_WIDTH_PX      = LEVEL_COLS * TILE_SIZE;   // 3584 logical px
export const LEVEL_HEIGHT_PX     = LEVEL_ROWS * TILE_SIZE;   // 256 logical px

// ─── Tile IDs ────────────────────────────────────────────────────────────────
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
export const SOLID_TILES = new Set([
  TILE.GROUND, TILE.BRICK, TILE.QUESTION, TILE.USED, TILE.HARD, TILE.INVISIBLE,
  TILE.PIPE_TL, TILE.PIPE_TR, TILE.PIPE_BL, TILE.PIPE_BR,
  TILE.CASTLE_WALL, TILE.CASTLE_DOOR,
]);

// Tiles that are solid but only from the top (one-way platforms if needed later)
export const FLAGPOLE_TILES = new Set([TILE.FLAGPOLE, TILE.FLAG]);

// ─── Physics Constants ───────────────────────────────────────────────────────
export const GRAVITY             = 0.5;    // px/frame² applied each frame
export const MAX_FALL_SPEED      = 8.0;    // terminal velocity (clamped vy)

// Jump
export const JUMP_VELOCITY       = -8.5;  // initial vy when jump is pressed
export const JUMP_HOLD_GRAVITY   = 0.25;  // reduced gravity while jump held & vy < 0
export const JUMP_RELEASE_GRAVITY= 0.5;   // normal gravity once key released or vy >= 0

// Jump feel timers
export const COYOTE_FRAMES       = 4;     // frames after walking off edge where jump is still valid
export const JUMP_BUFFER_FRAMES  = 6;     // frames before landing where jump input is buffered

// Horizontal movement
export const WALK_ACCELERATION   = 0.15;  // px/frame² acceleration while walking
export const RUN_ACCELERATION    = 0.25;  // px/frame² acceleration while running
export const WALK_MAX_SPEED      = 2.5;   // max speed without run key
export const RUN_MAX_SPEED       = 5.0;   // max speed with run key held
export const SKID_DECELERATION   = 0.35;  // px/frame² when changing direction
export const GROUND_FRICTION     = 0.12;  // px/frame² deceleration on ground, no key
export const AIR_RESISTANCE      = 0.04;  // px/frame² deceleration in air, no key

// ─── Player Hitboxes (logical pixels) ────────────────────────────────────────
export const SMALL_MARIO_W       = 12;
export const SMALL_MARIO_H       = 16;
export const SUPER_MARIO_W       = 12;
export const SUPER_MARIO_H       = 24;
// Horizontal inset from sprite edge for hitbox (fairness)
export const MARIO_HITBOX_INSET  = 2;

// ─── Player States ────────────────────────────────────────────────────────────
export const MARIO_STATE = Object.freeze({
  SMALL:       'SMALL',
  SUPER:       'SUPER',
  FIRE:        'FIRE',
  INVINCIBLE:  'INVINCIBLE', // overlay, tracked separately
});

// ─── Player Animation States ─────────────────────────────────────────────────
export const ANIM_STATE = Object.freeze({
  IDLE:    'idle',
  WALK:    'walk',
  RUN:     'run',
  JUMP:    'jump',
  SKID:    'skid',
  CROUCH:  'crouch',
  DEATH:   'death',
  GROW:    'grow',
  SLIDE:   'slide',    // flagpole slide
});

// Walk animation frame counts
export const WALK_FRAME_DURATION = 6;  // frames per walk step
export const RUN_FRAME_DURATION  = 4;  // frames per run step

// ─── Death Animation ─────────────────────────────────────────────────────────
export const DEATH_POP_VELOCITY  = -8.0;   // initial vy on death pop
export const DEATH_ANIM_FRAMES   = 120;    // ~2 seconds before respawn check

// ─── Invincibility ───────────────────────────────────────────────────────────
export const INVINCIBLE_DURATION    = 600;   // frames (10 sec at 60fps)
export const HURT_INVINCIBLE_FRAMES = 120;   // ~2 sec invincibility after being hit
export const FLICKER_RATE           = 6;     // frames per flicker toggle

// ─── Fireball ────────────────────────────────────────────────────────────────
export const FIREBALL_SPEED_X    = 6.0;    // px/frame horizontal
export const FIREBALL_SPEED_Y    = -4.0;   // initial vertical (downward arc)
export const FIREBALL_GRAVITY    = 0.4;    // px/frame² gravity on fireball
export const FIREBALL_MAX_BOUNCES= 5;
export const FIREBALL_MAX_ACTIVE = 2;
export const FIREBALL_W          = 8;
export const FIREBALL_H          = 8;

// ─── Enemy Constants ─────────────────────────────────────────────────────────
export const GOOMBA_SPEED        = 1.0;
export const KOOPA_SPEED         = 1.0;
export const KOOPA_SHELL_SPEED   = 8.0;
export const FLYING_KOOPA_SPEED  = 1.5;
export const PIRANHA_RISE_TIME   = 120;  // frames for full rise (2 sec)
export const PIRANHA_PAUSE_TIME  = 120;  // frames paused at top/bottom

// ─── Camera ──────────────────────────────────────────────────────────────────
export const CAMERA_LEAD_X      = 128;   // Mario is this many logical px from left

// ─── Scoring ─────────────────────────────────────────────────────────────────
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
export const STOMP_COMBO_POINTS = [100, 200, 400, 800, 1000, 2000, 4000, 8000];

// ─── Time Limit ──────────────────────────────────────────────────────────────
export const TIME_LIMIT          = 400;   // seconds
export const HURRY_TIME          = 100;   // seconds remaining when hurry mode starts
export const TIME_BONUS_PER_SEC  = 50;    // points per remaining second at flagpole

// ─── Game States (screen) ────────────────────────────────────────────────────
export const SCREEN = Object.freeze({
  TITLE:     'title',
  INTRO:     'intro',      // world/lives intro card
  PLAYING:   'playing',
  PAUSED:    'paused',
  DEATH:     'death',
  WIN:       'win',
  GAMEOVER:  'gameover',
  COMING_SOON: 'coming_soon',
});

// ─── Colors ───────────────────────────────────────────────────────────────────
export const COLOR = Object.freeze({
  // Sky
  SKY:             '#5C94FC',  // NES world 1 sky blue
  // HUD
  HUD_BG:          '#000000',
  HUD_TEXT:        '#FFFFFF',
  HUD_SHADOW:      '#000000',
  // Mario — small
  MARIO_HAT:       '#CC0000',
  MARIO_SKIN:      '#FFCC99',
  MARIO_SHIRT:     '#CC0000',
  MARIO_OVERALLS:  '#0000CC',
  MARIO_HAIR:      '#6B3A2A',
  // Mario — fire (white shirt)
  FIRE_SHIRT:      '#FFFFFF',
  FIRE_OVERALLS:   '#CC0000',
  // Invincibility rainbow palette (cycles every 4 frames)
  RAINBOW: ['#FF0000','#FF8800','#FFFF00','#00CC00','#0088FF','#CC00CC'],
  // Ground
  GROUND_TOP:      '#E0A000',  // tan top row
  GROUND_FILL:     '#C07000',  // darker fill
  // Brick
  BRICK:           '#C84C0C',
  BRICK_MORTAR:    '#C8A078',
  // Question block
  QUESTION_FRAME:  '#E07820',
  QUESTION_BG:     '#FAC000',
  QUESTION_MARK:   '#FFFFFF',
  // Used block
  USED_BLOCK:      '#706050',
  // Hard block
  HARD_BLOCK:      '#8888AA',
  // Pipe
  PIPE_GREEN:      '#00AA00',
  PIPE_DARK:       '#006600',
  PIPE_LIGHT:      '#44CC44',
  // Flagpole
  FLAGPOLE_POLE:   '#AAAAAA',
  FLAG_COLOR:      '#00AA00',
  // Enemies
  GOOMBA_BODY:     '#AA5500',
  GOOMBA_DARK:     '#552200',
  GOOMBA_FEET:     '#552200',
  KOOPA_SHELL:     '#009900',
  KOOPA_SKIN:      '#FFFF00',
  KOOPA_DARK:      '#006600',
  // Items
  MUSHROOM_RED:    '#CC0000',
  MUSHROOM_SPOTS:  '#FFFFFF',
  MUSHROOM_GREEN:  '#00AA00',
  MUSHROOM_STEM:   '#FFCC99',
  FLOWER_RED:      '#CC0000',
  FLOWER_YELLOW:   '#FFFF00',
  FLOWER_STEM:     '#00AA00',
  STAR_YELLOW:     '#FFFF00',
  STAR_OUTLINE:    '#CC8800',
  FIREBALL:        '#FFFFFF',
  FIREBALL_GLOW:   '#FFAA00',
  COIN_YELLOW:     '#FFFF00',
  COIN_DARK:       '#CC8800',
  // Background overlays
  OVERLAY_BG:      'rgba(0,0,0,0.5)',
  BLACK:           '#000000',
  WHITE:           '#FFFFFF',
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

// ─── Audio frequencies (Hz) ──────────────────────────────────────────────────
export const AUDIO = Object.freeze({
  // Jump sweep
  JUMP_SMALL_START:  300,
  JUMP_SMALL_END:    600,
  JUMP_SMALL_DUR:    0.1,
  JUMP_SUPER_START:  200,
  JUMP_SUPER_END:    500,
  JUMP_SUPER_DUR:    0.15,
  // Coin
  COIN_FREQ1:        988,
  COIN_FREQ2:        1319,
  COIN_DUR1:         0.05,
  COIN_DUR2:         0.15,
  // Stomp
  STOMP_START:       200,
  STOMP_END:         100,
  STOMP_DUR:         0.1,
});
