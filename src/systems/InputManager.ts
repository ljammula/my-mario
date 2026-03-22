/**
 * InputManager.ts
 * Keyboard input handler for Super Mario Bros v2.
 * Ported from js/input.js with TypeScript types and jump buffer logic added.
 *
 * Design:
 * - Movement keys (left, right, down, run, jumpHeld) use continuous polling.
 * - Jump, fire, start are edge-triggered: set on keydown, consumed after one frame.
 * - Jump buffer: if jump pressed while airborne, buffer it for JUMP_BUFFER_FRAMES.
 *   Mario.ts checks jumpBufferTimer instead of the raw jump edge flag.
 */

import { InputSnapshot } from '../types/input';
import { JUMP_BUFFER_FRAMES } from '../config/physics';

/** Raw key-held state keyed by KeyboardEvent.code */
const keyDown: Record<string, boolean> = {};

/** Edge latch — prevents key-repeat firing for edge-triggered actions */
const edgeLatch = {
  jump:  false,
  start: false,
  fire:  false,
};

/** Map from KeyboardEvent.code to logical action name */
const KEY_MAP: Record<string, string> = {
  ArrowLeft:  'left',
  KeyA:       'left',
  ArrowRight: 'right',
  KeyD:       'right',
  ArrowDown:  'down',
  KeyS:       'down',
  Space:      'jump',
  KeyZ:       'jump',
  KeyX:       'run',
  Enter:      'start',
};

export class InputManager {
  private _jump:  boolean = false;
  private _fire:  boolean = false;
  private _start: boolean = false;

  /** frames since jump was pressed while airborne; counts down to 0 */
  jumpBufferTimer: number = 0;

  /** Whether the player is currently airborne (set externally each frame by Mario) */
  playerAirborne: boolean = false;

  constructor() {
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp   = this._onKeyUp.bind(this);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup',   this._onKeyUp);
  }

  private _onKeyDown(e: KeyboardEvent): void {
    // Prevent default browser behavior for game keys (e.g., Space scrolling page)
    if (KEY_MAP[e.code] !== undefined || e.code === 'KeyX') {
      e.preventDefault();
    }

    keyDown[e.code] = true;

    const action = KEY_MAP[e.code];
    if (!action) return;

    if (action === 'jump' && !edgeLatch.jump) {
      this._jump    = true;
      edgeLatch.jump = true;
    }

    if (action === 'start' && !edgeLatch.start) {
      this._start    = true;
      edgeLatch.start = true;
    }

    // X key: sets run (continuous) AND fire (edge, once per press)
    if (e.code === 'KeyX' && !edgeLatch.fire) {
      this._fire    = true;
      edgeLatch.fire = true;
    }
  }

  private _onKeyUp(e: KeyboardEvent): void {
    keyDown[e.code] = false;

    const action = KEY_MAP[e.code];
    if (action === 'jump')  edgeLatch.jump  = false;
    if (action === 'start') edgeLatch.start = false;
    if (e.code === 'KeyX')  edgeLatch.fire  = false;
  }

  /**
   * Called once per update tick at the top of WorldScene.update().
   * Builds and returns the canonical input snapshot for this frame.
   * Consumes edge flags (jump, fire, start) after reading.
   * Also manages the jump buffer timer.
   */
  pollInput(): InputSnapshot {
    // Continuous keys — reflect current raw hold state
    const left      = !!(keyDown['ArrowLeft']  || keyDown['KeyA']);
    const right     = !!(keyDown['ArrowRight'] || keyDown['KeyD']);
    const down      = !!(keyDown['ArrowDown']  || keyDown['KeyS']);
    const run       = !!(keyDown['KeyX']);
    const jumpHeld  = !!(keyDown['Space'] || keyDown['KeyZ']);

    // Jump buffer: if jump edge fires while airborne, buffer it
    if (this._jump) {
      if (this.playerAirborne) {
        // Buffer the jump for later when Mario lands
        this.jumpBufferTimer = JUMP_BUFFER_FRAMES;
      }
      // Whether airborne or not, pass jump=true this frame for immediate check
    }

    // Decrement jump buffer each frame
    if (!this._jump && this.jumpBufferTimer > 0) {
      this.jumpBufferTimer--;
    }

    const snapshot: InputSnapshot = {
      left,
      right,
      down,
      run,
      jumpHeld,
      jump:  this._jump,
      fire:  this._fire,
      start: this._start,
    };

    // Consume edge flags
    this._jump  = false;
    this._fire  = false;
    this._start = false;

    return snapshot;
  }

  /**
   * Clean up event listeners when the scene is destroyed.
   */
  destroy(): void {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup',   this._onKeyUp);
  }
}
