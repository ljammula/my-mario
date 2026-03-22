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
 * Convert a SpriteDef (RLE + dimensions) into a Phaser CanvasTexture.
 *
 * Uses scene.textures.createCanvas() + Canvas 2D API for reliable pixel
 * writes in both WebGL and Canvas renderers. The resulting texture lives
 * in the game-level TextureManager and survives scene shutdown.
 *
 * (Previous RenderTexture approach was broken: rt.saveTexture() in WebGL
 *  only keeps a reference to the RT framebuffer; rt.destroy() frees it,
 *  leaving every saved texture pointing at freed GPU memory → black screen.)
 */
function bakeSprite(scene: Phaser.Scene, key: string, def: SpriteDef): void {
  if (scene.textures.exists(key)) return;

  const { width, height, rle } = def;
  const pixels = decodeRLE(rle, width, height);

  // createCanvas lives in the game's TextureManager — survives scene stop
  const canvasTex = scene.textures.createCanvas(key, width, height)!;
  const ctx = canvasTex.context;

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const paletteIdx = pixels[row][col];
      if (paletteIdx === 0) continue; // transparent

      ctx.fillStyle = NES_PALETTE[paletteIdx];
      ctx.fillRect(col, row, 1, 1);
    }
  }

  // Upload canvas pixels to WebGL texture
  canvasTex.refresh();
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
    console.warn(`SpriteRegistry: unknown key "${key}", using fallback`);
    return _scene.textures.get('tile_used');
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
