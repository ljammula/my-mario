/**
 * SpriteRegistry.ts
 * SE2 — sprite baking system.
 *
 * At startup, bakes all NES palette-indexed RLE sprites into Phaser RenderTextures.
 * Zero per-frame allocation. All textures are pre-baked in initRegistry().
 *
 * API:
 *   initRegistry(scene)       — bakes all textures, must be called in PreloadScene.create()
 *   getTexture(key)           — returns Phaser.Textures.Texture by key
 *   getFrame(key)             — returns { width, height } for a sprite key
 */

import { SPRITE_DEFS, NES_PALETTE, decodeRLE, SpriteDef } from './SpriteData';

let _scene: Phaser.Scene | null = null;

// ── Internal baking ───────────────────────────────────────────────────────────

/**
 * Convert a SpriteDef (RLE + dimensions) into a Phaser texture.
 * Draws to a RenderTexture pixel-by-pixel using Graphics fill calls,
 * then takes a snapshot into the texture cache.
 *
 * We use Graphics objects (1×1 fillRect per pixel) rather than ImageData
 * because Phaser's WebGL renderer does not expose raw pixel writes.
 */
function bakeSprite(scene: Phaser.Scene, key: string, def: SpriteDef): void {
  if (scene.textures.exists(key)) return;

  const { width, height, rle } = def;
  const pixels = decodeRLE(rle, width, height);

  // Create a RenderTexture of the correct size
  const rt = scene.add.renderTexture(0, 0, width, height);

  // Use a Graphics object to draw each non-transparent pixel
  const gfx = scene.add.graphics();

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const paletteIdx = pixels[row][col];
      if (paletteIdx === 0) continue; // transparent

      const hexStr = NES_PALETTE[paletteIdx];
      const colorNum = parseInt(hexStr.replace('#', ''), 16);

      gfx.clear();
      gfx.fillStyle(colorNum, 1);
      gfx.fillRect(0, 0, 1, 1);

      rt.draw(gfx, col, row);
    }
  }

  gfx.destroy();

  // Save to texture cache under the key
  rt.saveTexture(key);

  // Remove the render texture display object (texture is now in cache)
  rt.destroy();
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialize the registry: bake all sprites into the Phaser texture cache.
 * Call this once in PreloadScene.create() before starting WorldScene.
 */
export function initRegistry(scene: Phaser.Scene): void {
  _scene = scene;

  const keys = Object.keys(SPRITE_DEFS);
  for (const key of keys) {
    bakeSprite(scene, key, SPRITE_DEFS[key]);
  }
}

/**
 * Retrieve a baked texture by sprite key.
 * Throws if the registry has not been initialized or the key is unknown.
 */
export function getTexture(key: string): Phaser.Textures.Texture {
  if (!_scene) {
    throw new Error(`SpriteRegistry: scene not initialized. Call initRegistry() first.`);
  }
  if (!_scene.textures.exists(key)) {
    throw new Error(`SpriteRegistry: texture '${key}' not found. Check SpriteData.ts SPRITE_DEFS.`);
  }
  return _scene.textures.get(key);
}

/**
 * Return pixel dimensions for a sprite key.
 * Safe to call after initRegistry().
 */
export function getFrame(key: string): { width: number; height: number } {
  const def = SPRITE_DEFS[key];
  if (!def) {
    throw new Error(`SpriteRegistry: no SpriteDef for key '${key}'.`);
  }
  return { width: def.width, height: def.height };
}

/**
 * Check whether a texture key has been registered (safe query without throwing).
 */
export function hasTexture(key: string): boolean {
  return _scene !== null && _scene.textures.exists(key);
}
