/**
 * GameStateMachine.ts
 * Central game state and screen state machine for Super Mario Bros v2.
 *
 * Screen transitions:
 *   TITLE    + Enter           → INTRO (3s)
 *   INTRO    + timer done      → PLAYING
 *   PLAYING  + Enter           → PAUSED
 *   PAUSED   + Enter           → PLAYING
 *   PLAYING  + death trigger   → DEATH (120 frames, all logic frozen)
 *   DEATH    + timer done      → lives > 0 ? INTRO : GAMEOVER
 *   PLAYING  + flagpole touch  → WIN (time bonus, fanfare)
 *   WIN      + timer done      → INTRO (next level)
 *   GAMEOVER + timer done      → TITLE
 */

import {
  TIME_LIMIT,
  HURRY_TIME,
  TIME_BONUS_PER_SEC,
  STOMP_COMBO_POINTS,
  SCORE,
} from '../config/constants';
import { Screen, GameState } from '../types/entities';
import { InputSnapshot } from '../types/input';

const INTRO_DURATION    = 180;   // 3 seconds at 60fps
const GAMEOVER_DURATION = 300;   // 5 seconds at 60fps
const WIN_DURATION      = 420;   // 7 seconds at 60fps (time bonus + fanfare)
const DEATH_DURATION    = 120;   // 2 seconds at 60fps

/** Callback interface so the state machine can notify other systems */
export interface GameStateMachineCallbacks {
  onHurryMode?:     () => void;
  onLivesLost?:     () => void;
  onGameOver?:      () => void;
  onLevelComplete?: (timeBonus: number) => void;
  onExtraLife?:     () => void;
}

export class GameStateMachine {
  state: GameState;

  private callbacks: GameStateMachineCallbacks;

  constructor(callbacks: GameStateMachineCallbacks = {}) {
    this.callbacks = callbacks;
    this.state = this._initialState();
  }

  private _initialState(): GameState {
    return {
      screen:        Screen.TITLE,
      score:         0,
      coins:         0,
      lives:         3,
      world:         1,
      levelNum:      1,
      time:          TIME_LIMIT,
      frameCount:    0,
      hurryMode:     false,
      introTimer:    INTRO_DURATION,
      gameoverTimer: GAMEOVER_DURATION,
      winTimer:      WIN_DURATION,
      titleBlink:    0,
      stompCombo:    0,
    };
  }

  // ─── Screen Transitions ───────────────────────────────────────────────────────

  toTitle(): void {
    this.state.screen        = Screen.TITLE;
    this.state.titleBlink    = 0;
  }

  toIntro(): void {
    this.state.screen      = Screen.INTRO;
    this.state.introTimer  = INTRO_DURATION;
    this.state.time        = TIME_LIMIT;
    this.state.hurryMode   = false;
    this.state.stompCombo  = 0;
  }

  toPlaying(): void {
    this.state.screen = Screen.PLAYING;
  }

  toPaused(): void {
    if (this.state.screen === Screen.PLAYING) {
      this.state.screen = Screen.PAUSED;
    }
  }

  toUnpaused(): void {
    if (this.state.screen === Screen.PAUSED) {
      this.state.screen = Screen.PLAYING;
    }
  }

  toDeath(): void {
    this.state.screen        = Screen.DEATH;
    this.state.introTimer    = DEATH_DURATION;
  }

  toWin(): void {
    this.state.screen   = Screen.WIN;
    this.state.winTimer = WIN_DURATION;
    // Award time bonus
    const timeBonus = Math.floor(this.state.time) * TIME_BONUS_PER_SEC;
    this.addScore(timeBonus);
    if (this.callbacks.onLevelComplete) {
      this.callbacks.onLevelComplete(timeBonus);
    }
  }

  toGameOver(): void {
    this.state.screen        = Screen.GAMEOVER;
    this.state.gameoverTimer = GAMEOVER_DURATION;
  }

  toNextLevel(): void {
    this.state.levelNum++;
    if (this.state.levelNum > 4) {
      this.state.levelNum = 1;
      this.state.world++;
    }
    this.toIntro();
  }

  // ─── Update ───────────────────────────────────────────────────────────────────

  /**
   * Call once per frame from WorldScene.update().
   * Handles timers, time countdown, and automatic transitions.
   */
  update(input: InputSnapshot): void {
    this.state.frameCount++;

    switch (this.state.screen) {
      case Screen.TITLE:
        this._updateTitle(input);
        break;
      case Screen.INTRO:
        this._updateIntro();
        break;
      case Screen.PLAYING:
        this._updatePlaying(input);
        break;
      case Screen.PAUSED:
        this._updatePaused(input);
        break;
      case Screen.DEATH:
        this._updateDeath();
        break;
      case Screen.WIN:
        this._updateWin();
        break;
      case Screen.GAMEOVER:
        this._updateGameOver();
        break;
    }

    // Title blink counter
    this.state.titleBlink = (this.state.titleBlink + 1) % 60;
  }

  private _updateTitle(input: InputSnapshot): void {
    if (input.start) {
      // Reset game for a fresh start
      this.state.score    = 0;
      this.state.coins    = 0;
      this.state.lives    = 3;
      this.state.world    = 1;
      this.state.levelNum = 1;
      this.toIntro();
    }
  }

  private _updateIntro(): void {
    this.state.introTimer--;
    if (this.state.introTimer <= 0) {
      this.toPlaying();
    }
  }

  private _updatePlaying(input: InputSnapshot): void {
    if (input.start) {
      this.toPaused();
      return;
    }

    // Time countdown — 1/60 second per frame
    this.state.time -= 1 / 60;

    // Hurry mode trigger
    if (!this.state.hurryMode && this.state.time <= HURRY_TIME) {
      this.state.hurryMode = true;
      if (this.callbacks.onHurryMode) this.callbacks.onHurryMode();
    }

    // Time runs out → kill Mario
    if (this.state.time <= 0) {
      this.state.time = 0;
      this.triggerDeath();
    }
  }

  private _updatePaused(input: InputSnapshot): void {
    if (input.start) {
      this.toUnpaused();
    }
  }

  private _updateDeath(): void {
    this.state.introTimer--;
    if (this.state.introTimer <= 0) {
      this.state.lives--;
      if (this.callbacks.onLivesLost) this.callbacks.onLivesLost();

      if (this.state.lives <= 0) {
        this.toGameOver();
        if (this.callbacks.onGameOver) this.callbacks.onGameOver();
      } else {
        this.toIntro();
      }
    }
  }

  private _updateWin(): void {
    this.state.winTimer--;
    if (this.state.winTimer <= 0) {
      this.toNextLevel();
    }
  }

  private _updateGameOver(): void {
    this.state.gameoverTimer--;
    if (this.state.gameoverTimer <= 0) {
      this.toTitle();
    }
  }

  // ─── Scoring ──────────────────────────────────────────────────────────────────

  /**
   * Add points to score. Score wraps at 999999 → 0 on next increment.
   */
  addScore(points: number): void {
    if (points <= 0) return;

    if (this.state.score === 999_999) {
      // Wrap: next increment after maxing out resets to 0
      this.state.score = Math.min(points, 999_999);
    } else {
      this.state.score = Math.min(this.state.score + points, 999_999);
    }
  }

  /**
   * Add a coin. At 100 coins, award an extra life and reset to 0.
   */
  addCoin(): void {
    this.addScore(SCORE.COIN);
    this.state.coins++;
    if (this.state.coins >= 100) {
      this.state.coins = 0;
      this.awardExtraLife();
    }
  }

  /**
   * Award an extra life.
   */
  awardExtraLife(): void {
    this.state.lives++;
    if (this.callbacks.onExtraLife) this.callbacks.onExtraLife();
  }

  // ─── Stomp Combo ─────────────────────────────────────────────────────────────

  /**
   * Called when Mario stomps an enemy while airborne.
   * Returns points to award (or 0 if awarding a life instead).
   * At stomp 9+: award an extra life instead of points.
   */
  onStomp(): number {
    this.state.stompCombo++;
    const comboIndex = Math.min(this.state.stompCombo - 1, STOMP_COMBO_POINTS.length - 1);

    if (this.state.stompCombo >= 9) {
      this.awardExtraLife();
      return 0;
    }

    const pts = STOMP_COMBO_POINTS[comboIndex];
    this.addScore(pts);
    return pts;
  }

  /**
   * Called when Mario lands on the ground. Resets stomp combo.
   */
  onLand(): void {
    this.state.stompCombo = 0;
  }

  // ─── Death Trigger ────────────────────────────────────────────────────────────

  /**
   * Trigger Mario's death sequence (called from WorldScene when pit or enemy kills).
   */
  triggerDeath(): void {
    if (this.state.screen !== Screen.PLAYING) return;
    this.toDeath();
  }

  // ─── Queries ─────────────────────────────────────────────────────────────────

  get isPlaying(): boolean {
    return this.state.screen === Screen.PLAYING;
  }

  get isPaused(): boolean {
    return this.state.screen === Screen.PAUSED;
  }

  get isDeath(): boolean {
    return this.state.screen === Screen.DEATH;
  }

  get isWin(): boolean {
    return this.state.screen === Screen.WIN;
  }
}
