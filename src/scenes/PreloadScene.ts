/**
 * PreloadScene.ts
 * Asset loading scene. SE2 owns sprite baking; SE1 owns the scene lifecycle scaffold.
 *
 * In v2, all assets are procedurally generated as pixel arrays and baked
 * into Phaser RenderTextures by SE2's SpriteRegistry system.
 * There are no external image files to load.
 *
 * Sequence:
 * 1. Show loading progress (optional — procedural generation is fast).
 * 2. Call SE2's sprite baking system to generate all textures.
 * 3. Initialize SpriteRegistry with this scene.
 * 4. Start WorldScene and UIScene.
 */

import { initRegistry } from '../systems/SpriteRegistry';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    // No external file assets — all sprites are procedurally generated
  }

  create(): void {
    // Initialize SpriteRegistry — bakes ALL NES sprite textures into Phaser cache.
    // Must be called before WorldScene starts. Zero per-frame allocation after this.
    initRegistry(this);

    // Start the main gameplay scene and the parallel HUD scene
    this.scene.start('WorldScene');
    this.scene.launch('UIScene');
  }
}
