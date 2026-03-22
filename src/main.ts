/**
 * main.ts
 * Phaser.Game configuration and entry point for Super Mario Bros v2.
 *
 * Canvas: 512×480 (NES 256×240 at 2× scale).
 * Scenes: BootScene → PreloadScene → WorldScene + UIScene (parallel).
 *
 * Physics: custom AABB — Phaser arcade physics is NOT used.
 * Rendering: pixelArt mode enabled globally.
 */

import Phaser from 'phaser';
import { BootScene }    from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { WorldScene }   from './scenes/WorldScene';
import { UIScene }      from './scenes/UIScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 512,
  height: 480,
  backgroundColor: '#000000',
  pixelArt: true,
  scene: [BootScene, PreloadScene, WorldScene, UIScene],
  physics: {
    // Arcade physics explicitly disabled — we use custom AABB
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  render: {
    antialias: false,
    pixelArt: true,
    roundPixels: true,
  },
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  audio: {
    disableWebAudio: false,  // SE2 uses Web Audio API directly for procedural synthesis
  },
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const game = new Phaser.Game(config);
