/**
 * HUDScene.ts
 * SE2 — Parallel Phaser scene that renders the HUD every frame.
 *
 * Renders on top of WorldScene using Phaser scene layering.
 * Reads from a shared `hudData` object written by WorldScene each frame.
 *
 * Layout (canvas px, 512×48 bar):
 *   "MARIO"  label  @ x=24,  y=16
 *   Score (6 digits) @ x=24,  y=32
 *   Coin icon        @ x=200, y=16
 *   "×" char         @ x=214, y=16
 *   Coin count (2d)  @ x=228, y=16
 *   "WORLD" label    @ x=312, y=16
 *   World "1-1"      @ x=318, y=32
 *   "TIME" label     @ x=424, y=16
 *   Time (3 digits)  @ x=430, y=32
 *
 * Font: 8×8 logical → 16×16 canvas (2× scale).
 * White text, 1px black shadow at (+1, +1).
 */

import * as SpriteRegistry from '../systems/SpriteRegistry';
import { CANVAS_WIDTH, HUD } from '../config/constants';

// Module-level constant — allocated once, not per _charKey() call (FIX-13)
const LETTER_MAP: Record<string, string> = {
  M: 'letter_M', A: 'letter_A', R: 'letter_R', I: 'letter_I',
  O: 'letter_O', W: 'letter_W', L: 'letter_L', D: 'letter_D',
  T: 'letter_T', E: 'letter_E', C: 'letter_C', N: 'letter_N',
  G: 'letter_G', V: 'letter_V', P: 'letter_P', U: 'letter_U',
  S: 'letter_S', B: 'letter_B', X: 'letter_X',
};

// ── Shared HUD data ───────────────────────────────────────────────────────────
// Imported from the single source of truth; WorldScene writes, HUDScene reads.
import { hudData } from '../state/hudData';
export type { HudData } from '../state/hudData';

// ── Pixel font glyph size (canvas px) ────────────────────────────────────────

const GLYPH_W = 16;   // 8 logical × 2 scale
const GLYPH_H = 16;

// ── HUDScene ──────────────────────────────────────────────────────────────────

export class HUDScene extends Phaser.Scene {
  // Background black bar
  private bar!: Phaser.GameObjects.Rectangle;

  // Pre-allocated Image objects for each character slot
  private scoreImages:  Phaser.GameObjects.Image[] = [];
  private coinImages:   Phaser.GameObjects.Image[] = [];
  private worldImages:  Phaser.GameObjects.Image[] = [];
  private timeImages:   Phaser.GameObjects.Image[] = [];

  // Static label images (never change content)
  private labelImages:  Phaser.GameObjects.Image[] = [];
  private coinIcon!:    Phaser.GameObjects.Image;
  private timesIcon!:   Phaser.GameObjects.Image;

  // Shadow (black duplicate behind each label/value)
  private shadowGroup!: Phaser.GameObjects.Group;

  // Track last rendered values to skip redundant texture swaps
  private lastScore = -1;
  private lastCoins = -1;
  private lastWorld = '';
  private lastTime  = -1;

  constructor() {
    super({ key: 'HUDScene' });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  create(): void {
    // Black HUD bar — full canvas width, 48 canvas px tall
    this.bar = this.add.rectangle(0, 0, CANVAS_WIDTH, HUD.HEIGHT_C, 0x000000);
    this.bar.setOrigin(0, 0);
    this.bar.setDepth(10);

    // Score: 6 digit slots at (SCORE_X_C, VALUE_Y_C)
    for (let i = 0; i < 6; i++) {
      const x = HUD.SCORE_X_C + i * GLYPH_W;
      const img = this._makeGlyph(x, HUD.VALUE_Y_C, 'digit_0');
      this.scoreImages.push(img);
    }

    // Coin icon
    this.coinIcon = this._makeGlyph(HUD.COIN_ICON_X_C, HUD.LABEL_Y_C, 'hud_coin_icon');

    // "×" separator — use letter_X as times sign
    this.timesIcon = this._makeGlyph(HUD.COINX_X_C, HUD.LABEL_Y_C, 'letter_X');

    // Coin count: 2 digit slots
    for (let i = 0; i < 2; i++) {
      const x = HUD.COIN_CNT_X_C + i * GLYPH_W;
      const img = this._makeGlyph(x, HUD.LABEL_Y_C, 'digit_0');
      this.coinImages.push(img);
    }

    // "MARIO" label
    this._makeLabel('MARIO', HUD.MARIO_X_C, HUD.LABEL_Y_C);

    // "WORLD" label
    this._makeLabel('WORLD', HUD.WORLD_X_C, HUD.LABEL_Y_C);

    // World value: up to 3 chars "1-1" — we'll use 3 image slots (digits + dash)
    // Allocate 5 slots for "W-W" style (max "8-4")
    for (let i = 0; i < 5; i++) {
      const x = HUD.WORLD_VAL_X_C + i * GLYPH_W;
      const img = this._makeGlyph(x, HUD.VALUE_Y_C, 'digit_0');
      img.setVisible(false);
      this.worldImages.push(img);
    }

    // "TIME" label
    this._makeLabel('TIME', HUD.TIME_X_C, HUD.LABEL_Y_C);

    // Time: 3 digit slots
    for (let i = 0; i < 3; i++) {
      const x = HUD.TIME_VAL_X_C + i * GLYPH_W;
      const img = this._makeGlyph(x, HUD.VALUE_Y_C, 'digit_0');
      this.timeImages.push(img);
    }

    // Force initial render
    this.lastScore = -1;
    this.lastCoins = -1;
    this.lastWorld = '';
    this.lastTime  = -1;
    this._renderAll();
  }

  update(): void {
    this._renderAll();
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  private _renderAll(): void {
    const d = hudData;

    if (d.score !== this.lastScore) {
      this._renderNumber(this.scoreImages, d.score, 6, true);
      this.lastScore = d.score;
    }

    if (d.coins !== this.lastCoins) {
      this._renderNumber(this.coinImages, d.coins, 2, true);
      this.lastCoins = d.coins;
    }

    if (d.world !== this.lastWorld) {
      this._renderWorld(d.world);
      this.lastWorld = d.world;
    }

    if (d.time !== this.lastTime) {
      this._renderNumber(this.timeImages, Math.max(0, Math.floor(d.time)), 3, true);
      this.lastTime = d.time;
    }
  }

  /** Render an integer into an array of digit Image slots, right-aligned, zero-padded. */
  private _renderNumber(
    slots:    Phaser.GameObjects.Image[],
    value:    number,
    digits:   number,
    zeroPad:  boolean,
  ): void {
    const str = Math.min(value, Math.pow(10, digits) - 1)
      .toFixed(0)
      .padStart(digits, zeroPad ? '0' : ' ');

    for (let i = 0; i < slots.length; i++) {
      const ch = str[i] ?? '0';
      if (ch === ' ') {
        slots[i].setVisible(false);
      } else {
        slots[i].setTexture(`digit_${ch}`);
        slots[i].setVisible(true);
      }
    }
  }

  /** Render the world string "1-1" into worldImages. */
  private _renderWorld(world: string): void {
    // world = "1-1"  → chars: '1', '-', '1'
    // Map '-' to a narrow dash using digit glyphs/X; use letter glyphs for letters
    const chars = world.split('');
    for (let i = 0; i < this.worldImages.length; i++) {
      const img = this.worldImages[i];
      if (i >= chars.length) {
        img.setVisible(false);
        continue;
      }
      const ch = chars[i];
      const key = this._charKey(ch);
      if (key) {
        img.setTexture(key);
        img.setVisible(true);
      } else {
        img.setVisible(false);
      }
    }
  }

  /** Map a character to a sprite key in the registry. */
  private _charKey(ch: string): string | null {
    if (ch >= '0' && ch <= '9') return `digit_${ch}`;
    if (ch === '-') return 'letter_I'; // use 'I' shape as dash approximation (narrow vertical)
    const upper = ch.toUpperCase();
    return LETTER_MAP[upper] ?? null;
  }

  // ── Factory helpers ───────────────────────────────────────────────────────

  /** Create a single Image glyph at the given canvas position. */
  private _makeGlyph(cx: number, cy: number, key: string): Phaser.GameObjects.Image {
    const img = this.add.image(cx, cy, key);
    img.setOrigin(0, 0);
    img.setDisplaySize(GLYPH_W, GLYPH_H);
    img.setDepth(11);
    return img;
  }

  /**
   * Create a row of letter Images for a static label string.
   * Also creates a 1px shadow offset copy behind each letter.
   */
  private _makeLabel(text: string, startX: number, y: number): void {
    for (let i = 0; i < text.length; i++) {
      const key = this._charKey(text[i]);
      if (!key) continue;
      const x = startX + i * GLYPH_W;

      // Shadow (black tint, +1,+1 offset)
      const shadow = this.add.image(x + 1, y + 1, key);
      shadow.setOrigin(0, 0);
      shadow.setDisplaySize(GLYPH_W, GLYPH_H);
      shadow.setTint(0x000000);
      shadow.setDepth(10);
      this.labelImages.push(shadow);

      // Foreground
      const img = this._makeGlyph(x, y, key);
      img.setDepth(11);
      this.labelImages.push(img);
    }
  }
}
