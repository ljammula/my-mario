/**
 * physics.test.ts
 * Verifies every constant in src/config/physics.ts matches the spec.
 */

import { describe, it, expect } from 'vitest';
import {
  GRAVITY,
  MAX_FALL_SPEED,
  JUMP_VELOCITY,
  JUMP_HOLD_GRAVITY,
  JUMP_RELEASE_GRAVITY,
  COYOTE_FRAMES,
  JUMP_BUFFER_FRAMES,
  WALK_ACCELERATION,
  RUN_ACCELERATION,
  WALK_MAX_SPEED,
  RUN_MAX_SPEED,
  SKID_DECELERATION,
  GROUND_FRICTION,
  AIR_RESISTANCE,
  DEATH_POP_VELOCITY,
  FIREBALL_SPEED_X,
  FIREBALL_SPEED_Y,
  FIREBALL_GRAVITY,
  FIREBALL_MAX_BOUNCES,
  FIREBALL_MAX_ACTIVE,
  GOOMBA_SPEED,
  KOOPA_SPEED,
  KOOPA_SHELL_SPEED,
  FLYING_KOOPA_SPEED,
  PIRANHA_RISE_TIME,
  PIRANHA_PAUSE_TIME,
  INVINCIBLE_DURATION,
  HURT_INVINCIBLE_FRAMES,
  FLICKER_RATE,
  CAMERA_LEAD_X,
} from '../config/physics';

describe('physics constants', () => {
  describe('gravity', () => {
    it('GRAVITY equals 0.5', () => {
      expect(GRAVITY).toBe(0.5);
    });

    it('MAX_FALL_SPEED equals 8.0', () => {
      expect(MAX_FALL_SPEED).toBe(8.0);
    });
  });

  describe('jump', () => {
    it('JUMP_VELOCITY equals -8.5', () => {
      expect(JUMP_VELOCITY).toBe(-8.5);
    });

    it('JUMP_HOLD_GRAVITY equals 0.25', () => {
      expect(JUMP_HOLD_GRAVITY).toBe(0.25);
    });

    it('JUMP_RELEASE_GRAVITY equals 0.5', () => {
      expect(JUMP_RELEASE_GRAVITY).toBe(0.5);
    });
  });

  describe('input feel', () => {
    it('COYOTE_FRAMES equals 4', () => {
      expect(COYOTE_FRAMES).toBe(4);
    });

    it('JUMP_BUFFER_FRAMES equals 6', () => {
      expect(JUMP_BUFFER_FRAMES).toBe(6);
    });
  });

  describe('horizontal movement', () => {
    it('WALK_ACCELERATION equals 0.15', () => {
      expect(WALK_ACCELERATION).toBe(0.15);
    });

    it('RUN_ACCELERATION equals 0.25', () => {
      expect(RUN_ACCELERATION).toBe(0.25);
    });

    it('WALK_MAX_SPEED equals 2.5', () => {
      expect(WALK_MAX_SPEED).toBe(2.5);
    });

    it('RUN_MAX_SPEED equals 5.0', () => {
      expect(RUN_MAX_SPEED).toBe(5.0);
    });

    it('SKID_DECELERATION equals 0.35', () => {
      expect(SKID_DECELERATION).toBe(0.35);
    });

    it('GROUND_FRICTION equals 0.12', () => {
      expect(GROUND_FRICTION).toBe(0.12);
    });

    it('AIR_RESISTANCE equals 0.04', () => {
      expect(AIR_RESISTANCE).toBe(0.04);
    });
  });

  describe('death', () => {
    it('DEATH_POP_VELOCITY equals -8.0', () => {
      expect(DEATH_POP_VELOCITY).toBe(-8.0);
    });
  });

  describe('fireball', () => {
    it('FIREBALL_SPEED_X equals 6.0', () => {
      expect(FIREBALL_SPEED_X).toBe(6.0);
    });

    it('FIREBALL_SPEED_Y equals 3.0 (positive = downward launch angle)', () => {
      expect(FIREBALL_SPEED_Y).toBe(3.0);
    });

    it('FIREBALL_GRAVITY equals 0.4', () => {
      expect(FIREBALL_GRAVITY).toBe(0.4);
    });

    it('FIREBALL_MAX_BOUNCES equals 5', () => {
      expect(FIREBALL_MAX_BOUNCES).toBe(5);
    });

    it('FIREBALL_MAX_ACTIVE equals 2', () => {
      expect(FIREBALL_MAX_ACTIVE).toBe(2);
    });
  });

  describe('enemy speeds', () => {
    it('GOOMBA_SPEED equals 1.0', () => {
      expect(GOOMBA_SPEED).toBe(1.0);
    });

    it('KOOPA_SPEED equals 1.0', () => {
      expect(KOOPA_SPEED).toBe(1.0);
    });

    it('KOOPA_SHELL_SPEED equals 8.0', () => {
      expect(KOOPA_SHELL_SPEED).toBe(8.0);
    });

    it('FLYING_KOOPA_SPEED equals 1.5', () => {
      expect(FLYING_KOOPA_SPEED).toBe(1.5);
    });
  });

  describe('piranha plant timings', () => {
    it('PIRANHA_RISE_TIME equals 120', () => {
      expect(PIRANHA_RISE_TIME).toBe(120);
    });

    it('PIRANHA_PAUSE_TIME equals 120', () => {
      expect(PIRANHA_PAUSE_TIME).toBe(120);
    });
  });

  describe('invincibility', () => {
    it('INVINCIBLE_DURATION equals 600', () => {
      expect(INVINCIBLE_DURATION).toBe(600);
    });

    it('HURT_INVINCIBLE_FRAMES equals 120', () => {
      expect(HURT_INVINCIBLE_FRAMES).toBe(120);
    });

    it('FLICKER_RATE equals 6', () => {
      expect(FLICKER_RATE).toBe(6);
    });
  });

  describe('camera', () => {
    it('CAMERA_LEAD_X equals 128', () => {
      expect(CAMERA_LEAD_X).toBe(128);
    });
  });
});
