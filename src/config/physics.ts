/**
 * physics.ts
 * All physics constants for Super Mario Bros v2.
 * Values transcribed verbatim from js/constants.js, verified against spec.md.
 * All units: logical pixels per frame (at 60fps).
 */

// ─── Gravity ──────────────────────────────────────────────────────────────────
export const GRAVITY             = 0.5;    // px/frame² applied each frame
export const MAX_FALL_SPEED      = 8.0;    // terminal velocity (clamped vy)

// ─── Jump ─────────────────────────────────────────────────────────────────────
export const JUMP_VELOCITY       = -8.5;   // initial vy when jump is pressed
export const JUMP_HOLD_GRAVITY   = 0.25;   // reduced gravity while jump held & vy < 0
export const JUMP_RELEASE_GRAVITY= 0.5;    // normal gravity once key released or vy >= 0

// ─── Input Feel ───────────────────────────────────────────────────────────────
export const COYOTE_FRAMES       = 4;      // frames after walking off edge where jump is still valid
export const JUMP_BUFFER_FRAMES  = 6;      // frames before landing where jump input is buffered

// ─── Horizontal Movement ──────────────────────────────────────────────────────
export const WALK_ACCELERATION   = 0.15;   // px/frame² acceleration while walking
export const RUN_ACCELERATION    = 0.25;   // px/frame² acceleration while running
export const WALK_MAX_SPEED      = 2.5;    // max speed without run key
export const RUN_MAX_SPEED       = 5.0;    // max speed with run key held
export const SKID_DECELERATION   = 0.35;   // px/frame² when changing direction
export const GROUND_FRICTION     = 0.12;   // px/frame² deceleration on ground, no key
export const AIR_RESISTANCE      = 0.04;   // px/frame² deceleration in air, no key

// ─── Death ────────────────────────────────────────────────────────────────────
export const DEATH_POP_VELOCITY  = -8.0;   // initial vy on death pop

// ─── Fireball ─────────────────────────────────────────────────────────────────
export const FIREBALL_SPEED_X    = 6.0;    // px/frame horizontal
export const FIREBALL_SPEED_Y    = 3.0;    // initial vertical (downward, toward ground)
export const FIREBALL_GRAVITY    = 0.4;    // px/frame² gravity on fireball
export const FIREBALL_MAX_BOUNCES= 5;      // max ground bounces before dying
export const FIREBALL_MAX_ACTIVE = 2;      // max simultaneous fireballs

// ─── Enemy Speeds ─────────────────────────────────────────────────────────────
export const GOOMBA_SPEED        = 1.0;    // px/frame walking speed
export const KOOPA_SPEED         = 1.0;    // px/frame walking speed
export const KOOPA_SHELL_SPEED   = 8.0;    // px/frame shell sliding speed
export const FLYING_KOOPA_SPEED  = 1.5;    // px/frame flying speed

// ─── Piranha Plant Timings ────────────────────────────────────────────────────
export const PIRANHA_RISE_TIME   = 120;    // frames for full emerge (2s at 60fps)
export const PIRANHA_PAUSE_TIME  = 120;    // frames paused at top/bottom

// ─── Invincibility ────────────────────────────────────────────────────────────
export const INVINCIBLE_DURATION    = 600; // frames (10s at 60fps) — star power
export const HURT_INVINCIBLE_FRAMES = 120; // frames (~2s) after being hit
export const FLICKER_RATE           = 6;   // frames per flicker toggle

// ─── Camera ───────────────────────────────────────────────────────────────────
export const CAMERA_LEAD_X       = 128;    // Mario is this many logical px from left edge
