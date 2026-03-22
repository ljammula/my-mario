/**
 * types/entities.ts
 * Entity interfaces: PlayerState, EnemyType, ItemType, and related.
 */

// ─── Player ───────────────────────────────────────────────────────────────────

export enum MarioForm {
  SMALL = 'SMALL',
  SUPER = 'SUPER',
  FIRE  = 'FIRE',
}

export enum AnimState {
  IDLE   = 'idle',
  WALK   = 'walk',
  RUN    = 'run',
  JUMP   = 'jump',
  SKID   = 'skid',
  CROUCH = 'crouch',
  DEATH  = 'death',
  GROW   = 'grow',
  SLIDE  = 'slide',  // flagpole slide
}

export interface PlayerState {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  form: MarioForm;
  animState: AnimState;
  facing: number;       // 1 = right, -1 = left
  grounded: boolean;
  crouching: boolean;
  isJumping: boolean;
  dead: boolean;
  starInvincible: boolean;
  starTimer: number;
  hurtInvincible: boolean;
  hurtTimer: number;
  frameCounter: number;
}

// ─── Enemies ──────────────────────────────────────────────────────────────────

export enum EnemyType {
  GOOMBA        = 'goomba',
  KOOPA_TROOPA  = 'koopa_troopa',
  KOOPA_SHELL   = 'koopa_shell',
  PIRANHA_PLANT = 'piranha_plant',
  FLYING_KOOPA  = 'flying_koopa',
}

export enum GoombaState {
  WALKING = 'walking',
  STOMPED = 'stomped',
  FLIPPED = 'flipped',
}

export enum KoopaState {
  WALKING  = 'walking',
  SHELL    = 'shell',
  SLIDING  = 'sliding',
  FLIPPED  = 'flipped',
}

export enum PiranhaState {
  WAITING_BOTTOM = 'waiting_bottom',
  RISING         = 'rising',
  WAITING_TOP    = 'waiting_top',
  RETRACTING     = 'retracting',
}

// ─── Items ────────────────────────────────────────────────────────────────────

export enum ItemType {
  MUSHROOM   = 'mushroom',
  FIRE_FLOWER= 'fire_flower',
  STAR       = 'star',
  ONE_UP     = '1up',
  COIN       = 'coin',
}

export interface ItemState {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  type: ItemType;
  alive: boolean;
  collected: boolean;
}

// ─── Game State ───────────────────────────────────────────────────────────────

export enum Screen {
  TITLE     = 'title',
  INTRO     = 'intro',
  PLAYING   = 'playing',
  PAUSED    = 'paused',
  DEATH     = 'death',
  WIN       = 'win',
  GAMEOVER  = 'gameover',
}

export interface GameState {
  screen:        Screen;
  score:         number;   // wraps at 999999
  coins:         number;   // wraps at 100 → +1 life
  lives:         number;
  world:         number;
  levelNum:      number;
  time:          number;   // seconds remaining
  frameCount:    number;
  hurryMode:     boolean;
  // Sub-timers
  introTimer:    number;
  gameoverTimer: number;
  winTimer:      number;
  titleBlink:    number;
  stompCombo:    number;   // consecutive stomps this airborne sequence
}
