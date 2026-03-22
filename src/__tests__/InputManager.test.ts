/**
 * InputManager.test.ts
 * Full branch coverage for InputManager.
 *
 * InputManager uses window.addEventListener, so we simulate keydown/keyup
 * by dispatching real KeyboardEvents on the global window object.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InputManager } from '../systems/InputManager';
import { JUMP_BUFFER_FRAMES } from '../config/physics';

// ── Helpers ──────────────────────────────────────────────────────────────────

function keyDown(code: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
}

function keyUp(code: string): void {
  window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('InputManager', () => {
  let im: InputManager;

  beforeEach(() => {
    im = new InputManager();
  });

  afterEach(() => {
    im.destroy();
  });

  // ── Continuous keys ───────────────────────────────────────────────────────

  describe('continuous key: left (ArrowLeft)', () => {
    it('left is true when ArrowLeft is held', () => {
      keyDown('ArrowLeft');
      const snap = im.pollInput();
      expect(snap.left).toBe(true);
      keyUp('ArrowLeft');
    });

    it('left is false after ArrowLeft released', () => {
      keyDown('ArrowLeft');
      keyUp('ArrowLeft');
      const snap = im.pollInput();
      expect(snap.left).toBe(false);
    });

    it('left is true when KeyA is held', () => {
      keyDown('KeyA');
      const snap = im.pollInput();
      expect(snap.left).toBe(true);
      keyUp('KeyA');
    });

    it('left is false when KeyA is released', () => {
      keyDown('KeyA');
      keyUp('KeyA');
      const snap = im.pollInput();
      expect(snap.left).toBe(false);
    });
  });

  describe('continuous key: right (ArrowRight)', () => {
    it('right is true when ArrowRight is held', () => {
      keyDown('ArrowRight');
      const snap = im.pollInput();
      expect(snap.right).toBe(true);
      keyUp('ArrowRight');
    });

    it('right is false after ArrowRight released', () => {
      keyDown('ArrowRight');
      keyUp('ArrowRight');
      const snap = im.pollInput();
      expect(snap.right).toBe(false);
    });

    it('right is true when KeyD is held', () => {
      keyDown('KeyD');
      const snap = im.pollInput();
      expect(snap.right).toBe(true);
      keyUp('KeyD');
    });
  });

  describe('continuous key: down (ArrowDown)', () => {
    it('down is true when ArrowDown is held', () => {
      keyDown('ArrowDown');
      const snap = im.pollInput();
      expect(snap.down).toBe(true);
      keyUp('ArrowDown');
    });

    it('down is true when KeyS is held', () => {
      keyDown('KeyS');
      const snap = im.pollInput();
      expect(snap.down).toBe(true);
      keyUp('KeyS');
    });

    it('down is false after ArrowDown released', () => {
      keyDown('ArrowDown');
      keyUp('ArrowDown');
      const snap = im.pollInput();
      expect(snap.down).toBe(false);
    });
  });

  describe('continuous key: run (KeyX)', () => {
    it('run is true when KeyX is held', () => {
      keyDown('KeyX');
      const snap = im.pollInput();
      expect(snap.run).toBe(true);
      keyUp('KeyX');
    });

    it('run is false after KeyX released', () => {
      keyDown('KeyX');
      keyUp('KeyX');
      const snap = im.pollInput();
      expect(snap.run).toBe(false);
    });
  });

  describe('continuous key: jumpHeld (Space)', () => {
    it('jumpHeld is true while Space is held', () => {
      keyDown('Space');
      const snap = im.pollInput();
      expect(snap.jumpHeld).toBe(true);
      keyUp('Space');
    });

    it('jumpHeld is true while KeyZ is held', () => {
      keyDown('KeyZ');
      const snap = im.pollInput();
      expect(snap.jumpHeld).toBe(true);
      keyUp('KeyZ');
    });

    it('jumpHeld is false after Space released', () => {
      keyDown('Space');
      keyUp('Space');
      const snap = im.pollInput();
      expect(snap.jumpHeld).toBe(false);
    });
  });

  // ── Edge-triggered: jump ──────────────────────────────────────────────────

  describe('edge-triggered: jump', () => {
    it('jump is true on first pollInput after keydown', () => {
      keyDown('Space');
      const snap = im.pollInput();
      expect(snap.jump).toBe(true);
      keyUp('Space');
    });

    it('jump is false on second pollInput without releasing key (edge consumed)', () => {
      keyDown('Space');
      im.pollInput(); // consume edge
      const snap = im.pollInput();
      expect(snap.jump).toBe(false);
      keyUp('Space');
    });

    it('jump is true again after key released and re-pressed', () => {
      keyDown('Space');
      im.pollInput();
      keyUp('Space');
      keyDown('Space');
      const snap = im.pollInput();
      expect(snap.jump).toBe(true);
      keyUp('Space');
    });

    it('jump via KeyZ fires on first poll', () => {
      keyDown('KeyZ');
      const snap = im.pollInput();
      expect(snap.jump).toBe(true);
      keyUp('KeyZ');
    });

    it('jump does not fire on repeated hold (edge latch prevents key-repeat)', () => {
      keyDown('Space');
      im.pollInput(); // first edge
      // simulate key-repeat (no keyup, another keydown from OS)
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', repeat: true, bubbles: true }));
      const snap = im.pollInput();
      expect(snap.jump).toBe(false);
      keyUp('Space');
    });
  });

  // ── Edge-triggered: start ─────────────────────────────────────────────────

  describe('edge-triggered: start (Enter)', () => {
    it('start is true on first pollInput after Enter pressed', () => {
      keyDown('Enter');
      const snap = im.pollInput();
      expect(snap.start).toBe(true);
      keyUp('Enter');
    });

    it('start is false on second poll without releasing', () => {
      keyDown('Enter');
      im.pollInput();
      const snap = im.pollInput();
      expect(snap.start).toBe(false);
      keyUp('Enter');
    });

    it('start fires again after key released and re-pressed', () => {
      keyDown('Enter');
      im.pollInput();
      keyUp('Enter');
      keyDown('Enter');
      const snap = im.pollInput();
      expect(snap.start).toBe(true);
      keyUp('Enter');
    });
  });

  // ── Edge-triggered: fire ──────────────────────────────────────────────────

  describe('edge-triggered: fire (KeyX)', () => {
    it('fire is true on first pollInput after KeyX pressed', () => {
      keyDown('KeyX');
      const snap = im.pollInput();
      expect(snap.fire).toBe(true);
      keyUp('KeyX');
    });

    it('fire is false on second poll without releasing', () => {
      keyDown('KeyX');
      im.pollInput();
      const snap = im.pollInput();
      expect(snap.fire).toBe(false);
      keyUp('KeyX');
    });

    it('fire fires again after KeyX released and re-pressed', () => {
      keyDown('KeyX');
      im.pollInput();
      keyUp('KeyX');
      keyDown('KeyX');
      const snap = im.pollInput();
      expect(snap.fire).toBe(true);
      keyUp('KeyX');
    });
  });

  // ── Jump buffer ───────────────────────────────────────────────────────────

  describe('jump buffer', () => {
    it('jumpBufferTimer is set to JUMP_BUFFER_FRAMES when jump pressed while airborne', () => {
      im.playerAirborne = true;
      keyDown('Space');
      im.pollInput();
      expect(im.jumpBufferTimer).toBe(JUMP_BUFFER_FRAMES);
      keyUp('Space');
    });

    it('jumpBufferTimer counts down each frame when not actively pressing jump', () => {
      im.playerAirborne = true;
      keyDown('Space');
      im.pollInput(); // jump pressed, timer set
      keyUp('Space');

      im.pollInput(); // frame 2: timer decrements
      expect(im.jumpBufferTimer).toBe(JUMP_BUFFER_FRAMES - 1);
    });

    it('jumpBufferTimer reaches 0 after JUMP_BUFFER_FRAMES polls without pressing jump', () => {
      im.playerAirborne = true;
      keyDown('Space');
      im.pollInput();
      keyUp('Space');

      for (let i = 0; i < JUMP_BUFFER_FRAMES; i++) {
        im.pollInput();
      }
      expect(im.jumpBufferTimer).toBe(0);
    });

    it('jumpBufferTimer is NOT set when jump pressed while grounded (not airborne)', () => {
      im.playerAirborne = false;
      keyDown('Space');
      im.pollInput();
      expect(im.jumpBufferTimer).toBe(0);
      keyUp('Space');
    });

    it('jump=true still fires in snapshot when airborne even as buffer is set', () => {
      im.playerAirborne = true;
      keyDown('Space');
      const snap = im.pollInput();
      expect(snap.jump).toBe(true);
      keyUp('Space');
    });

    it('jumpBufferTimer does not decrement below 0', () => {
      im.playerAirborne = true;
      keyDown('Space');
      im.pollInput();
      keyUp('Space');

      for (let i = 0; i < JUMP_BUFFER_FRAMES + 10; i++) {
        im.pollInput();
      }
      expect(im.jumpBufferTimer).toBe(0);
    });
  });

  // ── pollInput resets edge flags ───────────────────────────────────────────

  describe('pollInput edge flag reset', () => {
    it('jump flag is reset to false after first poll', () => {
      keyDown('Space');
      im.pollInput();
      const snap2 = im.pollInput();
      expect(snap2.jump).toBe(false);
      keyUp('Space');
    });

    it('fire flag is reset to false after first poll', () => {
      keyDown('KeyX');
      im.pollInput();
      const snap2 = im.pollInput();
      expect(snap2.fire).toBe(false);
      keyUp('KeyX');
    });

    it('start flag is reset to false after first poll', () => {
      keyDown('Enter');
      im.pollInput();
      const snap2 = im.pollInput();
      expect(snap2.start).toBe(false);
      keyUp('Enter');
    });
  });

  // ── Default snapshot values ───────────────────────────────────────────────

  describe('default snapshot (no keys pressed)', () => {
    it('all fields are false when no keys are held', () => {
      const snap = im.pollInput();
      expect(snap.left).toBe(false);
      expect(snap.right).toBe(false);
      expect(snap.down).toBe(false);
      expect(snap.run).toBe(false);
      expect(snap.jumpHeld).toBe(false);
      expect(snap.jump).toBe(false);
      expect(snap.fire).toBe(false);
      expect(snap.start).toBe(false);
    });
  });

  // ── destroy ───────────────────────────────────────────────────────────────

  describe('destroy', () => {
    it('removes keydown listener so keys no longer register after destroy()', () => {
      im.destroy();
      keyDown('ArrowLeft');
      const snap = im.pollInput();
      expect(snap.left).toBe(false);
    });
  });
});
