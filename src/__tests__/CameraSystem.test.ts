/**
 * CameraSystem.test.ts
 * Full branch coverage for CameraSystem.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CameraSystem } from '../systems/CameraSystem';
import { LOGICAL_WIDTH, SCALE } from '../config/constants';
import { CAMERA_LEAD_X } from '../config/physics';

describe('CameraSystem', () => {
  let camera: CameraSystem;
  const LEVEL_WIDTH = 3584; // LEVEL_COLS * TILE_SIZE

  beforeEach(() => {
    camera = new CameraSystem();
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  it('initialises cameraX to 0', () => {
    expect(camera.cameraX).toBe(0);
  });

  // ── update() ──────────────────────────────────────────────────────────────

  it('sets cameraX = marioX - CAMERA_LEAD_X when result is positive', () => {
    const marioX = 500;
    camera.update(marioX, LEVEL_WIDTH);
    expect(camera.cameraX).toBe(marioX - CAMERA_LEAD_X);
  });

  it('clamps cameraX to 0 when Mario is near the left edge (marioX < CAMERA_LEAD_X)', () => {
    camera.update(64, LEVEL_WIDTH);
    expect(camera.cameraX).toBe(0);
  });

  it('clamps cameraX to 0 when marioX equals 0', () => {
    camera.update(0, LEVEL_WIDTH);
    expect(camera.cameraX).toBe(0);
  });

  it('clamps cameraX to 0 when target is exactly 0 (marioX == CAMERA_LEAD_X)', () => {
    camera.update(CAMERA_LEAD_X, LEVEL_WIDTH);
    expect(camera.cameraX).toBe(0);
  });

  it('allows cameraX to be positive when marioX just exceeds CAMERA_LEAD_X', () => {
    camera.update(CAMERA_LEAD_X + 1, LEVEL_WIDTH);
    expect(camera.cameraX).toBe(1);
  });

  it('clamps cameraX to (levelWidthPx - logicalWidth) at the right edge', () => {
    const maxX = LEVEL_WIDTH - LOGICAL_WIDTH;
    camera.update(LEVEL_WIDTH, LEVEL_WIDTH);
    expect(camera.cameraX).toBe(maxX);
  });

  it('does not exceed maxX when Mario is past the right boundary', () => {
    const maxX = LEVEL_WIDTH - LOGICAL_WIDTH;
    camera.update(LEVEL_WIDTH + 1000, LEVEL_WIDTH);
    expect(camera.cameraX).toBe(maxX);
  });

  it('respects a custom logicalWidth argument', () => {
    const customWidth = 128;
    const marioX = 300;
    const expectedMaxX = LEVEL_WIDTH - customWidth;
    camera.update(marioX, LEVEL_WIDTH, customWidth);
    const expected = Math.max(0, Math.min(marioX - CAMERA_LEAD_X, expectedMaxX));
    expect(camera.cameraX).toBe(expected);
  });

  // ── No left scroll ─────────────────────────────────────────────────────────

  it('never decreases cameraX (no left scroll)', () => {
    camera.update(600, LEVEL_WIDTH);
    const afterRight = camera.cameraX;
    camera.update(100, LEVEL_WIDTH); // Mario moves back left
    expect(camera.cameraX).toBe(afterRight);
  });

  it('cameraX stays the same when Mario moves left from a forward position', () => {
    camera.update(800, LEVEL_WIDTH);
    const snapshot = camera.cameraX;
    camera.update(300, LEVEL_WIDTH);
    expect(camera.cameraX).toBeGreaterThanOrEqual(snapshot);
  });

  it('cameraX advances when Mario moves further right', () => {
    camera.update(400, LEVEL_WIDTH);
    const first = camera.cameraX;
    camera.update(600, LEVEL_WIDTH);
    expect(camera.cameraX).toBeGreaterThan(first);
  });

  // ── worldToScreen / screenToWorld ─────────────────────────────────────────

  it('worldToScreen returns worldX - cameraX', () => {
    camera.update(300, LEVEL_WIDTH);
    const worldX = 250;
    expect(camera.worldToScreen(worldX)).toBe(worldX - camera.cameraX);
  });

  it('screenToWorld returns screenX + cameraX', () => {
    camera.update(400, LEVEL_WIDTH);
    const screenX = 100;
    expect(camera.screenToWorld(screenX)).toBe(screenX + camera.cameraX);
  });

  // ── viewportLeft / viewportRight ──────────────────────────────────────────

  it('viewportLeft returns cameraX - margin (default 32)', () => {
    camera.update(400, LEVEL_WIDTH);
    expect(camera.viewportLeft()).toBe(camera.cameraX - 32);
  });

  it('viewportLeft respects custom margin', () => {
    camera.update(400, LEVEL_WIDTH);
    expect(camera.viewportLeft(16)).toBe(camera.cameraX - 16);
  });

  it('viewportRight returns cameraX + LOGICAL_WIDTH + margin (default 32)', () => {
    camera.update(400, LEVEL_WIDTH);
    expect(camera.viewportRight()).toBe(camera.cameraX + LOGICAL_WIDTH + 32);
  });

  it('viewportRight respects custom margin', () => {
    camera.update(400, LEVEL_WIDTH);
    expect(camera.viewportRight(0)).toBe(camera.cameraX + LOGICAL_WIDTH);
  });

  // ── isInViewport ──────────────────────────────────────────────────────────

  it('isInViewport returns true when object is inside the viewport', () => {
    camera.update(400, LEVEL_WIDTH);
    const worldX = camera.cameraX + 50;
    expect(camera.isInViewport(worldX, 16)).toBe(true);
  });

  it('isInViewport returns false when object is far left (off margin)', () => {
    camera.update(400, LEVEL_WIDTH);
    const worldX = camera.cameraX - 100; // beyond default 32px margin
    expect(camera.isInViewport(worldX, 8)).toBe(false);
  });

  it('isInViewport returns false when object is far right (off margin)', () => {
    camera.update(400, LEVEL_WIDTH);
    const worldX = camera.cameraX + LOGICAL_WIDTH + 100; // beyond default 32px margin
    expect(camera.isInViewport(worldX, 8)).toBe(false);
  });

  it('isInViewport returns true for object just within left margin', () => {
    camera.update(400, LEVEL_WIDTH);
    const worldX = camera.cameraX - 31; // within 32px margin
    expect(camera.isInViewport(worldX, 8)).toBe(true);
  });

  // ── applyToPhaser ─────────────────────────────────────────────────────────

  it('applyToPhaser calls scene.cameras.main.setScroll with cameraX * SCALE and 0', () => {
    camera.update(400, LEVEL_WIDTH);
    const mockSetScroll = vi.fn();
    const fakeScene = {
      cameras: { main: { setScroll: mockSetScroll } },
    } as unknown as Phaser.Scene;

    camera.applyToPhaser(fakeScene);

    expect(mockSetScroll).toHaveBeenCalledOnce();
    expect(mockSetScroll).toHaveBeenCalledWith(camera.cameraX * SCALE, 0);
  });

  it('applyToPhaser passes 0 as the Y scroll argument', () => {
    camera.update(300, LEVEL_WIDTH);
    const mockSetScroll = vi.fn();
    const fakeScene = {
      cameras: { main: { setScroll: mockSetScroll } },
    } as unknown as Phaser.Scene;

    camera.applyToPhaser(fakeScene);

    const [, yArg] = mockSetScroll.mock.calls[0] as [number, number];
    expect(yArg).toBe(0);
  });
});
