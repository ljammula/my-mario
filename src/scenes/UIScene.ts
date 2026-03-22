/**
 * UIScene.ts
 * Parallel HUD scene — runs alongside WorldScene, renders score/coins/world/timer
 * and screen overlays (title, pause, game over).
 *
 * All positions are in canvas coordinates (512×480 px).
 * This scene's camera is unzoomed and fixed, so canvas coords map 1:1 to pixels.
 */

import { Screen } from '../types/entities';
import { hudData } from '../state/hudData';

// Canvas dimensions
const CW = 512;
const CH = 480;

// HUD bar height (top strip)
const HUD_H = 48;

// Font style shared across HUD labels
const FONT_LABEL: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '14px',
  color: '#ffffff',
  resolution: 2,
};
const FONT_VALUE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '16px',
  color: '#ffffff',
  resolution: 2,
};
const FONT_OVERLAY: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '24px',
  color: '#ffffff',
  resolution: 2,
};
const FONT_SUBTITLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '14px',
  color: '#ffffff',
  resolution: 2,
};

export class UIScene extends Phaser.Scene {
  // HUD bar
  private hudBg!:       Phaser.GameObjects.Rectangle;
  // HUD text
  private scoreLabel!:  Phaser.GameObjects.Text;
  private scoreValue!:  Phaser.GameObjects.Text;
  private coinLabel!:   Phaser.GameObjects.Text;
  private coinValue!:   Phaser.GameObjects.Text;
  private worldLabel!:  Phaser.GameObjects.Text;
  private worldValue!:  Phaser.GameObjects.Text;
  private timeLabel!:   Phaser.GameObjects.Text;
  private timeValue!:   Phaser.GameObjects.Text;
  // Overlays
  private overlay!:     Phaser.GameObjects.Rectangle;
  private titleText!:   Phaser.GameObjects.Text;
  private subtitleText!:Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    this.cameras.main.setScroll(0, 0);
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    // ── HUD bar background ─────────────────────────────────────────────────
    this.hudBg = this.add.rectangle(0, 0, CW, HUD_H, 0x000000, 1)
      .setOrigin(0, 0).setDepth(100);

    // ── HUD labels and values ──────────────────────────────────────────────
    this.scoreLabel  = this.add.text(24,  8, 'MARIO',   FONT_LABEL).setDepth(101);
    this.scoreValue  = this.add.text(24, 24, '000000',  FONT_VALUE).setDepth(101);

    this.coinLabel   = this.add.text(196, 8,  '×',      FONT_LABEL).setDepth(101);
    this.coinValue   = this.add.text(212, 24, '×00',    FONT_VALUE).setDepth(101);

    this.worldLabel  = this.add.text(296, 8,  'WORLD',  FONT_LABEL).setDepth(101);
    this.worldValue  = this.add.text(308, 24, '1-1',    FONT_VALUE).setDepth(101);

    this.timeLabel   = this.add.text(400, 8,  'TIME',   FONT_LABEL).setDepth(101);
    this.timeValue   = this.add.text(412, 24, '400',    FONT_VALUE).setDepth(101);

    // ── Full-screen overlay (title / pause / game over) ────────────────────
    this.overlay = this.add.rectangle(0, 0, CW, CH, 0x000000, 0.75)
      .setOrigin(0, 0).setDepth(200).setVisible(false);

    this.titleText = this.add.text(CW / 2, CH / 2 - 40, 'SUPER MARIO BROS', FONT_OVERLAY)
      .setOrigin(0.5, 0.5).setDepth(201).setVisible(false);

    this.subtitleText = this.add.text(CW / 2, CH / 2 + 10, '', FONT_SUBTITLE)
      .setOrigin(0.5, 0.5).setDepth(201).setVisible(false);
  }

  update(_time: number, _delta: number): void {
    // ── HUD values ──────────────────────────────────────────────────────────
    this.scoreValue.setText(String(hudData.score).padStart(6, '0'));
    this.coinValue.setText(`×${String(hudData.coins).padStart(2, '0')}`);
    this.worldValue.setText(hudData.world);
    this.timeValue.setText(String(hudData.time));

    // Flash time red when hurry mode
    this.timeValue.setColor(hudData.hurry ? '#ff4040' : '#ffffff');

    // ── Screen overlays ─────────────────────────────────────────────────────
    const screen = hudData.screen;

    switch (screen) {
      case Screen.TITLE:
        this._showOverlay('SUPER MARIO BROS', 'PRESS ENTER TO START');
        break;
      case Screen.PAUSED:
        this._showOverlay('PAUSED', 'PRESS ENTER TO RESUME');
        break;
      case Screen.GAMEOVER:
        this._showOverlay('GAME OVER', '');
        break;
      case Screen.WIN:
        this._showOverlay('YOU WIN!', 'PRESS ENTER TO CONTINUE');
        break;
      case Screen.DEATH:
        // Show lives remaining briefly; no big overlay
        this._hideOverlay();
        break;
      default:
        this._hideOverlay();
        break;
    }
  }

  private _showOverlay(title: string, subtitle: string): void {
    this.overlay.setVisible(true);
    this.titleText.setText(title).setVisible(true);
    this.subtitleText.setText(subtitle).setVisible(subtitle.length > 0);
  }

  private _hideOverlay(): void {
    this.overlay.setVisible(false);
    this.titleText.setVisible(false);
    this.subtitleText.setVisible(false);
  }
}
