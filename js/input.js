/**
 * input.js
 * Keyboard input handler for Super Mario Bros.
 *
 * Design:
 * - Movement keys (left, right, down) use continuous polling each frame.
 * - Jump and fire keys trigger on keydown only; they must be released and
 *   re-pressed to trigger again (no key-repeat).
 * - The inputState object is a plain object that the engine reads each frame.
 *
 * Usage:
 *   import { initInput, inputState, consumeJump, consumeFire, consumeStart } from './input.js';
 *   initInput();   // call once to attach event listeners
 *   // Each frame: read inputState fields, then call consume* to clear edge-triggered flags
 */

/**
 * Raw key state — true while key is physically held.
 * @type {Object.<string, boolean>}
 */
const keyDown = {};

/**
 * inputState — the canonical input snapshot read by the engine each frame.
 *
 *  Continuous (polling):
 *    left    — move left
 *    right   — move right
 *    down    — crouch / duck
 *    run     — run / hold-fire modifier (X key)
 *    jumpHeld— jump key is currently held (for variable-height jump gravity)
 *
 *  Edge-triggered (true for exactly one frame, consumed via consume* functions):
 *    jump    — jump was just pressed (Space / Z)
 *    fire    — fire was just pressed (X, only when run key is not re-held for run;
 *              in practice X serves both run AND fire — engine decides based on state)
 *    start   — Enter was just pressed (title/pause toggle)
 */
export const inputState = {
  left:     false,
  right:    false,
  down:     false,
  run:      false,     // X held → run (and fire modifier)
  jumpHeld: false,     // Space/Z held → variable jump gravity
  jump:     false,     // edge: jump pressed this frame
  fire:     false,     // edge: X pressed this frame (for firing, not holding)
  start:    false,     // edge: Enter pressed this frame
};

/**
 * Map from KeyboardEvent.code to action.
 * Multiple codes can map to the same action.
 */
const KEY_MAP = {
  // Move left
  ArrowLeft:  'left',
  KeyA:       'left',
  // Move right
  ArrowRight: 'right',
  KeyD:       'right',
  // Crouch / down
  ArrowDown:  'down',
  KeyS:       'down',
  // Jump (edge)
  Space:      'jump',
  KeyZ:       'jump',
  // Run / Fire (X key: continuous for run speed, edge for fireball)
  KeyX:       'run',
  // Start / Pause
  Enter:      'start',
};

/**
 * Codes that produce edge-triggered (pressed-once) events.
 * These set a flag on keydown and require re-press to trigger again.
 */
const EDGE_TRIGGERED = new Set(['jump', 'start']);

/**
 * Track which edge-triggered keys are "consumed" so we don't fire twice.
 * true = key is held down and was already processed; wait for keyup.
 */
const edgeLatch = {
  jump:  false,
  start: false,
  fire:  false,  // X key as fire (edge) — separate from run (continuous)
};

// ─── Event Handlers ──────────────────────────────────────────────────────────

function onKeyDown(e) {
  // Prevent default browser behavior for game keys (e.g., Space scrolling page)
  if (KEY_MAP[e.code] !== undefined || e.code === 'KeyX') {
    e.preventDefault();
  }

  keyDown[e.code] = true;

  const action = KEY_MAP[e.code];
  if (!action) return;

  if (action === 'jump' && !edgeLatch.jump) {
    inputState.jump = true;
    edgeLatch.jump = true;
  }

  if (action === 'start' && !edgeLatch.start) {
    inputState.start = true;
    edgeLatch.start = true;
  }

  // X key: sets run (continuous) AND fire (edge, once per press)
  if (e.code === 'KeyX' && !edgeLatch.fire) {
    inputState.fire = true;
    edgeLatch.fire = true;
  }
}

function onKeyUp(e) {
  keyDown[e.code] = false;

  const action = KEY_MAP[e.code];

  // Release edge latches
  if (action === 'jump')  edgeLatch.jump  = false;
  if (action === 'start') edgeLatch.start = false;
  if (e.code === 'KeyX')  edgeLatch.fire  = false;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Attach keyboard event listeners to the window.
 * Call once at startup.
 */
export function initInput() {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup',   onKeyUp);
}

/**
 * Remove keyboard event listeners (for cleanup).
 */
export function destroyInput() {
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup',   onKeyUp);
}

/**
 * Poll continuous key states into inputState.
 * Call at the START of each frame before reading inputState.
 * This also preserves the edge-triggered flags set by keydown events.
 */
export function pollInput() {
  // Continuous keys — updated every frame from raw keyDown state
  inputState.left     = !!(keyDown['ArrowLeft']  || keyDown['KeyA']);
  inputState.right    = !!(keyDown['ArrowRight'] || keyDown['KeyD']);
  inputState.down     = !!(keyDown['ArrowDown']  || keyDown['KeyS']);
  inputState.run      = !!(keyDown['KeyX']);
  inputState.jumpHeld = !!(keyDown['Space'] || keyDown['KeyZ']);
  // Note: inputState.jump, inputState.fire, inputState.start
  // are set by keydown events and must be consumed (cleared) by the engine.
}

/**
 * Consume (clear) the edge-triggered jump flag.
 * Call after the engine has processed the jump this frame.
 */
export function consumeJump() {
  inputState.jump = false;
}

/**
 * Consume (clear) the edge-triggered fire flag.
 */
export function consumeFire() {
  inputState.fire = false;
}

/**
 * Consume (clear) the edge-triggered start flag.
 */
export function consumeStart() {
  inputState.start = false;
}
