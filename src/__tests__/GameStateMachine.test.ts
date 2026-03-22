/**
 * GameStateMachine.test.ts
 * Tests for score, coins, lives, timer, stomp combo, and screen transitions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameStateMachine, GameStateMachineCallbacks } from '../systems/GameStateMachine';
import { Screen } from '../types/entities';
import { TIME_LIMIT, HURRY_TIME, STOMP_COMBO_POINTS } from '../config/constants';
import { InputSnapshot } from '../types/input';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function noInput(): InputSnapshot {
  return { left: false, right: false, down: false, run: false, jumpHeld: false, jump: false, fire: false, start: false };
}

function startInput(): InputSnapshot {
  return { ...noInput(), start: true };
}

function makeGSM(callbacks: GameStateMachineCallbacks = {}): GameStateMachine {
  return new GameStateMachine(callbacks);
}

/** Bring GSM into PLAYING state (Title → INTRO → PLAYING). */
function intoPlaying(gsm: GameStateMachine): void {
  // From TITLE, trigger startGame (Enter/start)
  gsm.update(startInput()); // TITLE + start → INTRO (introTimer = 180)
  // Burn down INTRO timer
  for (let i = 0; i < 180; i++) {
    gsm.update(noInput());
  }
  // Now in PLAYING
}

// ─── Score ────────────────────────────────────────────────────────────────────

describe('GameStateMachine — score', () => {
  it('starts at 0', () => {
    const gsm = makeGSM();
    expect(gsm.state.score).toBe(0);
  });

  it('addScore(100) results in score of 100', () => {
    const gsm = makeGSM();
    gsm.addScore(100);
    expect(gsm.state.score).toBe(100);
  });

  it('addScore accumulates correctly', () => {
    const gsm = makeGSM();
    gsm.addScore(300);
    gsm.addScore(200);
    expect(gsm.state.score).toBe(500);
  });

  it('score wraps modulo 1000000 on overflow (999800 + 300 = 100)', () => {
    const gsm = makeGSM();
    gsm.addScore(999_800);
    gsm.addScore(300);
    // (999_800 + 300) % 1_000_000 = 1_000_100 % 1_000_000 = 100
    expect(gsm.state.score).toBe(100);
  });

  it('addScore(0) leaves score unchanged', () => {
    const gsm = makeGSM();
    gsm.addScore(0);
    expect(gsm.state.score).toBe(0);
  });

  it('addScore with negative value leaves score unchanged', () => {
    const gsm = makeGSM();
    gsm.addScore(100);
    gsm.addScore(-50);
    expect(gsm.state.score).toBe(100);
  });

  it('score wraps after hitting 999999: (999999 + 500) % 1000000 = 499', () => {
    const gsm = makeGSM();
    gsm.addScore(999_999);
    expect(gsm.state.score).toBe(999_999);
    // Wrap semantics: (999_999 + 500) % 1_000_000 = 499
    gsm.addScore(500);
    expect(gsm.state.score).toBe(499);
  });
});

// ─── Coins and life conversion ────────────────────────────────────────────────

describe('GameStateMachine — coins', () => {
  it('starts at 0 coins', () => {
    const gsm = makeGSM();
    expect(gsm.state.coins).toBe(0);
  });

  it('addCoin increments coin count', () => {
    const gsm = makeGSM();
    gsm.addCoin();
    expect(gsm.state.coins).toBe(1);
  });

  it('addCoin increments to 99 without awarding a life', () => {
    const gsm = makeGSM();
    for (let i = 0; i < 99; i++) gsm.addCoin();
    expect(gsm.state.coins).toBe(99);
    expect(gsm.state.lives).toBe(3);
  });

  it('addCoin at 99 (the 100th coin) resets coins to 0 and awards a life', () => {
    const gsm = makeGSM();
    for (let i = 0; i < 99; i++) gsm.addCoin();
    gsm.addCoin(); // 100th coin
    expect(gsm.state.coins).toBe(0);
    expect(gsm.state.lives).toBe(4);
  });

  it('onExtraLife callback fires when 100 coins collected', () => {
    const onExtraLife = vi.fn();
    const gsm = makeGSM({ onExtraLife });
    for (let i = 0; i < 100; i++) gsm.addCoin();
    expect(onExtraLife).toHaveBeenCalledOnce();
  });

  it('addCoin also awards score', () => {
    const gsm = makeGSM();
    gsm.addCoin();
    expect(gsm.state.score).toBeGreaterThan(0);
  });
});

// ─── Lives ────────────────────────────────────────────────────────────────────

describe('GameStateMachine — lives', () => {
  it('starts with 3 lives', () => {
    const gsm = makeGSM();
    expect(gsm.state.lives).toBe(3);
  });

  it('awardExtraLife increments lives', () => {
    const gsm = makeGSM();
    gsm.awardExtraLife();
    expect(gsm.state.lives).toBe(4);
  });

  it('awardExtraLife fires onExtraLife callback', () => {
    const onExtraLife = vi.fn();
    const gsm = makeGSM({ onExtraLife });
    gsm.awardExtraLife();
    expect(onExtraLife).toHaveBeenCalledOnce();
  });
});

// ─── Timer ────────────────────────────────────────────────────────────────────

describe('GameStateMachine — timer', () => {
  it('time starts at TIME_LIMIT', () => {
    const gsm = makeGSM();
    expect(gsm.state.time).toBe(TIME_LIMIT);
  });

  it('time decrements each frame when in PLAYING state', () => {
    const gsm = makeGSM();
    intoPlaying(gsm);
    const timeBefore = gsm.state.time;
    gsm.update(noInput());
    expect(gsm.state.time).toBeLessThan(timeBefore);
  });

  it('time does NOT decrement when PAUSED', () => {
    const gsm = makeGSM();
    intoPlaying(gsm);
    gsm.toPaused();
    expect(gsm.state.screen).toBe(Screen.PAUSED);
    const timeBefore = gsm.state.time;
    gsm.update(noInput());
    expect(gsm.state.time).toBe(timeBefore);
  });

  it('time does NOT decrement during DEATH screen', () => {
    const gsm = makeGSM();
    intoPlaying(gsm);
    gsm.toDeath();
    const timeBefore = gsm.state.time;
    gsm.update(noInput());
    expect(gsm.state.time).toBe(timeBefore);
  });

  it('hurryMode is false when time is above HURRY_TIME', () => {
    const gsm = makeGSM();
    intoPlaying(gsm);
    gsm.state.time = HURRY_TIME + 10;
    expect(gsm.state.hurryMode).toBe(false);
  });

  it('hurryMode activates when time drops to HURRY_TIME', () => {
    const onHurryMode = vi.fn();
    const gsm = makeGSM({ onHurryMode });
    intoPlaying(gsm);
    // Set time just above hurry threshold
    gsm.state.time = HURRY_TIME + (1 / 60);
    gsm.update(noInput()); // one tick brings time to <= HURRY_TIME
    expect(gsm.state.hurryMode).toBe(true);
    expect(onHurryMode).toHaveBeenCalledOnce();
  });

  it('hurryMode does not fire callback twice', () => {
    const onHurryMode = vi.fn();
    const gsm = makeGSM({ onHurryMode });
    intoPlaying(gsm);
    gsm.state.time = HURRY_TIME + (1 / 60);
    gsm.update(noInput());
    gsm.update(noInput()); // second tick
    expect(onHurryMode).toHaveBeenCalledOnce();
  });

  it('triggerDeath is called when time runs out', () => {
    const gsm = makeGSM();
    intoPlaying(gsm);
    gsm.state.time = 1 / 60; // one tick from zero
    gsm.update(noInput());
    expect(gsm.state.screen).toBe(Screen.DEATH);
    expect(gsm.state.time).toBe(0);
  });
});

// ─── Stomp combo ──────────────────────────────────────────────────────────────

describe('GameStateMachine — stomp combo', () => {
  it.each([
    [1, STOMP_COMBO_POINTS[0]],
    [2, STOMP_COMBO_POINTS[1]],
    [3, STOMP_COMBO_POINTS[2]],
    [4, STOMP_COMBO_POINTS[3]],
    [5, STOMP_COMBO_POINTS[4]],
    [6, STOMP_COMBO_POINTS[5]],
    [7, STOMP_COMBO_POINTS[6]],
    [8, STOMP_COMBO_POINTS[7]],
  ])('stomp #%i awards %i points', (stompNum, expectedPts) => {
    const gsm = makeGSM();
    let pts = 0;
    for (let i = 0; i < stompNum; i++) {
      pts = gsm.onStomp();
    }
    expect(pts).toBe(expectedPts);
  });

  it('stomp #9 awards an extra life instead of points', () => {
    const onExtraLife = vi.fn();
    const gsm = makeGSM({ onExtraLife });
    for (let i = 0; i < 9; i++) gsm.onStomp();
    expect(onExtraLife).toHaveBeenCalled();
    expect(gsm.state.lives).toBe(4);
  });

  it('stomp #9 returns 0 points (life awarded instead)', () => {
    const gsm = makeGSM();
    for (let i = 0; i < 8; i++) gsm.onStomp();
    const pts = gsm.onStomp();
    expect(pts).toBe(0);
  });

  it('onLand resets combo so next stomp gives 100 again', () => {
    const gsm = makeGSM();
    for (let i = 0; i < 4; i++) gsm.onStomp();
    gsm.onLand();
    const pts = gsm.onStomp();
    expect(pts).toBe(STOMP_COMBO_POINTS[0]);
  });

  it('score increases by stomp points on each stomp', () => {
    const gsm = makeGSM();
    gsm.onStomp(); // 100 pts
    expect(gsm.state.score).toBe(STOMP_COMBO_POINTS[0]);
    gsm.onStomp(); // 200 pts
    expect(gsm.state.score).toBe(STOMP_COMBO_POINTS[0] + STOMP_COMBO_POINTS[1]);
  });
});

// ─── Screen transitions ───────────────────────────────────────────────────────

describe('GameStateMachine — screen transitions', () => {
  it('starts on TITLE screen', () => {
    const gsm = makeGSM();
    expect(gsm.state.screen).toBe(Screen.TITLE);
  });

  it('TITLE + start input → transitions to INTRO', () => {
    const gsm = makeGSM();
    gsm.update(startInput());
    expect(gsm.state.screen).toBe(Screen.INTRO);
  });

  it('startGame resets score, coins, lives, world, levelNum', () => {
    const gsm = makeGSM();
    gsm.state.score   = 9999;
    gsm.state.coins   = 50;
    gsm.state.lives   = 1;
    gsm.state.world   = 3;
    gsm.state.levelNum = 3;
    gsm.update(startInput()); // triggers _updateTitle → reset and toIntro
    expect(gsm.state.score).toBe(0);
    expect(gsm.state.coins).toBe(0);
    expect(gsm.state.lives).toBe(3);
    expect(gsm.state.world).toBe(1);
    expect(gsm.state.levelNum).toBe(1);
  });

  it('INTRO timer countdown transitions to PLAYING', () => {
    const gsm = makeGSM();
    gsm.update(startInput()); // → INTRO
    for (let i = 0; i < 180; i++) gsm.update(noInput());
    expect(gsm.state.screen).toBe(Screen.PLAYING);
  });

  it('PLAYING + start input → PAUSED', () => {
    const gsm = makeGSM();
    intoPlaying(gsm);
    gsm.update(startInput());
    expect(gsm.state.screen).toBe(Screen.PAUSED);
  });

  it('PAUSED + start input → PLAYING', () => {
    const gsm = makeGSM();
    intoPlaying(gsm);
    gsm.toPaused();
    gsm.update(startInput());
    expect(gsm.state.screen).toBe(Screen.PLAYING);
  });

  it('toPaused does nothing when not in PLAYING', () => {
    const gsm = makeGSM(); // TITLE
    gsm.toPaused();
    expect(gsm.state.screen).toBe(Screen.TITLE);
  });

  it('toUnpaused does nothing when not PAUSED', () => {
    const gsm = makeGSM();
    intoPlaying(gsm);
    gsm.toUnpaused(); // should be no-op from PLAYING
    expect(gsm.state.screen).toBe(Screen.PLAYING);
  });

  it('triggerDeath from PLAYING → DEATH screen', () => {
    const gsm = makeGSM();
    intoPlaying(gsm);
    gsm.triggerDeath();
    expect(gsm.state.screen).toBe(Screen.DEATH);
  });

  it('triggerDeath is no-op when not in PLAYING', () => {
    const gsm = makeGSM(); // TITLE
    gsm.triggerDeath();
    expect(gsm.state.screen).toBe(Screen.TITLE);
  });

  it('DEATH with lives > 1: after death timer → INTRO (retries)', () => {
    const gsm = makeGSM();
    intoPlaying(gsm);
    gsm.triggerDeath();
    expect(gsm.state.lives).toBe(3); // lives before decrement
    // DEATH timer is 120 frames (DEATH_DURATION stored in introTimer)
    for (let i = 0; i < 121; i++) gsm.update(noInput());
    expect(gsm.state.screen).toBe(Screen.INTRO);
    expect(gsm.state.lives).toBe(2);
  });

  it('DEATH with lives = 1: after death timer → GAMEOVER', () => {
    const gsm = makeGSM();
    intoPlaying(gsm);
    gsm.state.lives = 1;
    gsm.triggerDeath();
    for (let i = 0; i < 121; i++) gsm.update(noInput());
    expect(gsm.state.screen).toBe(Screen.GAMEOVER);
    expect(gsm.state.lives).toBe(0);
  });

  it('onLivesLost callback fires during DEATH transition', () => {
    const onLivesLost = vi.fn();
    const gsm = makeGSM({ onLivesLost });
    intoPlaying(gsm);
    gsm.triggerDeath();
    for (let i = 0; i < 121; i++) gsm.update(noInput());
    expect(onLivesLost).toHaveBeenCalledOnce();
  });

  it('onGameOver callback fires when lives reach 0', () => {
    const onGameOver = vi.fn();
    const gsm = makeGSM({ onGameOver });
    intoPlaying(gsm);
    gsm.state.lives = 1;
    gsm.triggerDeath();
    for (let i = 0; i < 121; i++) gsm.update(noInput());
    expect(onGameOver).toHaveBeenCalledOnce();
  });

  it('toWin transitions to WIN screen', () => {
    const gsm = makeGSM();
    intoPlaying(gsm);
    gsm.toWin();
    expect(gsm.state.screen).toBe(Screen.WIN);
  });

  it('toWin fires onLevelComplete callback with time bonus', () => {
    const onLevelComplete = vi.fn();
    const gsm = makeGSM({ onLevelComplete });
    intoPlaying(gsm);
    gsm.state.time = 100;
    gsm.toWin();
    expect(onLevelComplete).toHaveBeenCalledWith(100 * 50); // TIME_BONUS_PER_SEC=50
  });

  it('WIN timer countdown transitions to INTRO (next level)', () => {
    const gsm = makeGSM();
    intoPlaying(gsm);
    gsm.toWin();
    for (let i = 0; i < 421; i++) gsm.update(noInput());
    expect(gsm.state.screen).toBe(Screen.INTRO);
  });

  it('GAMEOVER timer countdown transitions back to TITLE', () => {
    const gsm = makeGSM();
    intoPlaying(gsm);
    gsm.state.lives = 1;
    gsm.triggerDeath();
    // Through DEATH timer
    for (let i = 0; i < 121; i++) gsm.update(noInput()); // → GAMEOVER
    expect(gsm.state.screen).toBe(Screen.GAMEOVER);
    // Through GAMEOVER timer (300 frames)
    for (let i = 0; i < 301; i++) gsm.update(noInput());
    expect(gsm.state.screen).toBe(Screen.TITLE);
  });

  it('isPlaying getter returns true only when PLAYING', () => {
    const gsm = makeGSM();
    expect(gsm.isPlaying).toBe(false);
    intoPlaying(gsm);
    expect(gsm.isPlaying).toBe(true);
  });

  it('isPaused getter returns true only when PAUSED', () => {
    const gsm = makeGSM();
    intoPlaying(gsm);
    expect(gsm.isPaused).toBe(false);
    gsm.toPaused();
    expect(gsm.isPaused).toBe(true);
  });

  it('isDeath getter returns true only when in DEATH', () => {
    const gsm = makeGSM();
    intoPlaying(gsm);
    expect(gsm.isDeath).toBe(false);
    gsm.triggerDeath();
    expect(gsm.isDeath).toBe(true);
  });

  it('isWin getter returns true only when in WIN', () => {
    const gsm = makeGSM();
    intoPlaying(gsm);
    expect(gsm.isWin).toBe(false);
    gsm.toWin();
    expect(gsm.isWin).toBe(true);
  });

  it('frameCount increments each update call', () => {
    const gsm = makeGSM();
    gsm.update(noInput());
    expect(gsm.state.frameCount).toBe(1);
    gsm.update(noInput());
    expect(gsm.state.frameCount).toBe(2);
  });

  it('toNextLevel always resets to World 1-1 (only one level exists)', () => {
    const gsm = makeGSM();
    gsm.state.levelNum = 4;
    gsm.state.world    = 3;
    gsm.toNextLevel();
    expect(gsm.state.levelNum).toBe(1);
    expect(gsm.state.world).toBe(1);
  });

  it('toNextLevel resets to 1-1 regardless of current level', () => {
    const gsm = makeGSM();
    gsm.state.levelNum = 2;
    gsm.state.world    = 1;
    gsm.toNextLevel();
    expect(gsm.state.levelNum).toBe(1);
    expect(gsm.state.world).toBe(1);
  });
});
